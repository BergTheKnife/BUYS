import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, integer, timestamp, uuid, index, numeric } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
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
  immagineUrl: text("immagine_url"),
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
  dataSpedizione: timestamp("data_spedizione"), // Solo se spedito/consegnato
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("spedizioni_vendita_idx").on(table.venditaId),
  index("spedizioni_activity_idx").on(table.activityId),
]);

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
});

export type UpdateSpedizione = z.infer<typeof updateSpedizioneSchema>;