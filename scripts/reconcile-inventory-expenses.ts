/**
 * Retroactive reconciliation tool for inventory stock-in expenses.
 *
 * Every inventory stock-in movement (new item creation or restock) is
 * recorded as one row in `inventory_batches`, and MUST have exactly one
 * linked expense in `spese` (categoria = "Inventario", nonEliminabile = 1)
 * whose `importo` equals `quantitaIniziale * costo` of that batch. The
 * `inventory_batches.spesa_id` column is the durable link between the two
 * (see add-inventory-batch-expense-link.sql).
 *
 * This script finds and repairs historical drift between batches and
 * expenses that predates that durable link (or was caused by the previous
 * weighted-average-cost bug). It is SAFE to run repeatedly:
 *
 *   - DRY-RUN BY DEFAULT: it only prints a report unless you pass --apply.
 *   - IDEMPOTENT: once a batch is linked/created, re-running finds nothing
 *     left to do for it.
 *   - NEVER TOUCHES MANUAL EXPENSES: only `spese` rows with
 *     categoria = "Inventario" are ever considered or modified - manual
 *     expense categories are "Fisse", "Utenze", "Marketing", "Altro" and are
 *     never touched (see client/src/components/modals/add-expense-modal.tsx,
 *     which never lets a user pick "Inventario" as a category).
 *   - AMBIGUOUS CASES ARE NEVER GUESSED: if more than one unlinked expense
 *     could plausibly match a batch, it is flagged for manual review instead
 *     of being auto-linked.
 *
 * Usage:
 *   npx tsx scripts/reconcile-inventory-expenses.ts                # dry-run report
 *   npx tsx scripts/reconcile-inventory-expenses.ts --apply         # apply fixes
 *   npx tsx scripts/reconcile-inventory-expenses.ts --activity=<id> # scope to one activity
 *
 * BACKUP / ROLLBACK:
 *   Before running with --apply against production data, take a database
 *   snapshot/backup first (e.g. `pg_dump $DATABASE_URL > backup_before_reconcile.sql`).
 *   Every write this script performs is one of:
 *     (a) INSERT a new `spese` row + UPDATE inventory_batches.spesa_id (missing case)
 *     (b) UPDATE inventory_batches.spesa_id only (linking case, no data destroyed)
 *     (c) UPDATE spese.importo on an existing generated expense (amount-mismatch case)
 *   None of these delete rows, so rollback is always possible by restoring the
 *   backup, or by manually clearing the specific `inventory_batches.spesa_id` /
 *   `spese.importo` values reported in the summary printed by this script.
 */

import { db } from "../server/db";
import { eq, and } from "drizzle-orm";
import { inventario, spese } from "@shared/schema";
import { computeStockInAmount } from "../server/inventoryAccounting";

interface BatchRow {
  id: string;
  inventarioId: string;
  activityId: string;
  userId: string;
  costo: string;
  quantitaIniziale: number;
  dataAcquisto: string | null;
  spesaId: string | null;
}

interface ExpenseRow {
  id: string;
  activityId: string;
  voce: string;
  importo: string;
  itemId: string | null;
  nonEliminabile: number | null;
  data: Date | string | null;
}

interface Summary {
  created: number;
  corrected: number;
  linked: number;
  ambiguous: string[];
  orphanExpenses: string[];
  skippedOk: number;
}

function centsEqual(a: string | number, b: string | number): boolean {
  return Math.round(Number(a) * 100) === Math.round(Number(b) * 100);
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const activityArg = args.find((a) => a.startsWith("--activity="));
  const activityFilter = activityArg ? activityArg.split("=")[1] : null;

  const { inventoryBatches } = await import("../migrations/schema");

  const batches: BatchRow[] = (await db
    .select()
    .from(inventoryBatches)
    .where(activityFilter ? eq(inventoryBatches.activityId, activityFilter) : undefined as any)) as any;

  const inventoryExpenses: ExpenseRow[] = (await db
    .select()
    .from(spese)
    .where(
      activityFilter
        ? and(eq(spese.categoria, "Inventario"), eq(spese.activityId, activityFilter))
        : eq(spese.categoria, "Inventario")
    )) as any;

  const items = await db.select().from(inventario);
  const itemsById = new Map(items.map((i) => [i.id, i]));

  const expenseById = new Map(inventoryExpenses.map((e) => [e.id, e]));
  const usedExpenseIds = new Set<string>();

  const summary: Summary = {
    created: 0,
    corrected: 0,
    linked: 0,
    ambiguous: [],
    orphanExpenses: [],
    skippedOk: 0,
  };

  for (const batch of batches) {
    const expectedAmount = computeStockInAmount(batch.quantitaIniziale, Number(batch.costo));
    const item = itemsById.get(batch.inventarioId);
    const itemLabel = item ? `${item.nomeArticolo}${item.taglia ? " - " + item.taglia : ""}` : batch.inventarioId;

    // Case 1: already linked - verify amount, correct if it drifted.
    if (batch.spesaId) {
      const linked = expenseById.get(batch.spesaId);
      if (!linked) {
        summary.ambiguous.push(
          `Batch ${batch.id} (${itemLabel}): spesa_id=${batch.spesaId} punta a una spesa inesistente - richiede revisione manuale.`
        );
        continue;
      }
      usedExpenseIds.add(linked.id);
      if (!centsEqual(linked.importo, expectedAmount)) {
        console.log(
          `[${apply ? "APPLY" : "DRY-RUN"}] Correggo importo spesa ${linked.id} (${itemLabel}): ${linked.importo} -> ${expectedAmount}`
        );
        if (apply) {
          await db.update(spese).set({ importo: expectedAmount }).where(eq(spese.id, linked.id));
        }
        summary.corrected++;
      } else {
        summary.skippedOk++;
      }
      continue;
    }

    // Case 2: not linked yet - look for a plausible unlinked candidate.
    const candidates = inventoryExpenses.filter((e) => {
      if (usedExpenseIds.has(e.id)) return false;
      if (e.itemId && e.itemId !== batch.inventarioId) return false;
      if (!centsEqual(e.importo, expectedAmount)) return false;
      if (batch.dataAcquisto && e.data) {
        const batchDate = new Date(batch.dataAcquisto);
        const expenseDate = new Date(e.data);
        if (daysBetween(batchDate, expenseDate) > 2) return false;
      }
      return true;
    });

    if (candidates.length === 1) {
      const match = candidates[0];
      usedExpenseIds.add(match.id);
      console.log(`[${apply ? "APPLY" : "DRY-RUN"}] Collego batch ${batch.id} (${itemLabel}) -> spesa esistente ${match.id}`);
      if (apply) {
        await db
          .update(inventoryBatches)
          .set({ spesaId: match.id })
          .where(eq(inventoryBatches.id, batch.id));
        if (!match.itemId || match.nonEliminabile !== 1) {
          await db
            .update(spese)
            .set({ itemId: batch.inventarioId, nonEliminabile: 1 })
            .where(eq(spese.id, match.id));
        }
      }
      summary.linked++;
      continue;
    }

    if (candidates.length > 1) {
      summary.ambiguous.push(
        `Batch ${batch.id} (${itemLabel}, importo atteso ${expectedAmount}): ${candidates.length} spese candidate corrispondenti - richiede revisione manuale (nessuna modifica applicata).`
      );
      continue;
    }

    // Case 3: genuinely missing - create it from the batch's own historical data.
    console.log(
      `[${apply ? "APPLY" : "DRY-RUN"}] Creo spesa mancante per batch ${batch.id} (${itemLabel}): importo ${expectedAmount}`
    );
    if (apply) {
      const [created] = await db
        .insert(spese)
        .values({
          userId: batch.userId,
          activityId: batch.activityId,
          voce: `Rifornimento (riconciliato): ${itemLabel} (${batch.quantitaIniziale} pz)`,
          importo: expectedAmount,
          categoria: "Inventario",
          nonEliminabile: 1,
          itemId: batch.inventarioId,
          data: batch.dataAcquisto ? new Date(batch.dataAcquisto) : new Date(),
        })
        .returning();
      await db.update(inventoryBatches).set({ spesaId: created.id }).where(eq(inventoryBatches.id, batch.id));
    }
    summary.created++;
  }

  // Any "Inventario" expense never claimed by a batch is orphaned/duplicate - flag only.
  for (const e of inventoryExpenses) {
    if (!usedExpenseIds.has(e.id)) {
      summary.orphanExpenses.push(`Spesa ${e.id} ("${e.voce}", importo ${e.importo}) non corrisponde a nessun lotto - richiede revisione manuale.`);
    }
  }

  console.log("\n=== Riepilogo riconciliazione inventario/spese ===");
  console.log(`Modalità: ${apply ? "APPLY (modifiche scritte)" : "DRY-RUN (nessuna modifica scritta)"}`);
  console.log(`Batch già corretti: ${summary.skippedOk}`);
  console.log(`Spese create: ${summary.created}`);
  console.log(`Importi corretti: ${summary.corrected}`);
  console.log(`Batch collegati a spese esistenti: ${summary.linked}`);
  console.log(`Casi ambigui (nessuna modifica, revisione manuale): ${summary.ambiguous.length}`);
  for (const line of summary.ambiguous) console.log(`  - ${line}`);
  console.log(`Spese "Inventario" orfane (nessun lotto corrispondente): ${summary.orphanExpenses.length}`);
  for (const line of summary.orphanExpenses) console.log(`  - ${line}`);

  if (!apply && (summary.created > 0 || summary.corrected > 0 || summary.linked > 0)) {
    console.log("\nEsegui di nuovo con --apply per applicare le correzioni sopra elencate.");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Errore durante la riconciliazione:", err);
  process.exit(1);
});
