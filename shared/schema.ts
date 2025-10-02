import { sql } from 'drizzle-orm';
import { jsonb } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { createInsertSchema } from 'drizzle-zod';
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

// Store Profile - Configurazione tipologia store
export const storeProfiles = pgTable("store_profiles", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  activityId: uuid("activity_id").notNull().references(() => activities.id, { onDelete: "cascade" }).unique(),
  tipologiaStore: text("tipologia_store").notNull(),
  valuta: text("valuta").notNull().default("EUR"),
  paese: text("paese").notNull().default("IT"),
  ivaPredefinita: decimal("iva_predefinita", { precision: 5, scale: 2 }).notNull().default("22.00"),
  // Funzionalità attive (boolean flags)
  hasProduzione: integer("has_produzione").default(0).notNull(),
  hasVetrina: integer("has_vetrina").default(0).notNull(),
  hasVarianti: integer("has_varianti").default(0).notNull(),
  hasSeriali: integer("has_seriali").default(0).notNull(),
  hasLottiScadenze: integer("has_lotti_scadenze").default(0).notNull(),
  hasSpedizioni: integer("has_spedizioni").default(1).notNull(),
  hasServizi: integer("has_servizi").default(0).notNull(),
  hasDigitale: integer("has_digitale").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Materiali Produzione
export const materialiProduzione = pgTable("materiali_produzione", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  activityId: uuid("activity_id").notNull().references(() => activities.id, { onDelete: "cascade" }),
  nomeMateriale: text("nome_materiale").notNull(),
  unita: text("unita").notNull(), // g, m, pz
  colore: text("colore"),
  archiviato: integer("archiviato").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Lotti Materiali
export const lottiMateriali = pgTable("lotti_materiali", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  materialeId: uuid("materiale_id").notNull().references(() => materialiProduzione.id, { onDelete: "cascade" }),
  activityId: uuid("activity_id").notNull().references(() => activities.id, { onDelete: "cascade" }),
  quantitaTotale: decimal("quantita_totale", { precision: 10, scale: 2 }).notNull(),
  quantitaResidua: decimal("quantita_residua", { precision: 10, scale: 2 }).notNull(),
  costoTotale: decimal("costo_totale", { precision: 10, scale: 2 }).notNull(),
  costoPerUnita: decimal("costo_per_unita", { precision: 10, scale: 4 }).notNull(),
  lotto: text("lotto"),
  scadenza: timestamp("scadenza"),
  quotaCassa: decimal("quota_cassa", { precision: 10, scale: 2 }).default("0").notNull(),
  spesaId: uuid("spesa_id").references(() => spese.id), // Collegamento alla spesa
  createdAt: timestamp("created_at").defaultNow(),
});

// Vetrina - Articoli producibili
export const vetrina = pgTable("vetrina", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  activityId: uuid("activity_id").notNull().references(() => activities.id, { onDelete: "cascade" }),
  nomeArticolo: text("nome_articolo").notNull(),
  categoria: text("categoria"),
  lunghezza: decimal("lunghezza", { precision: 6, scale: 2 }),
  larghezza: decimal("larghezza", { precision: 6, scale: 2 }),
  altezza: decimal("altezza", { precision: 6, scale: 2 }),
  costoPrevisto: decimal("costo_previsto", { precision: 10, scale: 2 }),
  archiviato: integer("archiviato").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Materiali necessari per vetrina (BOM)
export const vetrinaMateriali = pgTable("vetrina_materiali", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  vetrinaId: uuid("vetrina_id").notNull().references(() => vetrina.id, { onDelete: "cascade" }),
  materialeId: uuid("materiale_id").notNull().references(() => materialiProduzione.id, { onDelete: "cascade" }),
  quantitaPerPezzo: decimal("quantita_per_pezzo", { precision: 10, scale: 2 }).notNull(),
});

// Consumo materiali (tracking)
export const consumiMateriali = pgTable("consumi_materiali", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  lottoId: uuid("lotto_id").notNull().references(() => lottiMateriali.id),
  venditaId: uuid("vendita_id").references(() => vendite.id),
  quantitaConsumata: decimal("quantita_consumata", { precision: 10, scale: 2 }).notNull(),
  costoConsumo: decimal("costo_consumo", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

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
  // Nuovo campo per vendite da vetrina
  vetrinaId: uuid("vetrina_id").references(() => vetrina.id),
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
  // Nuovo: origine vendita (magazzino o vetrina)
  origine: text("origine").default("magazzino").notNull(), // magazzino | vetrina
  vetrinaId: uuid("vetrina_id").references(() => vetrina.id),
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

// === PRODUZIONE / VETRINA ===
export const productionMaterials = pgTable("production_materials", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  activityId: uuid("activity_id").notNull().references(() => activities.id, { onDelete: "cascade" }),
  nome: text("nome").notNull(),
  unita: varchar("unita", { length: 8 }).notNull(),
  colore: text("colore"),
  archiviato: numeric("archiviato", { precision: 1, scale: 0 }).default("0").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const productionBatches = pgTable("production_batches", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  materialId: uuid("material_id").notNull().references(() => productionMaterials.id, { onDelete: "cascade" }),
  activityId: uuid("activity_id").notNull().references(() => activities.id, { onDelete: "cascade" }),
  quantitaTotale: numeric("quantita_totale", { precision: 12, scale: 3 }).notNull(),
  quantitaRimanente: numeric("quantita_rimanente", { precision: 12, scale: 3 }).notNull(),
  costoTotale: numeric("costo_totale", { precision: 12, scale: 2 }).notNull(),
  costoPerUnita: numeric("costo_per_unita", { precision: 12, scale: 6 }).notNull(),
  spesaId: uuid("spesa_id").references(() => spese.id, { onDelete: "set null" }),
  quotaCassa: numeric("quota_cassa", { precision: 12, scale: 2 }).default("0"),
  dataAcquisto: timestamp("data_acquisto").defaultNow(),
}, (t) => [index("prod_batches_material_idx").on(t.materialId), index("prod_batches_activity_idx").on(t.activityId)]);

export const productionProducts = pgTable("production_products", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  activityId: uuid("activity_id").notNull().references(() => activities.id, { onDelete: "cascade" }),
  nome: text("nome").notNull(),
  categoria: text("categoria"),
  altezza: numeric("altezza", { precision: 8, scale: 2 }),
  larghezza: numeric("larghezza", { precision: 8, scale: 2 }),
  lunghezza: numeric("lunghezza", { precision: 8, scale: 2 }),
  costoOverride: numeric("costo_override", { precision: 12, scale: 2 }),
  archiviato: numeric("archiviato", { precision: 1, scale: 0 }).default("0").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [index("prod_products_activity_idx").on(t.activityId)]);

export const productionProductBom = pgTable("production_product_bom", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: uuid("product_id").notNull().references(() => productionProducts.id, { onDelete: "cascade" }),
  materialId: uuid("material_id").notNull().references(() => productionMaterials.id, { onDelete: "restrict" }),
  quantita: numeric("quantita", { precision: 12, scale: 3 }).notNull(),
}, (t) => [index("prod_bom_product_idx").on(t.productId), index("prod_bom_material_idx").on(t.materialId)]);

export const productionConsumptions = pgTable("production_consumptions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  activityId: uuid("activity_id").notNull().references(() => activities.id, { onDelete: "cascade" }),
  venditaId: uuid("vendita_id"),
  productId: uuid("product_id").references(() => productionProducts.id, { onDelete: "set null" }),
  materialId: uuid("material_id").references(() => productionMaterials.id, { onDelete: "set null" }),
  batchId: uuid("batch_id").references(() => productionBatches.id, { onDelete: "set null" }),
  quantita: numeric("quantita", { precision: 12, scale: 3 }).notNull(),
  costoImputato: numeric("costo_imputato", { precision: 12, scale: 6 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [index("prod_cons_activity_idx").on(t.activityId)]);


// === STORE PROFILE & ATTRIBUTI DINAMICI ===
export const storeProfiles = pgTable("store_profiles", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  activityId: uuid("activity_id").notNull().references(() => activities.id, { onDelete: "cascade" }),
  storeType: varchar("store_type", { length: 64 }).notNull(),
  featureFlags: jsonb("feature_flags").$type<Record<string, boolean>>().notNull().default(sql`'{}'::jsonb`),
  currency: varchar("currency", { length: 8 }).default("EUR"),
  country: varchar("country", { length: 2 }).default("IT"),
  defaultVat: numeric("default_vat", { precision: 5, scale: 2 }).default("22.00"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (t) => [index("store_profile_activity_idx").on(t.activityId)]);

export const productAttributeDefs = pgTable("product_attribute_defs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  activityId: uuid("activity_id").notNull().references(() => activities.id, { onDelete: "cascade" }),
  key: varchar("key", { length: 64 }).notNull(),
  label: varchar("label", { length: 128 }).notNull(),
  type: varchar("type", { length: 24 }).notNull(), // text | number | select | date | bool
  unit: varchar("unit", { length: 16 }),
  required: numeric("required", { precision: 1, scale: 0 }).default("0").notNull(),
  options: jsonb("options"),
  createdAt: timestamp("created_at").defaultNow()
}, (t) => [index("attr_defs_activity_idx").on(t.activityId), index("attr_defs_key_idx").on(t.key)]);

export const productAttributeValues = pgTable("product_attribute_values", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  activityId: uuid("activity_id").notNull().references(() => activities.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull(),
  key: varchar("key", { length: 64 }).notNull(),
  value: text("value").notNull(),
  createdAt: timestamp("created_at").defaultNow()
}, (t) => [index("attr_vals_activity_idx").on(t.activityId), index("attr_vals_prod_idx").on(t.productId), index("attr_vals_key_idx").on(t.key)]);
