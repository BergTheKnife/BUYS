
import { pgTable, uuid, text, integer, decimal, timestamp, date, uniqueIndex, sql } from "drizzle-orm/pg-core";
import { users, activities } from "./schema"; // riusa utenti/attività esistenti

// ===============================
// STORE CONFIG (uno per activity)
// ===============================
export const storeConfig = pgTable("store_config", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  activityId: uuid("activity_id").notNull().references(() => activities.id, { onDelete: "cascade" }),
  tipologiaStore: text("tipologia_store").notNull(),
  valuta: text("valuta").notNull().default("EUR"),
  paese: text("paese").notNull().default("IT"),
  ivaPredefinita: decimal("iva_predefinita", { precision: 5, scale: 2 }).notNull().default("22.00"),
  // Flag funzionalità (0/1)
  produzione: integer("produzione").notNull().default(0),
  vetrina: integer("vetrina").notNull().default(0),
  varianti: integer("varianti").notNull().default(0),
  serialiImei: integer("seriali_imei").notNull().default(0),
  lottiScadenze: integer("lotti_scadenze").notNull().default(0),
  spedizioni: integer("spedizioni").notNull().default(1),
  servizi: integer("servizi").notNull().default(0),
  digitale: integer("digitale").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  uniqActivity: uniqueIndex("store_config_activity_unique").on(t.activityId),
}));

export type StoreConfig = typeof storeConfig.$inferSelect;
export type InsertStoreConfig = typeof storeConfig.$inferInsert;

// ===============================
// MATERIALI DI PRODUZIONE
// ===============================
export const productionMaterials = pgTable("production_materials", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  activityId: uuid("activity_id").notNull().references(() => activities.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  nomeMateriale: text("nome_materiale").notNull(),
  unita: text("unita").notNull(), // "grammi (g)" | "metri (m)" | "pezzi (pz)"
  colore: text("colore"),
  archiviato: integer("archiviato").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export type ProductionMaterial = typeof productionMaterials.$inferSelect;
export type InsertProductionMaterial = typeof productionMaterials.$inferInsert;

// ===============================
// LOTTI MATERIALI
// ===============================
export const materialBatches = pgTable("material_batches", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  materialId: uuid("material_id").notNull().references(() => productionMaterials.id, { onDelete: "cascade" }),
  activityId: uuid("activity_id").notNull().references(() => activities.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  quantitaTotale: decimal("quantita_totale", { precision: 18, scale: 6 }).notNull(),
  quantitaResidua: decimal("quantita_residua", { precision: 18, scale: 6 }).notNull(),
  costoTotale: decimal("costo_totale", { precision: 12, scale: 2 }).notNull(),
  costoPerUnita: decimal("costo_per_unita", { precision: 18, scale: 6 }).notNull(),
  lotto: text("lotto"),
  scadenza: date("scadenza"),
  dataAcquisto: timestamp("data_acquisto").defaultNow(),
  cassaCoverage: decimal("cassa_coverage", { precision: 12, scale: 2 }).notNull().default("0.00"),
});

export type MaterialBatch = typeof materialBatches.$inferSelect;
export type InsertMaterialBatch = typeof materialBatches.$inferInsert;

// ===============================
// VETRINA PRODOTTI (ricette)
// ===============================
export const productShowcase = pgTable("product_showcase", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  activityId: uuid("activity_id").notNull().references(() => activities.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  nomeArticolo: text("nome_articolo").notNull(),
  categoria: text("categoria"),
  altezza: decimal("altezza", { precision: 10, scale: 2 }),
  larghezza: decimal("larghezza", { precision: 10, scale: 2 }),
  lunghezza: decimal("lunghezza", { precision: 10, scale: 2 }),
  costoPrevisto: decimal("costo_previsto", { precision: 12, scale: 2 }).notNull().default("0.00"),
  archiviato: integer("archiviato").notNull().default(0),
  usatoAlmenoUnaVolta: integer("usato_almeno_una_volta").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export type ProductShowcase = typeof productShowcase.$inferSelect;
export type InsertProductShowcase = typeof productShowcase.$inferInsert;

// ===============================
// LINK VETRINA ⇄ MATERIALI
// ===============================
export const showcaseMaterialLinks = pgTable("showcase_material_links", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  showcaseId: uuid("showcase_id").notNull().references(() => productShowcase.id, { onDelete: "cascade" }),
  materialId: uuid("material_id").notNull().references(() => productionMaterials.id, { onDelete: "restrict" }),
  quantitaPerPezzo: decimal("quantita_per_pezzo", { precision: 18, scale: 6 }).notNull(),
});

export type ShowcaseMaterialLink = typeof showcaseMaterialLinks.$inferSelect;
export type InsertShowcaseMaterialLink = typeof showcaseMaterialLinks.$inferInsert;
