// Single source of truth for "inventory stock-in generates exactly one expense" accounting.
//
// Every code path that increases inventory quantity (new item creation, restock,
// or an edit that raises the quantity) MUST go through `recordInventoryStockIn`
// inside the SAME database transaction that writes the inventory row. This keeps
// warehouse movements, generated expenses and the balance in sync and makes the
// retroactive reconciliation tool (scripts/reconcile-inventory-expenses.ts) able
// to reason about a single, predictable shape of data.
//
// Rules enforced here (see problem statement for the full rationale):
//  - amount = quantita * costoUnitario of THIS movement, never the item's
//    post-update weighted-average cost;
//  - decimal-safe arithmetic (integer cents) to avoid floating point drift;
//  - exactly one linked "spese" row per batch (categoria "Inventario",
//    nonEliminabile=1, itemId=inventarioId, and a durable batch<->expense link
//    via inventory_batches.spesa_id, unique);
//  - idempotent: a repeated call with the same idempotencyKey returns the
//    existing batch/expense instead of creating a duplicate.
//  - production material purchases/refills are NOT affected: they already have
//    their own, separate accounting flow in server/production.ts (categoria
//    "produzione") and never call this module.

import { eq, and } from "drizzle-orm";
import { spese } from "@shared/schema";

export class InventoryAccountingError extends Error {}

export interface StockInParams {
  inventarioId: string;
  activityId: string;
  userId: string;
  nomeArticolo: string;
  taglia?: string | null;
  quantita: number;
  costoUnitario: number;
  voce?: string;
  data?: Date;
  idempotencyKey?: string | null;
}

export interface StockInResult {
  batch: any;
  expense: any;
  deduplicated: boolean;
  fromCassa: number;
}

/**
 * How much of a stock-in expense the reinvestment cash box can cover, clamped
 * to [0, importo] and never negative even if the balance itself is negative.
 * Pure function so the clamping logic can be unit-tested without a database.
 */
export function clampCassaCoverage(cassaBalance: number, importo: number): number {
  return Math.min(Math.max(cassaBalance, 0), importo);
}

/**
 * Computes quantita * costoUnitario using integer cents to avoid floating point
 * drift, returning a fixed 2-decimal string suitable for a numeric(10,2) column.
 * Throws InventoryAccountingError for non-positive/invalid inputs.
 */
export function computeStockInAmount(quantita: number, costoUnitario: number): string {
  if (!Number.isFinite(quantita) || quantita <= 0) {
    throw new InventoryAccountingError("Quantità non valida: deve essere un numero intero positivo");
  }
  if (!Number.isInteger(quantita)) {
    throw new InventoryAccountingError("Quantità non valida: deve essere un numero intero");
  }
  if (!Number.isFinite(costoUnitario) || costoUnitario <= 0) {
    throw new InventoryAccountingError("Costo unitario non valido: deve essere un numero positivo");
  }

  const unitCents = Math.round(costoUnitario * 100);
  const totalCents = unitCents * quantita;
  return (totalCents / 100).toFixed(2);
}

/**
 * Atomically records one inventory stock-in movement: a "spese" row (the
 * generated expense) and an "inventory_batches" row linked to it via spesa_id.
 * Must be called with the transactional db handle (`trx`) obtained from
 * `db.transaction(async (trx) => { ... })` so that the batch, the expense and
 * the caller's inventory quantity update all succeed or fail together.
 *
/** Transactional (or plain) drizzle db client used for reads/writes in this module. */
export type DbClient = any;

export interface StockInDeps {
  getCassaReinvestimentoBalance: (activityId: string, dbClient: DbClient) => Promise<number>;
  updateCassaReinvestimento: (
    activityId: string,
    amount: number,
    descrizione: string,
    userId: string,
    dbClient: DbClient
  ) => Promise<any>;
}

/**
 * Atomically records one inventory stock-in movement: a "spese" row (the
 * generated expense) and an "inventory_batches" row linked to it via spesa_id.
 * Must be called with the transactional db handle (`trx`) obtained from
 * `db.transaction(async (trx) => { ... })` so that the batch, the expense and
 * the caller's inventory quantity update all succeed or fail together.
 *
 * `deps` is only for unit tests, so `getCassaReinvestimentoBalance`/
 * `updateCassaReinvestimento` can be stubbed without a real database; callers
 * in application code should omit it and let it default to the real storage
 * module.
 */
export async function recordInventoryStockIn(
  trx: DbClient,
  params: StockInParams,
  deps?: StockInDeps
): Promise<StockInResult> {
  const { inventoryBatches } = await import("../migrations/schema");

  // Idempotency: a retried/duplicated request with the same key returns the
  // previously created batch+expense instead of creating a new one.
  if (params.idempotencyKey) {
    const [existingBatch] = await trx
      .select()
      .from(inventoryBatches)
      .where(
        and(
          eq(inventoryBatches.inventarioId, params.inventarioId),
          eq(inventoryBatches.idempotencyKey, params.idempotencyKey)
        )
      );

    if (existingBatch) {
      let existingExpense: any = undefined;
      if (existingBatch.spesaId) {
        [existingExpense] = await trx.select().from(spese).where(eq(spese.id, existingBatch.spesaId));
      }
      return {
        batch: existingBatch,
        expense: existingExpense,
        deduplicated: true,
        fromCassa: Number(existingBatch.quotaCassa || 0),
      };
    }
  }

  const importo = computeStockInAmount(params.quantita, params.costoUnitario);
  const dataAcquisto = params.data ?? new Date();

  // Reinvestment cash coverage, consistent with the production-material purchase flow
  // in server/production.ts (informational only - never affects the expense amount).
  let resolvedDeps = deps;
  if (!resolvedDeps) {
    const { storage } = await import("./storage");
    resolvedDeps = {
      getCassaReinvestimentoBalance: storage.getCassaReinvestimentoBalance.bind(storage),
      updateCassaReinvestimento: storage.updateCassaReinvestimento.bind(storage),
    };
  }
  const { getCassaReinvestimentoBalance, updateCassaReinvestimento } = resolvedDeps;
  const cassaBalance = await getCassaReinvestimentoBalance(params.activityId, trx);
  const fromCassa = clampCassaCoverage(cassaBalance, Number(importo));

  if (fromCassa > 0) {
    await updateCassaReinvestimento(
      params.activityId,
      -fromCassa,
      `Spesa coperta da cassa reinvestimento: ${params.nomeArticolo}`,
      params.userId,
      trx
    );
  }

  const voce =
    params.voce ??
    `Rifornimento: ${params.nomeArticolo}${params.taglia ? ` - ${params.taglia}` : ""} (${params.quantita} pz)`;

  const [expense] = await trx
    .insert(spese)
    .values({
      userId: params.userId,
      activityId: params.activityId,
      voce,
      importo,
      categoria: "Inventario",
      nonEliminabile: 1,
      itemId: params.inventarioId,
      data: dataAcquisto,
    })
    .returning();

  const [batch] = await trx
    .insert(inventoryBatches)
    .values({
      inventarioId: params.inventarioId,
      activityId: params.activityId,
      userId: params.userId,
      costo: params.costoUnitario.toFixed(2),
      quantitaIniziale: params.quantita,
      quantitaRimanente: params.quantita,
      dataAcquisto: dataAcquisto.toISOString(),
      spesaId: expense.id,
      quotaCassa: fromCassa.toFixed(2),
      idempotencyKey: params.idempotencyKey ?? null,
    })
    .returning();

  return { batch, expense, deduplicated: false, fromCassa };
}
