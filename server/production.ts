import { db } from "./db";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import {
  spese, financialHistory,
  productionMaterials, productionBatches, productionProducts, productionProductBom, productionConsumptions,
  inventario
} from "@shared/schema";

/** Balance cassa reinvestimento */
async function getCassaReinvestimentoBalance(activityId: string): Promise<number> {
  const rows = await db.execute(sql`
    SELECT COALESCE(SUM(CASE WHEN azione='DEPOSITO_CASSA' THEN importo::numeric ELSE 0 END),0)
         - COALESCE(SUM(CASE WHEN azione='PRELIEVO_CASSA' THEN importo::numeric ELSE 0 END),0) AS balance
    FROM ${financialHistory}
    WHERE activity_id = ${activityId}
  `);
  return Number(rows.rows[0]?.balance || 0);
}

/** Crea materiale + primo lotto + spesa non eliminabile + prelievo cassa */
export async function createProductionMaterial(p: {
  userId: string; activityId: string;
  nome: string; unita: 'g'|'m'|'pcs'; colore?: string|null;
  quantitaTotale: number; costoTotale: number;
}) {
  return await db.transaction(async (trx) => {
    const material = (await trx.insert(productionMaterials).values({
      userId: p.userId, activityId: p.activityId, nome: p.nome, unita: p.unita, colore: p.colore || null
    }).returning())[0];

    const expense = (await trx.insert(spese).values({
      userId: p.userId, activityId: p.activityId, voce: `acquisto materiale produzione: ${p.nome}`,
      importo: String(p.costoTotale), categoria: "produzione", nonEliminabile: 1, data: new Date()
    }).returning())[0];

    const balance = await getCassaReinvestimentoBalance(p.activityId);
    const fromCassa = Math.min(balance, p.costoTotale);
    if (fromCassa > 0) {
      await trx.insert(financialHistory).values({
        userId: p.userId, activityId: p.activityId, azione: "PRELIEVO_CASSA",
        importo: String(fromCassa), descrizione: `Acquisto materiali produzione: ${p.nome}`, createdAt: new Date()
      });
    }

    const cpu = p.quantitaTotale > 0 ? (p.costoTotale / p.quantitaTotale) : 0;
    const batch = (await trx.insert(productionBatches).values({
      materialId: material.id, activityId: p.activityId,
      quantitaTotale: String(p.quantitaTotale), quantitaRimanente: String(p.quantitaTotale),
      costoTotale: String(p.costoTotale), costoPerUnita: String(cpu),
      spesaId: expense.id, quotaCassa: String(fromCassa), dataAcquisto: new Date()
    }).returning())[0];

    return { material, batch, expense };
  });
}

export async function listProductionMaterials(activityId: string) {
  const rows = await db.execute(sql`
    SELECT m.*, 
      COALESCE(SUM(b.quantita_totale)::numeric, 0) AS q_totale,
      COALESCE(SUM(b.quantita_rimanente)::numeric, 0) AS q_residua,
      CASE WHEN COALESCE(SUM(b.quantita_totale)::numeric, 0) > 0 
        THEN COALESCE(SUM(b.costo_totale)::numeric, 0) / NULLIF(COALESCE(SUM(b.quantita_totale)::numeric, 0),0)
        ELSE 0 END AS costo_unit_medio
    FROM ${productionMaterials} m
    LEFT JOIN ${productionBatches} b ON b.material_id = m.id
    WHERE m.activity_id = ${activityId}
    GROUP BY m.id
    ORDER BY m.created_at DESC
  `);
  return rows.rows;
}

export async function refillProductionMaterial(p: {
  userId: string; activityId: string; materialId: string; quantita: number; costoTotale: number;
}) {
  return await db.transaction(async (trx) => {
    const expense = (await trx.insert(spese).values({
      userId: p.userId, activityId: p.activityId, voce: `acquisto materiale produzione (rifornimento)`,
      importo: String(p.costoTotale), categoria: "produzione", nonEliminabile: 1, data: new Date()
    }).returning())[0];

    const balance = await getCassaReinvestimentoBalance(p.activityId);
    const fromCassa = Math.min(balance, p.costoTotale);
    if (fromCassa > 0) {
      await trx.insert(financialHistory).values({
        userId: p.userId, activityId: p.activityId, azione: "PRELIEVO_CASSA",
        importo: String(fromCassa), descrizione: `Rifornimento materiali produzione`, createdAt: new Date()
      });
    }

    const cpu = p.quantita > 0 ? (p.costoTotale / p.quantita) : 0;
    const batch = (await trx.insert(productionBatches).values({
      materialId: p.materialId, activityId: p.activityId,
      quantitaTotale: String(p.quantita), quantitaRimanente: String(p.quantita),
      costoTotale: String(p.costoTotale), costoPerUnita: String(cpu),
      spesaId: expense.id, quotaCassa: String(fromCassa), dataAcquisto: new Date()
    }).returning())[0];

    return batch;
  });
}

export async function updateMaterial(materialId: string, activityId: string, data: { nome?: string; colore?: string | null }) {
  await db.update(productionMaterials)
    .set({
      ...(data.nome !== undefined && { nome: data.nome }),
      ...(data.colore !== undefined && { colore: data.colore })
    })
    .where(and(eq(productionMaterials.id, materialId), eq(productionMaterials.activityId, activityId)));
  return true;
}

export async function archiveMaterial(materialId: string, activityId: string) {
  await db.update(productionMaterials).set({ archiviato: "1" }).where(and(eq(productionMaterials.id, materialId), eq(productionMaterials.activityId, activityId)));
  return true;
}

export async function deleteMaterialIfUnused(materialId: string, activityId: string, userId?: string) {
  const used = await db.execute(sql`
    SELECT COUNT(*)::int AS c FROM ${productionConsumptions}
    WHERE activity_id = ${activityId} AND material_id = ${materialId}
  `);
  const c = Number(used.rows[0]?.c || 0);
  if (c > 0) return { success: false, reason: "USED" };

  return await db.transaction(async (trx) => {
    const batches = (await trx.select().from(productionBatches).where(and(eq(productionBatches.materialId, materialId), eq(productionBatches.activityId, activityId))));
    for (const b of batches) {
      const quota = Number(b.quotaCassa || 0);
      if (quota > 0 && userId) {
        await trx.insert(financialHistory).values({
          userId, activityId, azione: "DEPOSITO_CASSA", importo: String(quota),
          descrizione: "Rollback eliminazione materiale (mai usato)", createdAt: new Date()
        });
      }
      if (b.spesaId) {
        await trx.delete(spese).where(eq(spese.id, b.spesaId as any));
      }
    }
    await trx.delete(productionBatches).where(eq(productionBatches.materialId, materialId));
    await trx.delete(productionMaterials).where(eq(productionMaterials.id, materialId));

    return { success: true };
  });
}

export async function createProductionProduct(p: {
  userId: string; activityId: string; nome: string; categoria?: string|null;
  altezza?: number|null; larghezza?: number|null; lunghezza?: number|null; costoOverride?: number|null;
  imageUrl?: string|null;
  bom: { materialId: string; quantita: number; }[];
}) {
  return await db.transaction(async (trx) => {
    const prod = (await trx.insert(productionProducts).values({
      userId: p.userId, activityId: p.activityId, nome: p.nome, categoria: p.categoria || null,
      altezza: p.altezza != null ? String(p.altezza) : null,
      larghezza: p.larghezza != null ? String(p.larghezza) : null,
      lunghezza: p.lunghezza != null ? String(p.lunghezza) : null,
      costoOverride: p.costoOverride != null ? String(p.costoOverride) : null,
      imageUrl: p.imageUrl || null
    }).returning())[0];

    for (const r of p.bom) {
      await trx.insert(productionProductBom).values({ productId: prod.id, materialId: r.materialId, quantita: String(r.quantita) });
    }
    return prod;
  });
}

export async function updateProductionProduct(id: string, activityId: string, data: {
  nome?: string; categoria?: string|null;
  altezza?: number|null; larghezza?: number|null; lunghezza?: number|null; costoOverride?: number|null;
  imageUrl?: string|null;
  bom?: { materialId: string; quantita: number; }[];
}) {
  return await db.transaction(async (trx) => {
    const updateData: any = {};
    if (data.nome !== undefined) updateData.nome = data.nome;
    if (data.categoria !== undefined) updateData.categoria = data.categoria;
    if (data.altezza !== undefined) updateData.altezza = data.altezza != null ? String(data.altezza) : null;
    if (data.larghezza !== undefined) updateData.larghezza = data.larghezza != null ? String(data.larghezza) : null;
    if (data.lunghezza !== undefined) updateData.lunghezza = data.lunghezza != null ? String(data.lunghezza) : null;
    if (data.costoOverride !== undefined) updateData.costoOverride = data.costoOverride != null ? String(data.costoOverride) : null;
    if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;

    await trx.update(productionProducts).set(updateData).where(and(eq(productionProducts.id, id), eq(productionProducts.activityId, activityId)));

    if (data.bom) {
      await trx.delete(productionProductBom).where(eq(productionProductBom.productId, id));
      for (const r of data.bom) {
        await trx.insert(productionProductBom).values({ productId: id, materialId: r.materialId, quantita: String(r.quantita) });
      }
    }

    return true;
  });
}

export async function listProductionProducts(activityId: string) {
  const prods = await db.select().from(productionProducts).where(and(eq(productionProducts.activityId, activityId), eq(productionProducts.archiviato, "0"))).orderBy(desc(productionProducts.createdAt));
  const withBom: any[] = [];
  for (const p of prods) {
    const bom = await db.select().from(productionProductBom).where(eq(productionProductBom.productId, p.id));
    withBom.push({ ...p, bom });
  }
  return withBom;
}
export async function archiveProductionProduct(id: string, activityId: string) {
  await db.update(productionProducts).set({ archiviato: "1" }).where(and(eq(productionProducts.id, id), eq(productionProducts.activityId, activityId)));
  return true;
}
export async function deleteProductionProductIfUnused(id: string, activityId: string) {
  const used = await db.execute(sql`
    SELECT COUNT(*)::int AS c FROM ${productionConsumptions}
    WHERE activity_id = ${activityId} AND product_id = ${id}
  `);
  const c = Number(used.rows[0]?.c || 0);
  if (c > 0) return { success: false, reason: "USED" };
  await db.delete(productionProductBom).where(eq(productionProductBom.productId, id));
  await db.delete(productionProducts).where(eq(productionProducts.id, id));
  return { success: true };
}

export async function prepareInventoryFromVetrina(p: { userId: string; activityId: string; productId: string; quantita: number; }) {
  return await db.transaction(async (trx) => {
    const prod = (await trx.select().from(productionProducts).where(and(eq(productionProducts.id, p.productId), eq(productionProducts.activityId, p.activityId))))[0];
    if (!prod) throw new Error("Scheda Vetrina non trovata");
    const bom = await trx.select().from(productionProductBom).where(eq(productionProductBom.productId, prod.id));

    // First, create the inventory item to get its ID
    const costoUnit = 0; // Will be calculated after consumption
    const item = (await trx.insert(inventario).values({
      userId: p.userId, activityId: p.activityId,
      nomeArticolo: prod.nome, taglia: null,
      costo: String(costoUnit), quantita: p.quantita,
      lunghezza: prod.lunghezza, larghezza: prod.larghezza, altezza: prod.altezza,
      cassaCoverage: "0", immagineUrl: null, archiviato: 0,
      vetrinaId: prod.id
    }).returning())[0];

    // Now consume materials and link to inventory item
    let costoTot = 0;
    for (const r of bom) {
      let toConsume = Number(r.quantita) * p.quantita;
      const batches = await trx.select().from(productionBatches).where(and(eq(productionBatches.materialId, r.materialId), eq(productionBatches.activityId, p.activityId), sql`${productionBatches.quantitaRimanente} > 0`)).orderBy(asc(productionBatches.dataAcquisto));
      
      let consumed = 0;
      for (const b of batches) {
        if (toConsume <= 0) break;
        const rem = Number(b.quantitaRimanente);
        const take = Math.min(rem, toConsume);
        const cost = take * Number(b.costoPerUnita);
        await trx.update(productionBatches).set({ quantitaRimanente: String(rem - take) }).where(eq(productionBatches.id, b.id));
        await trx.insert(productionConsumptions).values({
          activityId: p.activityId, inventoryId: item.id, productId: prod.id, 
          materialId: b.materialId, batchId: b.id,
          quantita: String(take), costoImputato: String(cost)
        });
        costoTot += cost;
        toConsume -= take;
        consumed += take;
      }
      
      if (toConsume > 0) {
        throw new Error(`Materiale insufficiente: ${r.materialId} richiede ${Number(r.quantita) * p.quantita}, disponibili ${consumed}`);
      }
    }

    // Update inventory cost with actual calculated cost
    const finalCostoUnit = p.quantita > 0 ? (costoTot / p.quantita) : costoTot;
    await trx.update(inventario).set({ costo: String(finalCostoUnit) }).where(eq(inventario.id, item.id));

    return { inventarioId: item.id, costoUnit: finalCostoUnit, costoTot };
  });
}

export async function rollbackVetrinaSale(inventarioId: string, activityId: string) {
  return await db.transaction(async (trx) => {
    // Get the inventory item (auto-created from vetrina)
    const [item] = await trx.select().from(inventario).where(and(eq(inventario.id, inventarioId), eq(inventario.activityId, activityId)));
    if (!item || !item.vetrinaId) throw new Error("Item non trovato o non da vetrina");

    // Get ONLY consumptions for this specific inventory item
    const consumptions = await trx.select().from(productionConsumptions).where(and(
      eq(productionConsumptions.activityId, activityId),
      eq(productionConsumptions.inventoryId, inventarioId)
    ));

    // Restore materials to batches (FIFO reverse)
    for (const c of consumptions) {
      if (!c.batchId) {
        console.warn(`⚠️ Consumption ${c.id} has no batchId - skipping material restoration. This indicates data inconsistency.`);
        continue;
      }
      const batch = (await trx.select().from(productionBatches).where(eq(productionBatches.id, c.batchId)))[0];
      if (batch) {
        await trx.update(productionBatches).set({
          quantitaRimanente: String(Number(batch.quantitaRimanente) + Number(c.quantita))
        }).where(eq(productionBatches.id, batch.id));
      } else {
        console.warn(`⚠️ Batch ${c.batchId} not found for consumption ${c.id} - skipping restoration.`);
      }
    }

    // Delete consumption records for this specific inventory item
    await trx.delete(productionConsumptions).where(eq(productionConsumptions.inventoryId, inventarioId));

    // DO NOT delete the inventory item - it remains in inventory and behaves like any other item
    // The item keeps its vetrinaId reference but is now available in inventory without double accounting

    return true;
  });
}
