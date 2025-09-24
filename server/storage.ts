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
  rememberTokens, // Import remember tokens table
  spedizioni, // Import spedizioni table
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
  type UpdateProfile,
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
  type UpdateSpedizione
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sum, sql, gte, lt, lte, or, like, ilike, inArray } from "drizzle-orm";

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
  leaveActivity(activityId: string, userId: string): Promise<void>; // Added leaveActivity
  addUserToActivity(userId: string, activityId: string): Promise<void>;
  removeUserFromActivity(userId: string, activityId: string): Promise<void>;

  // Inventory methods (now with activity context)
  getInventoryByActivity(activityId: string): Promise<Inventario[]>;
  getInventoryItem(id: string, activityId: string): Promise<Inventario | undefined>;
  createInventoryItem(item: InsertInventario & { userId: string; activityId: string }): Promise<Inventario>;
  updateInventoryItem(id: string, activityId: string, updates: Partial<InsertInventario>): Promise<Inventario | undefined>;
  deleteInventoryItem(id: string, activityId: string): Promise<boolean>;
  updateInventoryQuantity(id: string, newQuantity: number): Promise<Inventario | undefined>;

  // Sales methods (now with activity context)
  getSalesByActivity(activityId: string): Promise<Vendita[]>;
  createSale(sale: InsertVendita & { userId: string; activityId: string; nomeArticolo: string; taglia: string; margine: string }): Promise<Vendita>;
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
      sql`${users.email} = ${emailOrUsername} OR ${users.username} = ${emailOrUsername}`
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

    // Add creator as member
    await db.insert(activityUsers).values({
      activityId: newActivity.id,
      userId: activity.proprietarioId,
    });

    // Update user's last activity
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
    // Check if user is already a member
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

    // Update user's last activity
    await db
      .update(users)
      .set({ lastActivityId: activityId })
      .where(eq(users.id, userId));
  }

  async leaveActivity(activityId: string, userId: string): Promise<void> {
    // Remove user from activity
    await db
      .delete(activityUsers)
      .where(and(
        eq(activityUsers.activityId, activityId),
        eq(activityUsers.userId, userId)
      ));

    // Update user's last activity to null if it was this activity
    await db
      .update(users)
      .set({ lastActivityId: null })
      .where(and(
        eq(users.id, userId),
        eq(users.lastActivityId, activityId)
      ));
  }

  async addUserToActivity(userId: string, activityId: string): Promise<void> {
    // Check if user is already a member
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
    // Remove user from activity
    await db
      .delete(activityUsers)
      .where(and(
        eq(activityUsers.userId, userId),
        eq(activityUsers.activityId, activityId)
      ));

    // Update user's last activity to null if it was this activity
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
    return await db.select().from(inventario).where(eq(inventario.activityId, activityId)).orderBy(desc(inventario.createdAt));
  }

  async getInventoryItem(id: string, activityId: string): Promise<Inventario | undefined> {
    const [item] = await db.select().from(inventario).where(
      and(eq(inventario.id, id), eq(inventario.activityId, activityId))
    );
    return item || undefined;
  }

  async createInventoryItem(data: any): Promise<Inventario> {
    const [item] = await db.insert(inventario).values(data).returning();

    // Automatically create an inventory batch for the initial stock
    if (item) {
      await this.createInventoryBatch({
        inventarioId: item.id,
        activityId: data.activityId,
        userId: data.userId,
        costo: data.costo,
        quantita: data.quantita,
      });

      // Also create an expense for this inventory addition
      await this.createExpense({
        userId: data.userId,
        activityId: data.activityId,
        voce: `Acquisto: ${data.nomeArticolo} - ${data.taglia} (${data.quantita} pz)`,
        importo: (Number(data.costo) * data.quantita).toString(),
        categoria: "Inventario",
        data: new Date(),
      });
    }

    return item;
  }

  async updateInventoryItem(id: string, activityId: string, updates: Partial<InsertInventario>): Promise<Inventario | undefined> {
    // Get the current item to compare quantities
    const currentItem = await this.getInventoryItem(id, activityId);
    if (!currentItem) return undefined;

    const [updatedItem] = await db
      .update(inventario)
      .set(updates)
      .where(and(eq(inventario.id, id), eq(inventario.activityId, activityId)))
      .returning();

    // Update related sales with new inventory item information
    if (updates.nomeArticolo || updates.taglia || updates.costo) {
      // Get all sales for this inventory item
      const relatedSales = await db
        .select()
        .from(vendite)
        .where(eq(vendite.inventarioId, id));

      // Update each sale with new information
      for (const sale of relatedSales) {
        const salesUpdates: any = {};

        // Always update name and size if they changed
        if (updates.nomeArticolo) {
          salesUpdates.nomeArticolo = updates.nomeArticolo;
        }
        if (updates.taglia) {
          salesUpdates.taglia = updates.taglia;
        }

        // NOTE: We intentionally do NOT recalculate historical sale margins when cost changes
        // Historical margins should remain based on the original FIFO costs at time of sale
        // Changing historical margins would corrupt financial data integrity

        // Only update if there are actual changes
        if (Object.keys(salesUpdates).length > 0) {
          await db
            .update(vendite)
            .set(salesUpdates)
            .where(eq(vendite.id, sale.id));
        }
      }
    }

    // If cost changed, create adjustment entry ONLY for existing inventory
    if (updates.costo !== undefined && Number(updates.costo) !== Number(currentItem.costo)) {
      // Use ONLY the original quantity for cost adjustment, not the new quantity
      const existingQuantity = currentItem.quantita;
      
      // Skip adjustment if there's no existing quantity
      if (existingQuantity > 0) {
        const oldCostTotal = Number(currentItem.costo) * existingQuantity;
        const newCostTotal = Number(updates.costo) * existingQuantity;
        const costDifference = newCostTotal - oldCostTotal;

        // Only create adjustment record if there's an actual difference
        if (Math.abs(costDifference) > 0.001) { // Using small epsilon for decimal comparison
          
          // Per gli aggiustamenti di costo, gestiamo solo la cassa reinvestimento
          // La spesa viene creata automaticamente dal metodo createExpense quando necessario
          
          if (costDifference > 0) {
            // Costo aumentato - preleva dalla cassa reinvestimento se disponibile
            const cassaBalance = await this.getCassaReinvestimentoBalance(activityId);
            if (cassaBalance >= costDifference) {
              await this.updateCassaReinvestimento(
                activityId,
                -costDifference,
                `Aggiustamento costo (aumento): ${updatedItem.nomeArticolo} - ${updatedItem.taglia} (${existingQuantity} pz)`,
                updatedItem.userId
              );
            } else {
              // Se non ci sono fondi sufficienti in cassa, crea una spesa normale
              await this.createExpense({
                userId: updatedItem.userId,
                activityId: activityId,
                voce: `Aggiustamento costo: ${updatedItem.nomeArticolo} - ${updatedItem.taglia} (${existingQuantity} pz)`,
                importo: costDifference.toString(),
                categoria: "Inventario",
                data: new Date(),
              });
            }
          } else {
            // Costo diminuito - rimborsa alla cassa reinvestimento
            await this.updateCassaReinvestimento(
              activityId,
              Math.abs(costDifference),
              `Aggiustamento costo (riduzione): ${updatedItem.nomeArticolo} - ${updatedItem.taglia} (${existingQuantity} pz)`,
              updatedItem.userId
            );
          }
        }
      }
    }

    // If quantity changed, create/update expense entry and manage cassa reinvestimento
    if (updates.quantita !== undefined && updates.quantita !== currentItem.quantita) {
      const quantityDifference = updates.quantita - currentItem.quantita;
      const costPerUnit = Number(updates.costo || currentItem.costo);
      const totalCostDifference = costPerUnit * quantityDifference;

      if (quantityDifference > 0) {
        // Quantity increased - manage cassa reinvestimento and add expense for additional stock
        const cassaBalance = await this.getCassaReinvestimentoBalance(activityId);
        
        if (totalCostDifference > 0 && cassaBalance >= totalCostDifference) {
          await this.updateCassaReinvestimento(
            activityId,
            -totalCostDifference,
            `Rifornimento coperto da cassa: ${updatedItem.nomeArticolo} - ${updatedItem.taglia} (+${quantityDifference} pz)`,
            updatedItem.userId
          );
        }

        await this.createExpense({
          userId: updatedItem.userId,
          activityId: activityId,
          voce: `Rifornimento: ${updatedItem.nomeArticolo} - ${updatedItem.taglia} (+${quantityDifference} pz)`,
          importo: totalCostDifference.toString(),
          categoria: "Inventario",
          data: new Date(),
        });
      } else {
        // Quantity decreased - restore to cassa reinvestimento and add negative expense
        if (totalCostDifference < 0) {
          await this.updateCassaReinvestimento(
            activityId,
            Math.abs(totalCostDifference),
            `Ripristino per riduzione inventario: ${updatedItem.nomeArticolo} - ${updatedItem.taglia} (${quantityDifference} pz)`,
            updatedItem.userId
          );
        }

        await this.createExpense({
          userId: updatedItem.userId,
          activityId: activityId,
          voce: `Riduzione inventario: ${updatedItem.nomeArticolo} - ${updatedItem.taglia} (${quantityDifference} pz)`,
          importo: totalCostDifference.toString(), // This will be negative
          categoria: "Inventario",
          data: new Date(),
        });
      }
    }

    return updatedItem || undefined;
  }

  async deleteInventoryItem(id: string, activityId: string): Promise<boolean> {
    // Get the inventory item to check for related data
    const item = await this.getInventoryItem(id, activityId);
    if (!item) return false;

    console.log(`🔍 [DELETE DEBUG] Starting deletion of item ${id}: ${item.nomeArticolo} - ${item.taglia}, cost: ${item.costo}, quantity: ${item.quantita}`);

    // Calculate the current total value of the inventory item
    const currentTotalValue = Number(item.costo) * item.quantita;
    console.log(`🔍 [DELETE DEBUG] Current total inventory value: ${currentTotalValue} (${item.costo} × ${item.quantita})`);

    // First, delete all related sales to avoid foreign key constraint
    await db
      .delete(vendite)
      .where(eq(vendite.inventarioId, id));

    // Find all related expenses for cleanup
    const relatedExpenses = await db
      .select()
      .from(spese)
      .where(and(
        eq(spese.activityId, activityId),
        sql`(${spese.categoria} = 'Aggiunta articolo' OR ${spese.categoria} = 'Inventario')`,
        or(
          like(spese.voce, `%Acquisto: ${item.nomeArticolo} - ${item.taglia}%`),
          like(spese.voce, `%Rifornimento: ${item.nomeArticolo} - ${item.taglia}%`),
          like(spese.voce, `%Riduzione inventario: ${item.nomeArticolo} - ${item.taglia}%`),
          like(spese.voce, `%Aggiustamento costo: ${item.nomeArticolo} - ${item.taglia}%`)
        )
      ));

    console.log(`🔍 [DELETE DEBUG] Found ${relatedExpenses.length} related expenses for cleanup`);

    const balanceBefore = await this.getCassaReinvestimentoBalance(activityId);
    console.log(`🔍 [DELETE DEBUG] Cassa balance before restoration: ${balanceBefore}`);

    // Restore the current inventory value to the reinvestment fund
    // This ensures accounting consistency regardless of historical cost changes
    if (currentTotalValue > 0) {
      console.log(`🔍 [DELETE DEBUG] Restoring current inventory value: ${currentTotalValue}`);
      await this.updateCassaReinvestimento(
        activityId,
        currentTotalValue,
        `Ripristino per eliminazione articolo: ${item.nomeArticolo} - ${item.taglia} (${item.quantita} pz @ €${item.costo})`,
        item.userId
      );

      const balanceAfter = await this.getCassaReinvestimentoBalance(activityId);
      console.log(`🔍 [DELETE DEBUG] Cassa balance after restoration: ${balanceAfter} (expected: ${balanceBefore + currentTotalValue})`);
    }

    // Delete all related expenses for cleanup
    await db
      .delete(spese)
      .where(and(
        eq(spese.activityId, activityId),
        sql`(${spese.categoria} = 'Aggiunta articolo' OR ${spese.categoria} = 'Inventario')`,
        or(
          like(spese.voce, `%Acquisto: ${item.nomeArticolo} - ${item.taglia}%`),
          like(spese.voce, `%Rifornimento: ${item.nomeArticolo} - ${item.taglia}%`),
          like(spese.voce, `%Riduzione inventario: ${item.nomeArticolo} - ${item.taglia}%`),
          like(spese.voce, `%Aggiustamento costo: ${item.nomeArticolo} - ${item.taglia}%`)
        )
      ));

    // Delete inventory batches
    const { inventoryBatches } = await import('../migrations/schema');
    await db
      .delete(inventoryBatches)
      .where(eq(inventoryBatches.inventarioId, id));

    // Finally, delete the inventory item
    const result = await db
      .delete(inventario)
      .where(and(eq(inventario.id, id), eq(inventario.activityId, activityId)));

    return (result.rowCount ?? 0) > 0;
  }

  async updateInventoryQuantity(id: string, newQuantity: number): Promise<Inventario | undefined> {
    const [updatedItem] = await db
      .update(inventario)
      .set({ quantita: newQuantity })
      .where(eq(inventario.id, id))
      .returning();

    return updatedItem;
  }

  // Gestione lotti inventario
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

  // Calcola margine FIFO per una vendita
  async calculateFIFOMargin(inventarioId: string, quantitaVenduta: number, prezzoVendita: number) {
    const { inventoryBatches } = await import('../migrations/schema');

    // Get available batches ordered by date (FIFO)
    const batches = await db
      .select()
      .from(inventoryBatches)
      .where(
        and(
          eq(inventoryBatches.inventarioId, inventarioId),
          sql`${inventoryBatches.quantitaRimanente} > 0`
        )
      )
      .orderBy(inventoryBatches.dataAcquisto);

    // Calculate total available quantity from batches
    const totalAvailableFromBatches = batches.reduce((sum, batch) => sum + batch.quantitaRimanente, 0);

    // If no batches exist, fall back to current inventory item cost
    if (batches.length === 0 || totalAvailableFromBatches === 0) {
      const [inventoryItem] = await db
        .select()
        .from(inventario)
        .where(eq(inventario.id, inventarioId));

      if (!inventoryItem || inventoryItem.quantita < quantitaVenduta) {
        throw new Error("Quantità insufficiente in magazzino per completare la vendita");
      }

      const costoTotale = quantitaVenduta * Number(inventoryItem.costo);
      const ricavoTotale = quantitaVenduta * prezzoVendita;
      const margine = ricavoTotale - costoTotale;

      return {
        margine,
        batchesUsed: [],
        batchDetails: [{
          batchId: null,
          costoUnitario: Number(inventoryItem.costo),
          quantitaUsata: quantitaVenduta,
          marginePartial: margine
        }]
      };
    }

    // Check if we have enough quantity in batches
    if (totalAvailableFromBatches < quantitaVenduta) {
      throw new Error("Quantità insufficiente in magazzino per completare la vendita");
    }

    let rimanenteVendita = quantitaVenduta;
    let costoTotale = 0;
    const batchesUsed: { id: string; quantitaUsata: number }[] = [];
    const batchDetails: { batchId: string | null; costoUnitario: number; quantitaUsata: number; marginePartial: number }[] = [];

    for (const batch of batches) {
      if (rimanenteVendita <= 0) break;

      const quantitaUsata = Math.min(rimanenteVendita, batch.quantitaRimanente);
      const costoUnitario = Number(batch.costo);
      const costoPartial = quantitaUsata * costoUnitario;
      const ricavoPartial = quantitaUsata * prezzoVendita;
      const marginePartial = ricavoPartial - costoPartial;

      costoTotale += costoPartial;

      batchesUsed.push({
        id: batch.id,
        quantitaUsata
      });

      batchDetails.push({
        batchId: batch.id,
        costoUnitario,
        quantitaUsata,
        marginePartial
      });

      rimanenteVendita -= quantitaUsata;
    }

    const ricavoTotale = quantitaVenduta * prezzoVendita;
    const margine = ricavoTotale - costoTotale;

    return {
      margine,
      batchesUsed,
      batchDetails
    };
  }

  // Aggiorna quantità nei lotti dopo una vendita
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

      // If batch is depleted, we could optionally delete it
      if (updatedBatch && updatedBatch.quantitaRimanente <= 0) {
        await db
          .delete(inventoryBatches)
          .where(eq(inventoryBatches.id, batchUsage.id));
      }
    }
  }

  // Ottenere saldo cassa reinvestimento
  async getCassaReinvestimentoBalance(activityId: string): Promise<number> {
    // Calcola il saldo dalla cronologia finanziaria considerando tutti i movimenti della cassa reinvestimento
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
        balance += amount; // Entrate nella cassa reinvestimento
      } else if (movement.azione === "PRELIEVO_CASSA") {
        balance -= amount; // Uscite dalla cassa reinvestimento
      }
    }

    return balance;
  }

  // Aggiorna saldo cassa reinvestimento
  async updateCassaReinvestimento(activityId: string, importo: number, descrizione: string, userId: string) {
    const currentBalance = await this.getCassaReinvestimentoBalance(activityId);

    if (currentBalance + importo < 0) {
      throw new Error("Fondi insufficienti nella cassa reinvestimento");
    }

    // Registra nella cronologia finanziaria
    const [newEntry] = await db.insert(financialHistory).values({
      userId,
      activityId,
      azione: importo > 0 ? "DEPOSITO_CASSA" : "PRELIEVO_CASSA",
      descrizione,
      importo: Math.abs(importo).toString(),
    }).returning();

    return currentBalance + importo;
  }

  // Updated sales methods with activity context
  async getSalesByActivity(activityId: string): Promise<Vendita[]> {
    return await db.select().from(vendite).where(eq(vendite.activityId, activityId)).orderBy(desc(vendite.data));
  }

  async createSale(saleData: InsertVendita & { userId: string; activityId: string; nomeArticolo: string; taglia: string; margine: string }): Promise<Vendita> {
    // Verify inventory item exists and has sufficient quantity
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

    // Calculate FIFO margin and update batches
    const { margine, batchesUsed, batchDetails } = await this.calculateFIFOMargin(saleData.inventarioId, saleData.quantita!, Number(saleData.prezzoVendita));
    await this.updateBatchesAfterSale(batchesUsed);

    // Calculate weighted average cost for storage
    const costoTotale = batchDetails.reduce((sum, detail) => sum + (detail.quantitaUsata * detail.costoUnitario), 0);

    // Create the sale record with calculated margin and new fields
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
        vendutoA: saleData.vendutoA || null,
        incassato: saleData.incassato || 0,
        incassatoDa: (saleData.incassato === 1) ? saleData.incassatoDa : null,
        incassatoSu: (saleData.incassato === 1) ? saleData.incassatoSu : null,
        margine: margine.toString()
      })
      .returning();

    // Update inventory quantity
    await db
      .update(inventario)
      .set({ 
        quantita: sql`${inventario.quantita} - ${saleData.quantita!}`
      })
      .where(eq(inventario.id, saleData.inventarioId));

    // Automatically create a spedizione record
    await this.createSpedizione({
      userId: saleData.userId,
      activityId: saleData.activityId,
      venditaId: newSale.id,
      nomeArticolo: saleData.nomeArticolo,
      taglia: saleData.taglia,
      quantita: saleData.quantita || 1,
      vendutoA: saleData.vendutoA || null,
      speditoConsegnato: 0, // Default to not yet shipped
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
    // Get the existing sale to compare changes
    const [existingSale] = await db
      .select()
      .from(vendite)
      .where(and(eq(vendite.id, id), eq(vendite.activityId, activityId)));

    if (!existingSale) return null;

    const oldQuantity = existingSale.quantita;
    const newQuantity = updates.quantita || oldQuantity;
    const oldInventarioId = existingSale.inventarioId;
    const newInventarioId = updates.inventarioId || oldInventarioId;

    // ALWAYS restore the old quantity first to ensure inventory consistency
    await db
      .update(inventario)
      .set({ 
        quantita: sql`${inventario.quantita} + ${oldQuantity}`
      })
      .where(eq(inventario.id, oldInventarioId));

    // Restore batches for the old sale to reset FIFO state
    await this.restoreBatchesAfterSaleDelete(oldInventarioId, oldQuantity, Number(existingSale.prezzoVendita));

    // If we're changing to a different inventory item OR keeping the same item
    if (newInventarioId !== oldInventarioId || newQuantity !== oldQuantity) {
      // Check if target item has enough quantity
      const [targetItem] = await db
        .select()
        .from(inventario)
        .where(eq(inventario.id, newInventarioId));

      if (!targetItem) {
        // Restore the old quantity since we're failing
        await db
          .update(inventario)
          .set({ 
            quantita: sql`${inventario.quantita} - ${oldQuantity}`
          })
          .where(eq(inventario.id, oldInventarioId));
        throw new Error("Articolo di destinazione non trovato");
      }

      if (targetItem.quantita < newQuantity) {
        // Restore the old quantity since we're failing
        await db
          .update(inventario)
          .set({ 
            quantita: sql`${inventario.quantita} - ${oldQuantity}`
          })
          .where(eq(inventario.id, oldInventarioId));
        throw new Error("Quantità insufficiente nel nuovo articolo selezionato");
      }

      // Reduce quantity from the target item
      await db
        .update(inventario)
        .set({ 
          quantita: sql`${inventario.quantita} - ${newQuantity}`
        })
        .where(eq(inventario.id, newInventarioId));
    } else {
      // Same item, same quantity - just restore the original state
      await db
        .update(inventario)
        .set({ 
          quantita: sql`${inventario.quantita} - ${oldQuantity}`
        })
        .where(eq(inventario.id, oldInventarioId));
    }

    // If quantity, item, or price changed, recalculate FIFO margin for new data
    if ((updates.quantita && updates.quantita !== oldQuantity) || 
        (updates.inventarioId && updates.inventarioId !== oldInventarioId) ||
        (updates.prezzoVendita && updates.prezzoVendita !== existingSale.prezzoVendita)) {

      const finalInventarioId = updates.inventarioId || oldInventarioId;
      const finalQuantity = updates.quantita || oldQuantity;
      const finalPrice = Number(updates.prezzoVendita || existingSale.prezzoVendita);

      try {
        // Calculate FIFO margin and update batches for the new sale parameters
        const { margine, batchesUsed } = await this.calculateFIFOMargin(finalInventarioId, finalQuantity, finalPrice);
        await this.updateBatchesAfterSale(batchesUsed);

        updates.margine = margine.toString();
      } catch (error) {
        // If FIFO calculation fails, fall back to using current item cost for margin calculation
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

    // Handle incassato field consistency logic
    if (updates.incassato !== undefined) {
      if (updates.incassato === 0) {
        // If setting incassato to NO, clear related fields  
        (updates as any).incassatoDa = null;
        (updates as any).incassatoSu = null;
      } else if (updates.incassato === 1) {
        // If setting incassato to YES, keep existing values if not provided
        if (updates.incassatoDa === undefined) {
          (updates as any).incassatoDa = existingSale.incassatoDa;
        }
        if (updates.incassatoSu === undefined) {
          (updates as any).incassatoSu = existingSale.incassatoSu;
        }
      }
    }

    // Update the sale
    const [updatedSale] = await db
      .update(vendite)
      .set(updates)
      .where(and(eq(vendite.id, id), eq(vendite.activityId, activityId)))
      .returning();

    // Synchronize corresponding spedizione record with updated sale data
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
      // Get the sale to restore inventory quantity
      const [saleToDelete] = await db
        .select()
        .from(vendite)
        .where(and(eq(vendite.id, id), eq(vendite.activityId, activityId)));

      if (!saleToDelete) return false;

      // Restore inventory quantity
      await db
        .update(inventario)
        .set({ 
          quantita: sql`${inventario.quantita} + ${saleToDelete.quantita}`
        })
        .where(eq(inventario.id, saleToDelete.inventarioId));

      // Restore inventory batches using FIFO logic (reverse the sale)
      await this.restoreBatchesAfterSaleDelete(saleToDelete.inventarioId, saleToDelete.quantita, Number(saleToDelete.prezzoVendita));

      // Delete related financial history if sale was incassato - simplified query
      if (saleToDelete.incassato === 1) {
        try {
          await db.delete(financialHistory)
            .where(and(
              eq(financialHistory.activityId, activityId),
              eq(financialHistory.azione, "Vendita incassata")
            ));
        } catch (error) {
          console.warn('Could not delete financial history for sale:', error);
          // Continue with deletion anyway
        }
      }

      // Delete related spedizione record
      await db
        .delete(spedizioni)
        .where(and(eq(spedizioni.venditaId, id), eq(spedizioni.activityId, activityId)));

      // Delete the sale
      const result = await db
        .delete(vendite)
        .where(and(eq(vendite.id, id), eq(vendite.activityId, activityId)));

      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      console.error('Error deleting sale:', error);
      throw new Error(`Errore nell'eliminazione della vendita: ${error.message}`);
    }
  }

  // Helper method to restore batches when a sale is deleted
  async restoreBatchesAfterSaleDelete(inventarioId: string, quantitaToRestore: number, prezzoVendita: number) {
    try {
      const { inventoryBatches } = await import('../migrations/schema');

      // Get all batches for this inventory item, ordered by date (FIFO reverse)
      const batches = await db
        .select()
        .from(inventoryBatches)
        .where(eq(inventoryBatches.inventarioId, inventarioId))
        .orderBy(sql`${inventoryBatches.dataAcquisto} DESC`); // Reverse FIFO for restoration

      let rimanenteRestore = quantitaToRestore;

      // Restore quantity to most recent batches first (reverse FIFO)
      for (const batch of batches) {
        if (rimanenteRestore <= 0) break;

        // Calculate how much we can restore to this batch
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

      // If we still have quantity to restore and no batches can accommodate it,
      // create a new batch with current inventory item cost
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
      // Continue without throwing - inventory quantity is already restored
      // This is a batch optimization, not critical for basic functionality
    }
  }

  // Updated expenses methods with activity context
  async getExpensesByActivity(activityId: string): Promise<Spesa[]> {
    return await db.select().from(spese).where(eq(spese.activityId, activityId)).orderBy(desc(spese.data));
  }

  async createExpense(expenseData: InsertSpesa & { userId: string; activityId: string }): Promise<Spesa> {
    // Verifica se ci sono fondi nella cassa reinvestimento per coprire la spesa
    const cassaBalance = await this.getCassaReinvestimentoBalance(expenseData.activityId);
    const expenseAmount = Number(expenseData.importo);

    // Se l'importo è positivo (uscita) e ci sono fondi sufficienti nella cassa reinvestimento
    if (expenseAmount > 0 && cassaBalance >= expenseAmount) {
      // Utilizza la cassa reinvestimento per coprire la spesa
      await this.updateCassaReinvestimento(
        expenseData.activityId,
        -expenseAmount,
        `Spesa coperta da cassa reinvestimento: ${expenseData.voce}`,
        expenseData.userId
      );
    }

    // Crea la spesa per registrare il movimento
    const [newExpense] = await db
      .insert(spese)
      .values(expenseData)
      .returning();
    return newExpense;
  }

  async updateExpense(id: string, activityId: string, updates: Partial<InsertSpesa>): Promise<Spesa | undefined> {
    // Recupera la spesa originale
    const [originalExpense] = await db
      .select()
      .from(spese)
      .where(and(eq(spese.id, id), eq(spese.activityId, activityId)));

    if (!originalExpense) return undefined;

    // Controlla se la spesa originale era stata coperta dalla cassa reinvestimento
    const originalCoverage = await db
      .select()
      .from(financialHistory)
      .where(and(
        eq(financialHistory.activityId, activityId),
        eq(financialHistory.azione, "PRELIEVO_CASSA"),
        sql`${financialHistory.descrizione} LIKE ${'%' + originalExpense.voce + '%'}`
      ));

    // Se era stata coperta dalla cassa, ripristina l'importo originale E elimina il record
    if (originalCoverage.length > 0) {
      await this.updateCassaReinvestimento(
        activityId,
        Number(originalExpense.importo),
        `Ripristino per modifica spesa: ${originalExpense.voce}`,
        originalExpense.userId
      );

      // IMPORTANTE: Elimina il record di copertura originale per evitare duplicazioni
      await db
        .delete(financialHistory)
        .where(eq(financialHistory.id, originalCoverage[0].id));
    }

    // Aggiorna la spesa
    const [updatedExpense] = await db
      .update(spese)
      .set(updates)
      .where(and(eq(spese.id, id), eq(spese.activityId, activityId)))
      .returning();

    if (!updatedExpense) return undefined;

    // Se l'importo è cambiato, applica la nuova logica di copertura dalla cassa
    if (updates.importo && updates.importo !== originalExpense.importo) {
      const newAmount = Number(updates.importo);
      const cassaBalance = await this.getCassaReinvestimentoBalance(activityId);

      if (newAmount > 0 && cassaBalance >= newAmount) {
        await this.updateCassaReinvestimento(
          activityId,
          -newAmount,
          `Spesa coperta da cassa reinvestimento: ${updatedExpense.voce}`,
          updatedExpense.userId
        );
      }
    }

    return updatedExpense;
  }

  async deleteExpense(id: string, activityId: string): Promise<boolean> {
    // Check if this expense is for inventory addition - these should not be deleted manually
    const [expense] = await db
      .select()
      .from(spese)
      .where(and(eq(spese.id, id), eq(spese.activityId, activityId)));

    if (!expense) return false;

    // Prevent deletion of inventory-related expenses
    if (expense.categoria === "Aggiunta articolo" || expense.categoria === "Inventario") {
      throw new Error("Non è possibile eliminare manualmente le spese relative all'inventario. Gestisci l'inventario dalla sezione Magazzino per aggiornare automaticamente le spese correlate.");
    }

    // Controlla se la spesa era stata coperta dalla cassa reinvestimento
    const coverage = await db
      .select()
      .from(financialHistory)
      .where(and(
        eq(financialHistory.activityId, activityId),
        eq(financialHistory.azione, "PRELIEVO_CASSA"),
        sql`${financialHistory.descrizione} LIKE ${'%' + expense.voce + '%'}`
      ));

    // Se era stata coperta dalla cassa, ripristina l'importo E elimina il record di copertura
    if (coverage.length > 0) {
      await this.updateCassaReinvestimento(
        activityId,
        Number(expense.importo),
        `Ripristino per eliminazione spesa: ${expense.voce}`,
        expense.userId
      );

      // IMPORTANTE: Elimina il record di copertura per evitare che venga processato di nuovo
      await db
        .delete(financialHistory)
        .where(eq(financialHistory.id, coverage[0].id));
    }

    const result = await db
      .delete(spese)
      .where(and(eq(spese.id, id), eq(spese.activityId, activityId)));
    return (result.rowCount ?? 0) > 0;
  }

  // Updated stats methods with activity context
  async getActivityStats(activityId: string): Promise<{
    inventoryCount: number;
    totalSales: number;
    totalExpenses: number;
    netMargin: number;
  }> {
    const [inventoryCountResult] = await db
      .select({ count: sql<number>`coalesce(sum(${inventario.quantita}), 0)` })
      .from(inventario)
      .where(eq(inventario.activityId, activityId));

    const [salesSumResult] = await db
      .select({ total: sql<number>`coalesce(sum(${vendite.prezzoVendita}), 0)` })
      .from(vendite)
      .where(eq(vendite.activityId, activityId));

    const [expensesSumResult] = await db
      .select({ total: sql<number>`coalesce(sum(${spese.importo}), 0)` })
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
    // Build date conditions based on filter
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

    // Get sales with date filters
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

    // Get expenses with same date filters  
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
        // Replace vendite.data with spese.data in conditions
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

    // Get inventory additions with date filters
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
        // Replace vendite.data with inventario.createdAt in conditions
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

    // Sort by date and return
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


  // Admin methods implementation
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
      .leftJoin(inventario, eq(activities.id, inventario.activityId))
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
      .where(eq(inventario.userId, userId));

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
      .where(eq(inventario.activityId, activityId));

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
    // Delete activity and all related data (cascading deletes should handle most)
    await db.delete(activities).where(eq(activities.id, activityId));
  }

  async getChartDataByActivity(activityId: string): Promise<{
    salesData: Array<{date: string, amount: number}>;
    expensesData: Array<{date: string, amount: number}>;
    marginData: Array<{date: string, amount: number}>;
    months: string[];
  }> {
    // Get last 6 months of data
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Sales data by month
    const salesByMonth = await db
      .select({
        month: sql<string>`to_char(${vendite.data}, 'YYYY-MM')`,
        total: sql<number>`sum(${vendite.prezzoVendita})`
      })
      .from(vendite)
      .where(and(
        eq(vendite.activityId, activityId),
        gte(vendite.data, sixMonthsAgo)
      ))
      .groupBy(sql`to_char(${vendite.data}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${vendite.data}, 'YYYY-MM')`);

    // Expenses data by month
    const expensesByMonth = await db
      .select({
        month: sql<string>`to_char(${spese.data}, 'YYYY-MM')`,
        total: sql<number>`sum(${spese.importo})`
      })
      .from(spese)
      .where(and(
        eq(spese.activityId, activityId),
        gte(spese.data, sixMonthsAgo)
      ))
      .groupBy(sql`to_char(${spese.data}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${spese.data}, 'YYYY-MM')`);

    // Generate last 6 months
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

  // Fund transfer methods
  async getFundTransfersByActivity(activityId: string): Promise<FundTransfer[]> {
    return await db.select().from(fundTransfers).where(eq(fundTransfers.activityId, activityId)).orderBy(desc(fundTransfers.data));
  }

  async createFundTransfers(transfers: Array<InsertFundTransfer & { userId: string; activityId: string }>): Promise<FundTransfer[]> {
    const results = [];

    for (const transfer of transfers) {
      // Create fund transfer record
      const [newTransfer] = await db
        .insert(fundTransfers)
        .values(transfer)
        .returning();
      results.push(newTransfer);

      // Update reinvestment fund if it's a reinvestment transfer
      // Note: transfer doesn't have tipo property in current schema, commenting out
      // if (transfer.tipo === "Reinvestimento") {
      //   await this.updateCassaReinvestimento(
      //     transfer.activityId,
      //     Number(transfer.importo),
      //     `Versamento cassa reinvestimento: ${transfer.descrizione || ''}`,
      //     transfer.userId
      //   );
      // }

      // Create financial history entry
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

  // Financial history methods
  async getFinancialHistoryByActivity(activityId: string): Promise<FinancialHistory[]> {
    return await db.select().from(financialHistory).where(
      and(
        eq(financialHistory.activityId, activityId),
        eq(financialHistory.azione, "Riunisci fondi")
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
    // First, check if the entry is a 'Riunisci fondi' operation.
    // These operations might have side effects (like updating the reinvestment fund).
    // For simplicity, we'll assume that 'Riunisci fondi' operations are not directly deletable
    // from the history UI, or if they are, they need to be handled with care.
    // For other types of entries, direct deletion is fine.

    // Example: preventing deletion of 'Riunisci fondi' for now.
    const [entry] = await db
      .select()
      .from(financialHistory)
      .where(and(eq(financialHistory.id, entryId), eq(financialHistory.activityId, activityId)));

    if (!entry) {
      return false; // Entry not found
    }

    if (entry.azione === "Riunisci fondi") {
      // Optionally, implement logic to reverse the fund transfer and reinvestment fund update
      // For now, we'll disallow direct deletion of this type of entry via this method.
      // In a real scenario, you'd likely have a specific "undo" operation.
      throw new Error("Impossibile eliminare le operazioni di 'Riunisci fondi' direttamente dalla cronologia. Utilizzare la funzione di annullamento specifica.");
    }

    const result = await db
      .delete(financialHistory)
      .where(and(eq(financialHistory.id, entryId), eq(financialHistory.activityId, activityId)));

    return (result.rowCount ?? 0) > 0;
  }

  // Spedizioni methods
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
      },
    }));
  }
}

export const storage = new DatabaseStorage();