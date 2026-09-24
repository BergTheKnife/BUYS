import {
  users,
  inventario,
  vendite,
  spese,
  fundTransfers,
  financialHistory,
  activities,
  activityUsers,
  emailVerificationTokens,
  passwordResetTokens,
  rememberTokens,
  spedizioni,
  equityWithdrawals,
  type User,
  type InsertUser,
  type Inventario,
  type InsertInventario,
  type Vendita,
  type InsertVendita,
  type Spesa,
  type InsertSpesa,
  type FundTransfer,
  type InsertFundTransfer,
  type FinancialHistory,
  type InsertFinancialHistory,
  type Activity,
  type InsertActivity,
  type ActivityUser,
  type InsertActivityUser,
  type EmailVerificationToken,
  type InsertEmailVerificationToken,
  type PasswordResetToken,
  type InsertPasswordResetToken,
  type Spedizione,
  type InsertSpedizione,
  type UpdateSpedizione,
  type EquityWithdrawal,
  type InsertEquityWithdrawal,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sum, sql, gte, lt, lte, or, like, ilike, inArray, ne } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByEmailOrUsername(emailOrUsername: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;

  verifyUserEmail(id: string): Promise<User | undefined>;

  // Email verification methods
  createEmailVerificationToken(token: InsertEmailVerificationToken): Promise<EmailVerificationToken>;
  getEmailVerificationToken(token: string): Promise<EmailVerificationToken | undefined>;
  deleteEmailVerificationToken(token: string): Promise<boolean>;
  deleteEmailVerificationTokenByUserId(userId: string): Promise<void>;
  deleteExpiredTokens(): Promise<void>;

  // Password reset methods
  createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  deletePasswordResetToken(token: string): Promise<boolean>;
  deletePasswordResetTokensByUserId(userId: string): Promise<void>;
  deleteExpiredPasswordResetTokens(): Promise<void>;

  // Remember Me token methods
  createRememberToken(userId: string, token: string, expiresAt: Date): Promise<void>;
  getRememberToken(token: string): Promise<{ userId: string; expiresAt: Date } | undefined>;
  deleteRememberToken(token: string): Promise<void>;
  cleanupExpiredRememberTokens(): Promise<void>;

  // Activity methods
  createActivity(activity: InsertActivity & { proprietarioId: string }): Promise<Activity>;
  getActivitiesByUserId(userId: string): Promise<Activity[]>;
  getActivityByName(nome: string): Promise<Activity | undefined>;
  getActivityById(id: string): Promise<Activity | undefined>;
  joinActivity(activityId: string, userId: string): Promise<void>;
  leaveActivity(activityId: string, userId: string): Promise<void>;
  addUserToActivity(userId: string, activityId: string): Promise<void>;
  removeUserFromActivity(userId: string, activityId: string): Promise<void>;

  // Inventory methods (now with activity context)
  getInventoryByActivity(activityId: string): Promise<Inventario[]>;
  getInventoryItem(id: string, activityId: string): Promise<Inventario | undefined>;
  createInventoryItem(item: InsertInventario & { userId: string; activityId: string; immagineUrl?: string | null }): Promise<Inventario>;
  updateInventoryItem(id: string, activityId: string, updates: Partial<InsertInventario>): Promise<Inventario | undefined>;

  // 🗂️ MODALITÀ 1: ARCHIVIAZIONE - Solo soft-delete, nessun ripristino cassa
  archiveInventoryItem(id: string, activityId: string): Promise<boolean>;

  // 🗑️ MODALITÀ 2: ELIMINAZIONE DEFINITIVA - Rollback completo se nessuna dipendenza
  permanentlyDeleteInventoryItem(id: string, activityId: string): Promise<{success: boolean, error?: string}>;

  // Mantieni per compatibilità (ora rimappa ad archiviazione di default)
  deleteInventoryItem(id: string, activityId: string): Promise<boolean>;
  updateInventoryQuantity(id: string, newQuantity: number): Promise<Inventario | undefined>;

  // Sales methods (now with activity context)
  getSalesByActivity(activityId: string): Promise<Vendita[]>;
  createSale(sale: InsertVendita & { userId: string; activityId: string; nomeArticolo: string; taglia: string; margine: string; origine?: string; productionProductId?: string | null }): Promise<Vendita>;
  getSaleById(id: string, activityId: string): Promise<Vendita | null>;
  updateSale(id: string, activityId: string, updates: Partial<InsertVendita> & { nomeArticolo?: string; taglia?: string | null; margine?: string }): Promise<Vendita | null>;
  deleteSale(id: string, activityId: string): Promise<boolean>;

  // Expenses methods (now with activity context)
  getExpensesByActivity(activityId: string): Promise<Spesa[]>;
  createExpense(expense: InsertSpesa & { userId: string; activityId: string }): Promise<Spesa>;
  updateExpense(id: string, activityId: string, updates: Partial<InsertSpesa>): Promise<Spesa | undefined>;
  deleteExpense(id: string, activityId: string): Promise<boolean>;

  // Statistics methods (now with activity context)
  getActivityStats(activityId: string): Promise<{
    inventoryCount: number;
    totalSales: number;
    totalExpenses: number;
    netMargin: number;
  }>;
  getTopSellingItemsByActivity(activityId: string): Promise<Array<{
    nomeArticolo: string;
    taglia: string | null;
    totalQuantity: number;
    totalRevenue: number;
  }>>;

  // Activity history and members
  getActivityHistoryByActivity(activityId: string, filter?: string, month?: string, year?: string): Promise<Array<{
    id: string;
    type: 'sale' | 'expense' | 'inventory';
    description: string;
    amount: number;
    data: string;
    details?: any;
  }>>;

  getActivityMembers(activityId: string): Promise<Array<{
    id: string;
    nome: string;
    cognome: string;
    displayName: string;
  }>>;

  // Admin methods
  getAdminUsers(): Promise<Array<{
    id: string;
    nome: string;
    cognome: string;
    email: string;
    username: string;
    isActive: number;
    emailVerified: string | null;
    createdAt: string;
    activitiesCount: number;
    salesCount: number;
    inventoryCount: number;
  }>>;

  getAdminActivities(): Promise<Array<{
    id: string;
    nome: string;
    proprietarioNome: string;
    proprietarioEmail: string;
    membersCount: number;
    inventoryCount: number;
    salesCount: number;
    expensesCount: number;
    createdAt: string;
    hasData: boolean;
  }>>;

  userHasData(userId: string): Promise<boolean>;
  activityHasData(activityId: string): Promise<boolean>;
  deleteUser(userId: string): Promise<void>;
  deleteActivity(activityId: string): Promise<void>;
  updateUserProfileImage(userId: string, profileImageUrl: string): Promise<User>;
  updateUserProfile(userId: string, profileData: { nome: string; cognome: string; email: string }): Promise<User>;
  getChartDataByActivity(activityId: string): Promise<{
    salesData: Array<{date: string, amount: number}>;
    expensesData: Array<{date: string, amount: number}>;
    marginData: Array<{date: string, amount: number}>;
    months: string[];
  }>;

  // Fund transfer methods
  getFundTransfersByActivity(activityId: string): Promise<FundTransfer[]>;
  createFundTransfers(transfers: Array<InsertFundTransfer & { userId: string; activityId: string }>): Promise<FundTransfer[]>;

  // Financial history methods
  getFinancialHistoryByActivity(activityId: string): Promise<FinancialHistory[]>;
  createFinancialHistoryEntry(entry: InsertFinancialHistory & { userId: string; activityId: string }): Promise<FinancialHistory>;
  deleteFinancialHistoryEntry(entryId: string, activityId: string): Promise<boolean>;

  // Spedizioni methods
  getSpedizioniByActivity(activityId: string): Promise<Spedizione[]>;
  createSpedizione(spedizione: InsertSpedizione & { userId: string; activityId: string }): Promise<Spedizione>;
  updateSpedizioneStatus(id: string, activityId: string, updates: UpdateSpedizione): Promise<Spedizione | null>;
  deleteSpedizione(id: string, activityId: string): Promise<boolean>;
  getVenditeConSpedizioni(activityId: string): Promise<Array<{
    id: string;
    nomeArticolo: string;
    taglia: string | null;
    quantita: number;
    prezzoVendita: string;
    vendutoA: string | null;
    data: Date;
    margine: string;
    spedizione: {
      id: string;
      speditoConsegnato: number;
      dataSpedizione: Date | null;
    };
  }>>;

  // Equity Withdrawal Methods
  getCassaReinvestimento(activityId: string): Promise<number>;
  updateCassaReinvestimento(activityId: string, importo: number, descrizione: string, userId: string, tx?: any): Promise<number>;
  createEquityWithdrawal(
    activityId: string,
    userId: string,
    data: { importo: number; tipo: string; memberId?: string; descrizione?: string; data?: string }
  ): Promise<{ withdrawal: EquityWithdrawal; nuovoSaldo: number }>;
  getEquityWithdrawals(
    activityId: string,
    filters: { from?: string; to?: string; tipo?: string; memberId?: string }
  ): Promise<{ withdrawals: EquityWithdrawal[]; totals: { totale: number; rimborsi: number; dividendi: number } }>;
  annullaEquityWithdrawal(withdrawalId: string, activityId: string, userId: string): Promise<{ success: boolean; nuovoSaldo: number }>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getUserByEmailOrUsername(emailOrUsername: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(
      or(eq(users.email, emailOrUsername), eq(users.username, emailOrUsername))
    );
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async deleteUser(id: string): Promise<void> {
    await db
      .delete(users)
      .where(eq(users.id, id));
  }

  async verifyUserEmail(id: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({
        emailVerified: new Date(),
        isActive: 1
      })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  // Email verification methods
  async createEmailVerificationToken(token: InsertEmailVerificationToken): Promise<EmailVerificationToken> {
    const [newToken] = await db
      .insert(emailVerificationTokens)
      .values(token)
      .returning();
    return newToken;
  }

  async getEmailVerificationToken(token: string): Promise<EmailVerificationToken | undefined> {
    const [emailToken] = await db
      .select()
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.token, token));
    return emailToken || undefined;
  }

  async deleteEmailVerificationToken(token: string): Promise<boolean> {
    const result = await db
      .delete(emailVerificationTokens)
      .where(eq(emailVerificationTokens.token, token));
    return result.rowCount! > 0;
  }

  async deleteEmailVerificationTokensByUserId(userId: string): Promise<void> {
    await db
      .delete(emailVerificationTokens)
      .where(eq(emailVerificationTokens.userId, userId));
  }

  async deleteEmailVerificationTokenByUserId(userId: string): Promise<void> {
    await this.deleteEmailVerificationTokensByUserId(userId);
  }

  async deleteExpiredTokens(): Promise<void> {
    await db
      .delete(emailVerificationTokens)
      .where(sql`${emailVerificationTokens.expiresAt} < NOW()`);
  }

  // Password reset methods
  async createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken> {
    const [newToken] = await db
      .insert(passwordResetTokens)
      .values(token)
      .returning();
    return newToken;
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const [passwordToken] = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token));
    return passwordToken || undefined;
  }

  async deletePasswordResetToken(token: string): Promise<boolean> {
    const result = await db
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token));
    return result.rowCount! > 0;
  }

  async deletePasswordResetTokensByUserId(userId: string): Promise<void> {
    await db
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, userId));
  }

  async deleteExpiredPasswordResetTokens(): Promise<void> {
    await db
      .delete(passwordResetTokens)
      .where(sql`${passwordResetTokens.expiresAt} < NOW()`);
  }

  // Remember Me token implementation
  async createRememberToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    await db.insert(rememberTokens).values({
      userId,
      token,
      expiresAt,
    });
  }

  async getRememberToken(token: string): Promise<{ userId: string; expiresAt: Date } | undefined> {
    const result = await db
      .select({
        userId: rememberTokens.userId,
        expiresAt: rememberTokens.expiresAt,
      })
      .from(rememberTokens)
      .where(eq(rememberTokens.token, token))
      .limit(1);

    return result[0];
  }

  async deleteRememberToken(token: string): Promise<void> {
    await db.delete(rememberTokens).where(eq(rememberTokens.token, token));
  }

  async cleanupExpiredRememberTokens(): Promise<void> {
    await db
      .delete(rememberTokens)
      .where(sql`${rememberTokens.expiresAt} < NOW()`);
  }

  // Activity methods
  async createActivity(activity: InsertActivity & { proprietarioId: string }): Promise<Activity> {
    const [newActivity] = await db
      .insert(activities)
      .values(activity)
      .returning();

    await db.insert(activityUsers).values({
      activityId: newActivity.id,
      userId: activity.proprietarioId,
    });

    await db
      .update(users)
      .set({ lastActivityId: newActivity.id })
      .where(eq(users.id, activity.proprietarioId));

    return newActivity;
  }

  async getActivitiesByUserId(userId: string): Promise<Activity[]> {
    const userActivities = await db
      .select({
        id: activities.id,
        nome: activities.nome,
        passwordHash: activities.passwordHash,
        proprietarioId: activities.proprietarioId,
        createdAt: activities.createdAt,
        updatedAt: activities.updatedAt,
      })
      .from(activities)
      .innerJoin(activityUsers, eq(activities.id, activityUsers.activityId))
      .where(eq(activityUsers.userId, userId));

    return userActivities;
  }

  async getActivityByName(nome: string): Promise<Activity | undefined> {
    const [activity] = await db
      .select()
      .from(activities)
      .where(eq(activities.nome, nome));
    return activity || undefined;
  }

  async getActivityById(id: string): Promise<Activity | undefined> {
    const [activity] = await db
      .select()
      .from(activities)
      .where(eq(activities.id, id));
    return activity || undefined;
  }

  async joinActivity(activityId: string, userId: string): Promise<void> {
    const [existingMembership] = await db
      .select()
      .from(activityUsers)
      .where(and(
        eq(activityUsers.activityId, activityId),
        eq(activityUsers.userId, userId)
      ));

    if (!existingMembership) {
      await db.insert(activityUsers).values({
        activityId,
        userId,
      });
    }

    await db
      .update(users)
      .set({ lastActivityId: activityId })
      .where(eq(users.id, userId));
  }

  async leaveActivity(activityId: string, userId: string): Promise<void> {
    await db
      .delete(activityUsers)
      .where(and(
        eq(activityUsers.activityId, activityId),
        eq(activityUsers.userId, userId)
      ));

    await db
      .update(users)
      .set({ lastActivityId: null })
      .where(and(
        eq(users.id, userId),
        eq(users.lastActivityId, activityId)
      ));
  }

  async addUserToActivity(userId: string, activityId: string): Promise<void> {
    const [existingMembership] = await db
      .select()
      .from(activityUsers)
      .where(and(
        eq(activityUsers.userId, userId),
        eq(activityUsers.activityId, activityId)
      ));

    if (!existingMembership) {
      await db.insert(activityUsers).values({
        userId,
        activityId,
      });
    }
  }

  async removeUserFromActivity(userId: string, activityId: string): Promise<void> {
    await db
      .delete(activityUsers)
      .where(and(
        eq(activityUsers.userId, userId),
        eq(activityUsers.activityId, activityId)
      ));

    await db
      .update(users)
      .set({ lastActivityId: null })
      .where(and(
        eq(users.id, userId),
        eq(users.lastActivityId, activityId)
      ));
  }

  // Admin methods
  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(users.createdAt);
  }

  async getAllActivities() {
    return await db
      .select({
        id: activities.id,
        nome: activities.nome,
        proprietarioId: activities.proprietarioId,
        createdAt: activities.createdAt,
        proprietarioNome: users.nome,
        proprietarioEmail: users.email,
        proprietarioUsername: users.username
      })
      .from(activities)
      .leftJoin(users, eq(activities.proprietarioId, users.id))
      .orderBy(activities.createdAt);
  }

  async getUserActivities(userId: string) {
    return await db
      .select({
        activityId: activities.id,
        nome: activities.nome,
        proprietarioId: activities.proprietarioId,
        createdAt: activities.createdAt,
        joinedAt: activityUsers.joinedAt
      })
      .from(activityUsers)
      .innerJoin(activities, eq(activityUsers.activityId, activities.id))
      .where(eq(activityUsers.userId, userId))
      .orderBy(activityUsers.joinedAt);
  }

  async updateLastActivity(userId: string, activityId: string): Promise<void> {
    await db
      .update(users)
      .set({ lastActivityId: activityId })
      .where(eq(users.id, userId));
  }

  // Updated inventory methods with activity context
  async getInventoryByActivity(activityId: string): Promise<Inventario[]> {
    return await db.select().from(inventario)
      .where(and(
        eq(inventario.activityId, activityId),
        eq(inventario.archiviato, 0)
      ))
      .orderBy(desc(inventario.createdAt));
  }

  async getInventoryByActivityHistorical(activityId: string): Promise<Inventario[]> {
    return await db.select().from(inventario)
      .where(eq(inventario.activityId, activityId))
      .orderBy(desc(inventario.createdAt));
  }

  async getInventoryItem(id: string, activityId: string): Promise<Inventario | undefined> {
    const [item] = await db.select().from(inventario).where(
      and(
        eq(inventario.id, id), 
        eq(inventario.activityId, activityId),
        eq(inventario.archiviato, 0)
      )
    );
    return item || undefined;
  }

  async createInventoryItem(itemData: InsertInventario & { userId: string; activityId: string; immagineUrl?: string | null }): Promise<Inventario> {
    const [item] = await db.insert(inventario).values(itemData).returning();

    const totalCost = Number(itemData.costo) * itemData.quantita;

    const cassaBalance = await this.getCassaReinvestimentoBalance(itemData.activityId);
    let amountFromCassa = 0;
    let remainingCost = totalCost;

    if (cassaBalance > 0) {
      amountFromCassa = Math.min(cassaBalance, totalCost);
      remainingCost = totalCost - amountFromCassa;

      await this.updateCassaReinvestimento(
        itemData.activityId,
        -amountFromCassa,
        `Acquisto articolo (copertura cassa): ${itemData.nomeArticolo} - ${itemData.taglia} (${itemData.quantita} pz)`,
        itemData.userId
      );
    }

    const fundingDetails = amountFromCassa > 0 
      ? `Costo totale €${totalCost.toFixed(2)} (€${amountFromCassa.toFixed(2)} da cassa reinvestimento + €${remainingCost.toFixed(2)} fondi personali)`
      : `Costo totale €${totalCost.toFixed(2)} (fondi personali)`;

    await this.createExpense({
      userId: itemData.userId,
      activityId: itemData.activityId,
      voce: `Inventario: ${itemData.nomeArticolo} - ${itemData.taglia} (${itemData.quantita} pz) - ${fundingDetails}`,
      importo: totalCost.toString(),
      categoria: "Inventario",
      data: new Date(),
      itemId: item.id
    });

    await this.createInventoryBatch({
      inventarioId: item.id,
      activityId: itemData.activityId,
      userId: itemData.userId,
      costo: itemData.costo,
      quantita: itemData.quantita,
    });

    await db.update(inventario)
      .set({ cassaCoverage: amountFromCassa.toString() })
      .where(eq(inventario.id, item.id));

    return { ...item, cassaCoverage: amountFromCassa.toString() };
  }

  async updateInventoryItem(id: string, activityId: string, updates: Partial<InsertInventario>): Promise<Inventario | undefined> {
    const currentItem = await this.getInventoryItem(id, activityId);
    if (!currentItem) return undefined;

    const [updatedItem] = await db
      .update(inventario)
      .set(updates)
      .where(and(eq(inventario.id, id), eq(inventario.activityId, activityId)))
      .returning();

    if (updates.nomeArticolo || updates.taglia || updates.costo) {
      const relatedSales = await db
        .select()
        .from(vendite)
        .where(eq(vendite.inventarioId, id));

      for (const sale of relatedSales) {
        const salesUpdates: any = {};

        if (updates.nomeArticolo) {
          salesUpdates.nomeArticolo = updates.nomeArticolo;
        }
        if (updates.taglia) {
          salesUpdates.taglia = updates.taglia;
        }

        if (Object.keys(salesUpdates).length > 0) {
          await db
            .update(vendite)
            .set(salesUpdates)
            .where(eq(vendite.id, sale.id));
        }
      }
    }

    if (updates.costo !== undefined && Number(updates.costo) !== Number(currentItem.costo)) {
      const existingQuantity = currentItem.quantita;

      if (existingQuantity > 0) {
        const oldCostTotal = Number(currentItem.costo) * existingQuantity;
        const newCostTotal = Number(updates.costo) * existingQuantity;
        const costDifference = newCostTotal - oldCostTotal;

        if (Math.abs(costDifference) > 0.001) {
          const originalCassaCoverage = Number(currentItem.cassaCoverage || 0);

          if (costDifference > 0) {
            const cassaBalance = await this.getCassaReinvestimentoBalance(activityId);
            const amountToCover = Math.min(cassaBalance, costDifference);

            if (amountToCover > 0) {
              await this.updateCassaReinvestimento(
                activityId,
                -amountToCover,
                `Aggiustamento costo (aumento): ${updatedItem.nomeArticolo} - ${updatedItem.taglia} (${existingQuantity} pz)`,
                updatedItem.userId
              );

              const newCassaCoverage = originalCassaCoverage + amountToCover;
              await db.update(inventario)
                .set({ cassaCoverage: newCassaCoverage.toString() })
                .where(eq(inventario.id, updatedItem.id));
            }

            const existingExpense = await db
              .select()
              .from(spese)
              .where(and(
                eq(spese.activityId, activityId),
                eq(spese.itemId, updatedItem.id),
                eq(spese.categoria, "Inventario")
              ))
              .limit(1);

            if (existingExpense.length > 0) {
              await db.update(spese)
                .set({ 
                  importo: newCostTotal.toString(),
                  voce: `${updatedItem.nomeArticolo}${updatedItem.taglia ? ` - ${updatedItem.taglia}` : ''} (${existingQuantity} pz) - Costo aggiornato`
                })
                .where(eq(spese.id, existingExpense[0].id));
            } else {
              await this.createExpense({
                userId: updatedItem.userId,
                activityId: activityId,
                voce: `${updatedItem.nomeArticolo}${updatedItem.taglia ? ` - ${updatedItem.taglia}` : ''} (${existingQuantity} pz) - Costo aggiornato`,
                importo: newCostTotal.toString(),
                categoria: "Inventario",
                data: new Date(),
                itemId: updatedItem.id
              });
            }
          } else if (costDifference < 0) {
            const costReduction = Math.abs(costDifference);
            const maxCassaCoverageNeeded = Math.min(newCostTotal, originalCassaCoverage);
            const amountToReturn = originalCassaCoverage - maxCassaCoverageNeeded;

            if (amountToReturn > 0) {
              await this.updateCassaReinvestimento(
                activityId,
                amountToReturn,
                `Aggiustamento costo (riduzione): ${updatedItem.nomeArticolo} - ${updatedItem.taglia} (${existingQuantity} pz)`,
                updatedItem.userId
              );

              const newCassaCoverage = originalCassaCoverage - amountToReturn;
              await db.update(inventario)
                .set({ cassaCoverage: newCassaCoverage.toString() })
                .where(eq(inventario.id, updatedItem.id));
            }

            const existingExpense = await db
              .select()
              .from(spese)
              .where(and(
                eq(spese.activityId, activityId),
                eq(spese.itemId, updatedItem.id),
                eq(spese.categoria, "Inventario")
              ))
              .limit(1);

            if (existingExpense.length > 0) {
              await db.update(spese)
                .set({ 
                  importo: newCostTotal.toString(),
                  voce: `${updatedItem.nomeArticolo}${updatedItem.taglia ? ` - ${updatedItem.taglia}` : ''} (${existingQuantity} pz) - Costo aggiornato`
                })
                .where(eq(spese.id, existingExpense[0].id));
            }
          }
        }
      }
    }

    if (updates.quantita !== undefined && updates.quantita !== currentItem.quantita) {
      const quantityDifference = updates.quantita - currentItem.quantita;
      const costPerUnit = Number(updates.costo || currentItem.costo);
      const totalCostDifference = costPerUnit * quantityDifference;

      if (totalCostDifference > 0) {
        const cassaBalance = await this.getCassaReinvestimentoBalance(activityId);
        const amountFromCassa = Math.min(cassaBalance, totalCostDifference);
        const remainingCost = totalCostDifference - amountFromCassa;

        if (amountFromCassa > 0) {
          await this.updateCassaReinvestimento(
            activityId,
            -amountFromCassa,
            `Rifornimento (copertura cassa): ${updatedItem.nomeArticolo} - ${updatedItem.taglia} (+${quantityDifference} pz)`,
            updatedItem.userId
          );

          const [currentItemState] = await db
            .select({ cassaCoverage: inventario.cassaCoverage })
            .from(inventario)
            .where(eq(inventario.id, updatedItem.id));

          const currentCassaCoverage = Number(currentItemState?.cassaCoverage || 0);
          const newCassaCoverage = currentCassaCoverage + amountFromCassa;
          await db.update(inventario)
            .set({ cassaCoverage: newCassaCoverage.toString() })
            .where(eq(inventario.id, updatedItem.id));
        }

        const fundingDetails = amountFromCassa > 0 
          ? `Costo rifornimento €${totalCostDifference.toFixed(2)} (€${amountFromCassa.toFixed(2)} da cassa reinvestimento + €${remainingCost.toFixed(2)} fondi personali)`
          : `Costo rifornimento €${totalCostDifference.toFixed(2)} (fondi personali)`;

        await this.createExpense({
          userId: updatedItem.userId,
          activityId: activityId,
          voce: `Rifornimento: ${updatedItem.nomeArticolo} - ${updatedItem.taglia} (+${quantityDifference} pz) - ${fundingDetails}`,
          importo: totalCostDifference.toString(),
          categoria: "Inventario",
          data: new Date(),
          itemId: updatedItem.id
        });
      } else if (totalCostDifference < 0) {
        const quantityReduction = Math.abs(quantityDifference);
        const totalCostReduction = Math.abs(totalCostDifference);

        const [currentItemState] = await db
          .select({ cassaCoverage: inventario.cassaCoverage })
          .from(inventario)
          .where(eq(inventario.id, updatedItem.id));

        const currentCassaCoverage = Number(currentItemState?.cassaCoverage || 0);
        const originalCostPerUnit = Number(currentItem.costo);
        const originalCostTotal = originalCostPerUnit * currentItem.quantita;
        const newCostTotal = costPerUnit * updates.quantita;
        const proportionalCassaCoverage = (currentCassaCoverage / originalCostTotal) * newCostTotal;
        const amountToReturn = Math.max(0, currentCassaCoverage - proportionalCassaCoverage);

        if (amountToReturn > 0) {
          await this.updateCassaReinvestimento(
            activityId,
            amountToReturn,
            `Riduzione inventario: ${updatedItem.nomeArticolo} - ${updatedItem.taglia} (-${quantityReduction} pz)`,
            updatedItem.userId
          );

          const newCassaCoverage = currentCassaCoverage - amountToReturn;
          await db.update(inventario)
            .set({ cassaCoverage: newCassaCoverage.toString() })
            .where(eq(inventario.id, updatedItem.id));
        }

        const existingExpense = await db
          .select()
          .from(spese)
          .where(and(
            eq(spese.activityId, activityId),
            eq(spese.itemId, updatedItem.id),
            eq(spese.categoria, "Inventario")
          ))
          .limit(1);

        if (existingExpense.length > 0) {
          await db.update(spese)
            .set({ 
              importo: newCostTotal.toString(),
              voce: `${updatedItem.nomeArticolo}${updatedItem.taglia ? ` - ${updatedItem.taglia}` : ''} (${updates.quantita} pz) - Quantità ridotta`
            })
            .where(eq(spese.id, existingExpense[0].id));
        }

        const fundingDetails = amountToReturn > 0 
          ? `Riduzione inventario €${totalCostReduction.toFixed(2)} (€${amountToReturn.toFixed(2)} rimborsato alla cassa reinvestimento + €${(totalCostReduction - amountToReturn).toFixed(2)} fondi personali)`
          : `Riduzione inventario €${totalCostReduction.toFixed(2)} (fondi personali)`;

        await this.createExpense({
          userId: updatedItem.userId,
          activityId: activityId,
          voce: `Riduzione inventario: ${updatedItem.nomeArticolo} - ${updatedItem.taglia} (-${quantityReduction} pz) - ${fundingDetails}`,
          importo: (-totalCostReduction).toString(),
          categoria: "Inventario",
          data: new Date(),
          itemId: updatedItem.id
        });
      }
    }

    return updatedItem || undefined;
  }

  async archiveInventoryItem(id: string, activityId: string): Promise<boolean> {
    const [item] = await db.select().from(inventario)
      .where(and(eq(inventario.id, id), eq(inventario.activityId, activityId)))
      .limit(1);

    if (!item || item.archiviato === 1) return false;

    const result = await db.update(inventario)
      .set({ archiviato: 1 })
      .where(and(eq(inventario.id, id), eq(inventario.activityId, activityId)));

    return (result.rowCount ?? 0) > 0;
  }

  async permanentlyDeleteInventoryItem(id: string, activityId: string): Promise<{success: boolean, error?: string}> {
    try {
      return await db.transaction(async (tx) => {
        const item = await tx.select().from(inventario)
          .where(and(eq(inventario.id, id), eq(inventario.activityId, activityId)))
          .limit(1);

        if (!item.length) return {success: false, error: "Articolo non trovato"};

        const itemData = item[0];
        const relatedSales = await tx.select().from(vendite)
          .where(eq(vendite.inventarioId, id))
          .limit(1);

        if (relatedSales.length > 0) {
          return {success: false, error: "Impossibile eliminare: esistono vendite collegate. Usa 'Archivia' invece."};
        }

        const cassaCoverage = Number(itemData.cassaCoverage || 0);
        const amountToRestore = cassaCoverage;

        if (amountToRestore > 0) {
          await tx.insert(financialHistory).values({
            userId: itemData.userId,
            activityId: activityId,
            azione: "DEPOSITO_CASSA",
            descrizione: `Rollback eliminazione: ${itemData.nomeArticolo}${itemData.taglia ? ` - ${itemData.taglia}` : ''} (${itemData.quantita} pz)`,
            importo: amountToRestore.toString(),
            itemId: null,
            data: new Date(),
          });
        }

        await tx.delete(spese)
          .where(and(
            eq(spese.activityId, activityId),
            eq(spese.itemId, id),
            eq(spese.categoria, "Inventario")
          ));

        await tx.delete(financialHistory)
          .where(and(
            eq(financialHistory.activityId, activityId),
            eq(financialHistory.itemId, id)
          ));

        const result = await tx.delete(inventario)
          .where(and(eq(inventario.id, id), eq(inventario.activityId, activityId)));

        return {success: (result.rowCount ?? 0) > 0};
      });
    } catch (error) {
      return {success: false, error: `Errore eliminazione definitiva: ${error instanceof Error ? error.message : String(error)}`};
    }
  }

  async deleteInventoryItem(id: string, activityId: string): Promise<boolean> {
    return await this.archiveInventoryItem(id, activityId);
  }

  async updateInventoryQuantity(id: string, newQuantity: number): Promise<Inventario | undefined> {
    const [updatedItem] = await db
      .update(inventario)
      .set({ quantita: newQuantity })
      .where(eq(inventario.id, id))
      .returning();

    return updatedItem;
  }

  private async reconcileInventoryBatches(inventarioId: string) {
    const { inventoryBatches } = await import('../migrations/schema');

    const [inventoryItem] = await db
      .select()
      .from(inventario)
      .where(eq(inventario.id, inventarioId));

    if (!inventoryItem) {
      return [] as any[];
    }

    const batches = await db
      .select()
      .from(inventoryBatches)
      .where(
        and(
          eq(inventoryBatches.inventarioId, inventarioId),
          sql`${inventoryBatches.quantitaRimanente} > 0`
        )
      )
      .orderBy(
        inventoryBatches.dataAcquisto,
        inventoryBatches.createdAt,
        inventoryBatches.id
      );

    const totalAvailableFromBatches = batches.reduce((sum, batch) => sum + Number(batch.quantitaRimanente || 0), 0);

    if (inventoryItem.quantita !== totalAvailableFromBatches) {
      await db
        .update(inventario)
        .set({ quantita: totalAvailableFromBatches })
        .where(eq(inventario.id, inventarioId));
    }

    return batches;
  }

  async createInventoryBatch(data: {
    inventarioId: string;
    activityId: string;
    userId: string;
    costo: string;
    quantita: number;
    dataAcquisto?: Date;
  }) {
    const { inventoryBatches } = await import('../migrations/schema');

    const [batch] = await db.insert(inventoryBatches).values({
      inventarioId: data.inventarioId,
      activityId: data.activityId,
      userId: data.userId,
      costo: data.costo,
      quantitaIniziale: data.quantita,
      quantitaRimanente: data.quantita,
      dataAcquisto: data.dataAcquisto?.toISOString() || new Date().toISOString(),
    }).returning();

    return batch;
  }

  async getInventoryBatches(inventarioId: string) {
    const { inventoryBatches } = await import('../migrations/schema');

    return await db
      .select()
      .from(inventoryBatches)
      .where(eq(inventoryBatches.inventarioId, inventarioId))
      .orderBy(inventoryBatches.dataAcquisto);
  }

  async updateBatchQuantity(batchId: string, newQuantity: number) {
    const { inventoryBatches } = await import('../migrations/schema');

    const [updatedBatch] = await db
      .update(inventoryBatches)
      .set({ quantitaRimanente: newQuantity })
      .where(eq(inventoryBatches.id, batchId))
      .returning();

    return updatedBatch;
  }

  async calculateFIFOMargin(inventarioId: string, quantitaVenduta: number, prezzoVendita: number) {
    const { inventoryBatches } = await import('../migrations/schema');

    const [inventoryItem] = await db
      .select()
      .from(inventario)
      .where(eq(inventario.id, inventarioId));

    if (!inventoryItem) {
      throw new Error("Articolo non trovato nell'inventario");
    }

    if (inventoryItem.quantita < quantitaVenduta) {
      throw new Error("Quantità insufficiente in magazzino per completare la vendita");
    }

    const batches = await this.reconcileInventoryBatches(inventarioId);
    const totalAvailableFromBatches = batches.reduce((sum, batch) => sum + Number(batch.quantitaRimanente || 0), 0);

    if (batches.length === 0 || totalAvailableFromBatches === 0) {
      throw new Error("Nessun lotto attivo disponibile per calcolare il costo FIFO. Verifica la consistenza dell'inventario e dei lotti.");
    }

    if (totalAvailableFromBatches < quantitaVenduta) {
      throw new Error("Quantità insufficiente in magazzino per completare la vendita");
    }

    let rimanenteVendita = quantitaVenduta;
    let costoTotale = 0;
    const batchesUsed: { id: string; quantitaUsata: number }[] = [];
    const batchDetails: { batchId: string | null; costoUnitario: number; quantitaUsata: number; marginePartial: number }[] = [];

    for (const batch of batches) {
      if (rimanenteVendita <= 0) break;

      const quantitaDisponibile = Number(batch.quantitaRimanente || 0);
      const quantitaUsata = Math.min(rimanenteVendita, quantitaDisponibile);
      const costoUnitario = Number(batch.costo ?? 0);

      if (!Number.isFinite(costoUnitario)) {
        throw new Error(`Costo del lotto non valido per il lotto ${batch.id}`);
      }

      const costoPartial = quantitaUsata * costoUnitario;
      const ricavoPartial = quantitaUsata * prezzoVendita;
      const marginePartial = ricavoPartial - costoPartial;

      costoTotale += costoPartial;

      batchesUsed.push({
        id: batch.id,
        quantitaUsata: quantitaUsata
      });

      batchDetails.push({
        batchId: batch.id,
        costoUnitario,
        quantitaUsata,
        marginePartial
      });

      rimanenteVendita -= quantitaUsata;
    }

    if (rimanenteVendita > 0) {
      throw new Error("Quantità insufficiente nei lotti disponibili per completare la vendita");
    }

    const ricavoTotale = quantitaVenduta * prezzoVendita;
    const margine = ricavoTotale - costoTotale;

    return {
      margine,
      batchesUsed,
      batchDetails
    };
  }

  async updateBatchesAfterSale(batchesUsed: { id: string; quantitaUsata: number }[]) {
    const { inventoryBatches } = await import('../migrations/schema');

    for (const batchUsage of batchesUsed) {
      const [updatedBatch] = await db
        .update(inventoryBatches)
        .set({
          quantitaRimanente: sql`${inventoryBatches.quantitaRimanente} - ${batchUsage.quantitaUsata}`
        })
        .where(eq(inventoryBatches.id, batchUsage.id))
        .returning();

      if (updatedBatch) {
        const newRemaining = Number(updatedBatch.quantitaRimanente || 0);
        if (newRemaining <= 0) {
          await db
            .update(inventoryBatches)
            .set({ quantitaRimanente: 0 })
            .where(eq(inventoryBatches.id, batchUsage.id));
        }
      }
    }
  }

  async getCassaReinvestimentoBalance(activityId: string): Promise<number> {
    const movements = await db
      .select({
        azione: financialHistory.azione,
        importo: financialHistory.importo
      })
      .from(financialHistory)
      .where(and(
        eq(financialHistory.activityId, activityId),
        or(
          eq(financialHistory.azione, "Riunisci fondi"),
          eq(financialHistory.azione, "DEPOSITO_CASSA"),
          eq(financialHistory.azione, "PRELIEVO_CASSA")
        )
      ));

    let balance = 0;

    for (const movement of movements) {
      const amount = Number(movement.importo);

      if (movement.azione === "Riunisci fondi" || movement.azione === "DEPOSITO_CASSA") {
        balance += amount;
      } else if (movement.azione === "PRELIEVO_CASSA") {
        balance -= amount;
      }
    }

    return balance;
  }

  async updateCassaReinvestimento(activityId: string, importo: number, descrizione: string, userId: string, tx?: any) {
    const dbInstance = tx || db;
    const currentBalance = await this.getCassaReinvestimentoBalance(activityId);

    if (currentBalance + importo < 0) {
      throw new Error("Fondi insufficienti nella cassa reinvestimento");
    }

    await dbInstance.insert(financialHistory).values({
      userId,
      activityId,
      azione: importo > 0 ? "DEPOSITO_CASSA" : "PRELIEVO_CASSA",
      descrizione,
      importo: Math.abs(importo).toString(),
    }).returning();

    return currentBalance + importo;
  }

  async getSalesByActivity(activityId: string): Promise<Vendita[]> {
    return await db.select().from(vendite).where(eq(vendite.activityId, activityId)).orderBy(desc(vendite.data));
  }

  async createSale(saleData: InsertVendita & { userId: string; activityId: string; nomeArticolo: string; taglia: string; margine: string; origine?: string; productionProductId?: string | null }): Promise<Vendita> {
    const [inventoryItem] = await db
      .select()
      .from(inventario)
      .where(and(
        eq(inventario.id, saleData.inventarioId),
        eq(inventario.activityId, saleData.activityId)
      ));

    if (!inventoryItem) {
      throw new Error("Articolo non trovato nell'inventario");
    }

    if (inventoryItem.quantita < (saleData.quantita || 0)) {
      throw new Error("Quantità insufficiente in magazzino");
    }

    const { margine, batchesUsed, batchDetails } = await this.calculateFIFOMargin(saleData.inventarioId, saleData.quantita!, Number(saleData.prezzoVendita));
    await this.updateBatchesAfterSale(batchesUsed);

    const [newSale] = await db
      .insert(vendite)
      .values({
        data: saleData.data,
        userId: saleData.userId,
        activityId: saleData.activityId,
        inventarioId: saleData.inventarioId,
        nomeArticolo: saleData.nomeArticolo,
        taglia: saleData.taglia,
        quantita: saleData.quantita,
        prezzoVendita: saleData.prezzoVendita,
        vendutoA: saleData.vendutoA,
        incassato: saleData.incassato || 0,
        incassatoDa: (saleData.incassato === 1) ? saleData.incassatoDa : null,
        incassatoSu: (saleData.incassato === 1) ? saleData.incassatoSu : null,
        margine: margine.toString(),
        origine: saleData.origine || "magazzino",
        productionProductId: saleData.productionProductId || null
      })
      .returning();

    await db
      .update(inventario)
      .set({
        quantita: sql`${inventario.quantita} - ${saleData.quantita!}`
      })
      .where(eq(inventario.id, saleData.inventarioId));

    await this.createSpedizione({
      userId: saleData.userId,
      activityId: saleData.activityId,
      venditaId: newSale.id,
      nomeArticolo: saleData.nomeArticolo,
      taglia: saleData.taglia,
      quantita: saleData.quantita || 1,
      vendutoA: saleData.vendutoA,
      speditoConsegnato: 0,
      dataSpedizione: null
    });

    return newSale;
  }

  async getSaleById(id: string, activityId: string): Promise<Vendita | null> {
    const [sale] = await db
      .select()
      .from(vendite)
      .where(and(eq(vendite.id, id), eq(vendite.activityId, activityId)));

    return sale || null;
  }

  async updateSale(id: string, activityId: string, updates: Partial<InsertVendita> & { nomeArticolo?: string; taglia?: string | null; margine?: string }): Promise<Vendita | null> {
    const [existingSale] = await db
      .select()
      .from(vendite)
      .where(and(eq(vendite.id, id), eq(vendite.activityId, activityId)));

    if (!existingSale) return null;

    const oldQuantity = existingSale.quantita;
    const newQuantity = updates.quantita || oldQuantity;
    const oldInventarioId = existingSale.inventarioId;
    const newInventarioId = updates.inventarioId || oldInventarioId;

    await db
      .update(inventario)
      .set({
        quantita: sql`${inventario.quantita} + ${oldQuantity}`
      })
      .where(eq(inventario.id, oldInventarioId));

    await this.restoreBatchesAfterSaleDelete(oldInventarioId, oldQuantity, Number(existingSale.prezzoVendita));

    if (newInventarioId !== oldInventarioId || newQuantity !== oldQuantity) {
      const [targetItem] = await db
        .select()
        .from(inventario)
        .where(eq(inventario.id, newInventarioId));

      if (!targetItem) {
        await db
          .update(inventario)
          .set({
            quantita: sql`${inventario.quantita} - ${oldQuantity}`
          })
          .where(eq(inventario.id, oldInventarioId));
        throw new Error("Articolo di destinazione non trovato");
      }

      if (targetItem.quantita < newQuantity) {
        await db
          .update(inventario)
          .set({
            quantita: sql`${inventario.quantita} - ${oldQuantity}`
          })
          .where(eq(inventario.id, oldInventarioId));
        throw new Error("Quantità insufficiente nel nuovo articolo selezionato");
      }

      await db
        .update(inventario)
        .set({
          quantita: sql`${inventario.quantita} - ${newQuantity}`
        })
        .where(eq(inventario.id, newInventarioId));
    } else {
      await db
        .update(inventario)
        .set({
          quantita: sql`${inventario.quantita} - ${oldQuantity}`
        })
        .where(eq(inventario.id, oldInventarioId));
    }

    if ((updates.quantita && updates.quantita !== oldQuantity) ||
        (updates.inventarioId && updates.inventarioId !== oldInventarioId) ||
        (updates.prezzoVendita && updates.prezzoVendita !== existingSale.prezzoVendita)) {

      const finalInventarioId = updates.inventarioId || oldInventarioId;
      const finalQuantity = updates.quantita || oldQuantity;
      const finalPrice = Number(updates.prezzoVendita || existingSale.prezzoVendita);

      try {
        const { margine, batchesUsed } = await this.calculateFIFOMargin(finalInventarioId, finalQuantity, finalPrice);
        await this.updateBatchesAfterSale(batchesUsed);
        updates.margine = margine.toString();
      } catch (error) {
        console.warn('FIFO calculation failed during sale update, falling back to current cost:', error);

        const [currentItem] = await db
          .select()
          .from(inventario)
          .where(eq(inventario.id, finalInventarioId));

        if (currentItem) {
          const costoTotale = finalQuantity * Number(currentItem.costo);
          const ricavoTotale = finalQuantity * finalPrice;
          const margine = ricavoTotale - costoTotale;
          updates.margine = margine.toString();
        }
      }
    }

    if (updates.incassato !== undefined) {
      if (updates.incassato === 0) {
        (updates as any).incassatoDa = null;
        (updates as any).incassatoSu = null;
      } else if (updates.incassato === 1) {
        if (updates.incassatoDa === undefined) {
          (updates as any).incassatoDa = existingSale.incassatoDa;
        }
        if (updates.incassatoSu === undefined) {
          (updates as any).incassatoSu = existingSale.incassatoSu;
        }
      }
    }

    const [updatedSale] = await db
      .update(vendite)
      .set(updates)
      .where(and(eq(vendite.id, id), eq(vendite.activityId, activityId)))
      .returning();

    if (updatedSale && (updates.nomeArticolo || updates.taglia !== undefined || updates.quantita || updates.vendutoA !== undefined)) {
      await db
        .update(spedizioni)
        .set({
          nomeArticolo: updatedSale.nomeArticolo,
          taglia: updatedSale.taglia,
          quantita: updatedSale.quantita,
          vendutoA: updatedSale.vendutoA
        })
        .where(and(eq(spedizioni.venditaId, id), eq(spedizioni.activityId, activityId)));
    }

    return updatedSale || null;
  }

  async deleteSale(id: string, activityId: string): Promise<boolean> {
    try {
      const [saleToDelete] = await db
        .select()
        .from(vendite)
        .where(and(eq(vendite.id, id), eq(vendite.activityId, activityId)));

      if (!saleToDelete) return false;

      if (saleToDelete.origine === "vetrina") {
        const prodSvc = await import('../server/production');
        await prodSvc.rollbackVetrinaSale(saleToDelete.inventarioId, activityId);
      } else {
        await db
          .update(inventario)
          .set({
            quantita: sql`${inventario.quantita} + ${saleToDelete.quantita}`
          })
          .where(eq(inventario.id, saleToDelete.inventarioId));

        await this.restoreBatchesAfterSaleDelete(saleToDelete.inventarioId, saleToDelete.quantita, Number(saleToDelete.prezzoVendita));
      }

      if (saleToDelete.incassato === 1) {
        try {
          await db.delete(financialHistory)
            .where(and(
              eq(financialHistory.activityId, activityId),
              eq(financialHistory.azione, "Vendita incassata")
            ));
        } catch (error) {
          console.warn('Could not delete financial history for sale:', error);
        }
      }

      await db
        .delete(spedizioni)
        .where(and(eq(spedizioni.venditaId, id), eq(spedizioni.activityId, activityId)));

      const result = await db
        .delete(vendite)
        .where(and(eq(vendite.id, id), eq(vendite.activityId, activityId)));

      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      console.error('Error deleting sale:', error);
      throw new Error(`Errore nell'eliminazione della vendita: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async restoreBatchesAfterSaleDelete(inventarioId: string, quantitaToRestore: number, prezzoVendita: number) {
    try {
      const { inventoryBatches } = await import('../migrations/schema');

      const batches = await db
        .select()
        .from(inventoryBatches)
        .where(eq(inventoryBatches.inventarioId, inventarioId))
        .orderBy(sql`${inventoryBatches.dataAcquisto} DESC`);

      let rimanenteRestore = quantitaToRestore;

      for (const batch of batches) {
        if (rimanenteRestore <= 0) break;

        const maxRestorableToBatch = batch.quantitaIniziale - batch.quantitaRimanente;
        const quantitaToRestoreToBatch = Math.min(rimanenteRestore, maxRestorableToBatch);

        if (quantitaToRestoreToBatch > 0) {
          await db
            .update(inventoryBatches)
            .set({
              quantitaRimanente: sql`${inventoryBatches.quantitaRimanente} + ${quantitaToRestoreToBatch}`
            })
            .where(eq(inventoryBatches.id, batch.id));

          rimanenteRestore -= quantitaToRestoreToBatch;
        }
      }

      if (rimanenteRestore > 0) {
        const [inventoryItem] = await db
          .select()
          .from(inventario)
          .where(eq(inventario.id, inventarioId));

        if (inventoryItem) {
          await this.createInventoryBatch({
            inventarioId: inventarioId,
            activityId: inventoryItem.activityId,
            userId: inventoryItem.userId,
            costo: inventoryItem.costo,
            quantita: rimanenteRestore,
          });
        }
      }
    } catch (error) {
      console.error('Error restoring batches after sale deletion:', error);
    }
  }

  async getExpensesByActivity(activityId: string): Promise<Spesa[]> {
    const expenses = await db
      .select()
      .from(spese)
      .where(eq(spese.activityId, activityId))
      .orderBy(desc(spese.data));
    return expenses;
  }

  async createExpense(expenseData: InsertSpesa & { userId: string; activityId: string }): Promise<Spesa> {
    return await db.transaction(async (tx) => {
      const amount = Number(expenseData.importo || 0);
      if (amount <= 0) throw new Error("Importo spesa non valido.");

      const cassaBalance = await this.getCassaReinvestimentoBalance(expenseData.activityId);
      const fromCassa = Math.min(cassaBalance, amount);
      if (fromCassa > 0) {
        await this.updateCassaReinvestimento(
          expenseData.activityId,
          -fromCassa,
          `Spesa coperta da cassa reinvestimento: ${expenseData.voce} – prelevati €${fromCassa.toFixed(2)}`,
          expenseData.userId
        );
      }

      const [expense] = await tx.insert(spese).values({
        ...expenseData,
        data: expenseData.data || new Date(),
      }).returning();

      return expense;
    });
  }

  async updateExpense(id: string, activityId: string, updates: Partial<InsertSpesa>): Promise<Spesa | undefined> {
    return await db.transaction(async (tx) => {
      const [original] = await tx
        .select()
        .from(spese)
        .where(and(eq(spese.id, id), eq(spese.activityId, activityId)))
        .limit(1);

      if (!original) return undefined;

      const originalAmount = Number(original.importo);
      const newAmount = updates.importo !== undefined ? Number(updates.importo) : originalAmount;
      const amountDiff = newAmount - originalAmount;

      const likeVoce = `%${original.voce}%`;
      const covRows = await tx
        .select({
          azione: financialHistory.azione,
          importo: financialHistory.importo,
        })
        .from(financialHistory)
        .where(and(
          eq(financialHistory.activityId, activityId),
          or(eq(financialHistory.azione, "PRELIEVO_CASSA"), eq(financialHistory.azione, "DEPOSITO_CASSA")),
          sql`${financialHistory.descrizione} LIKE ${likeVoce}`
        ));

      let prelievi = 0, depositi = 0;
      for (const r of covRows) {
        const v = Math.abs(Number(r.importo) || 0);
        if (r.azione === "PRELIEVO_CASSA") prelievi += v;
        else if (r.azione === "DEPOSITO_CASSA") depositi += v;
      }
      const currentCassaCoverage = Math.max(0, prelievi - depositi);

      if (amountDiff < 0) {
        const targetCoverage = Math.min(newAmount, currentCassaCoverage);
        const toReturn = currentCassaCoverage - targetCoverage;
        if (toReturn > 0) {
          await this.updateCassaReinvestimento(
            activityId,
            +toReturn,
            `Adeguamento spesa (riduzione): ${original.voce} – restituiti €${toReturn.toFixed(2)}`,
            original.userId
          );
        }
      } else if (amountDiff > 0) {
        const cassaBalance = await this.getCassaReinvestimentoBalance(activityId);
        const toWithdraw = Math.min(cassaBalance, amountDiff);
        if (toWithdraw > 0) {
          await this.updateCassaReinvestimento(
            activityId,
            -toWithdraw,
            `Adeguamento spesa (aumento): ${original.voce} – prelevati €${toWithdraw.toFixed(2)}`,
            original.userId
          );
        }
      }

      const patch: any = { ...updates };
      if (patch.data) patch.data = new Date(patch.data);
      const [updated] = await tx
        .update(spese)
        .set(patch)
        .where(and(eq(spese.id, id), eq(spese.activityId, activityId)))
        .returning();

      return updated;
    });
  }

  async deleteExpense(id: string, activityId: string): Promise<boolean> {
    return await db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(spese)
        .where(and(eq(spese.id, id), eq(spese.activityId, activityId)))
        .limit(1);

      if (!row) return false;

      if (row.categoria === "Aggiunta articolo" || row.categoria === "Inventario") {
        throw new Error("Non è possibile eliminare manualmente le spese relative all'inventario. Gestisci l'inventario dalla sezione Magazzino per aggiornare automaticamente le spese correlate.");
      }

      if (row.categoria === "produzione" || row.nonEliminabile === 1) {
        throw new Error("Non è possibile eliminare manualmente le spese relative ai materiali di produzione. Gestisci i materiali dalla sezione Produzione per aggiornare automaticamente le spese correlate.");
      }

      const likeVoce = `%${row.voce}%`;
      const cov = await tx
        .select({ azione: financialHistory.azione, importo: financialHistory.importo })
        .from(financialHistory)
        .where(and(
          eq(financialHistory.activityId, activityId),
          or(eq(financialHistory.azione, "PRELIEVO_CASSA"), eq(financialHistory.azione, "DEPOSITO_CASSA")),
          sql`${financialHistory.descrizione} LIKE ${likeVoce}`
        ));

      let prelievi = 0, depositi = 0;
      for (const r of cov) {
        const v = Math.abs(Number(r.importo) || 0);
        if (r.azione === "PRELIEVO_CASSA") prelievi += v;
        else if (r.azione === "DEPOSITO_CASSA") depositi += v;
      }
      const currentCassaCoverage = Math.max(0, prelievi - depositi);

      if (currentCassaCoverage > 0) {
        await this.updateCassaReinvestimento(
          activityId,
          +currentCassaCoverage,
          `Eliminazione spesa: ${row.voce} – restituiti €${currentCassaCoverage.toFixed(2)} alla cassa`,
          row.userId
        );
      }

      await tx.delete(spese).where(and(eq(spese.id, id), eq(spese.activityId, activityId)));
      return true;
    });
  }

  async getActivityStats(activityId: string): Promise<{
    inventoryCount: number;
    totalSales: number;
    totalExpenses: number;
    netMargin: number;
  }> {
    const [inventoryCountResult] = await db
      .select({ count: sql<number>`coalesce(sum(${inventario.quantita}), 0)` })
      .from(inventario)
      .where(and(
        eq(inventario.activityId, activityId),
        eq(inventario.archiviato, 0)
      ));

    const [salesSumResult] = await db
      .select({ total: sql<number>`coalesce(sum(cast(${vendite.prezzoVendita} as decimal)), 0)` })
      .from(vendite)
      .where(eq(vendite.activityId, activityId));

    const [expensesSumResult] = await db
      .select({ total: sql<number>`coalesce(sum(cast(${spese.importo} as decimal)), 0)` })
      .from(spese)
      .where(eq(spese.activityId, activityId));

    const inventoryCount = Number(inventoryCountResult?.count || 0);
    const totalSales = Number(salesSumResult?.total || 0);
    const totalExpenses = Number(expensesSumResult?.total || 0);
    const netMargin = totalSales - totalExpenses;

    return {
      inventoryCount,
      totalSales,
      totalExpenses,
      netMargin,
    };
  }

  async getActivityHistoryByActivity(
    activityId: string,
    filter: string = 'all',
    month?: string,
    year?: string
  ): Promise<Array<{
    id: string;
    type: 'sale' | 'expense' | 'inventory';
    description: string;
    amount: number;
    data: string;
    details?: any;
  }>> {
    let dateConditions: any[] = [];

    if (filter === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      dateConditions = [
        gte(vendite.data, today),
        lt(vendite.data, tomorrow)
      ];
    } else if (filter === 'month' && month && year) {
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);
      dateConditions = [
        gte(vendite.data, startDate),
        lte(vendite.data, endDate)
      ];
    } else if (filter === 'year' && year) {
      const startDate = new Date(parseInt(year), 0, 1);
      const endDate = new Date(parseInt(year), 11, 31, 23, 59, 59, 999);
      dateConditions = [
        gte(vendite.data, startDate),
        lte(vendite.data, endDate)
      ];
    }

    const allActivities: Array<{
      id: string;
      type: 'sale' | 'expense' | 'inventory';
      description: string;
      amount: number;
      data: string;
      details?: any;
    }> = [];

    let salesQuery = db
      .select({
        id: vendite.id,
        description: sql<string>`'Vendita: ' || ${vendite.nomeArticolo} || ' - ' || ${vendite.taglia}`,
        amount: vendite.prezzoVendita,
        data: vendite.data,
        type: sql<string>`'sale'`
      })
      .from(vendite)
      .where(and(eq(vendite.activityId, activityId), ...dateConditions))
      .orderBy(desc(vendite.data));

    const sales = await salesQuery.limit(50);

    allActivities.push(...sales.map(item => ({
      id: item.id,
      type: 'sale' as const,
      description: item.description,
      amount: Number(item.amount),
      data: item.data.toISOString()
    })));

    let expensesQuery = db
      .select({
        id: spese.id,
        description: sql<string>`'Spesa: ' || ${spese.voce}`,
        amount: spese.importo,
        data: spese.data,
        type: sql<string>`'expense'`
      })
      .from(spese)
      .where(and(eq(spese.activityId, activityId), ...dateConditions.map(cond =>
        cond.toString().includes('vendite.data')
          ? sql`${spese.data} ${cond.toString().split(' ').slice(1).join(' ')}`
          : cond
      )))
      .orderBy(desc(spese.data));

    const expenses = await expensesQuery.limit(50);

    allActivities.push(...expenses.map(item => ({
      id: item.id,
      type: 'expense' as const,
      description: item.description,
      amount: Number(item.amount),
      data: item.data.toISOString()
    })));

    let inventoryQuery = db
      .select({
        id: inventario.id,
        description: sql<string>`'Inventario: ' || ${inventario.nomeArticolo} || ' - ' || ${inventario.taglia}`,
        amount: sql<number>`${inventario.costo} * ${inventario.quantita}`,
        data: inventario.createdAt,
        type: sql<string>`'inventory'`
      })
      .from(inventario)
      .where(and(eq(inventario.activityId, activityId), ...dateConditions.map(cond =>
        cond.toString().includes('vendite.data')
          ? sql`${inventario.createdAt} ${cond.toString().split(' ').slice(1).join(' ')}`
          : cond
      )))
      .orderBy(desc(inventario.createdAt));

    const inventory = await inventoryQuery.limit(50);

    allActivities.push(...inventory.map(item => ({
      id: item.id,
      type: 'inventory' as const,
      description: item.description,
      amount: Number(item.amount),
      data: item.data?.toISOString() || new Date().toISOString()
    })));

    return allActivities
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
      .slice(0, 100);
  }

  async getTopSellingItemsByActivity(activityId: string): Promise<Array<{
    nomeArticolo: string;
    taglia: string | null;
    totalQuantity: number;
    totalRevenue: number;
  }>> {
    const topItems = await db
      .select({
        nomeArticolo: vendite.nomeArticolo,
        taglia: vendite.taglia,
        totalQuantity: sql<number>`sum(${vendite.quantita})`,
        totalRevenue: sql<number>`sum(${vendite.prezzoVendita})`
      })
      .from(vendite)
      .where(eq(vendite.activityId, activityId))
      .groupBy(vendite.nomeArticolo, vendite.taglia)
      .orderBy(desc(sql`sum(${vendite.quantita})`))
      .limit(10);

    return topItems.map(item => ({
      nomeArticolo: item.nomeArticolo,
      taglia: item.taglia,
      totalQuantity: Number(item.totalQuantity),
      totalRevenue: Number(item.totalRevenue)
    }));
  }

  async updateUserProfileImage(userId: string, profileImageUrl: string): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ profileImageUrl })
      .where(eq(users.id, userId))
      .returning();

    return updatedUser;
  }

  async updateUserProfile(userId: string, profileData: { nome: string; cognome: string; email: string }): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set(profileData)
      .where(eq(users.id, userId))
      .returning();

    return updatedUser;
  }

  async getActivityMembers(activityId: string): Promise<Array<{
    id: string;
    nome: string;
    cognome: string;
    displayName: string;
  }>> {
    const members = await db
      .select({
        id: users.id,
        nome: users.nome,
        cognome: users.cognome
      })
      .from(activityUsers)
      .innerJoin(users, eq(activityUsers.userId, users.id))
      .where(eq(activityUsers.activityId, activityId));

    return members.map(member => ({
      ...member,
      displayName: `${member.nome} ${member.cognome}`
    }));
  }

  async getAdminUsers(): Promise<Array<{
    id: string;
    nome: string;
    cognome: string;
    email: string;
    username: string;
    isActive: number;
    emailVerified: string | null;
    createdAt: string;
    activitiesCount: number;
    salesCount: number;
    inventoryCount: number;
  }>> {
    const adminUsers = await db
      .select({
        id: users.id,
        nome: users.nome,
        cognome: users.cognome,
        email: users.email,
        username: users.username,
        isActive: users.isActive,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt,
        activitiesCount: sql<number>`count(distinct ${activityUsers.activityId})`,
        salesCount: sql<number>`count(distinct ${vendite.id})`,
        inventoryCount: sql<number>`count(distinct ${inventario.id})`
      })
      .from(users)
      .leftJoin(activityUsers, eq(users.id, activityUsers.userId))
      .leftJoin(vendite, eq(users.id, vendite.userId))
      .leftJoin(inventario, eq(users.id, inventario.userId))
      .groupBy(users.id, users.nome, users.cognome, users.email, users.username, users.isActive, users.emailVerified, users.createdAt)
      .orderBy(desc(users.createdAt));

    return adminUsers.map(user => ({
      id: user.id,
      nome: user.nome,
      cognome: user.cognome,
      email: user.email,
      username: user.username,
      isActive: user.isActive || 0,
      emailVerified: user.emailVerified?.toISOString() || null,
      createdAt: user.createdAt?.toISOString() || "",
      activitiesCount: Number(user.activitiesCount),
      salesCount: Number(user.salesCount),
      inventoryCount: Number(user.inventoryCount)
    }));
  }

  async getAdminActivities(): Promise<Array<{
    id: string;
    nome: string;
    proprietarioNome: string;
    proprietarioEmail: string;
    membersCount: number;
    inventoryCount: number;
    salesCount: number;
    expensesCount: number;
    createdAt: string;
    hasData: boolean;
  }>> {
    const adminActivities = await db
      .select({
        id: activities.id,
        nome: activities.nome,
        proprietarioNome: sql<string>`${users.nome} || ' ' || ${users.cognome}`,
        proprietarioEmail: users.email,
        createdAt: activities.createdAt,
        membersCount: sql<number>`count(distinct ${activityUsers.userId})`,
        inventoryCount: sql<number>`count(distinct ${inventario.id})`,
        salesCount: sql<number>`count(distinct ${vendite.id})`,
        expensesCount: sql<number>`count(distinct ${spese.id})`
      })
      .from(activities)
      .innerJoin(users, eq(activities.proprietarioId, users.id))
      .leftJoin(activityUsers, eq(activities.id, activityUsers.activityId))
      .leftJoin(inventario, and(
        eq(activities.id, inventario.activityId),
        eq(inventario.archiviato, 0)
      ))
      .leftJoin(vendite, eq(activities.id, vendite.activityId))
      .leftJoin(spese, eq(activities.id, spese.activityId))
      .groupBy(activities.id, activities.nome, users.nome, users.cognome, users.email, activities.createdAt)
      .orderBy(desc(activities.createdAt));

    return adminActivities.map(activity => ({
      id: activity.id,
      nome: activity.nome,
      proprietarioNome: activity.proprietarioNome,
      proprietarioEmail: activity.proprietarioEmail,
      membersCount: Number(activity.membersCount),
      inventoryCount: Number(activity.inventoryCount),
      salesCount: Number(activity.salesCount),
      expensesCount: Number(activity.expensesCount),
      createdAt: activity.createdAt?.toISOString() || "",
      hasData: Number(activity.inventoryCount) > 0 || Number(activity.salesCount) > 0 || Number(activity.expensesCount) > 0
    }));
  }

  async userHasData(userId: string): Promise<boolean> {
    const [inventoryCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(inventario)
      .where(and(
        eq(inventario.userId, userId),
        eq(inventario.archiviato, 0)
      ));

    const [salesCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(vendite)
      .where(eq(vendite.userId, userId));

    const [expensesCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(spese)
      .where(eq(spese.userId, userId));

    return Number(inventoryCount.count) > 0 || Number(salesCount.count) > 0 || Number(expensesCount.count) > 0;
  }

  async activityHasData(activityId: string): Promise<boolean> {
    const [inventoryCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(inventario)
      .where(and(
        eq(inventario.activityId, activityId),
        eq(inventario.archiviato, 0)
      ));

    const [salesCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(vendite)
      .where(eq(vendite.activityId, activityId));

    const [expensesCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(spese)
      .where(eq(spese.activityId, activityId));

    return Number(inventoryCount.count) > 0 || Number(salesCount.count) > 0 || Number(expensesCount.count) > 0;
  }

  async deleteActivity(activityId: string): Promise<void> {
    await db.delete(activities).where(eq(activities.id, activityId));
  }

  async getChartDataByActivity(activityId: string): Promise<{
    salesData: Array<{date: string, amount: number}>;
    expensesData: Array<{date: string, amount: number}>;
    marginData: Array<{date: string, amount: number}>;
    months: string[];
  }> {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const salesByMonth = await db
      .select({
        month: sql<string>`to_char(${vendite.data}, 'YYYY-MM')`,
        total: sql<number>`sum(cast(${vendite.prezzoVendita} as decimal))`
      })
      .from(vendite)
      .where(and(
        eq(vendite.activityId, activityId),
        gte(vendite.data, sixMonthsAgo)
      ))
      .groupBy(sql`to_char(${vendite.data}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${vendite.data}, 'YYYY-MM')`);

    const expensesByMonth = await db
      .select({
        month: sql<string>`to_char(${spese.data}, 'YYYY-MM')`,
        total: sql<number>`sum(cast(${spese.importo} as decimal))`
      })
      .from(spese)
      .where(and(
        eq(spese.activityId, activityId),
        gte(spese.data, sixMonthsAgo)
      ))
      .groupBy(sql`to_char(${spese.data}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${spese.data}, 'YYYY-MM')`);

    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(date.toISOString().substring(0, 7));
    }

    const salesData = months.map(month => {
      const sale = salesByMonth.find(s => s.month === month);
      return {
        date: month,
        amount: sale ? Number(sale.total) : 0
      };
    });

    const expensesData = months.map(month => {
      const expense = expensesByMonth.find(e => e.month === month);
      return {
        date: month,
        amount: expense ? Number(expense.total) : 0
      };
    });

    const marginData = months.map((month, index) => ({
      date: month,
      amount: salesData[index].amount - expensesData[index].amount
    }));

    return {
      salesData,
      expensesData,
      marginData,
      months: months.map(month => {
        const date = new Date(month + '-01');
        return date.toLocaleDateString('it-IT', { month: 'short', year: 'numeric' });
      })
    };
  }

  async getFundTransfersByActivity(activityId: string): Promise<FundTransfer[]> {
    return await db.select().from(fundTransfers).where(eq(fundTransfers.activityId, activityId)).orderBy(desc(fundTransfers.data));
  }

  async createFundTransfers(transfers: Array<InsertFundTransfer & { userId: string; activityId: string }>): Promise<FundTransfer[]> {
    const results = [];

    for (const transfer of transfers) {
      const [newTransfer] = await db
        .insert(fundTransfers)
        .values(transfer)
        .returning();
      results.push(newTransfer);

      const description = `Trasferimento fondi: ${transfer.importo}€ da ${transfer.fromMember} (${transfer.fromAccount}) a ${transfer.toAccount}`;
      await db.insert(financialHistory).values({
        userId: transfer.userId,
        activityId: transfer.activityId,
        azione: "Riunisci fondi",
        descrizione: description,
        importo: transfer.importo,
        dettagli: JSON.stringify({
          fromMember: transfer.fromMember,
          fromAccount: transfer.fromAccount,
          toAccount: transfer.toAccount,
          descrizione: transfer.descrizione
        })
      });
    }

    return results;
  }

  async getFinancialHistoryByActivity(activityId: string): Promise<FinancialHistory[]> {
    return await db.select().from(financialHistory).where(
      and(
        eq(financialHistory.activityId, activityId),
        or(
          eq(financialHistory.azione, "Riunisci fondi"),
          eq(financialHistory.azione, "PRELIEVO_CASSA"),
          eq(financialHistory.azione, "DEPOSITO_CASSA")
        )
      )
    ).orderBy(desc(financialHistory.data));
  }

  async createFinancialHistoryEntry(entry: InsertFinancialHistory & { userId: string; activityId: string }): Promise<FinancialHistory> {
    const [newEntry] = await db
      .insert(financialHistory)
      .values(entry)
      .returning();
    return newEntry;
  }

  async deleteFinancialHistoryEntry(entryId: string, activityId: string): Promise<boolean> {
    const [entry] = await db
      .select()
      .from(financialHistory)
      .where(and(eq(financialHistory.id, entryId), eq(financialHistory.activityId, activityId)));

    if (!entry) {
      return false;
    }

    if (entry.azione === "Riunisci fondi") {
      throw new Error("Impossibile eliminare le operazioni di 'Riunisci fondi' direttamente dalla cronologia. Utilizzare la funzione di annullamento specifica.");
    }

    const result = await db
      .delete(financialHistory)
      .where(and(eq(financialHistory.id, entryId), eq(financialHistory.activityId, activityId)));

    return (result.rowCount ?? 0) > 0;
  }

  async getSpedizioniByActivity(activityId: string): Promise<Spedizione[]> {
    return await db.select().from(spedizioni).where(eq(spedizioni.activityId, activityId)).orderBy(desc(spedizioni.createdAt));
  }

  async createSpedizione(spedizioneData: InsertSpedizione & { userId: string; activityId: string }): Promise<Spedizione> {
    const [newSpedizione] = await db
      .insert(spedizioni)
      .values(spedizioneData)
      .returning();
    return newSpedizione;
  }

  async updateSpedizioneStatus(id: string, activityId: string, updates: UpdateSpedizione): Promise<Spedizione | null> {
    const [updatedSpedizione] = await db
      .update(spedizioni)
      .set({
        ...updates,
        dataSpedizione: updates.speditoConsegnato === 1 ? new Date() : null
      })
      .where(and(eq(spedizioni.id, id), eq(spedizioni.activityId, activityId)))
      .returning();

    return updatedSpedizione || null;
  }

  async deleteSpedizione(id: string, activityId: string): Promise<boolean> {
    const result = await db
      .delete(spedizioni)
      .where(and(eq(spedizioni.id, id), eq(spedizioni.activityId, activityId)));

    return (result.rowCount ?? 0) > 0;
  }

  async getVenditeConSpedizioni(activityId: string): Promise<Array<{
    id: string;
    nomeArticolo: string;
    taglia: string | null;
    quantita: number;
    prezzoVendita: string;
    vendutoA: string | null;
    data: Date;
    margine: string;
    spedizione: {
      id: string;
      speditoConsegnato: number;
      dataSpedizione: Date | null;
    };
  }>> {
    const result = await db
      .select({
        id: vendite.id,
        nomeArticolo: vendite.nomeArticolo,
        taglia: vendite.taglia,
        quantita: vendite.quantita,
        prezzoVendita: vendite.prezzoVendita,
        vendutoA: vendite.vendutoA,
        data: vendite.data,
        margine: vendite.margine,
        spedizioneId: spedizioni.id,
        speditoConsegnato: spedizioni.speditoConsegnato,
        dataSpedizione: spedizioni.dataSpedizione,
        numeroTracking: spedizioni.numeroTracking,
      })
      .from(vendite)
      .innerJoin(spedizioni, eq(vendite.id, spedizioni.venditaId))
      .where(eq(vendite.activityId, activityId))
      .orderBy(desc(vendite.data));

    return result.map(row => ({
      id: row.id,
      nomeArticolo: row.nomeArticolo,
      taglia: row.taglia,
      quantita: row.quantita,
      prezzoVendita: row.prezzoVendita,
      vendutoA: row.vendutoA,
      data: row.data,
      margine: row.margine,
      spedizione: {
        id: row.spedizioneId,
        speditoConsegnato: row.speditoConsegnato ?? 0,
        dataSpedizione: row.dataSpedizione,
        numeroTracking: row.numeroTracking,
      },
    }));
  }

  async getCassaReinvestimento(activityId: string): Promise<number> {
    const balance = await this.getCassaReinvestimentoBalance(activityId);
    return balance;
  }

  async updateCassaReinvestimento(activityId: string, importo: number, descrizione: string, userId: string, tx?: any): Promise<number> {
    const dbInstance = tx || db;
    const currentBalance = await this.getCassaReinvestimentoBalance(activityId);

    if (currentBalance + importo < 0) {
      throw new Error("Fondi insufficienti nella cassa reinvestimento");
    }

    await dbInstance.insert(financialHistory).values({
      userId,
      activityId,
      azione: importo > 0 ? "DEPOSITO_CASSA" : "PRELIEVO_CASSA",
      descrizione,
      importo: Math.abs(importo).toString(),
    });

    return currentBalance + importo;
  }

  async createEquityWithdrawal(
    activityId: string,
    userId: string,
    data: { importo: number; tipo: string; memberId?: string; descrizione?: string; data?: string }
  ) {
    return await db.transaction(async (tx) => {
      const activity = await tx.query.activities.findFirst({
        where: eq(activities.id, activityId),
      });

      if (!activity) {
        throw new Error("Attività non trovata");
      }

      const saldo = await this.getCassaReinvestimento(activityId);
      if (saldo < data.importo) {
        throw new Error("Saldo cassa reinvestimento insufficiente");
      }

      const [withdrawal] = await tx.insert(equityWithdrawals).values({
        activityId,
        userId,
        importo: data.importo.toString(),
        tipo: data.tipo,
        memberId: data.memberId,
        descrizione: data.descrizione,
        dataOperazione: data.data || new Date().toISOString(),
        annullato: 0,
      }).returning();

      const tipoLabel = data.tipo === 'RIMBORSO' ? 'Rimborso investimento iniziale' :
                        data.tipo === 'DIVIDENDO' ? 'Distribuzione margine (dividendi)' :
                        'Altro prelievo socio';

      let memberName = '';
      if (data.memberId) {
        const [member] = await tx.select({ nome: users.nome, cognome: users.cognome })
          .from(users)
          .where(eq(users.id, data.memberId))
          .limit(1);
        if (member) {
          memberName = `${member.nome} ${member.cognome}`;
        }
      }

      const descrizione = memberName 
        ? `${tipoLabel} – ${memberName} – €${data.importo.toFixed(2)}`
        : `${tipoLabel} – €${data.importo.toFixed(2)}`;

      await tx.insert(financialHistory).values({
        userId,
        activityId,
        azione: 'PRELIEVO_CASSA',
        descrizione,
        importo: data.importo.toString(),
        dettagli: JSON.stringify({ scope: 'EQUITY', kind: data.tipo, withdrawalId: withdrawal.id }),
      });

      const nuovoSaldo = await this.getCassaReinvestimento(activityId);
      return { withdrawal, nuovoSaldo };
    });
  }

  async getEquityWithdrawals(
    activityId: string,
    filters: { from?: string; to?: string; tipo?: string; memberId?: string }
  ) {
    const conditions = [eq(equityWithdrawals.activityId, activityId)];

    if (filters.from) {
      conditions.push(sql`${equityWithdrawals.dataOperazione} >= ${filters.from}`);
    }
    if (filters.to) {
      conditions.push(sql`${equityWithdrawals.dataOperazione} <= ${filters.to}`);
    }
    if (filters.tipo) {
      conditions.push(eq(equityWithdrawals.tipo, filters.tipo));
    }
    if (filters.memberId) {
      conditions.push(eq(equityWithdrawals.memberId, filters.memberId));
    }

    const withdrawals = await db.query.equityWithdrawals.findMany({
      where: and(...conditions),
      orderBy: (equityWithdrawals, { desc }) => [desc(equityWithdrawals.dataOperazione)],
    });

    const totals = withdrawals
      .filter(w => !w.annullato)
      .reduce((acc, w) => {
        const importo = parseFloat(w.importo);
        acc.totale += importo;
        if (w.tipo === 'RIMBORSO') acc.rimborsi += importo;
        if (w.tipo === 'DIVIDENDO') acc.dividendi += importo;
        return acc;
      }, { totale: 0, rimborsi: 0, dividendi: 0 });

    return { withdrawals, totals };
  }

  async annullaEquityWithdrawal(withdrawalId: string, activityId: string, userId: string) {
    return await db.transaction(async (tx) => {
      const withdrawal = await tx.query.equityWithdrawals.findFirst({
        where: and(
          eq(equityWithdrawals.id, withdrawalId),
          eq(equityWithdrawals.activityId, activityId)
        ),
      });

      if (!withdrawal) {
        throw new Error("Prelievo non trovato");
      }

      if (withdrawal.annullato) {
        throw new Error("Prelievo già annullato");
      }

      const tipoLabel = withdrawal.tipo === 'RIMBORSO' ? 'Rimborso investimento iniziale' :
                        withdrawal.tipo === 'DIVIDENDO' ? 'Distribuzione margine (dividendi)' :
                        'Altro prelievo socio';

      let memberName = '';
      if (withdrawal.memberId) {
        const [member] = await tx.select({ nome: users.nome, cognome: users.cognome })
          .from(users)
          .where(eq(users.id, withdrawal.memberId))
          .limit(1);
        if (member) {
          memberName = `${member.nome} ${member.cognome}`;
        }
      }

      const descrizione = memberName
        ? `Annullamento: ${tipoLabel} – ${memberName} – €${parseFloat(withdrawal.importo).toFixed(2)}`
        : `Annullamento: ${tipoLabel} – €${parseFloat(withdrawal.importo).toFixed(2)}`;

      await tx.insert(financialHistory).values({
        userId,
        activityId,
        azione: 'DEPOSITO_CASSA',
        descrizione,
        importo: withdrawal.importo,
        dettagli: JSON.stringify({ scope: 'EQUITY', kind: 'ANNULLAMENTO', withdrawalId }),
      });

      await tx.update(equityWithdrawals)
        .set({ annullato: 1 })
        .where(eq(equityWithdrawals.id, withdrawalId));

      const nuovoSaldo = await this.getCassaReinvestimento(activityId);
      return { success: true, nuovoSaldo };
    });
  }
}

export const storage = new DatabaseStorage();
