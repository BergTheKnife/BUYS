import { 
  users, 
  attivita,
  inventario, 
  vendite, 
  spese, 
  type User, 
  type InsertUser,
  type Attivita,
  type InsertAttivita,
  type JoinAttivita,
  type Inventario,
  type InsertInventario,
  type Vendita,
  type InsertVendita,
  type Spesa,
  type InsertSpesa,
  type UpdateProfile
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sum, sql, gte, or, like, ilike } from "drizzle-orm";
import bcrypt from "bcrypt";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByEmailOrUsername(emailOrUsername: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<UpdateProfile & { password?: string; username?: string; ultimaAttivitaId?: string }>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  
  // Attivita methods
  getAttivitaById(id: string): Promise<Attivita | undefined>;
  getAttivitaByName(nome: string): Promise<Attivita | undefined>;
  getUserAttivita(userId: string): Promise<Attivita[]>;
  createAttivita(attivita: InsertAttivita & { proprietarioId: string }): Promise<Attivita>;
  addMemberToAttivita(attivitaId: string, userId: string): Promise<boolean>;
  getAttivitaMembers(attivitaId: string): Promise<User[]>;
  
  // Inventory methods
  getInventoryByAttivita(attivitaId: string): Promise<Inventario[]>;
  getInventoryItem(id: string, attivitaId: string): Promise<Inventario | undefined>;
  createInventoryItem(item: InsertInventario & { userId: string; attivitaId: string }): Promise<Inventario>;
  updateInventoryItem(id: string, attivitaId: string, updates: Partial<InsertInventario>): Promise<Inventario | undefined>;
  deleteInventoryItem(id: string, attivitaId: string): Promise<boolean>;
  updateInventoryQuantity(id: string, newQuantity: number): Promise<void>;
  
  // Sales methods
  getSalesByAttivita(attivitaId: string): Promise<Vendita[]>;
  getSalesByAttivitaWithFilters(attivitaId: string, filters: { search?: string; startDate?: string; endDate?: string }): Promise<Vendita[]>;
  createSale(sale: InsertVendita & { userId: string; attivitaId: string; nomeArticolo: string; taglia: string; margine: number }): Promise<Vendita>;
  getTopSellingItems(attivitaId: string): Promise<Array<{ nomeArticolo: string; taglia: string; totalQuantity: number; totalRevenue: number }>>;
  
  // Expenses methods
  getExpensesByAttivita(attivitaId: string): Promise<Spesa[]>;
  getExpensesByAttivitaWithFilters(attivitaId: string, filters: { search?: string; categoria?: string; startDate?: string; endDate?: string }): Promise<Spesa[]>;
  createExpense(expense: InsertSpesa & { userId: string; attivitaId: string }): Promise<Spesa>;
  updateExpense(id: string, attivitaId: string, updates: Partial<InsertSpesa>): Promise<Spesa | undefined>;
  deleteExpense(id: string, attivitaId: string): Promise<boolean>;
  
  // Statistics methods
  getAttivitaStats(attivitaId: string): Promise<{
    inventoryCount: number;
    totalSales: number;
    totalExpenses: number;
    netMargin: number;
  }>;
  getRecentActivities(attivitaId: string): Promise<Array<{
    id: string;
    type: 'sale' | 'expense' | 'inventory';
    description: string;
    amount?: number;
    data: string;
  }>>;
  getChartData(attivitaId: string): Promise<{
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

  async updateUser(id: string, updates: Partial<UpdateProfile & { password?: string; username?: string; ultimaAttivitaId?: string }>): Promise<User | undefined> {
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

  // Attivita methods
  async getAttivitaById(id: string): Promise<Attivita | undefined> {
    const [attivitaRecord] = await db.select().from(attivita).where(eq(attivita.id, id));
    return attivitaRecord || undefined;
  }

  async getAttivitaByName(nome: string): Promise<Attivita | undefined> {
    const [attivitaRecord] = await db.select().from(attivita).where(eq(attivita.nome, nome));
    return attivitaRecord || undefined;
  }

  async getUserAttivita(userId: string): Promise<Attivita[]> {
    const result = await db.select().from(attivita).where(
      or(
        eq(attivita.proprietarioId, userId),
        sql`${userId} = ANY(${attivita.membri})`
      )
    );
    return result;
  }

  async createAttivita(data: InsertAttivita & { proprietarioId: string }): Promise<Attivita> {
    const hashedPassword = await bcrypt.hash(data.passwordHash, 10);
    const [newAttivita] = await db
      .insert(attivita)
      .values({
        ...data,
        passwordHash: hashedPassword,
        membri: [data.proprietarioId],
      })
      .returning();
    return newAttivita;
  }

  async addMemberToAttivita(attivitaId: string, userId: string): Promise<boolean> {
    const [attivitaRecord] = await db.select().from(attivita).where(eq(attivita.id, attivitaId));
    if (!attivitaRecord) return false;
    
    const currentMembers = attivitaRecord.membri || [];
    if (currentMembers.includes(userId)) return true;
    
    const newMembers = [...currentMembers, userId];
    await db
      .update(attivita)
      .set({ membri: newMembers })
      .where(eq(attivita.id, attivitaId));
    
    return true;
  }

  async getAttivitaMembers(attivitaId: string): Promise<User[]> {
    const [attivitaRecord] = await db.select().from(attivita).where(eq(attivita.id, attivitaId));
    if (!attivitaRecord || !attivitaRecord.membri) return [];
    
    const members = await db.select().from(users).where(
      sql`${users.id} = ANY(${attivitaRecord.membri})`
    );
    return members;
  }

  // Updated Inventory methods
  async getInventoryByAttivita(attivitaId: string): Promise<Inventario[]> {
    return await db.select().from(inventario).where(eq(inventario.attivitaId, attivitaId)).orderBy(desc(inventario.createdAt));
  }

  async getInventoryItem(id: string, attivitaId: string): Promise<Inventario | undefined> {
    const [item] = await db.select().from(inventario).where(
      and(eq(inventario.id, id), eq(inventario.attivitaId, attivitaId))
    );
    return item || undefined;
  }

  async createInventoryItem(item: InsertInventario & { userId: string; attivitaId: string }): Promise<Inventario> {
    const [newItem] = await db
      .insert(inventario)
      .values(item)
      .returning();
    return newItem;
  }

  async updateInventoryItem(id: string, attivitaId: string, updates: Partial<InsertInventario>): Promise<Inventario | undefined> {
    const [updatedItem] = await db
      .update(inventario)
      .set(updates)
      .where(and(eq(inventario.id, id), eq(inventario.attivitaId, attivitaId)))
      .returning();
    return updatedItem || undefined;
  }

  async deleteInventoryItem(id: string, attivitaId: string): Promise<boolean> {
    const result = await db
      .delete(inventario)
      .where(and(eq(inventario.id, id), eq(inventario.attivitaId, attivitaId)));
    return (result.rowCount ?? 0) > 0;
  }

  async updateInventoryQuantity(id: string, newQuantity: number): Promise<void> {
    await db
      .update(inventario)
      .set({ quantita: newQuantity })
      .where(eq(inventario.id, id));
  }

  // Sales methods
  async getSalesByAttivita(attivitaId: string): Promise<Vendita[]> {
    return await db.select().from(vendite).where(eq(vendite.attivitaId, attivitaId)).orderBy(desc(vendite.data));
  }

  async getSalesByAttivitaWithFilters(attivitaId: string, filters: { search?: string; startDate?: string; endDate?: string }): Promise<Vendita[]> {
    let query = db.select().from(vendite).where(eq(vendite.attivitaId, attivitaId));
    
    if (filters.search) {
      query = query.where(
        or(
          ilike(vendite.nomeArticolo, `%${filters.search}%`),
          ilike(vendite.taglia, `%${filters.search}%`),
          ilike(vendite.incassatoDa, `%${filters.search}%`)
        )
      );
    }
    
    if (filters.startDate) {
      query = query.where(gte(vendite.data, new Date(filters.startDate)));
    }
    
    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999);
      query = query.where(sql`${vendite.data} <= ${endDate}`);
    }
    
    return await query.orderBy(desc(vendite.data));
  }

  async createSale(saleData: InsertVendita & { userId: string; attivitaId: string; nomeArticolo: string; taglia: string; margine: number }): Promise<Vendita> {
    const [newSale] = await db
      .insert(vendite)
      .values(saleData)
      .returning();
    return newSale;
  }

  async getTopSellingItems(attivitaId: string): Promise<Array<{ nomeArticolo: string; taglia: string; totalQuantity: number; totalRevenue: number }>> {
    const result = await db
      .select({
        nomeArticolo: vendite.nomeArticolo,
        taglia: vendite.taglia,
        totalQuantity: sql<number>`sum(${vendite.quantita})`,
        totalRevenue: sql<number>`sum(${vendite.prezzoVendita})`
      })
      .from(vendite)
      .where(eq(vendite.attivitaId, attivitaId))
      .groupBy(vendite.nomeArticolo, vendite.taglia)
      .orderBy(sql<number>`sum(${vendite.quantita}) DESC`)
      .limit(10);
    
    return result.map(item => ({
      nomeArticolo: item.nomeArticolo,
      taglia: item.taglia,
      totalQuantity: Number(item.totalQuantity),
      totalRevenue: Number(item.totalRevenue)
    }));
  }

  // Expenses methods
  async getExpensesByAttivita(attivitaId: string): Promise<Spesa[]> {
    return await db.select().from(spese).where(eq(spese.attivitaId, attivitaId)).orderBy(desc(spese.data));
  }

  async getExpensesByAttivitaWithFilters(attivitaId: string, filters: { search?: string; categoria?: string; startDate?: string; endDate?: string }): Promise<Spesa[]> {
    let query = db.select().from(spese).where(eq(spese.attivitaId, attivitaId));
    
    if (filters.search) {
      query = query.where(ilike(spese.voce, `%${filters.search}%`));
    }
    
    if (filters.categoria) {
      query = query.where(eq(spese.categoria, filters.categoria));
    }
    
    if (filters.startDate) {
      query = query.where(gte(spese.data, new Date(filters.startDate)));
    }
    
    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999);
      query = query.where(sql`${spese.data} <= ${endDate}`);
    }
    
    return await query.orderBy(desc(spese.data));
  }

  async createExpense(expense: InsertSpesa & { userId: string; attivitaId: string }): Promise<Spesa> {
    const [newExpense] = await db
      .insert(spese)
      .values(expense)
      .returning();
    return newExpense;
  }

  async updateExpense(id: string, attivitaId: string, updates: Partial<InsertSpesa>): Promise<Spesa | undefined> {
    const [updatedExpense] = await db
      .update(spese)
      .set(updates)
      .where(and(eq(spese.id, id), eq(spese.attivitaId, attivitaId)))
      .returning();
    return updatedExpense || undefined;
  }

  async deleteExpense(id: string, attivitaId: string): Promise<boolean> {
    const result = await db
      .delete(spese)
      .where(and(eq(spese.id, id), eq(spese.attivitaId, attivitaId)));
    return (result.rowCount ?? 0) > 0;
  }

  // Statistics methods
  async getAttivitaStats(attivitaId: string): Promise<{
    inventoryCount: number;
    totalSales: number;
    totalExpenses: number;
    netMargin: number;
  }> {
    const [inventoryCountResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(inventario)
      .where(eq(inventario.attivitaId, attivitaId));

    const [salesSumResult] = await db
      .select({ total: sql<number>`coalesce(sum(${vendite.prezzoVendita}), 0)` })
      .from(vendite)
      .where(eq(vendite.attivitaId, attivitaId));

    const [expensesSumResult] = await db
      .select({ total: sql<number>`coalesce(sum(${spese.importo}), 0)` })
      .from(spese)
      .where(eq(spese.attivitaId, attivitaId));

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

  async getRecentActivities(attivitaId: string): Promise<Array<{
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
      .where(eq(vendite.attivitaId, attivitaId))
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
      .where(eq(spese.attivitaId, attivitaId))
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
      .where(eq(inventario.attivitaId, attivitaId))
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

  async getChartData(attivitaId: string): Promise<{
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
        eq(vendite.attivitaId, attivitaId),
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
        eq(spese.attivitaId, attivitaId),
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
      months
    };
  }
}

export const storage = new DatabaseStorage();
