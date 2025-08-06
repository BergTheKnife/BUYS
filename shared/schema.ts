import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, integer, timestamp, uuid } from "drizzle-orm/pg-core";
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
  ultimaAttivitaId: uuid("ultima_attivita_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const attivita = pgTable("attivita", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  nome: text("nome").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  proprietarioId: uuid("proprietario_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  membri: text("membri").array().notNull().default(sql`'{}'`),
  createdAt: timestamp("created_at").defaultNow(),
});

export const inventario = pgTable("inventario", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  attivitaId: uuid("attivita_id").notNull().references(() => attivita.id, { onDelete: "cascade" }),
  nomeArticolo: text("nome_articolo").notNull(),
  taglia: text("taglia").notNull(),
  costo: decimal("costo", { precision: 10, scale: 2 }).notNull(),
  quantita: integer("quantita").notNull(),
  immagineUrl: text("immagine_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const vendite = pgTable("vendite", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  attivitaId: uuid("attivita_id").notNull().references(() => attivita.id, { onDelete: "cascade" }),
  inventarioId: uuid("inventario_id").notNull().references(() => inventario.id),
  nomeArticolo: text("nome_articolo").notNull(),
  taglia: text("taglia").notNull(),
  quantita: integer("quantita").notNull().default(1),
  prezzoVendita: decimal("prezzo_vendita", { precision: 10, scale: 2 }).notNull(),
  incassatoDa: text("incassato_da").notNull(),
  incassatoSu: text("incassato_su").notNull(),
  data: timestamp("data").notNull(),
  margine: decimal("margine", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const spese = pgTable("spese", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  attivitaId: uuid("attivita_id").notNull().references(() => attivita.id, { onDelete: "cascade" }),
  voce: text("voce").notNull(),
  importo: decimal("importo", { precision: 10, scale: 2 }).notNull(),
  categoria: text("categoria").notNull(),
  data: timestamp("data").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  inventario: many(inventario),
  vendite: many(vendite),
  spese: many(spese),
  attivitaProprietario: many(attivita),
}));

export const attivitaRelations = relations(attivita, ({ one, many }) => ({
  proprietario: one(users, {
    fields: [attivita.proprietarioId],
    references: [users.id],
  }),
  inventario: many(inventario),
  vendite: many(vendite),
  spese: many(spese),
}));

export const inventarioRelations = relations(inventario, ({ one, many }) => ({
  user: one(users, {
    fields: [inventario.userId],
    references: [users.id],
  }),
  attivita: one(attivita, {
    fields: [inventario.attivitaId],
    references: [attivita.id],
  }),
  vendite: many(vendite),
}));

export const venditeRelations = relations(vendite, ({ one }) => ({
  user: one(users, {
    fields: [vendite.userId],
    references: [users.id],
  }),
  attivita: one(attivita, {
    fields: [vendite.attivitaId],
    references: [attivita.id],
  }),
  inventario: one(inventario, {
    fields: [vendite.inventarioId],
    references: [inventario.id],
  }),
}));

export const speseRelations = relations(spese, ({ one }) => ({
  user: one(users, {
    fields: [spese.userId],
    references: [users.id],
  }),
  attivita: one(attivita, {
    fields: [spese.attivitaId],
    references: [attivita.id],
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

export const insertAttivitaSchema = createInsertSchema(attivita, {
  nome: z.string().min(1, "Nome attività richiesto").max(50, "Nome troppo lungo"),
  passwordHash: z.string().min(6, "Password deve essere di almeno 6 caratteri"),
}).omit({
  id: true,
  proprietarioId: true,
  membri: true,
  createdAt: true,
});

export const joinAttivitaSchema = z.object({
  nome: z.string().min(1, "Nome attività richiesto"),
  password: z.string().min(1, "Password richiesta"),
});

export const insertInventarioSchema = createInsertSchema(inventario).omit({
  id: true,
  userId: true,
  attivitaId: true,
  createdAt: true,
  immagineUrl: true,
});

export const insertVenditaSchema = createInsertSchema(vendite).omit({
  id: true,
  userId: true,
  attivitaId: true,
  nomeArticolo: true,
  taglia: true,
  margine: true,
  createdAt: true,
});

export const insertSpesaSchema = createInsertSchema(spese).omit({
  id: true,
  userId: true,
  attivitaId: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginUser = z.infer<typeof loginUserSchema>;
export type UpdateProfile = z.infer<typeof updateProfileSchema>;
export type ChangePassword = z.infer<typeof changePasswordSchema>;
export type UpdateUsername = z.infer<typeof updateUsernameSchema>;
export type User = typeof users.$inferSelect;
export type InsertAttivita = z.infer<typeof insertAttivitaSchema>;
export type JoinAttivita = z.infer<typeof joinAttivitaSchema>;
export type Attivita = typeof attivita.$inferSelect;
export type InsertInventario = z.infer<typeof insertInventarioSchema>;
export type Inventario = typeof inventario.$inferSelect;
export type InsertVendita = z.infer<typeof insertVenditaSchema>;
export type Vendita = typeof vendite.$inferSelect;
export type InsertSpesa = z.infer<typeof insertSpesaSchema>;
export type Spesa = typeof spese.$inferSelect;
