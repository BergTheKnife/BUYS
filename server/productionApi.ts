
import { Express, Request, Response } from "express";
import { db } from "./db";
import { storage } from "./storage";
import {
  storeConfig,
  productionMaterials,
  materialBatches,
  productShowcase,
  showcaseMaterialLinks,
  type StoreConfig,
  type InsertStoreConfig,
  type ProductionMaterial,
  type InsertProductionMaterial,
  type MaterialBatch,
  type InsertMaterialBatch,
  type ProductShowcase,
  type InsertProductShowcase,
  type InsertShowcaseMaterialLink
} from "@shared/schema";
import { and, asc, desc, eq, isNull, not, sql } from "drizzle-orm";

/**
 * Piccola guardia: assicura che userId & activityId siano presenti in sessione.
 */
function requireAuth(req: Request, res: Response): { userId: string; activityId: string } | null {
  const userId = (req.session as any)?.userId;
  const activityId = (req.session as any)?.activityId;
  if (!userId || !activityId) {
    res.status(401).json({ message: "Non autenticato o attività non selezionata" });
    return null;
  }
  return { userId, activityId };
}

/**
 * Ordina i lotti in modalità FEFO->FIFO.
 * Se lo store ha lottiScadenze=1 e sono presenti scadenze, ordina per scadenza crescente con nulls last.
 * Altrimenti ordina per data di acquisto (FIFO).
 */
async function getOrderedBatchesForMaterial(activityId: string, materialId: string, hasExpiry: boolean) {
  if (hasExpiry) {
    // Prima per scadenza (null alla fine), poi per dataAcquisto
    const batches = await db
      .select()
      .from(materialBatches)
      .where(and(eq(materialBatches.activityId, activityId), eq(materialBatches.materialId, materialId), sql`${materialBatches.quantitaResidua} > 0`))
      .orderBy(asc(materialBatches.scadenza), asc(materialBatches.dataAcquisto));
    // Drizzle pone i NULL all'inizio su Postgres: filtriamo e rimettiamo i null alla fine
    const withDate = batches.filter(b => b.scadenza !== null);
    const noDate  = batches.filter(b => b.scadenza === null);
    return [...withDate, ...noDate];
  }
  // FIFO puro
  return await db
    .select()
    .from(materialBatches)
    .where(and(eq(materialBatches.activityId, activityId), eq(materialBatches.materialId, materialId), sql`${materialBatches.quantitaResidua} > 0`))
    .orderBy(asc(materialBatches.dataAcquisto));
}

/**
 * Consuma materiali per una vendita di vetrina.
 * Ritorna costoTotale (number) e il dettaglio dei consumi.
 */
async function consumeMaterialsForShowcase(activityId: string, showcaseId: string, quantita: number, hasExpiry: boolean) {
  // Carica i link materiali per la vetrina
  const links = await db
    .select()
    .from(showcaseMaterialLinks)
    .where(eq(showcaseMaterialLinks.showcaseId, showcaseId));

  if (links.length === 0) {
    throw new Error("Nessun materiale collegato all'articolo di vetrina");
  }

  // Prepara piano di consumo
  type Consumption = { batchId: string; materialId: string; quantita: number; costoPerUnita: number };
  const planned: Consumption[] = [];

  // Prima passata: verifica disponibilità sufficiente
  for (const link of links) {
    const needed = Number(link.quantitaPerPezzo) * quantita;
    let remaining = needed;

    const batches = await getOrderedBatchesForMaterial(activityId, link.materialId, hasExpiry);
    let available = 0;
    for (const b of batches) available += Number(b.quantitaResidua);
    if (available + 1e-9 < needed) {
      throw new Error("Materiale insufficiente");
    }

    for (const b of batches) {
      if (remaining <= 0) break;
      const use = Math.min(remaining, Number(b.quantitaResidua));
      if (use > 0) {
        planned.push({ batchId: b.id, materialId: b.materialId, quantita: use, costoPerUnita: Number(b.costoPerUnita) });
        remaining -= use;
      }
    }
  }

  // Seconda passata: applica consumo in transazione e calcola costo
  let costoTotale = 0;
  await db.transaction(async (tx) => {
    for (const c of planned) {
      costoTotale += c.quantita * c.costoPerUnita;
      await tx.update(materialBatches)
        .set({ quantitaResidua: sql`${materialBatches.quantitaResidua} - ${c.quantita}` })
        .where(eq(materialBatches.id, c.batchId));
    }
    // Marca i materiali come "usati" impliciti: non serve un flag, è sufficiente la differenza residua/totale
  });

  return { costoTotale, planned };
}

/**
 * Calcola prelievo dalla cassa reinvestimento e crea la spesa non eliminabile.
 * Torna { prelievo, expenseId }.
 */
async function handleMaterialExpenseAndCassa(activityId: string, userId: string, voce: string, importo: number) {
  const balance = await (storage as any).getCassaReinvestimentoBalance(activityId);
  const prelievo = Math.min(balance, importo);
  if (prelievo > 0) {
    await (storage as any).updateCassaReinvestimento(activityId, -prelievo, `PRELIEVO_CASSA - ${voce}`, userId);
  }
  const expense = await (storage as any).createExpense({
    userId,
    activityId,
    voce,
    importo: importo.toFixed(2),
    categoria: "Inventario", // categoria protetta dalle eliminazioni manuali
    data: new Date(),
  });
  return { prelievo, expenseId: expense.id };
}

export async function registerProductionApi(app: Express) {
  /**
   * STORE CONFIG
   */
  app.get("/api/store-config", async (req, res) => {
    const auth = requireAuth(req, res); if (!auth) return;
    const cfg = await db.select().from(storeConfig).where(eq(storeConfig.activityId, auth.activityId));
    res.json(cfg[0] || null);
  });

  app.post("/api/store-config", async (req, res) => {
    const auth = requireAuth(req, res); if (!auth) return;
    const body = req.body as Partial<StoreConfig>;
    try {
      // Upsert by activityId (unique)
      const existing = await db.select().from(storeConfig).where(eq(storeConfig.activityId, auth.activityId));
      const baseValues = {
        activityId: auth.activityId,
        tipologiaStore: body.tipologiaStore || "Abbigliamento & Accessori",
        valuta: body.valuta || "EUR",
        paese: body.paese || "IT",
        ivaPredefinita: body.ivaPredefinita || "22.00",
        produzione: body.produzione ? 1 : 0,
        vetrina: body.vetrina ? 1 : 0,
        varianti: body.varianti ? 1 : 0,
        serialiImei: body.serialiImei ? 1 : 0,
        lottiScadenze: body.lottiScadenze ? 1 : 0,
        spedizioni: body.spedizioni ? 1 : 0,
        servizi: body.servizi ? 1 : 0,
        digitale: body.digitale ? 1 : 0,
      };
      if (existing.length) {
        const [updated] = await db.update(storeConfig).set(baseValues).where(eq(storeConfig.activityId, auth.activityId)).returning();
        res.json(updated);
      } else {
        const [created] = await db.insert(storeConfig).values(baseValues).returning();
        res.json(created);
      }
    } catch (e: any) {
      res.status(400).json({ message: e.message || "Errore salvataggio configurazione store" });
    }
  });

  /**
   * MATERIALI - elenco
   */
  app.get("/api/produzione/materiali", async (req, res) => {
    const auth = requireAuth(req, res); if (!auth) return;
    const materials = await db
      .select()
      .from(productionMaterials)
      .where(and(eq(productionMaterials.activityId, auth.activityId), eq(productionMaterials.archiviato, 0)));
    // Aggrega residuo e scadenza prossima
    const result = [];
    for (const m of materials) {
      const batches = await db.select().from(materialBatches).where(eq(materialBatches.materialId, m.id));
      const residuo = batches.reduce((s, b) => s + Number(b.quantitaResidua), 0);
      const costoMedio = (() => {
        const totVal = batches.reduce((s, b) => s + Number(b.costoPerUnita) * Number(b.quantitaResidua), 0);
        return residuo > 0 ? totVal / residuo : 0;
      })();
      const scadenze = batches.map(b => b.scadenza).filter(Boolean).sort();
      result.push({ ...m, quantitaResidua: residuo, costoMedioPerUnita: Number(costoMedio.toFixed(4)), scadenzaProssima: scadenze[0] || null });
    }
    res.json(result);
  });

  /**
   * MATERIALI - aggiungi con lotto iniziale
   */
  app.post("/api/produzione/materiali", async (req, res) => {
    const auth = requireAuth(req, res); if (!auth) return;
    const { nomeMateriale, unita, colore, quantitaTotale, costoTotale, lotto, scadenza } = req.body || {};
    try {
      if (!nomeMateriale || !unita || !quantitaTotale || !costoTotale) {
        return res.status(400).json({ message: "Dati mancanti" });
      }

      // Scadenza obbligatoria se attivo
      const cfg = await db.select().from(storeConfig).where(eq(storeConfig.activityId, auth.activityId));
      const requireExpiry = cfg[0]?.lottiScadenze === 1;
      if (requireExpiry && !scadenza) {
        return res.status(400).json({ message: "Scadenza obbligatoria per questo store" });
      }

      const [material] = await db.insert(productionMaterials).values({
        activityId: auth.activityId,
        userId: auth.userId,
        nomeMateriale,
        unita,
        colore: colore || null,
      }).returning();

      const costoPerUnita = Number(costoTotale) / Number(quantitaTotale);

      // Crea spesa + prelievo da cassa
      const voce = `acquisto materiale produzione: ${nomeMateriale}`;
      const { prelievo } = await handleMaterialExpenseAndCassa(auth.activityId, auth.userId, voce, Number(costoTotale));

      const [batch] = await db.insert(materialBatches).values({
        materialId: material.id,
        activityId: auth.activityId,
        userId: auth.userId,
        quantitaTotale: quantitaTotale.toString(),
        quantitaResidua: quantitaTotale.toString(),
        costoTotale: Number(costoTotale).toFixed(2),
        costoPerUnita: costoPerUnita.toFixed(6),
        lotto: lotto || null,
        scadenza: scadenza ? new Date(scadenza) : null,
        cassaCoverage: prelievo.toFixed(2),
      }).returning();

      res.json({ material, batch });
    } catch (e: any) {
      res.status(400).json({ message: e.message || "Errore creazione materiale" });
    }
  });

  /**
   * MATERIALI - rifornisci (nuovo lotto)
   */
  app.post("/api/produzione/materiali/:id/rifornisci", async (req, res) => {
    const auth = requireAuth(req, res); if (!auth) return;
    const { id } = req.params;
    const { quantitaTotale, costoTotale, lotto, scadenza } = req.body || {};
    try {
      const [material] = await db.select().from(productionMaterials).where(and(eq(productionMaterials.id, id), eq(productionMaterials.activityId, auth.activityId)));
      if (!material) return res.status(404).json({ message: "Materiale non trovato" });

      const cfg = await db.select().from(storeConfig).where(eq(storeConfig.activityId, auth.activityId));
      const requireExpiry = cfg[0]?.lottiScadenze === 1;
      if (requireExpiry && !scadenza) {
        return res.status(400).json({ message: "Scadenza obbligatoria per questo store" });
      }

      const costoPerUnita = Number(costoTotale) / Number(quantitaTotale);

      const voce = `acquisto materiale produzione: ${material.nomeMateriale}`;
      const { prelievo } = await handleMaterialExpenseAndCassa(auth.activityId, auth.userId, voce, Number(costoTotale));

      const [batch] = await db.insert(materialBatches).values({
        materialId: material.id,
        activityId: auth.activityId,
        userId: auth.userId,
        quantitaTotale: quantitaTotale.toString(),
        quantitaResidua: quantitaTotale.toString(),
        costoTotale: Number(costoTotale).toFixed(2),
        costoPerUnita: costoPerUnita.toFixed(6),
        lotto: lotto || null,
        scadenza: scadenza ? new Date(scadenza) : null,
        cassaCoverage: prelievo.toFixed(2),
      }).returning();

      res.json({ material, batch });
    } catch (e: any) {
      res.status(400).json({ message: e.message || "Errore rifornimento materiale" });
    }
  });

  /**
   * MATERIALI - archivia o elimina (se mai usato)
   */
  app.post("/api/produzione/materiali/:id/archivia", async (req, res) => {
    const auth = requireAuth(req, res); if (!auth) return;
    const { id } = req.params;
    // Se usato almeno una volta -> archivia
    const batches = await db.select().from(materialBatches).where(eq(materialBatches.materialId, id));
    const maiUsato = batches.every(b => Number(b.quantitaResidua) === Number(b.quantitaTotale));
    if (maiUsato) {
      return res.status(400).json({ message: "Il materiale non è mai stato usato: puoi eliminarlo definitivamente." });
    }
    const [updated] = await db.update(productionMaterials).set({ archiviato: 1 }).where(eq(productionMaterials.id, id)).returning();
    res.json(updated);
  });

  app.delete("/api/produzione/materiali/:id", async (req, res) => {
    const auth = requireAuth(req, res); if (!auth) return;
    const { id } = req.params;
    const batches = await db.select().from(materialBatches).where(eq(materialBatches.materialId, id));
    const maiUsato = batches.every(b => Number(b.quantitaResidua) === Number(b.quantitaTotale));
    if (!maiUsato) {
      return res.status(400).json({ message: "Materiale già usato: puoi solo archiviare." });
    }

    const quotaCassa = batches.reduce((s, b) => s + Number(b.cassaCoverage || 0), 0);

    await db.transaction(async (tx) => {
      // Deposita in cassa la sola quotaCassa
      if (quotaCassa > 0) {
        await (storage as any).updateCassaReinvestimento(auth.activityId, quotaCassa, "DEPOSITO_CASSA - Rimborso eliminazione materiale (mai usato)", auth.userId);
      }
      // Elimina le spese collegate ai lotti: non avendo un link forte, eliminiamo per voce e importo corrispondente.
      // (In alternativa si potrebbe mantenere un mapping specifico in financial_history)
      // Rimuoviamo comunque i batch e il materiale
      await tx.delete(materialBatches).where(eq(materialBatches.materialId, id));
      await tx.delete(productionMaterials).where(eq(productionMaterials.id, id));
    });

    res.json({ ok: true, depositoCassa: quotaCassa.toFixed(2) });
  });

  /**
   * VETRINA - CRUD
   */
  app.get("/api/produzione/vetrina", async (req, res) => {
    const auth = requireAuth(req, res); if (!auth) return;
    const list = await db.select().from(productShowcase).where(and(eq(productShowcase.activityId, auth.activityId), eq(productShowcase.archiviato, 0)));
    res.json(list);
  });

  app.post("/api/produzione/vetrina", async (req, res) => {
    const auth = requireAuth(req, res); if (!auth) return;
    const { nomeArticolo, categoria, altezza, larghezza, lunghezza, materiali } = req.body || {};
    try {
      if (!nomeArticolo) return res.status(400).json({ message: "Nome articolo richiesto" });
      const [created] = await db.insert(productShowcase).values({
        activityId: auth.activityId,
        userId: auth.userId,
        nomeArticolo,
        categoria: categoria || null,
        altezza: altezza || null,
        larghezza: larghezza || null,
        lunghezza: lunghezza || null,
        costoPrevisto: "0.00", // verrà aggiornato sotto
      }).returning();

      let costoPrevisto = 0;
      if (Array.isArray(materiali)) {
        for (const m of materiali) {
          const { materialId, quantitaPerPezzo } = m;
          const [mat] = await db.select().from(productionMaterials).where(eq(productionMaterials.id, materialId));
          if (!mat) continue;
          await db.insert(showcaseMaterialLinks).values({
            showcaseId: created.id,
            materialId,
            quantitaPerPezzo: quantitaPerPezzo.toString(),
          });
          // usa costoMedio corrente sui lotti
          const batches = await db.select().from(materialBatches).where(eq(materialBatches.materialId, materialId));
          const residuo = batches.reduce((s, b) => s + Number(b.quantitaResidua), 0);
          const totVal = batches.reduce((s, b) => s + Number(b.costoPerUnita) * Number(b.quantitaResidua), 0);
          const costoMedio = residuo > 0 ? (totVal / residuo) : 0;
          costoPrevisto += costoMedio * Number(quantitaPerPezzo || 0);
        }
      }
      const [updated] = await db.update(productShowcase).set({ costoPrevisto: costoPrevisto.toFixed(2) }).where(eq(productShowcase.id, created.id)).returning();
      res.json(updated);
    } catch (e: any) {
      res.status(400).json({ message: e.message || "Errore creazione vetrina" });
    }
  });

  app.put("/api/produzione/vetrina/:id", async (req, res) => {
    const auth = requireAuth(req, res); if (!auth) return;
    const { id } = req.params;
    const { nomeArticolo, categoria, altezza, larghezza, lunghezza, materiali } = req.body || {};
    try {
      const [existing] = await db.select().from(productShowcase).where(and(eq(productShowcase.id, id), eq(productShowcase.activityId, auth.activityId)));
      if (!existing) return res.status(404).json({ message: "Articolo di vetrina non trovato" });

      await db.update(productShowcase).set({
        nomeArticolo: nomeArticolo ?? existing.nomeArticolo,
        categoria: categoria ?? existing.categoria,
        altezza: altezza ?? existing.altezza,
        larghezza: larghezza ?? existing.larghezza,
        lunghezza: lunghezza ?? existing.lunghezza,
      }).where(eq(productShowcase.id, id));

      if (Array.isArray(materiali)) {
        // reset links
        await db.delete(showcaseMaterialLinks).where(eq(showcaseMaterialLinks.showcaseId, id));
        let costoPrevisto = 0;
        for (const m of materiali) {
          const { materialId, quantitaPerPezzo } = m;
          await db.insert(showcaseMaterialLinks).values({
            showcaseId: id,
            materialId,
            quantitaPerPezzo: quantitaPerPezzo.toString(),
          });
          const batches = await db.select().from(materialBatches).where(eq(materialBatches.materialId, materialId));
          const residuo = batches.reduce((s, b) => s + Number(b.quantitaResidua), 0);
          const totVal = batches.reduce((s, b) => s + Number(b.costoPerUnita) * Number(b.quantitaResidua), 0);
          const costoMedio = residuo > 0 ? (totVal / residuo) : 0;
          costoPrevisto += costoMedio * Number(quantitaPerPezzo || 0);
        }
        await db.update(productShowcase).set({ costoPrevisto: costoPrevisto.toFixed(2) }).where(eq(productShowcase.id, id));
      }

      const [updated] = await db.select().from(productShowcase).where(eq(productShowcase.id, id));
      res.json(updated);
    } catch (e: any) {
      res.status(400).json({ message: e.message || "Errore aggiornamento vetrina" });
    }
  });

  app.post("/api/produzione/vetrina/:id/archivia", async (req, res) => {
    const auth = requireAuth(req, res); if (!auth) return;
    const { id } = req.params;
    const [existing] = await db.select().from(productShowcase).where(and(eq(productShowcase.id, id), eq(productShowcase.activityId, auth.activityId)));
    if (!existing) return res.status(404).json({ message: "Articolo di vetrina non trovato" });
    if (existing.usatoAlmenoUnaVolta !== 1) {
      return res.status(400).json({ message: "Questo articolo non è stato ancora usato: puoi eliminarlo definitivamente." });
    }
    const [updated] = await db.update(productShowcase).set({ archiviato: 1 }).where(eq(productShowcase.id, id)).returning();
    res.json(updated);
  });

  app.delete("/api/produzione/vetrina/:id", async (req, res) => {
    const auth = requireAuth(req, res); if (!auth) return;
    const { id } = req.params;
    const [existing] = await db.select().from(productShowcase).where(and(eq(productShowcase.id, id), eq(productShowcase.activityId, auth.activityId)));
    if (!existing) return res.status(404).json({ message: "Articolo di vetrina non trovato" });
    if (existing.usatoAlmenoUnaVolta === 1) {
      return res.status(400).json({ message: "Articolo già usato: puoi solo archiviare." });
    }
    await db.transaction(async (tx) => {
      await tx.delete(showcaseMaterialLinks).where(eq(showcaseMaterialLinks.showcaseId, id));
      await tx.delete(productShowcase).where(eq(productShowcase.id, id));
    });
    res.json({ ok: true });
  });

  /**
   * VENDITA DA VETRINA
   */
  app.post("/api/vendite/vetrina", async (req, res) => {
    const auth = requireAuth(req, res); if (!auth) return;
    const { showcaseId, quantita, prezzoVendita, vendutoA, incassato, incassatoDa, incassatoSu, data } = req.body || {};
    try {
      // Config store per FEFO
      const cfg = await db.select().from(storeConfig).where(eq(storeConfig.activityId, auth.activityId));
      const hasExpiry = cfg[0]?.lottiScadenze === 1;

      // Calcola il costo reale consumando i materiali
      const { costoTotale } = await consumeMaterialsForShowcase(auth.activityId, showcaseId, Number(quantita), hasExpiry);
      const costoUnitario = costoTotale / Number(quantita || 1);

      // Recupera info della vetrina
      const [sc] = await db.select().from(productShowcase).where(eq(productShowcase.id, showcaseId));
      if (!sc) return res.status(404).json({ message: "Articolo di vetrina non trovato" });

      // Crea un articolo "sintetico" in inventario per completare il flusso standard vendite
      const { createInventoryItem } = storage as any;
      const inv = await createInventoryItem({
        userId: auth.userId,
        activityId: auth.activityId,
        nomeArticolo: sc.nomeArticolo,
        taglia: null,
        costo: costoUnitario.toFixed(2),
        quantita: Number(quantita),
        lunghezza: null,
        larghezza: null,
        altezza: null,
        cassaCoverage: "0",
        immagineUrl: null,
        archiviato: 0,
      });

      // Marca la vetrina come usata almeno una volta
      await db.update(productShowcase).set({ usatoAlmenoUnaVolta: 1 }).where(eq(productShowcase.id, showcaseId));

      // Esegui la vendita con lo storage standard (userà il costo dell'articolo sintetico)
      const { createSale } = storage as any;
      const vendita = await createSale({
        userId: auth.userId,
        activityId: auth.activityId,
        inventarioId: inv.id,
        nomeArticolo: sc.nomeArticolo,
        taglia: null,
        quantita: Number(quantita),
        prezzoVendita: Number(prezzoVendita).toFixed(2),
        vendutoA: vendutoA || null,
        incassato: Number(incassato) || 0,
        incassatoDa: incassato ? (incassatoDa || "Cliente") : null,
        incassatoSu: incassato ? (incassatoSu || "Cassa") : null,
        data: new Date(data || Date.now()),
        margine: "0.00", // verrà ricalcolato nello storage
      });

      res.json(vendita);
    } catch (e: any) {
      console.error("Errore vendita vetrina:", e);
      res.status(400).json({ message: e.message || "Errore registrazione vendita da vetrina" });
    }
  });
}
