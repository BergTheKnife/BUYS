import { 
  users, 
  inventario, 
  vendite, 
  spese,
  activities,
  activityUsers,
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
  type InsertActivityUser
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sum, sql, gte, or, like, ilike } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByEmailOrUsername(emailOrUsername: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<UpdateProfile & { password?: string; username?: string }>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  
  // Activity methods
  createActivity(activity: InsertActivity & { proprietarioId: string }): Promise<Activity>;
  getActivitiesByUserId(userId: string): Promise<Activity[]>;
  getActivityByName(nome: string): Promise<Activity | undefined>;
  joinActivity(activityId: string, userId: string): Promise<void>;
  
  // Inventory methods (now with activity context)
  getInventoryByActivity(activityId: string): Promise<Inventario[]>;
  getInventoryItem(id: string, activityId: string): Promise<Inventario | undefined>;
  createInventoryItem(item: InsertInventario & { userId: string; activityId: string }): Promise<Inventario>;
  updateInventoryItem(id: string, activityId: string, updates: Partial<InsertInventario>): Promise<Inventario | undefined>;
  deleteInventoryItem(id: string, activityId: string): Promise<boolean>;
  updateInventoryQuantity(id: string, newQuantity: number): Promise<void>;
  
  // Sales methods (now with activity context)
  getSalesByActivity(activityId: string): Promise<Vendita[]>;
  createSale(sale: InsertVendita & { userId: string; activityId: string }): Promise<Vendita>;
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
  getRecentActivitiesByActivity(activityId: string): Promise<Array<{
    id: string;
    type: 'sale' | 'expense' | 'inventory';
    description: string;
    amount?: number;
    data: string;
  }>>;
  getTopSellingItemsByActivity(activityId: string): Promise<Array<{
    nomeArticolo: string;
    taglia: string;
    totalQuantity: number;
    totalRevenue: number;
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

  async updateUser(id: string, updates: Partial<UpdateProfile & { password?: string }>): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return updatedUser || undefined;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db
      .delete(users)
      .where(eq(users.id, id));
    return (result.rowCount ?? 0) > 0;
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
    const [updatedItem] = await db
      .update(inventario)
      .set(updates)
      .where(and(eq(inventario.id, id), eq(inventario.activityId, activityId)))
      .returning();
    return updatedItem || undefined;
  }

  async deleteInventoryItem(id: string, activityId: string): Promise<boolean> {
    const result = await db
      .delete(inventario)
      .where(and(eq(inventario.id, id), eq(inventario.activityId, activityId)));
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

  async deleteSale(id: string, activityId: string): Promise<boolean> {
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

  async getRecentActivitiesByActivity(activityId: string): Promise<Array<{
    id: string;
    type: 'sale' | 'expense' | 'inventory';
    description: string;
    amount?: number;
    data: string;
  }>> {
    // Get recent sales
    const recentSales = await db
      .select({
        id: vendite.id,
        description: sql<string>`'Vendita: ' || ${vendite.nomeArticolo} || ' - ' || ${vendite.taglia}`,
        amount: vendite.prezzoVendita,
        data: vendite.data,
        type: sql<string>`'sale'`
      })
      .from(vendite)
      .where(eq(vendite.activityId, activityId))
      .orderBy(desc(vendite.data))
      .limit(5);

    // Get recent expenses
    const recentExpenses = await db
      .select({
        id: spese.id,
        description: sql<string>`'Spesa: ' || ${spese.voce}`,
        amount: spese.importo,
        data: spese.data,
        type: sql<string>`'expense'`
      })
      .from(spese)
      .where(eq(spese.activityId, activityId))
      .orderBy(desc(spese.data))
      .limit(5);

    // Get recent inventory additions
    const recentInventory = await db
      .select({
        id: inventario.id,
        description: sql<string>`'Inventario: ' || ${inventario.nomeArticolo} || ' - ' || ${inventario.taglia}`,
        amount: sql<number>`${inventario.costo} * ${inventario.quantita}`,
        data: inventario.createdAt,
        type: sql<string>`'inventory'`
      })
      .from(inventario)
      .where(eq(inventario.activityId, activityId))
      .orderBy(desc(inventario.createdAt))
      .limit(5);

    // Combine and sort all activities
    const allActivities = [
      ...recentSales.map(item => ({
        id: item.id,
        type: item.type as 'sale' | 'expense' | 'inventory',
        description: item.description,
        amount: Number(item.amount),
        data: item.data.toISOString()
      })),
      ...recentExpenses.map(item => ({
        id: item.id,
        type: item.type as 'sale' | 'expense' | 'inventory',
        description: item.description,
        amount: Number(item.amount),
        data: item.data.toISOString()
      })),
      ...recentInventory.map(item => ({
        id: item.id,
        type: item.type as 'sale' | 'expense' | 'inventory',
        description: item.description,
        amount: Number(item.amount),
        data: item.data?.toISOString() || new Date().toISOString()
      }))
    ];

    // Sort by date and return top 10
    return allActivities
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
      .slice(0, 10);
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
