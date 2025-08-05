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
  createdAt: timestamp("created_at").defaultNow(),
});

export const inventario = pgTable("inventario", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
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
  inventarioId: uuid("inventario_id").notNull().references(() => inventario.id),
  nomeArticolo: text("nome_articolo").notNull(),
  taglia: text("taglia").notNull(),
  prezzoVendita: decimal("prezzo_vendita", { precision: 10, scale: 2 }).notNull(),
  incassatoDa: text("incassato_da").notNull(),
  data: timestamp("data").notNull(),
  margine: decimal("margine", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const spese = pgTable("spese", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
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
}));

export const inventarioRelations = relations(inventario, ({ one, many }) => ({
  user: one(users, {
    fields: [inventario.userId],
    references: [users.id],
  }),
  vendite: many(vendite),
}));

export const venditeRelations = relations(vendite, ({ one }) => ({
  user: one(users, {
    fields: [vendite.userId],
    references: [users.id],
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
}));

export const insertUserSchema = createInsertSchema(users).omit({
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
  newPassword: z.string().min(6, "La nuova password deve essere di almeno 6 caratteri"),
});

export const insertInventarioSchema = createInsertSchema(inventario).omit({
  id: true,
  userId: true,
  createdAt: true,
}).extend({
  costo: z.string().min(1, "Costo richiesto"),
  quantita: z.number().min(0, "Quantità deve essere almeno 0"),
});

export const insertVenditaSchema = createInsertSchema(vendite).omit({
  id: true,
  userId: true,
  nomeArticolo: true,
  taglia: true,
  margine: true,
  createdAt: true,
}).extend({
  prezzoVendita: z.string().min(1, "Prezzo vendita richiesto"),
  incassatoDa: z.string().min(1, "Metodo di pagamento richiesto"),
  inventarioId: z.string().min(1, "Articolo richiesto"),
});

export const insertSpesaSchema = createInsertSchema(spese).omit({
  id: true,
  userId: true,
  createdAt: true,
}).extend({
  voce: z.string().min(1, "Voce richiesta"),
  importo: z.string().min(1, "Importo richiesto"),
  categoria: z.string().min(1, "Categoria richiesta"),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginUser = z.infer<typeof loginUserSchema>;
export type UpdateProfile = z.infer<typeof updateProfileSchema>;
export type ChangePassword = z.infer<typeof changePasswordSchema>;
export type User = typeof users.$inferSelect;
export type InsertInventario = z.infer<typeof insertInventarioSchema>;
export type Inventario = typeof inventario.$inferSelect;
export type InsertVendita = z.infer<typeof insertVenditaSchema>;
export type Vendita = typeof vendite.$inferSelect;
export type InsertSpesa = z.infer<typeof insertSpesaSchema>;
export type Spesa = typeof spese.$inferSelect;
