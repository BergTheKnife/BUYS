import { test } from "node:test";
import assert from "node:assert/strict";
import { computeStockInAmount, InventoryAccountingError, clampCassaCoverage, recordInventoryStockIn } from "../server/inventoryAccounting";

test("computeStockInAmount: quantity * unit cost, exact to the cent", () => {
  assert.equal(computeStockInAmount(10, 5.5), "55.00");
  assert.equal(computeStockInAmount(3, 19.99), "59.97");
  assert.equal(computeStockInAmount(1, 0.1), "0.10");
});

test("computeStockInAmount: avoids classic floating point drift", () => {
  // 0.1 + 0.2 style drift would corrupt this if done with plain floats
  assert.equal(computeStockInAmount(7, 0.29), "2.03");
  assert.equal(computeStockInAmount(3, 1.15), "3.45");
});

test("computeStockInAmount: rejects non-positive or non-integer quantity", () => {
  assert.throws(() => computeStockInAmount(0, 10), InventoryAccountingError);
  assert.throws(() => computeStockInAmount(-1, 10), InventoryAccountingError);
  assert.throws(() => computeStockInAmount(1.5, 10), InventoryAccountingError);
  assert.throws(() => computeStockInAmount(Number.NaN, 10), InventoryAccountingError);
});

test("computeStockInAmount: rejects non-positive unit cost", () => {
  assert.throws(() => computeStockInAmount(5, 0), InventoryAccountingError);
  assert.throws(() => computeStockInAmount(5, -3), InventoryAccountingError);
  assert.throws(() => computeStockInAmount(5, Number.NaN), InventoryAccountingError);
});

test("computeStockInAmount: amount equals qty * unit cost regardless of a different weighted-average cost", () => {
  // Restocking 5 units at 8.00 must always cost 40.00, even if the item's
  // current (post-update) weighted-average cost ends up being something else.
  const movementAmount = computeStockInAmount(5, 8.0);
  assert.equal(movementAmount, "40.00");

  // Simulate what the (buggy) weighted-average based calculation would have produced,
  // to document why it must never be used to derive the expense amount.
  const priorQty = 10;
  const priorCost = 4.0;
  const newQty = priorQty + 5;
  const weightedAvgCost = (priorQty * priorCost + 5 * 8.0) / newQty;
  const wrongAmount = (5 * weightedAvgCost).toFixed(2);
  assert.notEqual(movementAmount, wrongAmount);
});

test("clampCassaCoverage: covers up to the expense amount, never more, never negative", () => {
  assert.equal(clampCassaCoverage(100, 40), 40); // plenty of cassa -> fully covered
  assert.equal(clampCassaCoverage(10, 40), 10); // partial cassa -> capped at balance
  assert.equal(clampCassaCoverage(0, 40), 0); // empty cassa -> no coverage
  assert.equal(clampCassaCoverage(-5, 40), 0); // negative balance never subsidizes further
});

// A minimal in-memory stand-in for the drizzle transactional query builder,
// just enough to exercise recordInventoryStockIn's control flow without a
// real database. `.where()` ignores its argument and returns every row of
// the matching table, which is fine because each test seeds at most one row.
function makeFakeTrx(spesaTable: any, batchesTableRef: any) {
  const expensesRows: any[] = [];
  const batchesRows: any[] = [];
  let idCounter = 1;
  const nextId = () => `id-${idCounter++}`;

  return {
    trx: {
      select() {
        return {
          from(table: any) {
            return {
              where() {
                return Promise.resolve(table === spesaTable ? expensesRows : batchesRows);
              },
            };
          },
        };
      },
      insert(table: any) {
        return {
          values(v: any) {
            return {
              returning() {
                const row = { id: nextId(), ...v };
                if (table === spesaTable) expensesRows.push(row);
                else batchesRows.push(row);
                return Promise.resolve([row]);
              },
            };
          },
        };
      },
    },
    expensesRows,
    batchesRows,
  };
}

test("recordInventoryStockIn: creates exactly one linked expense + batch, using injected deps (no real DB)", async () => {
  const { spese } = await import("../shared/schema");
  const { inventoryBatches } = await import("../migrations/schema");
  const { trx, expensesRows, batchesRows } = makeFakeTrx(spese, inventoryBatches);

  const deps = {
    getCassaReinvestimentoBalance: async () => 15, // partial coverage available
    updateCassaReinvestimento: async () => ({}),
  };

  const result = await recordInventoryStockIn(
    trx,
    {
      inventarioId: "item-1",
      activityId: "activity-1",
      userId: "user-1",
      nomeArticolo: "Maglietta",
      taglia: "M",
      quantita: 10,
      costoUnitario: 5,
    },
    deps
  );

  assert.equal(result.deduplicated, false);
  assert.equal(result.expense.importo, "50.00");
  assert.equal(result.expense.categoria, "Inventario");
  assert.equal(result.expense.nonEliminabile, 1);
  assert.equal(result.expense.itemId, "item-1");
  assert.equal(result.batch.spesaId, result.expense.id);
  assert.equal(result.batch.quantitaIniziale, 10);
  assert.equal(result.fromCassa, 15); // clamped to the available cassa balance
  assert.equal(expensesRows.length, 1);
  assert.equal(batchesRows.length, 1);
});

test("recordInventoryStockIn: a retried call with the same idempotencyKey does not create a duplicate", async () => {
  const { spese } = await import("../shared/schema");
  const { inventoryBatches } = await import("../migrations/schema");
  const { trx, expensesRows, batchesRows } = makeFakeTrx(spese, inventoryBatches);

  const deps = {
    getCassaReinvestimentoBalance: async () => 0,
    updateCassaReinvestimento: async () => ({}),
  };

  const params = {
    inventarioId: "item-1",
    activityId: "activity-1",
    userId: "user-1",
    nomeArticolo: "Maglietta",
    quantita: 10,
    costoUnitario: 5,
    idempotencyKey: "retry-key-1",
  };

  const first = await recordInventoryStockIn(trx, params, deps);
  const second = await recordInventoryStockIn(trx, params, deps);

  assert.equal(first.deduplicated, false);
  assert.equal(second.deduplicated, true);
  assert.equal(second.batch.id, first.batch.id);
  assert.equal(expensesRows.length, 1); // still exactly one expense created
  assert.equal(batchesRows.length, 1); // still exactly one batch created
});

