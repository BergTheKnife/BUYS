import { pgTable, unique, uuid, text, timestamp, integer, foreignKey, numeric, index, varchar } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	nome: text().notNull(),
	cognome: text().notNull(),
	email: text().notNull(),
	username: text().notNull(),
	password: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	lastActivityId: uuid("last_activity_id"),
	emailVerified: timestamp("email_verified", { mode: 'string' }),
	isActive: integer("is_active").default(1),
	profileImageUrl: text("profile_image_url"),
}, (table) => [
	unique("users_email_unique").on(table.email),
	unique("users_username_unique").on(table.username),
]);

export const vendite = pgTable("vendite", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	inventarioId: uuid("inventario_id").notNull(),
	nomeArticolo: text("nome_articolo").notNull(),
	taglia: text().notNull(),
	prezzoVendita: numeric("prezzo_vendita", { precision: 10, scale:  2 }).notNull(),
	incassatoDa: text("incassato_da").notNull(),
	data: timestamp({ mode: 'string' }).notNull(),
	margine: numeric({ precision: 10, scale:  2 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	quantita: integer().default(1).notNull(),
	incassatoSu: text("incassato_su").notNull(),
	activityId: uuid("activity_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "vendite_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.inventarioId],
			foreignColumns: [inventario.id],
			name: "vendite_inventario_id_inventario_id_fk"
		}),
	foreignKey({
			columns: [table.activityId],
			foreignColumns: [activities.id],
			name: "vendite_activity_fk"
		}).onDelete("cascade"),
]);

export const spese = pgTable("spese", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	voce: text().notNull(),
	importo: numeric({ precision: 10, scale:  2 }).notNull(),
	categoria: text().notNull(),
	data: timestamp({ mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	activityId: uuid("activity_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "spese_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.activityId],
			foreignColumns: [activities.id],
			name: "spese_activity_fk"
		}).onDelete("cascade"),
]);

export const fundTransfers = pgTable("fund_transfers", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid().notNull(),
	activityId: uuid().notNull(),
	fromMember: text().notNull(),
	fromAccount: text().notNull(),
	toAccount: text().default('Cassa Reinvestimento').notNull(),
	importo: numeric().notNull(),
	descrizione: text(),
	data: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "fund_transfers_userId_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.activityId],
			foreignColumns: [activities.id],
			name: "fund_transfers_activityId_fkey"
		}).onDelete("cascade"),
]);

export const activityUsers = pgTable("activity_users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	activityId: uuid("activity_id").notNull(),
	userId: uuid("user_id").notNull(),
	joinedAt: timestamp("joined_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("activity_users_activity_idx").using("btree", table.activityId.asc().nullsLast().op("uuid_ops")),
	index("activity_users_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
]);

export const inventario = pgTable("inventario", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	nomeArticolo: text("nome_articolo").notNull(),
	taglia: text().notNull(),
	costo: numeric({ precision: 10, scale:  2 }).notNull(),
	quantita: integer().notNull(),
	immagineUrl: text("immagine_url"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	activityId: uuid("activity_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "inventario_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.activityId],
			foreignColumns: [activities.id],
			name: "inventario_activity_fk"
		}).onDelete("cascade"),
]);

export const activities = pgTable("activities", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	nome: varchar({ length: 100 }).notNull(),
	passwordHash: text("password_hash").notNull(),
	proprietarioId: uuid("proprietario_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("activities_nome_key").on(table.nome),
]);

export const emailVerificationTokens = pgTable("email_verification_tokens", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	token: varchar({ length: 255 }).notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "email_verification_tokens_user_id_fkey"
		}).onDelete("cascade"),
	unique("email_verification_tokens_token_key").on(table.token),
]);

export const passwordResetTokens = pgTable("password_reset_tokens", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	token: text().notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("password_reset_tokens_token_idx").using("btree", table.token.asc().nullsLast().op("text_ops")),
	index("password_reset_tokens_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "password_reset_tokens_user_id_fkey"
		}).onDelete("cascade"),
	unique("password_reset_tokens_token_key").on(table.token),
]);

export const rememberTokens = pgTable("remember_tokens", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	token: text().notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("remember_tokens_token_idx").using("btree", table.token.asc().nullsLast().op("text_ops")),
	index("remember_tokens_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "remember_tokens_user_id_fkey"
		}).onDelete("cascade"),
	unique("remember_tokens_token_key").on(table.token),
]);

export const financialHistory = pgTable("financial_history", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid().notNull(),
	activityId: uuid().notNull(),
	azione: text().notNull(),
	descrizione: text().notNull(),
	importo: numeric(),
	dettagli: text(),
	data: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "financial_history_userId_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.activityId],
			foreignColumns: [activities.id],
			name: "financial_history_activityId_fkey"
		}).onDelete("cascade"),
]);
