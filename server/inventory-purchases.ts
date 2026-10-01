import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { inventoryBatches, inventario, spese } from "@shared/schema";
import type { InsertInventario } from "@shared/schema";
import { storage } from "./storage";

const MAX_AMOUNT_CENTS = BigInt("9999999999");
const CENTS_PER_UNIT = BigInt(100);

export function normalizeUnitCost(value: unknown) {
  const text = String(value ?? "").trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) {
    throw new Error("Il costo unitario deve essere un importo valido con massimo due decimali");
  }

  const [whole, fraction = ""] = text.split(".");
  const cents = BigInt(whole) * CENTS_PER_UNIT + BigInt(fraction.padEnd(2, "0"));
  if (cents > MAX_AMOUNT_CENTS) {
    throw new Error("Il costo unitario supera il limite consentito");
  }

  return {
    cents,
    decimal: `${whole}.${fraction.padEnd(2, "0")}`,
  };
}

function totalAmount(cents: bigint, quantity: number) {
  const totalCents = cents * BigInt(quantity);
  if (totalCents > MAX_AMOUNT_CENTS) {
    throw new Error("Il costo totale supera il limite consentito");
  }
  return `${totalCents / CENTS_PER_UNIT}.${String(totalCents % CENTS_PER_UNIT).padStart(2, "0")}`;
}

export function inventoryPurchaseDescription(
  kind: "initial" | "restock",
  item: { nomeArticolo: string; taglia?: string | null },
  quantity: number,
  unitCost: string,
) {
  const name = [item.nomeArticolo, item.taglia].filter(Boolean).join(" ");
  const formattedCost = Number(unitCost).toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const prefix = kind === "initial" ? "Carico iniziale" : "Rifornimento";
  return `${prefix} ${name} — ${quantity} × ${formattedCost} €`;
}

type PurchaseIdentity = {
  activityId: string;
  userId: string;
  idempotencyKey: string;
};

type InventoryDatabase = Pick<typeof db, "transaction">;

async function findPriorPurchase(
  identity: PurchaseIdentity,
  expected: { quantitaIniziale: number; costo: string; inventarioId?: string; nomeArticolo?: string; taglia?: string | null },
) {
  const [batch] = await db
    .select({ inventarioId: inventoryBatches.inventarioId })
    .from(inventoryBatches)
    .where(and(
      eq(inventoryBatches.idempotencyKey, identity.idempotencyKey),
      eq(inventoryBatches.activityId, identity.activityId),
      eq(inventoryBatches.userId, identity.userId),
      eq(inventoryBatches.quantitaIniziale, expected.quantitaIniziale),
      eq(inventoryBatches.costo, expected.costo),
      ...(expected.inventarioId ? [eq(inventoryBatches.inventarioId, expected.inventarioId)] : []),
    ))
    .limit(1);

  if (!batch) return null;
  const [item] = await db
    .select()
    .from(inventario)
    .where(and(
      eq(inventario.id, batch.inventarioId),
      eq(inventario.activityId, identity.activityId),
    ))
    .limit(1);
  if (!item || item.userId !== identity.userId) return null;
  if (expected.nomeArticolo !== undefined && item.nomeArticolo !== expected.nomeArticolo) return null;
  if (expected.taglia !== undefined && (item.taglia || null) !== expected.taglia) return null;
  return item;
}

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error &&
    (error as { code?: string }).code === "23505";
}

/**
 * Withdraws as much as possible of an inventory stock-in expense from the
 * "Cassa Reinvestimento" available balance, mirroring the manual expense
 * route (/api/spese) and the production material purchase flow. Returns the
 * amount actually covered by the cash box (0 if there was no balance).
 */
async function coverExpenseFromCassa(
  tx: any,
  params: { activityId: string; userId: string; amount: number; descrizione: string },
): Promise<number> {
  const balance = await storage.getCassaReinvestimentoBalance(params.activityId, tx);
  const fromCassa = Math.min(Math.max(balance, 0), params.amount);

  if (fromCassa > 0) {
    await storage.updateCassaReinvestimento(params.activityId, -fromCassa, params.descrizione, params.userId, tx);
  }

  return fromCassa;
}

export async function createInitialInventoryPurchase(
  data: InsertInventario & { userId: string; activityId: string; immagineUrl: string | null; idempotencyKey: string },
  database: InventoryDatabase = db,
) {
  const quantity = Number(data.quantita);
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    throw new Error("La quantità iniziale deve essere almeno 1");
  }
  const unitCost = normalizeUnitCost(data.costo);
  const amount = totalAmount(unitCost.cents, quantity);

  try {
    return await database.transaction(async (tx) => {
      const [priorBatch] = await tx
        .select({
          inventarioId: inventoryBatches.inventarioId,
          costo: inventoryBatches.costo,
          quantitaIniziale: inventoryBatches.quantitaIniziale,
        })
        .from(inventoryBatches)
        .where(eq(inventoryBatches.idempotencyKey, data.idempotencyKey))
        .limit(1);
      if (priorBatch) {
        const [priorItem] = await tx.select().from(inventario).where(eq(inventario.id, priorBatch.inventarioId));
        if (
          priorItem?.activityId === data.activityId &&
          priorItem.userId === data.userId &&
          priorBatch.costo === unitCost.decimal &&
          priorBatch.quantitaIniziale === quantity &&
          priorItem.nomeArticolo === data.nomeArticolo &&
          (priorItem.taglia || null) === (data.taglia || null)
        ) return priorItem;
        throw new Error("Chiave di idempotenza già utilizzata per un carico diverso");
      }

      const [item] = await tx.insert(inventario).values({
        userId: data.userId,
        activityId: data.activityId,
        nomeArticolo: data.nomeArticolo,
        taglia: data.taglia || null,
        costo: unitCost.decimal,
        quantita: quantity,
        lunghezza: data.lunghezza || null,
        larghezza: data.larghezza || null,
        altezza: data.altezza || null,
        immagineUrl: data.immagineUrl,
      }).returning();

      const [expense] = await tx.insert(spese).values({
        userId: data.userId,
        activityId: data.activityId,
        voce: inventoryPurchaseDescription("initial", item, quantity, unitCost.decimal),
        importo: amount,
        categoria: "Inventario",
        data: new Date(),
        nonEliminabile: 1,
        itemId: item.id,
      }).returning();

      const fromCassa = await coverExpenseFromCassa(tx, {
        activityId: data.activityId,
        userId: data.userId,
        amount: Number(amount),
        descrizione: `Spesa coperta da cassa reinvestimento: ${expense.voce}`,
      });

      await tx.insert(inventoryBatches).values({
        inventarioId: item.id,
        activityId: data.activityId,
        userId: data.userId,
        costo: unitCost.decimal,
        quantitaIniziale: quantity,
        quantitaRimanente: quantity,
        spesaId: expense.id,
        quotaCassa: fromCassa.toFixed(2),
        idempotencyKey: data.idempotencyKey,
      });

      if (fromCassa > 0) {
        const [updatedItem] = await tx
          .update(inventario)
          .set({ cassaCoverage: fromCassa.toFixed(2) })
          .where(eq(inventario.id, item.id))
          .returning();
        return updatedItem;
      }

      return item;
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const prior = await findPriorPurchase(data, {
        quantitaIniziale: quantity,
        costo: unitCost.decimal,
        nomeArticolo: data.nomeArticolo,
        taglia: data.taglia || null,
      });
      if (prior) return prior;
    }
    throw error;
  }
}

export async function restockInventoryPurchase(data: PurchaseIdentity & {
  inventarioId: string;
  quantita: number;
  costo: unknown;
}, database: InventoryDatabase = db) {
  if (!Number.isSafeInteger(data.quantita) || data.quantita < 1) {
    throw new Error("La quantità del rifornimento deve essere almeno 1");
  }
  const unitCost = normalizeUnitCost(data.costo);
  const amount = totalAmount(unitCost.cents, data.quantita);

  try {
    return await database.transaction(async (tx) => {
      const [priorBatch] = await tx
        .select({
          inventarioId: inventoryBatches.inventarioId,
          costo: inventoryBatches.costo,
          quantitaIniziale: inventoryBatches.quantitaIniziale,
        })
        .from(inventoryBatches)
        .where(eq(inventoryBatches.idempotencyKey, data.idempotencyKey))
        .limit(1);
      if (priorBatch) {
        const [priorItem] = await tx.select().from(inventario).where(eq(inventario.id, priorBatch.inventarioId));
        if (
          priorItem?.activityId === data.activityId &&
          priorItem.userId === data.userId &&
          priorBatch.inventarioId === data.inventarioId &&
          priorBatch.costo === unitCost.decimal &&
          priorBatch.quantitaIniziale === data.quantita
        ) return priorItem;
        throw new Error("Chiave di idempotenza già utilizzata per un carico diverso");
      }

      const [item] = await tx
        .select()
        .from(inventario)
        .where(and(eq(inventario.id, data.inventarioId), eq(inventario.activityId, data.activityId)))
        .for("update")
        .limit(1);
      if (!item || item.archiviato) {
        throw new Error("Articolo non trovato o archiviato");
      }

      const [expense] = await tx.insert(spese).values({
        userId: data.userId,
        activityId: data.activityId,
        voce: inventoryPurchaseDescription("restock", item, data.quantita, unitCost.decimal),
        importo: amount,
        categoria: "Inventario",
        data: new Date(),
        nonEliminabile: 1,
        itemId: item.id,
      }).returning();

      const fromCassa = await coverExpenseFromCassa(tx, {
        activityId: data.activityId,
        userId: data.userId,
        amount: Number(amount),
        descrizione: `Spesa coperta da cassa reinvestimento: ${expense.voce}`,
      });

      await tx.insert(inventoryBatches).values({
        inventarioId: item.id,
        activityId: data.activityId,
        userId: data.userId,
        costo: unitCost.decimal,
        quantitaIniziale: data.quantita,
        quantitaRimanente: data.quantita,
        spesaId: expense.id,
        quotaCassa: fromCassa.toFixed(2),
        idempotencyKey: data.idempotencyKey,
      });

      const [updatedItem] = await tx.update(inventario)
        .set({
          quantita: item.quantita + data.quantita,
          ...(fromCassa > 0
            ? { cassaCoverage: (Number(item.cassaCoverage || 0) + fromCassa).toFixed(2) }
            : {}),
        })
        .where(eq(inventario.id, item.id))
        .returning();
      return updatedItem;
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const prior = await findPriorPurchase(data, {
        inventarioId: data.inventarioId,
        quantitaIniziale: data.quantita,
        costo: unitCost.decimal,
      });
      if (prior) return prior;
    }
    throw error;
  }
}
