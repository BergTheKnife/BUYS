import { test } from "node:test";
import assert from "node:assert/strict";
import { computeStockInAmount, InventoryAccountingError } from "../server/inventoryAccounting";

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
