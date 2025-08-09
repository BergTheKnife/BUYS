import { 
  users, 
  inventario, 
  vendite, 
  spese,
  activities,
  activityUsers,
  emailVerificationTokens,
  passwordResetTokens, // Import the new table
  type User, 
  type InsertUser,
  type Inventario,
  type InsertInventario,
  type Vendita,
  type InsertVendita,
  type Spesa,
  type InsertSpesa,
  type UpdateProfile,
  type Activity,
  type InsertActivity,
  type ActivityUser,
  type InsertActivityUser,
  type EmailVerificationToken,
  type InsertEmailVerificationToken,
  type PasswordResetToken, // Import the new type
  type InsertPasswordResetToken // Import the new type
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sum, sql, gte, lt, lte, or, like, ilike } from "drizzle-orm";

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
  deleteEmailVerificationTokensByUserId(userId: string): Promise<void>;
  deleteExpiredTokens(): Promise<void>;

  // Password reset methods
  createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  deletePasswordResetToken(token: string): Promise<boolean>;
  deletePasswordResetTokensByUserId(userId: string): Promise<void>;
  deleteExpiredPasswordResetTokens(): Promise<void>;

  // Activity methods
  createActivity(activity: InsertActivity & { proprietarioId: string }): Promise<Activity>;
  getActivitiesByUserId(userId: string): Promise<Activity[]>;
  getActivityByName(nome: string): Promise<Activity | undefined>;
  getActivityById(id: string): Promise<Activity | undefined>;
  joinActivity(activityId: string, userId: string): Promise<void>;
  addUserToActivity(userId: string, activityId: string): Promise<void>;
  removeUserFromActivity(userId: string, activityId: string): Promise<void>;

  // Inventory methods (now with activity context)
  getInventoryByActivity(activityId: string): Promise<Inventario[]>;
  getInventoryItem(id: string, activityId: string): Promise<Inventario | undefined>;
  createInventoryItem(item: InsertInventario & { userId: string; activityId: string }): Promise<Inventario>;
  updateInventoryItem(id: string, activityId: string, updates: Partial<InsertInventario>): Promise<Inventario | undefined>;
  deleteInventoryItem(id: string, activityId: string): Promise<boolean>;
  updateInventoryQuantity(id: string, newQuantity: number): Promise<void>;

  // Sales methods (now with activity context)
  getSalesByActivity(activityId: string): Promise<Vendita[]>;
  createSale(sale: InsertVendita & { userId: string; activityId: string; nomeArticolo: string; taglia: string; margine: string }): Promise<Vendita>;
  getSaleById(id: string, activityId: string): Promise<Vendita | null>;
  updateSale(id: string, activityId: string, updates: Partial<InsertVendita> & { nomeArticolo?: string; taglia?: string; margine?: string }): Promise<Vendita | null>;
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
    taglia: string;
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
        proprietarioCognome: users.cognome,
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

  async createInventoryItem(item: InsertInventario & { userId: string; activityId: string }): Promise<Inventario> {
    const [newItem] = await db
      .insert(inventario)
      .values(item)
      .returning();
    return newItem;
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
      const salesUpdates: any = {};
      
      if (updates.nomeArticolo) {
        salesUpdates.nomeArticolo = updates.nomeArticolo;
      }
      if (updates.taglia) {
        salesUpdates.taglia = updates.taglia;
      }
      
      // If cost changed, recalculate margin for all related sales
      if (updates.costo) {
        // Get all sales for this inventory item
        const relatedSales = await db
          .select()
          .from(vendite)
          .where(eq(vendite.inventarioId, id));
        
        // Update each sale with new margin calculation
        for (const sale of relatedSales) {
          const newMargin = (Number(sale.prezzoVendita) - Number(updates.costo)) * sale.quantita;
          salesUpdates.margine = newMargin.toString();
          
          await db
            .update(vendite)
            .set(salesUpdates)
            .where(eq(vendite.id, sale.id));
        }
      } else if (updates.nomeArticolo || updates.taglia) {
        // Update only name/size without recalculating margin
        await db
          .update(vendite)
          .set(salesUpdates)
          .where(eq(vendite.inventarioId, id));
      }
    }

    // If quantity changed, create/update expense entry
    if (updates.quantita !== undefined && updates.quantita !== currentItem.quantita) {
      const quantityDifference = updates.quantita - currentItem.quantita;
      const costPerUnit = Number(updates.costo || currentItem.costo);
      const totalCostDifference = costPerUnit * quantityDifference;

      if (quantityDifference > 0) {
        // Quantity increased - add expense for additional stock
        await this.createExpense({
          userId: updatedItem.userId,
          activityId: activityId,
          voce: `Rifornimento: ${updatedItem.nomeArticolo} - ${updatedItem.taglia} (+${quantityDifference} pz)`,
          importo: totalCostDifference.toString(),
          categoria: "Inventario",
          data: new Date(),
        });
      } else {
        // Quantity decreased - add negative expense (reduction)
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

    // First, delete all related sales to avoid foreign key constraint
    await db
      .delete(vendite)
      .where(eq(vendite.inventarioId, id));

    // Find and delete all related expenses for this inventory item
    // This includes initial addition and any quantity updates (rifornimenti/riduzioni)
    await db
      .delete(spese)
      .where(and(
        eq(spese.activityId, activityId),
        sql`(${spese.categoria} = 'Aggiunta articolo' OR ${spese.categoria} = 'Inventario')`,
        or(
          like(spese.voce, `%${item.nomeArticolo} - ${item.taglia}%`),
          like(spese.voce, `%Rifornimento: ${item.nomeArticolo} - ${item.taglia}%`),
          like(spese.voce, `%Riduzione inventario: ${item.nomeArticolo} - ${item.taglia}%`)
        )
      ));

    // Finally, delete the inventory item
    const result = await db
      .delete(inventario)
      .where(and(eq(inventario.id, id), eq(inventario.activityId, activityId)));

    // After deleting the inventory item, clean up orphaned expenses
    // Get all remaining inventory items for this activity
    const remainingInventoryItems = await db
      .select({
        nomeArticolo: inventario.nomeArticolo,
        taglia: inventario.taglia
      })
      .from(inventario)
      .where(eq(inventario.activityId, activityId));

    // Get all inventory-related expenses for this activity
    const inventoryExpenses = await db
      .select()
      .from(spese)
      .where(and(
        eq(spese.activityId, activityId),
        sql`(${spese.categoria} = 'Aggiunta articolo' OR ${spese.categoria} = 'Inventario')`
      ));

    // Find orphaned expenses (expenses that don't match any remaining inventory item)
    for (const expense of inventoryExpenses) {
      let isOrphaned = true;

      for (const inventoryItem of remainingInventoryItems) {
        const itemSignature = `${inventoryItem.nomeArticolo} - ${inventoryItem.taglia}`;
        if (expense.voce.includes(itemSignature)) {
          isOrphaned = false;
          break;
        }
      }

      // Delete orphaned expense
      if (isOrphaned) {
        await db
          .delete(spese)
          .where(eq(spese.id, expense.id));
      }
    }

    return (result.rowCount ?? 0) > 0;
  }

  async updateInventoryQuantity(id: string, newQuantity: number): Promise<void> {
    await db
      .update(inventario)
      .set({ quantita: newQuantity })
      .where(eq(inventario.id, id));
  }

  // Updated sales methods with activity context
  async getSalesByActivity(activityId: string): Promise<Vendita[]> {
    return await db.select().from(vendite).where(eq(vendite.activityId, activityId)).orderBy(desc(vendite.data));
  }

  async createSale(saleData: InsertVendita & { userId: string; activityId: string; nomeArticolo: string; taglia: string; margine: string }): Promise<Vendita> {
    const [newSale] = await db
      .insert(vendite)
      .values(saleData)
      .returning();
    return newSale;
  }

  async getSaleById(id: string, activityId: string): Promise<Vendita | null> {
    const [sale] = await db
      .select()
      .from(vendite)
      .where(and(eq(vendite.id, id), eq(vendite.activityId, activityId)));

    return sale || null;
  }

  async updateSale(id: string, activityId: string, updates: Partial<InsertVendita> & { nomeArticolo?: string; taglia?: string; margine?: string }): Promise<Vendita | null> {
    const [updatedSale] = await db
      .update(vendite)
      .set(updates)
      .where(and(eq(vendite.id, id), eq(vendite.activityId, activityId)))
      .returning();

    return updatedSale || null;
  }

  async deleteSale(id: string, activityId: string): Promise<boolean> {
    // Get the sale data to restore inventory quantity
    const [sale] = await db
      .select()
      .from(vendite)
      .where(and(eq(vendite.id, id), eq(vendite.activityId, activityId)));

    if (!sale) return false;

    // Restore the inventory quantity
    await db
      .update(inventario)
      .set({ 
        quantita: sql`${inventario.quantita} + ${sale.quantita}`
      })
      .where(eq(inventario.id, sale.inventarioId));

    // Delete the sale
    const result = await db
      .delete(vendite)
      .where(and(eq(vendite.id, id), eq(vendite.activityId, activityId)));

    return (result.rowCount ?? 0) > 0;
  }

  // Updated expenses methods with activity context
  async getExpensesByActivity(activityId: string): Promise<Spesa[]> {
    return await db.select().from(spese).where(eq(spese.activityId, activityId)).orderBy(desc(spese.data));
  }

  async createExpense(expense: InsertSpesa & { userId: string; activityId: string }): Promise<Spesa> {
    const [newExpense] = await db
      .insert(spese)
      .values(expense)
      .returning();
    return newExpense;
  }

  async updateExpense(id: string, activityId: string, updates: Partial<InsertSpesa>): Promise<Spesa | undefined> {
    const [updatedExpense] = await db
      .update(spese)
      .set(updates)
      .where(and(eq(spese.id, id), eq(spese.activityId, activityId)))
      .returning();
    return updatedExpense || undefined;
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
      .select({ count: sql<number>`count(*)` })
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

    const inventoryCount = inventoryCountResult?.count || 0;
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
    taglia: string;
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
}

export const storage = new DatabaseStorage();