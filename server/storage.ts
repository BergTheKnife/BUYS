  async calculateFIFOMargin(inventarioId: string, quantitaVenduta: number, prezzoVendita: number) {
    const { inventoryBatches } = await import('../migrations/schema');

    const [inventoryItem] = await db
      .select()
      .from(inventario)
      .where(eq(inventario.id, inventarioId));

    if (!inventoryItem || inventoryItem.quantita < quantitaVenduta) {
      throw new Error("Quantità insufficiente in magazzino per completare la vendita");
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
      .orderBy(inventoryBatches.dataAcquisto);

    const totalAvailableFromBatches = batches.reduce((sum, batch) => sum + batch.quantitaRimanente, 0);

    // Important: for FIFO, the margin must be based on the historical cost of the batch being consumed,
    // not on the current average price of the inventory item.
    const currentCostPerUnit = Number(inventoryItem.costo);

    if (batches.length === 0 || totalAvailableFromBatches === 0) {
      const costoTotale = quantitaVenduta * currentCostPerUnit;
      const ricavoTotale = quantitaVenduta * prezzoVendita;
      const margine = ricavoTotale - costoTotale;

      return {
        margine,
        batchesUsed: [],
        batchDetails: [{
          batchId: null,
          costoUnitario: currentCostPerUnit,
          quantitaUsata: quantitaVenduta,
          marginePartial: margine
        }]
      };
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

      const quantitaUsata = Math.min(rimanenteVendita, batch.quantitaRimanente);

      // FIFO must use the original cost of the batch being consumed.
      // inventoryItem.costo is the current average cost and should not drive the sold-item margin.
      const costoUnitario = Number(batch.costo);
      const costoPartial = quantitaUsata * costoUnitario;
      const ricavoPartial = quantitaUsata * prezzoVendita;
      const marginePartial = ricavoPartial - costoPartial;

      costoTotale += costoPartial;

      batchesUsed.push({
        id: batch.id,
        quantitaUsata: quantitaUsata
      });

      batchDetails.push({
        batchId: batch.id,
        costoUnitario,
        quantitaUsata,
        marginePartial
      });

      rimanenteVendita -= quantitaUsata;
    }

    const ricavoTotale = quantitaVenduta * prezzoVendita;
    const margine = ricavoTotale - costoTotale;

    return {
      margine,
      batchesUsed,
      batchDetails
    };
  }
