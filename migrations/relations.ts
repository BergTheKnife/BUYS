import { relations } from "drizzle-orm/relations";
import { users, vendite, inventario, activities, spese, fundTransfers, emailVerificationTokens, passwordResetTokens, rememberTokens, financialHistory } from "./schema";

export const venditeRelations = relations(vendite, ({one}) => ({
	user: one(users, {
		fields: [vendite.userId],
		references: [users.id]
	}),
	inventario: one(inventario, {
		fields: [vendite.inventarioId],
		references: [inventario.id]
	}),
	activity: one(activities, {
		fields: [vendite.activityId],
		references: [activities.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	vendites: many(vendite),
	spese: many(spese),
	fundTransfers: many(fundTransfers),
	inventarios: many(inventario),
	emailVerificationTokens: many(emailVerificationTokens),
	passwordResetTokens: many(passwordResetTokens),
	rememberTokens: many(rememberTokens),
	financialHistories: many(financialHistory),
}));

export const inventarioRelations = relations(inventario, ({one, many}) => ({
	vendites: many(vendite),
	user: one(users, {
		fields: [inventario.userId],
		references: [users.id]
	}),
	activity: one(activities, {
		fields: [inventario.activityId],
		references: [activities.id]
	}),
}));

export const activitiesRelations = relations(activities, ({many}) => ({
	vendites: many(vendite),
	spese: many(spese),
	fundTransfers: many(fundTransfers),
	inventarios: many(inventario),
	financialHistories: many(financialHistory),
}));

export const speseRelations = relations(spese, ({one}) => ({
	user: one(users, {
		fields: [spese.userId],
		references: [users.id]
	}),
	activity: one(activities, {
		fields: [spese.activityId],
		references: [activities.id]
	}),
}));

export const fundTransfersRelations = relations(fundTransfers, ({one}) => ({
	user: one(users, {
		fields: [fundTransfers.userId],
		references: [users.id]
	}),
	activity: one(activities, {
		fields: [fundTransfers.activityId],
		references: [activities.id]
	}),
}));

export const emailVerificationTokensRelations = relations(emailVerificationTokens, ({one}) => ({
	user: one(users, {
		fields: [emailVerificationTokens.userId],
		references: [users.id]
	}),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({one}) => ({
	user: one(users, {
		fields: [passwordResetTokens.userId],
		references: [users.id]
	}),
}));

export const rememberTokensRelations = relations(rememberTokens, ({one}) => ({
	user: one(users, {
		fields: [rememberTokens.userId],
		references: [users.id]
	}),
}));

export const financialHistoryRelations = relations(financialHistory, ({one}) => ({
	user: one(users, {
		fields: [financialHistory.userId],
		references: [users.id]
	}),
	activity: one(activities, {
		fields: [financialHistory.activityId],
		references: [activities.id]
	}),
}));