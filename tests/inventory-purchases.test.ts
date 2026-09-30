import assert from "node:assert/strict";
import { test } from "node:test";
import { getTableName } from "drizzle-orm";

process.env.DATABASE_URL ??= "postgresql://localhost/test";
const { createInitialInventoryPurchase, restockInventoryPurchase } = await import("../server/inventory-purchases");
const { recordInventoryStockIn } = await import("../server/inventoryAccounting");

const activityId = "activity-1";
const userId = "user-1";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function getParameters(condition: any) {
  const values: Record<string, unknown> = {};
  let column: string | undefined;
  const visit = (part: any) => {
    if (Array.isArray(part?.queryChunks)) {
      part.queryChunks.forEach(visit);
    } else if (part?.name) {
      column = part.name;
    } else if (part?.constructor?.name === "Param" && column) {
      values[column] = part.value;
      column = undefined;
    }
  };
  visit(condition);
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [
    key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()),
    value,
  ]));
}

class FakeTransaction {
  constructor(private state: any, private failOnTable?: string) {}

  select() {
    const query: any = {
      from: (table: any) => {
        query.table = getTableName(table);
        return query;
      },
      where: (condition: any) => {
        query.conditions = getParameters(condition);
        return query;
      },
      limit: () => query,
      for: () => query,
      then: (resolve: any, reject: any) => {
        const rows = this.state[query.table] || [];
        const matched = rows.filter((row: any) =>
          Object.entries(query.conditions || {}).every(([key, value]) => row[key] === value),
        );
        return Promise.resolve(matched).then(resolve, reject);
      },
    };
    return query;
  }

  insert(table: any) {
    const tableName = getTableName(table);
    return {
      values: (values: any) => {
        const insertRow = () => {
          if (tableName === this.failOnTable) {
            throw new Error(`simulated ${tableName} insert failure`);
          }
          const row = {
            ...values,
            id: `${tableName}-${this.state[tableName].length + 1}`,
            ...(tableName === "inventario" ? { archiviato: 0 } : {}),
          };
          this.state[tableName].push(row);
          return row;
        };
        let inserted: any;
        const execute = () => {
          if (!inserted) inserted = insertRow();
          return inserted;
        };
        return {
          returning: async () => [execute()],
          then: (resolve: any, reject: any) => Promise.resolve(execute()).then(resolve, reject),
        };
      },
    };
  }

  update(table: any) {
    const tableName = getTableName(table);
    return {
      set: (values: any) => ({
        where: (condition: any) => ({
          returning: async () => {
            const matches = getParameters(condition);
            const row = this.state[tableName].find((candidate: any) =>
              Object.entries(matches).every(([key, value]) => candidate[key] === value),
            );
            if (!row) return [];
            Object.assign(row, values);
            return [row];
          },
        }),
      }),
    };
  }
}

class FakeDatabase {
  state = { inventario: [] as any[], spese: [] as any[], inventory_batches: [] as any[] };

  constructor(private failOnTable?: string) {}

  async transaction<T>(callback: (tx: any) => Promise<T>) {
    const nextState = clone(this.state);
    const result = await callback(new FakeTransaction(nextState, this.failOnTable));
    this.state = nextState;
    return result;
  }
}

function initialData(idempotencyKey: string) {
  return {
    nomeArticolo: "Maglia Azzurra",
    taglia: "XL",
    costo: "13.50",
    quantita: 10,
    userId,
    activityId,
    immagineUrl: null,
    idempotencyKey,
  } as any;
}

test("initial purchase creates an item, linked lot and exact expense", async () => {
  const database = new FakeDatabase();
  const initialKey = "00000000-0000-4000-8000-000000000001";
  const item = await createInitialInventoryPurchase(initialData(initialKey), database as any);
  await createInitialInventoryPurchase(initialData(initialKey), database as any);
  const [batch] = database.state.inventory_batches;
  const [expense] = database.state.spese;

  assert.equal(item.quantita, 10);
  assert.equal(batch.costo, "13.50");
  assert.equal(batch.quantitaIniziale, 10);
  assert.equal(batch.spesaId, expense.id);
  assert.equal(batch.idempotencyKey, initialKey);
  assert.equal(expense.itemId, item.id);
  assert.equal(expense.importo, "135.00");
  assert.equal(expense.categoria, "Inventario");
  assert.equal(database.state.inventario.length, 1);
  assert.equal(database.state.inventory_batches.length, 1);
  assert.equal(database.state.spese.length, 1);
});

test("restock keeps its own cost and expense and can be retried without duplicates", async () => {
  const database = new FakeDatabase();
  const item = await createInitialInventoryPurchase(initialData("00000000-0000-4000-8000-000000000001"), database as any);
  const restock = {
    inventarioId: item.id,
    userId,
    activityId,
    quantita: 5,
    costo: "10.00",
    idempotencyKey: "00000000-0000-4000-8000-000000000002",
  };

  await restockInventoryPurchase(restock, database as any);
  const retriedItem = await restockInventoryPurchase(restock, database as any);
  const [initialBatch, restockBatch] = database.state.inventory_batches;

  assert.equal(retriedItem.quantita, 15);
  assert.equal(database.state.inventory_batches.length, 2);
  assert.equal(database.state.spese.length, 2);
  assert.equal(initialBatch.costo, "13.50");
  assert.equal(restockBatch.costo, "10.00");
  assert.equal(restockBatch.spesaId, database.state.spese[1].id);
  assert.equal(database.state.spese[1].importo, "50.00");
  assert.match(database.state.spese[1].voce, /Rifornimento Maglia Azzurra XL — 5 × 10,00 €/);
  assert.equal(database.state.spese.reduce((sum, expense) => sum + Number(expense.importo), 0), 185);
});

test("purchase writes roll back when an expense or lot insert fails", async () => {
  for (const failOnTable of ["spese", "inventory_batches"]) {
    const database = new FakeDatabase(failOnTable);

    await assert.rejects(
      createInitialInventoryPurchase(
        initialData(failOnTable === "spese"
          ? "00000000-0000-4000-8000-000000000003"
          : "00000000-0000-4000-8000-000000000004"),
        database as any,
      ),
      new RegExp(`simulated ${failOnTable} insert failure`),
    );
    assert.deepEqual(database.state, { inventario: [], spese: [], inventory_batches: [] });
  }
});

test("restock is fully rolled back when the lot insert fails", async () => {
  const database = new FakeDatabase();
  const item = await createInitialInventoryPurchase(initialData("00000000-0000-4000-8000-000000000001"), database as any);
  const before = clone(database.state);
  const failingDatabase = {
    transaction: async (callback: (tx: any) => Promise<unknown>) => {
      const nextState = clone(database.state);
      const result = await callback(new FakeTransaction(nextState, "inventory_batches"));
      database.state = nextState;
      return result;
    },
  };

  await assert.rejects(
    restockInventoryPurchase({
      inventarioId: item.id,
      userId,
      activityId,
      quantita: 5,
      costo: "10.00",
      idempotencyKey: "00000000-0000-4000-8000-000000000005",
    }, failingDatabase as any),
    /simulated inventory_batches insert failure/,
  );

  assert.deepEqual(database.state, before);
});

test("legacy stock-in helper links the expense without a cash-box movement", async () => {
  const database = new FakeDatabase();
  const result = await database.transaction((tx) => recordInventoryStockIn(tx, {
    inventarioId: "inventory-1",
    userId,
    activityId,
    nomeArticolo: "Maglia Azzurra",
    taglia: "XL",
    quantita: 10,
    costoUnitario: 13.5,
    idempotencyKey: "00000000-0000-4000-8000-000000000006",
  }));

  assert.equal(result.fromCassa, 0);
  assert.equal(result.batch.spesaId, result.expense.id);
  assert.equal(result.batch.quotaCassa, "0.00");
  assert.equal(database.state.spese.length, 1);
});
