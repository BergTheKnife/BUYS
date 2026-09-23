  private async reconcileInventoryBatches(inventarioId: string) {
    const { inventoryBatches } = await import('../migrations/schema');

    const [inventoryItem] = await db
      .select()
      .from(inventario)
      .where(eq(inventario.id, inventarioId));

    if (!inventoryItem) {
      return [] as any[];
    }

    const batches = await db
      .select()
      .from(inventoryBatches)
      .where(
        and(
          eq(inventoryBatches.inventarioId, inventarioId),
          sql`${inventoryBatches.quantitaRimanente} > 0`
        )
      )
      .orderBy(
        inventoryBatches.dataAcquisto,
        inventoryBatches.createdAt,
        inventoryBatches.id
      );

    const totalAvailableFromBatches = batches.reduce((sum, batch) => sum + Number(batch.quantitaRimanente || 0), 0);

    if (totalAvailableFromBatches !== inventoryItem.quantita) {
      await db
        .update(inventario)
        .set({ quantita: totalAvailableFromBatches })
        .where(eq(inventario.id, inventarioId));
    }

    return batches;
  }

  async createInventoryBatch(data: {
    inventarioId: string;
    activityId: string;
    userId: string;
    costo: string;
    quantita: number;
    dataAcquisto?: Date;
  }) {
    const { inventoryBatches } = await import('../migrations/schema');

    const [batch] = await db.insert(inventoryBatches).values({
      inventarioId: data.inventarioId,
      activityId: data.activityId,
      userId: data.userId,
      costo: data.costo,
      quantitaIniziale: data.quantita,
      quantitaRimanente: data.quantita,
      dataAcquisto: data.dataAcquisto?.toISOString() || new Date().toISOString(),
    }).returning();

    return batch;
  }

  async getInventoryBatches(inventarioId: string) {
    const { inventoryBatches } = await import('../migrations/schema');

    return await db
      .select()
      .from(inventoryBatches)
      .where(eq(inventoryBatches.inventarioId, inventarioId))
      .orderBy(inventoryBatches.dataAcquisto);
  }

  async updateBatchQuantity(batchId: string, newQuantity: number) {
    const { inventoryBatches } = await import('../migrations/schema');

    const [updatedBatch] = await db
      .update(inventoryBatches)
      .set({ quantitaRimanente: newQuantity })
      .where(eq(inventoryBatches.id, batchId))
      .returning();

    return updatedBatch;
  }

  async calculateFIFOMargin(inventarioId: string, quantitaVenduta: number, prezzoVendita: number) {
    const { inventoryBatches } = await import('../migrations/schema');

    const [inventoryItem] = await db
      .select()
      .from(inventario)
      .where(eq(inventario.id, inventarioId));

    if (!inventoryItem) {
      throw new Error("Articolo non trovato nell'inventario");
    }

    if (inventoryItem.quantita < quantitaVenduta) {
      throw new Error("Quantità insufficiente in magazzino per completare la vendita");
    }

    const batches = await this.reconcileInventoryBatches(inventarioId);
    const totalAvailableFromBatches = batches.reduce((sum, batch) => sum + Number(batch.quantitaRimanente || 0), 0);

    if (batches.length === 0 || totalAvailableFromBatches === 0) {
      throw new Error("Nessun lotto attivo disponibile per calcolare il costo FIFO. Verifica la consistenza dell'inventario e dei lotti.");
    }

    if (totalAvailableFromBatches < quantitaVenduta) {
      throw new Error("Quantità insufficiente in magazzino per completare la vendita");
    }

    let rimanenteVendita = quantitaVenduta;
    let costoTotale = 0;
    const batchesUsed: { id: string; quantitaUsata: number }[] = [];
    const batchDetails: { batchId: string | null; costoUnitario: number; quantitaUsata: number; marginePartial: number }[] = [];

    for (const batch of batches) {
      if (rimanenteVendita <= 0) break;

      const quantitaDisponibile = Number(batch.quantitaRimanente || 0);
      const quantitaUsata = Math.min(rimanenteVendita, quantitaDisponibile);
      const costoUnitario = Number(batch.costo ?? 0);

      if (!Number.isFinite(costoUnitario)) {
        throw new Error(`Costo del lotto non valido per il lotto ${batch.id}`);
      }

      const costoPartial = quantitaUsata * costoUnitario;
      const ricavoPartial = quantitaUsata * prezzoVendita;
      const marginePartial = ricavoPartial - costoPartial;

      costoTotale += costoPartial;

      batchesUsed.push({
        id: batch.id,
        quantitaUsata,
      });

      batchDetails.push({
        batchId: batch.id,
        costoUnitario,
        quantitaUsata,
        marginePartial,
      });

      rimanenteVendita -= quantitaUsata;
    }

    if (rimanenteVendita > 0) {
      throw new Error("Quantità insufficiente nei lotti disponibili per completare la vendita");
    }

    const ricavoTotale = quantitaVenduta * prezzoVendita;
    const margine = ricavoTotale - costoTotale;

    return {
      margine,
      batchesUsed,
      batchDetails,
    };
  }

  async updateBatchesAfterSale(batchesUsed: { id: string; quantitaUsata: number }[]) {
    const { inventoryBatches } = await import('../migrations/schema');

    for (const batchUsage of batchesUsed) {
      const [updatedBatch] = await db
        .update(inventoryBatches)
        .set({
          quantitaRimanente: sql`${inventoryBatches.quantitaRimanente} - ${batchUsage.quantitaUsata}`
        })
        .where(eq(inventoryBatches.id, batchUsage.id))
        .returning();

      if (updatedBatch) {
        const newRemaining = Number(updatedBatch.quantitaRimanente || 0);
        if (newRemaining <= 0) {
          await db
            .update(inventoryBatches)
            .set({ quantitaRimanente: 0 })
            .where(eq(inventoryBatches.id, batchUsage.id));
        }
      }
    }
  }
