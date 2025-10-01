import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, integer, timestamp, uuid, index, numeric } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { z } from "zod";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  nome: text("nome").notNull(),
  cognome: text("cognome").notNull(),
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  profileImageUrl: text("profile_image_url"),
  emailVerified: timestamp("email_verified"),
  isActive: integer("is_active").default(0), // 0 = pending verification, 1 = verified/active
  lastActivityId: uuid("last_activity_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Email verification tokens
export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("email_verification_tokens_user_idx").on(table.userId),
  index("email_verification_tokens_token_idx").on(table.token),
]);

// Password reset tokens (reusing email verification tokens structure)
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("password_reset_tokens_user_idx").on(table.userId),
  index("password_reset_tokens_token_idx").on(table.token),
]);

// Remember Me tokens for auto-login
export const rememberTokens = pgTable("remember_tokens", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("remember_tokens_user_idx").on(table.userId),
  index("remember_tokens_token_idx").on(table.token),
]);

// Activities table
export const activities = pgTable("activities", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  nome: varchar("nome", { length: 100 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  proprietarioId: uuid("proprietario_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Activity users junction table
export const activityUsers = pgTable("activity_users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  activityId: uuid("activity_id").notNull().references(() => activities.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  joinedAt: timestamp("joined_at").defaultNow(),
}, (table) => [
  index("activity_users_activity_idx").on(table.activityId),
  index("activity_users_user_idx").on(table.userId),
]);

export const inventario = pgTable("inventario", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  activityId: uuid("activity_id").notNull().references(() => activities.id, { onDelete: "cascade" }),
  nomeArticolo: text("nome_articolo").notNull(),
  taglia: text("taglia"), // Ora facoltativo
  costo: decimal("costo", { precision: 10, scale: 2 }).notNull(),
  quantita: integer("quantita").notNull(),
  // Campi dimensioni in cm
  lunghezza: decimal("lunghezza", { precision: 6, scale: 2 }), // cm
  larghezza: decimal("larghezza", { precision: 6, scale: 2 }), // cm
  altezza: decimal("altezza", { precision: 6, scale: 2 }), // cm
  cassaCoverage: numeric("cassa_coverage", { precision: 10, scale: 2 }).default("0"),
  immagineUrl: text("immagine_url"),
  archiviato: integer("archiviato").default(0).notNull(), // 0 = attivo, 1 = archiviato (soft-deleted)
  createdAt: timestamp("created_at").defaultNow(),
});

export const vendite = pgTable("vendite", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  activityId: uuid("activity_id").notNull().references(() => activities.id, { onDelete: "cascade" }),
  inventarioId: uuid("inventario_id").notNull().references(() => inventario.id),
  nomeArticolo: text("nome_articolo").notNull(),
  taglia: text("taglia"),
  quantita: integer("quantita").notNull().default(1),
  prezzoVendita: decimal("prezzo_vendita", { precision: 10, scale: 2 }).notNull(),
  // Nuovo campo "venduto a"
  vendutoA: text("venduto_a"),
  // Campo incassato SI/NO - null significa NO, not null significa SI
  incassato: integer("incassato").default(0), // 0 = NO, 1 = SI
  incassatoDa: text("incassato_da"), // Ora condizionale
  incassatoSu: text("incassato_su"), // Ora condizionale
  data: timestamp("data").notNull(),
  margine: decimal("margine", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const spese = pgTable("spese", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  activityId: uuid("activity_id").notNull().references(() => activities.id, { onDelete: "cascade" }),
  voce: text("voce").notNull(),
  importo: decimal("importo", { precision: 10, scale: 2 }).notNull(),
  categoria: text("categoria").notNull(),
  data: timestamp("data").notNull(),
  itemId: uuid("item_id").references(() => inventario.id), // Riferimento puntuale all'articolo (se applicabile)
  createdAt: timestamp("created_at").defaultNow(),
});

// Fund transfers table for "Riunisci fondi" functionality
export const fundTransfers = pgTable("fund_transfers", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  activityId: uuid("activity_id").notNull().references(() => activities.id, { onDelete: "cascade" }),
  fromMember: text("from_member").notNull(), // Chi ha trasferito i fondi
  fromAccount: text("from_account").notNull(), // Da quale conto
  toAccount: text("to_account").notNull().default("Cassa Reinvestimento"), // Verso quale conto
  importo: decimal("importo", { precision: 10, scale: 2 }).notNull(),
  descrizione: text("descrizione"), // Descrizione opzionale del trasferimento
  data: timestamp("data").notNull().defaultNow(),
});

// Financial history table for tracking all financial management actions
export const financialHistory = pgTable("financial_history", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  activityId: uuid("activity_id").notNull().references(() => activities.id, { onDelete: "cascade" }),
  azione: text("azione").notNull(), // Tipo di azione (es. "Riunisci fondi", "Vendita registrata")
  descrizione: text("descrizione").notNull(), // Descrizione dell'azione
  importo: decimal("importo", { precision: 10, scale: 2 }), // Importo coinvolto (opzionale)
  dettagli: text("dettagli"), // JSON stringificato con dettagli aggiuntivi
  itemId: uuid("item_id").references(() => inventario.id), // Riferimento puntuale all'articolo (se applicabile)
  data: timestamp("data").defaultNow(),
});

// Spedizioni e Consegne table - ogni vendita genera automaticamente una spedizione
export const spedizioni = pgTable("spedizioni", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  activityId: uuid("activity_id").notNull().references(() => activities.id, { onDelete: "cascade" }),
  venditaId: uuid("vendita_id").notNull().references(() => vendite.id, { onDelete: "cascade" }),
  // Duplicati dalla vendita per query veloci
  nomeArticolo: text("nome_articolo").notNull(),
  taglia: text("taglia"),
  quantita: integer("quantita").notNull().default(1),
  vendutoA: text("venduto_a"),
  // Stato spedizione
  speditoConsegnato: integer("spedito_consegnato").default(0), // 0 = da spedire, 1 = spedito
  numeroTracking: text("numero_tracking"), // New tracking field
  dataSpedizione: timestamp("data_spedizione"), // Solo se spedito/consegnato
  createdAt: timestamp("created_at").defaultNow(),
});

export const emailVerificationTokensRelations = relations(emailVerificationTokens, ({ one }) => ({
  user: one(users, {
    fields: [emailVerificationTokens.userId],
    references: [users.id],
  }),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, {
    fields: [passwordResetTokens.userId],
    references: [users.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  inventario: many(inventario),
  vendite: many(vendite),
  spese: many(spese),
  fundTransfers: many(fundTransfers),
  financialHistory: many(financialHistory),
  spedizioni: many(spedizioni),
  ownedActivities: many(activities),
  activityMemberships: many(activityUsers),
  emailVerificationTokens: many(emailVerificationTokens),
  productionMaterials: many(productionMaterials),
  materialBatches: many(materialBatches),
  productShowcase: many(productShowcase),
}));

export const activitiesRelations = relations(activities, ({ one, many }) => ({
  proprietario: one(users, {
    fields: [activities.proprietarioId],
    references: [users.id],
  }),
  members: many(activityUsers),
  inventario: many(inventario),
  vendite: many(vendite),
  spese: many(spese),
  fundTransfers: many(fundTransfers),
  financialHistory: many(financialHistory),
  spedizioni: many(spedizioni),
  storeConfig: one(storeConfig),
  productionMaterials: many(productionMaterials),
  materialBatches: many(materialBatches),
  productShowcase: many(productShowcase),
}));

export const activityUsersRelations = relations(activityUsers, ({ one }) => ({
  activity: one(activities, {
    fields: [activityUsers.activityId],
    references: [activities.id],
  }),
  user: one(users, {
    fields: [activityUsers.userId],
    references: [users.id],
  }),
}));

export const inventarioRelations = relations(inventario, ({ one, many }) => ({
  user: one(users, {
    fields: [inventario.userId],
    references: [users.id],
  }),
  activity: one(activities, {
    fields: [inventario.activityId],
    references: [activities.id],
  }),
  vendite: many(vendite),
}));

export const venditeRelations = relations(vendite, ({ one, many }) => ({
  user: one(users, {
    fields: [vendite.userId],
    references: [users.id],
  }),
  activity: one(activities, {
    fields: [vendite.activityId],
    references: [activities.id],
  }),
  inventario: one(inventario, {
    fields: [vendite.inventarioId],
    references: [inventario.id],
  }),
  spedizione: one(spedizioni, {
    fields: [vendite.id],
    references: [spedizioni.venditaId],
  }),
}));

export const speseRelations = relations(spese, ({ one }) => ({
  user: one(users, {
    fields: [spese.userId],
    references: [users.id],
  }),
  activity: one(activities, {
    fields: [spese.activityId],
    references: [activities.id],
  }),
}));

export const fundTransfersRelations = relations(fundTransfers, ({ one }) => ({
  user: one(users, {
    fields: [fundTransfers.userId],
    references: [users.id],
  }),
  activity: one(activities, {
    fields: [fundTransfers.activityId],
    references: [activities.id],
  }),
}));

export const financialHistoryRelations = relations(financialHistory, ({ one }) => ({
  user: one(users, {
    fields: [financialHistory.userId],
    references: [users.id],
  }),
  activity: one(activities, {
    fields: [financialHistory.activityId],
    references: [activities.id],
  }),
}));

export const spedizioniRelations = relations(spedizioni, ({ one }) => ({
  user: one(users, {
    fields: [spedizioni.userId],
    references: [users.id],
  }),
  activity: one(activities, {
    fields: [spedizioni.activityId],
    references: [activities.id],
  }),
  vendita: one(vendite, {
    fields: [spedizioni.venditaId],
    references: [vendite.id],
  }),
}));

// Store Configuration table - configurazione tipologia di store per activity
export const storeConfig = pgTable("store_config", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  activityId: uuid("activity_id").notNull().references(() => activities.id, { onDelete: "cascade" }).unique(),
  tipologiaStore: text("tipologia_store").notNull(), // Es. "Abbigliamento & Accessori"
  valuta: text("valuta").notNull().default("EUR"),
  paese: text("paese").notNull().default("IT"),
  ivaPredefinita: decimal("iva_predefinita", { precision: 5, scale: 2 }).notNull().default("22.00"),
  // Funzionalità attive (flag booleani come integer 0/1)
  produzione: integer("produzione").notNull().default(0),
  vetrina: integer("vetrina").notNull().default(0),
  varianti: integer("varianti").notNull().default(0),
  serialiImei: integer("seriali_imei").notNull().default(0),
  lottiScadenze: integer("lotti_scadenze").notNull().default(0),
  spedizioni: integer("spedizioni").notNull().default(1),
  servizi: integer("servizi").notNull().default(0),
  digitale: integer("digitale").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Production Materials table - materiali per produzione
export const productionMaterials = pgTable("production_materials", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  activityId: uuid("activity_id").notNull().references(() => activities.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  nomeMateriale: text("nome_materiale").notNull(),
  unita: text("unita").notNull(), // "grammi (g)", "metri (m)", "pezzi (pz)"
  colore: text("colore"),
  archiviato: integer("archiviato").default(0).notNull(), // 0 = attivo, 1 = archiviato
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("production_materials_activity_idx").on(table.activityId),
]);

// Material Batches table - lotti materiali con FIFO/FEFO
export const materialBatches = pgTable("material_batches", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  materialId: uuid("material_id").notNull().references(() => productionMaterials.id, { onDelete: "cascade" }),
  activityId: uuid("activity_id").notNull().references(() => activities.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  quantitaTotale: decimal("quantita_totale", { precision: 12, scale: 3 }).notNull(), // Supporta decimali per grammi/metri
  quantitaResidua: decimal("quantita_residua", { precision: 12, scale: 3 }).notNull(),
  costoTotale: decimal("costo_totale", { precision: 10, scale: 2 }).notNull(),
  costoPerUnita: decimal("costo_per_unita", { precision: 10, scale: 6 }).notNull(), // Più precisione per piccole unità
  lotto: text("lotto"), // Codice lotto opzionale
  scadenza: timestamp("scadenza"), // Data scadenza opzionale (obbligatoria se store ha lottiScadenze)
  cassaCoverage: numeric("cassa_coverage", { precision: 10, scale: 2 }).default("0"), // Quota coperta dalla cassa reinvestimento
  dataAcquisto: timestamp("data_acquisto").notNull().defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("material_batches_material_idx").on(table.materialId),
  index("material_batches_activity_idx").on(table.activityId),
]);

// Product Showcase table - vetrina prodotti che so produrre
export const productShowcase = pgTable("product_showcase", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  activityId: uuid("activity_id").notNull().references(() => activities.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  nomeArticolo: text("nome_articolo").notNull(),
  categoria: text("categoria"),
  // Dimensioni opzionali in cm
  altezza: decimal("altezza", { precision: 6, scale: 2 }),
  larghezza: decimal("larghezza", { precision: 6, scale: 2 }),
  lunghezza: decimal("lunghezza", { precision: 6, scale: 2 }),
  costoPrevisto: decimal("costo_previsto", { precision: 10, scale: 2 }).notNull(), // Calcolato automaticamente, modificabile
  archiviato: integer("archiviato").default(0).notNull(), // 0 = attivo, 1 = archiviato
  usatoAlmenoUnaVolta: integer("usato_almeno_una_volta").default(0).notNull(), // 0 = mai usato, 1 = usato
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("product_showcase_activity_idx").on(table.activityId),
]);

// Showcase-Material Links table - relazione tra prodotti vetrina e materiali necessari
export const showcaseMaterialLinks = pgTable("showcase_material_links", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  showcaseId: uuid("showcase_id").notNull().references(() => productShowcase.id, { onDelete: "cascade" }),
  materialId: uuid("material_id").notNull().references(() => productionMaterials.id, { onDelete: "restrict" }), // Prevent deletion if used
  quantitaPerPezzo: decimal("quantita_per_pezzo", { precision: 12, scale: 3 }).notNull(), // Quantità materiale necessaria per 1 pezzo
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("showcase_material_links_showcase_idx").on(table.showcaseId),
  index("showcase_material_links_material_idx").on(table.materialId),
]);

// Relations for new production tables
export const storeConfigRelations = relations(storeConfig, ({ one }) => ({
  activity: one(activities, {
    fields: [storeConfig.activityId],
    references: [activities.id],
  }),
}));

export const productionMaterialsRelations = relations(productionMaterials, ({ one, many }) => ({
  activity: one(activities, {
    fields: [productionMaterials.activityId],
    references: [activities.id],
  }),
  user: one(users, {
    fields: [productionMaterials.userId],
    references: [users.id],
  }),
  batches: many(materialBatches),
  showcaseLinks: many(showcaseMaterialLinks),
}));

export const materialBatchesRelations = relations(materialBatches, ({ one }) => ({
  material: one(productionMaterials, {
    fields: [materialBatches.materialId],
    references: [productionMaterials.id],
  }),
  activity: one(activities, {
    fields: [materialBatches.activityId],
    references: [activities.id],
  }),
  user: one(users, {
    fields: [materialBatches.userId],
    references: [users.id],
  }),
}));

export const productShowcaseRelations = relations(productShowcase, ({ one, many }) => ({
  activity: one(activities, {
    fields: [productShowcase.activityId],
    references: [activities.id],
  }),
  user: one(users, {
    fields: [productShowcase.userId],
    references: [users.id],
  }),
  materialLinks: many(showcaseMaterialLinks),
}));

export const showcaseMaterialLinksRelations = relations(showcaseMaterialLinks, ({ one }) => ({
  showcase: one(productShowcase, {
    fields: [showcaseMaterialLinks.showcaseId],
    references: [productShowcase.id],
  }),
  material: one(productionMaterials, {
    fields: [showcaseMaterialLinks.materialId],
    references: [productionMaterials.id],
  }),
}));

export const insertUserSchema = createInsertSchema(users, {
  email: z.string().email("Email non valida"),
  password: z.string()
    .min(6, "La password deve essere di almeno 6 caratteri")
    .regex(/(?=.*[A-Z])/, "La password deve contenere almeno una lettera maiuscola")
    .regex(/(?=.*\d)/, "La password deve contenere almeno un numero"),
  username: z.string().min(3, "Username deve essere di almeno 3 caratteri"),
}).omit({
  id: true,
  createdAt: true,
});

export const loginUserSchema = z.object({
  emailOrUsername: z.string().min(1, "Email o username richiesto"),
  password: z.string().min(1, "Password richiesta"),
  rememberMe: z.boolean().optional(),
});

export const updateProfileSchema = z.object({
  nome: z.string().min(1, "Nome richiesto"),
  cognome: z.string().min(1, "Cognome richiesto"),
  email: z.string().email("Email non valida"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Password attuale richiesta"),
  newPassword: z.string()
    .min(6, "La nuova password deve essere di almeno 6 caratteri")
    .regex(/(?=.*[A-Z])/, "La password deve contenere almeno una lettera maiuscola")
    .regex(/(?=.*\d)/, "La password deve contenere almeno un numero"),
});

export const updateUsernameSchema = z.object({
  username: z.string().min(3, "Username deve essere di almeno 3 caratteri"),
});

export const forgotPasswordSchema = z.object({
  emailOrUsername: z.string().min(1, "Email o username richiesto"),
});

export const resetPasswordSchema = z.object({
  newPassword: z.string()
    .min(6, "La password deve essere di almeno 6 caratteri")
    .regex(/(?=.*[A-Z])/, "La password deve contenere almeno una lettera maiuscola")
    .regex(/(?=.*\d)/, "La password deve contenere almeno un numero"),
});

// Activity schemas
export const insertActivitySchema = createInsertSchema(activities, {
  nome: z.string().min(1, "Nome attività richiesto").max(100, "Nome troppo lungo"),
  passwordHash: z.string().min(6, "Password deve essere di almeno 6 caratteri"),
}).omit({
  id: true,
  proprietarioId: true,
  createdAt: true,
  updatedAt: true,
});

export const joinActivitySchema = z.object({
  nome: z.string().min(1),
  password: z.string().min(6),
});

export const inventoryBatchSchema = z.object({
  id: z.string(),
  inventarioId: z.string(),
  activityId: z.string(),
  userId: z.string(),
  costo: z.string(),
  quantitaIniziale: z.number(),
  quantitaRimanente: z.number(),
  dataAcquisto: z.string(),
  createdAt: z.string().optional(),
});

export type InventoryBatch = z.infer<typeof inventoryBatchSchema>;

export const restockItemSchema = z.object({
  quantita: z.number().min(1),
  costo: z.string().optional(), // Nuovo costo opzionale
});

export const insertInventarioSchema = createInsertSchema(inventario, {
  taglia: z.string().optional(),
  lunghezza: z.string().optional(),
  larghezza: z.string().optional(),
  altezza: z.string().optional(),
}).omit({
  id: true,
  userId: true,
  activityId: true,  // Excluded because it's added server-side
  createdAt: true,
  immagineUrl: true,
});

export const insertVenditaSchema = createInsertSchema(vendite, {
  vendutoA: z.string().optional(),
  incassato: z.number().min(0).max(1).default(0),
  incassatoDa: z.string().optional(),
  incassatoSu: z.string().optional(),
}).omit({
  id: true,
  userId: true,
  activityId: true,  // Excluded because it's added server-side
  nomeArticolo: true,
  taglia: true,
  margine: true,
  createdAt: true,
});

export const insertSpesaSchema = createInsertSchema(spese).omit({
  id: true,
  userId: true,
  activityId: true,  // Excluded because it's added server-side
  createdAt: true,
});

export const insertFundTransferSchema = createInsertSchema(fundTransfers).omit({
  id: true,
  userId: true,
  activityId: true,  // Excluded because it's added server-side
  data: true, // Will be set to current time
});

export const insertFinancialHistorySchema = createInsertSchema(financialHistory).omit({
  id: true,
  userId: true,
  activityId: true,  // Excluded because it's added server-side
  data: true, // Will be set to current time
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginUser = z.infer<typeof loginUserSchema>;
export type UpdateProfile = z.infer<typeof updateProfileSchema>;
export type ChangePassword = z.infer<typeof changePasswordSchema>;
export type UpdateUsername = z.infer<typeof updateUsernameSchema>;
export type User = typeof users.$inferSelect;
export type InsertInventario = z.infer<typeof insertInventarioSchema>;
export type Inventario = typeof inventario.$inferSelect;
export type InsertVendita = z.infer<typeof insertVenditaSchema>;
export type Vendita = typeof vendite.$inferSelect;
export type InsertSpesa = z.infer<typeof insertSpesaSchema>;
export type Spesa = typeof spese.$inferSelect;
export type InsertFundTransfer = z.infer<typeof insertFundTransferSchema>;
export type FundTransfer = typeof fundTransfers.$inferSelect;
export type InsertFinancialHistory = z.infer<typeof insertFinancialHistorySchema>;
export type FinancialHistory = typeof financialHistory.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type JoinActivity = z.infer<typeof joinActivitySchema>;
export type ActivityUser = typeof activityUsers.$inferSelect;
export type InsertActivityUser = typeof activityUsers.$inferInsert;
export type EmailVerificationToken = typeof emailVerificationTokens.$inferSelect;
export type InsertEmailVerificationToken = typeof emailVerificationTokens.$inferInsert;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;

export type ForgotPassword = z.infer<typeof forgotPasswordSchema>;
export type ResetPassword = z.infer<typeof resetPasswordSchema>;

// Nuovi tipi per spedizioni
export type Spedizione = typeof spedizioni.$inferSelect;
export type InsertSpedizione = typeof spedizioni.$inferInsert;

// Schema per aggiornare spedizione
export const updateSpedizioneSchema = z.object({
  speditoConsegnato: z.number().min(0).max(1),
  numeroTracking: z.string().optional(), // Aggiunto campo tracking opzionale
});

export type UpdateSpedizione = z.infer<typeof updateSpedizioneSchema>;

// Schemi per inventario
export const getInventarioFilteredSchema = z.object({
  filtro: z.string().optional(),
  campo: z.string().optional(), // Campo su cui filtrare
  valore: z.string().optional(), // Valore del filtro
});

export type GetInventarioFiltered = z.infer<typeof getInventarioFilteredSchema>;

// Production schemas
export const insertStoreConfigSchema = createInsertSchema(storeConfig, {
  tipologiaStore: z.string().min(1, "Tipologia store richiesta"),
  valuta: z.string().default("EUR"),
  paese: z.string().default("IT"),
  ivaPredefinita: z.string().default("22.00"),
}).omit({
  id: true,
  activityId: true, // Added server-side
  createdAt: true,
  updatedAt: true,
});

export const insertProductionMaterialSchema = createInsertSchema(productionMaterials, {
  nomeMateriale: z.string().min(1, "Nome materiale richiesto"),
  unita: z.enum(["grammi (g)", "metri (m)", "pezzi (pz)"], { 
    errorMap: () => ({ message: "Unità non valida" }) 
  }),
  colore: z.string().optional(),
}).omit({
  id: true,
  userId: true,
  activityId: true,
  archiviato: true,
  createdAt: true,
});

export const insertMaterialBatchSchema = createInsertSchema(materialBatches, {
  lotto: z.string().optional(),
  scadenza: z.string().optional(), // Will be converted to timestamp
}).omit({
  id: true,
  materialId: true,
  userId: true,
  activityId: true,
  costoPerUnita: true, // Calculated
  cassaCoverage: true, // Calculated
  dataAcquisto: true,
  createdAt: true,
});

export const insertProductShowcaseSchema = createInsertSchema(productShowcase, {
  nomeArticolo: z.string().min(1, "Nome articolo richiesto"),
  categoria: z.string().optional(),
  altezza: z.string().optional(),
  larghezza: z.string().optional(),
  lunghezza: z.string().optional(),
}).omit({
  id: true,
  userId: true,
  activityId: true,
  archiviato: true,
  usatoAlmenoUnaVolta: true,
  createdAt: true,
});

export const insertShowcaseMaterialLinkSchema = createInsertSchema(showcaseMaterialLinks).omit({
  id: true,
  createdAt: true,
});

// Types for production
export type StoreConfig = typeof storeConfig.$inferSelect;
export type InsertStoreConfig = z.infer<typeof insertStoreConfigSchema>;

export type ProductionMaterial = typeof productionMaterials.$inferSelect;
export type InsertProductionMaterial = z.infer<typeof insertProductionMaterialSchema>;

export type MaterialBatch = typeof materialBatches.$inferSelect;
export type InsertMaterialBatch = z.infer<typeof insertMaterialBatchSchema>;

export type ProductShowcase = typeof productShowcase.$inferSelect;
export type InsertProductShowcase = z.infer<typeof insertProductShowcaseSchema>;

export type ShowcaseMaterialLink = typeof showcaseMaterialLinks.$inferSelect;
export type InsertShowcaseMaterialLink = z.infer<typeof insertShowcaseMaterialLinkSchema>;