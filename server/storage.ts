import { db } from "./db";
import { eq, and, or, desc, sql, ne } from "drizzle-orm";
import { InventoryAccountingError } from "./inventoryAccounting";
import {
  users,
  activities,
  activityUsers,
  inventario,
  vendite,
  spese,
  fundTransfers,
  financialHistory,
  spedizioni,
  emailVerificationTokens,
  passwordResetTokens,
  rememberTokens,
  equityWithdrawals,
  type User,
  type Activity,
  type InsertUser,
  type InsertActivity,
  type InsertEmailVerificationToken,
  type InsertPasswordResetToken,
} from "@shared/schema";

class DatabaseStorage {
  private stripUndefined<T extends Record<string, any>>(value: T): Partial<T> {
    return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
  }

  private formatMoney(value: number): string {
    return value.toFixed(2);
  }

  private inferUnitCostFromSale(sale: typeof vendite.$inferSelect): number {
    const qty = Math.max(1, Number(sale.quantita || 1));
    const revenue = Number(sale.prezzoVendita || 0) * qty;
    const margin = Number(sale.margine || 0);
    const totalCost = revenue - margin;
    return totalCost / qty;
  }

  private async restoreSaleQuantityToInventory(sale: typeof vendite.$inferSelect) {
    const [item] = await db.select().from(inventario).where(eq(inventario.id, sale.inventarioId));
    if (!item) return;

    await db
      .update(inventario)
      .set({ quantita: item.quantita + sale.quantita })
      .where(eq(inventario.id, sale.inventarioId));

    const { inventoryBatches } = await import('../migrations/schema');
    const unitCost = this.inferUnitCostFromSale(sale);

    await db.insert(inventoryBatches).values({
      inventarioId: sale.inventarioId,
      activityId: sale.activityId,
      userId: sale.userId,
      costo: this.formatMoney(unitCost),
      quantitaIniziale: sale.quantita,
      quantitaRimanente: sale.quantita,
      dataAcquisto: sale.data instanceof Date ? sale.data.toISOString() : new Date(sale.data || new Date()).toISOString(),
    });
  }

  private async createShippingForSale(sale: typeof vendite.$inferSelect) {
    const [existing] = await db.select().from(spedizioni).where(eq(spedizioni.venditaId, sale.id));
    const values = {
      userId: sale.userId,
      activityId: sale.activityId,
      venditaId: sale.id,
      nomeArticolo: sale.nomeArticolo,
      taglia: sale.taglia,
      quantita: sale.quantita,
      vendutoA: sale.vendutoA,
    };

    if (existing) {
      const [updated] = await db
        .update(spedizioni)
        .set(values)
        .where(eq(spedizioni.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db.insert(spedizioni).values(values).returning();
    return created;
  }

  async getUser(id: string) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user ?? null;
  }

  async getUserByEmail(email: string) {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user ?? null;
  }

  async getUserByUsername(username: string) {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user ?? null;
  }

  async getUserByEmailOrUsername(emailOrUsername: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(or(eq(users.email, emailOrUsername), eq(users.username, emailOrUsername)));
    return user ?? null;
  }

  async createUser(data: InsertUser | Partial<User>) {
    const [user] = await db.insert(users).values(data as any).returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<User>) {
    const payload = this.stripUndefined(updates);
    if (Object.keys(payload).length === 0) {
      return this.getUser(id);
    }

    const [user] = await db.update(users).set(payload as any).where(eq(users.id, id)).returning();
    return user ?? null;
  }

  async deleteUser(id: string) {
    const [deleted] = await db.delete(users).where(eq(users.id, id)).returning();
    return !!deleted;
  }

  async getAllUsers() {
    const result = await db.execute(sql`
      SELECT
        u.*,
        COALESCE((
          SELECT COUNT(DISTINCT au.activity_id)::int
          FROM ${activityUsers} au
          WHERE au.user_id = u.id
        ), 0) AS "activitiesCount",
        COALESCE((
          SELECT COUNT(*)::int
          FROM ${vendite} v
          WHERE v.user_id = u.id
        ), 0) AS "salesCount",
        COALESCE((
          SELECT COUNT(*)::int
          FROM ${inventario} i
          WHERE i.user_id = u.id AND COALESCE(i.archiviato, 0) = 0
        ), 0) AS "inventoryCount"
      FROM ${users} u
      ORDER BY u.created_at DESC
    `);

    return result.rows as any[];
  }

  async updateUserProfile(userId: string, profile: { nome?: string; cognome?: string; email?: string }) {
    return this.updateUser(userId, profile as any);
  }

  async updateUserProfileImage(userId: string, profileImageUrl: string) {
    return this.updateUser(userId, { profileImageUrl } as any);
  }

  async updateLastActivity(userId: string, activityId: string | null) {
    return this.updateUser(userId, { lastActivityId: activityId } as any);
  }

  async verifyUserEmail(userId: string) {
    const [user] = await db
      .update(users)
      .set({ emailVerified: new Date(), isActive: 1 })
      .where(eq(users.id, userId))
      .returning();
    return user ?? null;
  }

  async createActivity(data: InsertActivity | (Partial<Activity> & { proprietarioId: string })) {
    const [activity] = await db.insert(activities).values(data as any).returning();
    await db.insert(activityUsers).values({ activityId: activity.id, userId: activity.proprietarioId });
    await this.updateLastActivity(activity.proprietarioId, activity.id);
    return activity;
  }

  async getActivityById(id: string) {
    const [activity] = await db.select().from(activities).where(eq(activities.id, id));
    return activity ?? null;
  }

  async getActivityByName(nome: string) {
    const [activity] = await db.select().from(activities).where(eq(activities.nome, nome));
    return activity ?? null;
  }

  async getAllActivities() {
    const result = await db.execute(sql`
      SELECT
        a.*,
        u.nome AS "proprietarioNome",
        u.email AS "proprietarioEmail",
        COALESCE((
          SELECT COUNT(*)::int FROM ${activityUsers} au WHERE au.activity_id = a.id
        ), 0) AS "membersCount",
        COALESCE((
          SELECT COUNT(*)::int FROM ${inventario} i WHERE i.activity_id = a.id AND COALESCE(i.archiviato, 0) = 0
        ), 0) AS "inventoryCount",
        COALESCE((
          SELECT COUNT(*)::int FROM ${vendite} v WHERE v.activity_id = a.id
        ), 0) AS "salesCount",
        COALESCE((
          SELECT COUNT(*)::int FROM ${spese} s WHERE s.activity_id = a.id
        ), 0) AS "expensesCount",
        (
          COALESCE((SELECT COUNT(*)::int FROM ${inventario} i WHERE i.activity_id = a.id), 0) +
          COALESCE((SELECT COUNT(*)::int FROM ${vendite} v WHERE v.activity_id = a.id), 0) +
          COALESCE((SELECT COUNT(*)::int FROM ${spese} s WHERE s.activity_id = a.id), 0)
        ) > 0 AS "hasData"
      FROM ${activities} a
      INNER JOIN ${users} u ON u.id = a.proprietario_id
      ORDER BY a.created_at DESC
    `);

    return result.rows as any[];
  }

  async getActivitiesByUserId(userId: string) {
    return await db
      .select({
        id: activities.id,
        nome: activities.nome,
        passwordHash: activities.passwordHash,
        proprietarioId: activities.proprietarioId,
        createdAt: activities.createdAt,
        updatedAt: activities.updatedAt,
      })
      .from(activityUsers)
      .innerJoin(activities, eq(activityUsers.activityId, activities.id))
      .where(eq(activityUsers.userId, userId))
      .orderBy(desc(activities.createdAt));
  }

  async getUserActivities(userId: string) {
    return this.getActivitiesByUserId(userId);
  }

  async joinActivity(activityId: string, userId: string) {
    const [existing] = await db
      .select()
      .from(activityUsers)
      .where(and(eq(activityUsers.activityId, activityId), eq(activityUsers.userId, userId)));

    if (!existing) {
      await db.insert(activityUsers).values({ activityId, userId });
    }

    await this.updateLastActivity(userId, activityId);
    return true;
  }

  async leaveActivity(activityId: string, userId: string) {
    await db.delete(activityUsers).where(and(eq(activityUsers.activityId, activityId), eq(activityUsers.userId, userId)));
    const user = await this.getUser(userId);
    if (user?.lastActivityId === activityId) {
      await this.updateLastActivity(userId, null);
    }
    return true;
  }

  async addUserToActivity(userId: string, activityId: string) {
    const [existing] = await db
      .select()
      .from(activityUsers)
      .where(and(eq(activityUsers.activityId, activityId), eq(activityUsers.userId, userId)));

    if (!existing) {
      const [membership] = await db.insert(activityUsers).values({ activityId, userId }).returning();
      return membership;
    }

    return existing;
  }

  async removeUserFromActivity(userId: string, activityId: string) {
    await db.delete(activityUsers).where(and(eq(activityUsers.activityId, activityId), eq(activityUsers.userId, userId)));
    const user = await this.getUser(userId);
    if (user?.lastActivityId === activityId) {
      await this.updateLastActivity(userId, null);
    }
    return true;
  }

  async getActivityMembers(activityId: string) {
    return await db
      .select({
        id: users.id,
        userId: users.id,
        nome: users.nome,
        cognome: users.cognome,
        email: users.email,
        username: users.username,
        joinedAt: activityUsers.joinedAt,
        displayName: sql<string>`${users.nome} || ' ' || ${users.cognome}`,
        isOwner: sql<boolean>`${users.id} = ${activities.proprietarioId}`,
      })
      .from(activityUsers)
      .innerJoin(users, eq(activityUsers.userId, users.id))
      .innerJoin(activities, eq(activityUsers.activityId, activities.id))
      .where(eq(activityUsers.activityId, activityId))
      .orderBy(users.nome, users.cognome);
  }

  async createEmailVerificationToken(data: Omit<InsertEmailVerificationToken, 'id' | 'createdAt'>) {
    const [token] = await db.insert(emailVerificationTokens).values(data as any).returning();
    return token;
  }

  async getEmailVerificationToken(token: string) {
    const [row] = await db.select().from(emailVerificationTokens).where(eq(emailVerificationTokens.token, token));
    return row ?? null;
  }

  async deleteEmailVerificationToken(token: string) {
    const [deleted] = await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.token, token)).returning();
    return !!deleted;
  }

  async deleteEmailVerificationTokensByUserId(userId: string) {
    await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, userId));
    return true;
  }

  async createPasswordResetToken(data: Omit<InsertPasswordResetToken, 'id' | 'createdAt'>) {
    const [token] = await db.insert(passwordResetTokens).values(data as any).returning();
    return token;
  }

  async getPasswordResetToken(token: string) {
    const [row] = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.token, token));
    return row ?? null;
  }

  async deletePasswordResetToken(token: string) {
    const [deleted] = await db.delete(passwordResetTokens).where(eq(passwordResetTokens.token, token)).returning();
    return !!deleted;
  }

  async deletePasswordResetTokensByUserId(userId: string) {
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
    return true;
  }

  async deleteExpiredPasswordResetTokens() {
    await db.delete(passwordResetTokens).where(sql`${passwordResetTokens.expiresAt} < NOW()`);
    return true;
  }

  async createRememberToken(userId: string, token: string, expiresAt: Date) {
    const [remember] = await db.insert(rememberTokens).values({ userId, token, expiresAt }).returning();
    return remember;
  }

  async getRememberToken(token: string) {
    const [remember] = await db.select().from(rememberTokens).where(eq(rememberTokens.token, token));
    return remember ?? null;
  }

  async deleteRememberToken(token: string) {
    const [deleted] = await db.delete(rememberTokens).where(eq(rememberTokens.token, token)).returning();
    return !!deleted;
  }

  async cleanupExpiredRememberTokens() {
    await db.delete(rememberTokens).where(sql`${rememberTokens.expiresAt} < NOW()`);
    return true;
  }

  async deleteExpiredTokens() {
    await db.delete(emailVerificationTokens).where(sql`${emailVerificationTokens.expiresAt} < NOW()`);
    await this.deleteExpiredPasswordResetTokens();
    await this.cleanupExpiredRememberTokens();
    return true;
  }

  async getInventoryByActivity(activityId: string) {
    return await db
      .select()
      .from(inventario)
      .where(and(eq(inventario.activityId, activityId), eq(inventario.archiviato, 0)))
      .orderBy(desc(inventario.createdAt));
  }

  async getInventoryByActivityHistorical(activityId: string) {
    // Include archived items: exports/reports must preserve full history.
    return await db
      .select()
      .from(inventario)
      .where(eq(inventario.activityId, activityId))
      .orderBy(desc(inventario.createdAt));
  }

  async getInventoryItem(id: string, activityId: string) {
    const [item] = await db
      .select()
      .from(inventario)
      .where(and(eq(inventario.id, id), eq(inventario.activityId, activityId)));
    return item ?? null;
  }

  /**
   * Creates a brand-new inventory item. This is a stock-in movement like any
   * other: it must produce exactly one linked "Inventario" expense equal to
   * quantita * costo, atomically with the item row and its first batch.
   */
  async createInventoryItem(data: {
    userId: string;
    activityId: string;
    nomeArticolo: string;
    taglia?: string | null;
    costo: string | number;
    quantita: number;
    lunghezza?: string | null;
    larghezza?: string | null;
    altezza?: string | null;
    immagineUrl?: string | null;
    vetrinaId?: string | null;
    idempotencyKey?: string | null;
  }) {
    const { recordInventoryStockIn } = await import("./inventoryAccounting");

    return await db.transaction(async (trx) => {
      const [item] = await trx
        .insert(inventario)
        .values({
          userId: data.userId,
          activityId: data.activityId,
          nomeArticolo: data.nomeArticolo,
          taglia: data.taglia ?? null,
          costo: String(data.costo),
          quantita: data.quantita,
          lunghezza: data.lunghezza ?? null,
          larghezza: data.larghezza ?? null,
          altezza: data.altezza ?? null,
          immagineUrl: data.immagineUrl ?? null,
          vetrinaId: data.vetrinaId ?? null,
        })
        .returning();

      const { batch, fromCassa } = await recordInventoryStockIn(trx, {
        inventarioId: item.id,
        activityId: data.activityId,
        userId: data.userId,
        nomeArticolo: data.nomeArticolo,
        taglia: data.taglia,
        quantita: data.quantita,
        costoUnitario: Number(data.costo),
        voce: `Nuovo articolo: ${data.nomeArticolo}${data.taglia ? ` - ${data.taglia}` : ""} (${data.quantita} pz)`,
        idempotencyKey: data.idempotencyKey ?? null,
      });

      if (fromCassa > 0) {
        const [updated] = await trx
          .update(inventario)
          .set({ cassaCoverage: sql`COALESCE(${inventario.cassaCoverage}, 0) + ${fromCassa}` })
          .where(eq(inventario.id, item.id))
          .returning();
        return { ...updated, _batch: batch };
      }

      return { ...item, _batch: batch };
    });
  }

  /**
   * Restocks (or otherwise increases the quantity of) an existing inventory
   * item. Always creates a new, separate batch + linked expense for the
   * incoming quantity at ITS OWN unit cost - never a weighted-average of
   * the item's history. The existing item cost is left unchanged.
   */
  async restockInventoryItem(
    id: string,
    activityId: string,
    userId: string,
    params: { quantita: number; costo?: string | number | null; idempotencyKey?: string | null }
  ) {
    const { recordInventoryStockIn } = await import("./inventoryAccounting");

    return await db.transaction(async (trx) => {
      const [item] = await trx
        .select()
        .from(inventario)
        .where(and(eq(inventario.id, id), eq(inventario.activityId, activityId)));

      if (!item) {
        return null;
      }

      const quantita = Math.round(Number(params.quantita));
      const costoUnitario = params.costo !== undefined && params.costo !== null ? Number(params.costo) : Number(item.costo);

      const { batch, expense, deduplicated, fromCassa } = await recordInventoryStockIn(trx, {
        inventarioId: id,
        activityId,
        userId,
        nomeArticolo: item.nomeArticolo,
        taglia: item.taglia,
        quantita,
        costoUnitario,
        idempotencyKey: params.idempotencyKey ?? null,
      });

      if (deduplicated) {
        const [current] = await trx.select().from(inventario).where(eq(inventario.id, id));
        return { item: current, batch, expense, deduplicated: true };
      }

      const newQuantity = item.quantita + quantita;
      const [updated] = await trx
        .update(inventario)
        .set({
          quantita: newQuantity,
          cassaCoverage: sql`COALESCE(${inventario.cassaCoverage}, 0) + ${fromCassa}`,
        })
        .where(eq(inventario.id, id))
        .returning();

      return { item: updated, batch, expense, deduplicated: false };
    });
  }

  async updateInventoryQuantity(id: string, newQuantity: number) {
    const [updated] = await db
      .update(inventario)
      .set({ quantita: newQuantity })
      .where(eq(inventario.id, id))
      .returning();
    return updated ?? null;
  }

  /**
   * Generic field edits. Quantity/cost changes are routed through the
   * stock-in workflow (quantity increases) or rejected outright (cost-only
   * changes, quantity decreases) so historical purchase expenses can never be
   * silently rewritten - see restockInventoryItem for the correct way to
   * change both quantity and cost together.
   */
  async updateInventoryItem(
    id: string,
    activityId: string,
    updates: Partial<{
      nomeArticolo: string;
      taglia: string | null;
      costo: string;
      quantita: number;
      lunghezza: string | null;
      larghezza: string | null;
      altezza: string | null;
      immagineUrl: string | null;
    }>
  ) {
    const [item] = await db
      .select()
      .from(inventario)
      .where(and(eq(inventario.id, id), eq(inventario.activityId, activityId)));

    if (!item) {
      return null;
    }

    const quantitaChanged = updates.quantita !== undefined && updates.quantita !== item.quantita;
    const costoChanged = updates.costo !== undefined && Number(updates.costo) !== Number(item.costo);

    if (quantitaChanged) {
      const delta = updates.quantita! - item.quantita;
      if (delta < 0) {
        throw new InventoryAccountingError(
          "Non è possibile ridurre direttamente la quantità in magazzino: la riduzione deve avvenire tramite una vendita o un'operazione dedicata, per non alterare la storia contabile dei lotti."
        );
      }

      // Quantity increase: treat exactly like a restock (new batch + linked
      // expense at the movement's own unit cost), then apply any other
      // (non quantity/cost) field edits on top.
      const restockResult = await this.restockInventoryItem(id, activityId, item.userId, {
        quantita: delta,
        costo: updates.costo ?? item.costo,
      });
      if (!restockResult) {
        return null;
      }
      const { item: restocked } = restockResult;

      const rest = this.stripUndefined({
        nomeArticolo: updates.nomeArticolo,
        taglia: updates.taglia,
        lunghezza: updates.lunghezza,
        larghezza: updates.larghezza,
        altezza: updates.altezza,
        immagineUrl: updates.immagineUrl,
      });

      if (Object.keys(rest).length === 0) {
        return restocked;
      }

      const [updated] = await db.update(inventario).set(rest).where(eq(inventario.id, id)).returning();
      return updated ?? restocked;
    }

    if (costoChanged) {
      // A cost-only change (no accompanying quantity increase) has no
      // associated movement to attribute an expense to, and silently
      // rewriting `costo` would desynchronize it from every historical
      // batch/expense. Reject it explicitly instead of guessing.
      throw new InventoryAccountingError(
        "Non è possibile modificare solo il costo di un articolo: usa il rifornimento per registrare un nuovo ingresso di magazzino con il relativo costo."
      );
    }

    const rest = this.stripUndefined({
      nomeArticolo: updates.nomeArticolo,
      taglia: updates.taglia,
      lunghezza: updates.lunghezza,
      larghezza: updates.larghezza,
      altezza: updates.altezza,
      immagineUrl: updates.immagineUrl,
    });

    if (Object.keys(rest).length === 0) {
      return item;
    }

    const [updated] = await db.update(inventario).set(rest).where(eq(inventario.id, id)).returning();
    return updated ?? null;
  }

  /** Soft-delete: preserves all accounting/history, just hides the item from active views. */
  async archiveInventoryItem(id: string, activityId: string) {
    const [archived] = await db
      .update(inventario)
      .set({ archiviato: 1 })
      .where(and(eq(inventario.id, id), eq(inventario.activityId, activityId), eq(inventario.archiviato, 0)))
      .returning();
    return archived ?? null;
  }

  /** Kept for API/route compatibility: the legacy delete route behaves like an archive. */
  async deleteInventoryItem(id: string, activityId: string) {
    return await this.archiveInventoryItem(id, activityId);
  }

  /**
   * Full rollback of an item that was never sold: removes its batches and
   * their linked generated expenses, then the item itself. Blocked whenever
   * dependent sales exist, so historical accounting is never destroyed once
   * it has been relied upon elsewhere (mirrors production.deleteMaterialIfUnused).
   */
  async permanentlyDeleteInventoryItem(
    id: string,
    activityId: string
  ): Promise<{ success: boolean; error?: string }> {
    const { inventoryBatches } = await import("../migrations/schema");

    const [item] = await db
      .select()
      .from(inventario)
      .where(and(eq(inventario.id, id), eq(inventario.activityId, activityId)));

    if (!item) {
      return { success: false, error: "Articolo non trovato" };
    }

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(vendite)
      .where(eq(vendite.inventarioId, id));

    if (Number(count) > 0) {
      return {
        success: false,
        error:
          "Impossibile eliminare definitivamente l'articolo: esistono vendite collegate. Archivia l'articolo per preservare lo storico.",
      };
    }

    await db.transaction(async (trx) => {
      const batches = await trx.select().from(inventoryBatches).where(eq(inventoryBatches.inventarioId, id));

      for (const batch of batches) {
        const quota = Number(batch.quotaCassa || 0);
        if (quota > 0) {
          await this.updateCassaReinvestimento(
            activityId,
            quota,
            "Rollback eliminazione articolo inventario (mai venduto)",
            item.userId,
            trx
          );
        }
        if (batch.spesaId) {
          await trx.delete(spese).where(eq(spese.id, batch.spesaId as any));
        }
      }

      await trx.delete(inventoryBatches).where(eq(inventoryBatches.inventarioId, id));
      await trx.delete(inventario).where(eq(inventario.id, id));
    });

    return { success: true };
  }

  async checkInventoryIntegrity(activityId: string) {
    const { inventoryBatches } = await import("../migrations/schema");

    const items = await db.select().from(inventario).where(eq(inventario.activityId, activityId));
    const issues: Array<{ inventarioId: string; nomeArticolo: string; issue: string }> = [];

    for (const item of items) {
      const batches = await db
        .select()
        .from(inventoryBatches)
        .where(eq(inventoryBatches.inventarioId, item.id));

      const totalFromBatches = batches.reduce((sum, b) => sum + Number(b.quantitaRimanente || 0), 0);
      if (totalFromBatches !== item.quantita) {
        issues.push({
          inventarioId: item.id,
          nomeArticolo: item.nomeArticolo,
          issue: `Quantità disallineata: inventario=${item.quantita}, somma lotti=${totalFromBatches}`,
        });
      }

      const batchesMissingExpense = batches.filter((b) => !b.spesaId);
      if (batchesMissingExpense.length > 0) {
        issues.push({
          inventarioId: item.id,
          nomeArticolo: item.nomeArticolo,
          issue: `${batchesMissingExpense.length} lotto/i senza spesa collegata`,
        });
      }
    }

    return { isValid: issues.length === 0, issues };
  }

  /**
   * Manual expense creation (e.g. "acquisto buste per spedizione"). Separate
   * from the inventory stock-in workflow: no itemId/nonEliminabile flag is
   * set here, so generated inventory expenses can never be confused with
   * manually-entered ones.
   */
  async createExpense(data: {
    userId: string;
    activityId: string;
    voce: string;
    importo: string;
    categoria: string;
    data: Date;
  }) {
    const [expense] = await db
      .insert(spese)
      .values({
        userId: data.userId,
        activityId: data.activityId,
        voce: data.voce,
        importo: data.importo,
        categoria: data.categoria,
        data: data.data,
      })
      .returning();
    return expense;
  }

  /**
   * Manual expenses can be freely edited. Auto-generated inventory expenses
   * (nonEliminabile=1) are protected from amount/category/link edits so an
   * inventory update can never silently desynchronize the ledger; only their
   * description can be touched. Use the inventory edit/restock flow instead.
   */
  async updateExpense(
    id: string,
    activityId: string,
    updates: Partial<{ voce: string; importo: string; categoria: string; data: Date; itemId: string | null; nonEliminabile: number | null }>
  ) {
    const [expense] = await db
      .select()
      .from(spese)
      .where(and(eq(spese.id, id), eq(spese.activityId, activityId)));

    if (!expense) {
      return null;
    }

    const isGenerated = expense.nonEliminabile === 1;
    if (isGenerated) {
      const touchesProtectedField =
        updates.importo !== undefined || updates.categoria !== undefined || updates.itemId !== undefined || updates.nonEliminabile !== undefined;
      if (touchesProtectedField) {
        throw new InventoryAccountingError(
          "Questa spesa è stata generata automaticamente da un movimento di magazzino: importo/categoria non sono modificabili direttamente. Usa il rifornimento/modifica dell'articolo."
        );
      }
    }

    const allowed = isGenerated
      ? this.stripUndefined({ voce: updates.voce, data: updates.data })
      : this.stripUndefined(updates);

    if (Object.keys(allowed).length === 0) {
      return expense;
    }

    const [updated] = await db.update(spese).set(allowed).where(eq(spese.id, id)).returning();
    return updated ?? null;
  }

  /**
   * Manual expenses can be deleted normally. Auto-generated inventory
   * expenses (nonEliminabile=1) are protected: deleting them without also
   * reversing the underlying stock-in would silently break the ledger, so
   * they must be removed only via permanentlyDeleteInventoryItem (which
   * removes the batch and its linked expense together).
   */
  async deleteExpense(id: string, activityId: string) {
    const [expense] = await db
      .select()
      .from(spese)
      .where(and(eq(spese.id, id), eq(spese.activityId, activityId)));

    if (!expense) {
      return null;
    }

    if (expense.nonEliminabile === 1) {
      throw new InventoryAccountingError(
        "Questa spesa è stata generata automaticamente da un movimento di magazzino e non può essere eliminata direttamente. Elimina definitivamente l'articolo collegato per rimuoverla."
      );
    }

    const [deleted] = await db.delete(spese).where(eq(spese.id, id)).returning();
    return !!deleted;
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
        quantitaUsata,
      });

      batchDetails.push({
        batchId: batch.id,
        costoUnitario,
        quantitaUsata,
        marginePartial,
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
      batchDetails,
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

  async createSale(data: typeof vendite.$inferInsert) {
    const [inventoryItem] = await db
      .select()
      .from(inventario)
      .where(and(eq(inventario.id, data.inventarioId), eq(inventario.activityId, data.activityId!)));

    if (!inventoryItem) {
      throw new Error("Articolo non trovato nell'inventario");
    }

    const quantitaVenduta = Number(data.quantita ?? 1);
    const prezzoVendita = Number(data.prezzoVendita);

    if (inventoryItem.quantita < quantitaVenduta) {
      throw new Error("Quantità insufficiente in magazzino");
    }

    const fifoResult = await this.calculateFIFOMargin(data.inventarioId, quantitaVenduta, prezzoVendita);
    const { inventoryBatches } = await import('../migrations/schema');

    const sale = await db.transaction(async (trx) => {
      const [createdSale] = await trx.insert(vendite).values({
        ...data,
        margine: this.formatMoney(fifoResult.margine),
        nomeArticolo: data.nomeArticolo || inventoryItem.nomeArticolo,
        taglia: data.taglia ?? inventoryItem.taglia,
      } as any).returning();

      await trx
        .update(inventario)
        .set({ quantita: inventoryItem.quantita - quantitaVenduta })
        .where(eq(inventario.id, inventoryItem.id));

      for (const batchUsage of fifoResult.batchesUsed) {
        const [updatedBatch] = await trx
          .update(inventoryBatches)
          .set({ quantitaRimanente: sql`${inventoryBatches.quantitaRimanente} - ${batchUsage.quantitaUsata}` })
          .where(eq(inventoryBatches.id, batchUsage.id))
          .returning();

        if (updatedBatch && Number(updatedBatch.quantitaRimanente || 0) < 0) {
          await trx.update(inventoryBatches).set({ quantitaRimanente: 0 }).where(eq(inventoryBatches.id, batchUsage.id));
        }
      }

      await trx.insert(spedizioni).values({
        userId: createdSale.userId,
        activityId: createdSale.activityId,
        venditaId: createdSale.id,
        nomeArticolo: createdSale.nomeArticolo,
        taglia: createdSale.taglia,
        quantita: createdSale.quantita,
        vendutoA: createdSale.vendutoA,
      });

      await trx.insert(financialHistory).values({
        userId: createdSale.userId,
        activityId: createdSale.activityId,
        azione: "Vendita",
        descrizione: `Vendita: ${createdSale.nomeArticolo}${createdSale.taglia ? ` - ${createdSale.taglia}` : ""}`,
        importo: String(Number(createdSale.prezzoVendita) * Number(createdSale.quantita || 1)),
        dettagli: JSON.stringify({ saleId: createdSale.id, inventarioId: createdSale.inventarioId, quantita: createdSale.quantita }),
        itemId: createdSale.inventarioId,
        data: createdSale.data,
      });

      return createdSale;
    });

    return sale;
  }

  async updateSale(id: string, activityId: string, updates: Partial<typeof vendite.$inferInsert> & { nomeArticolo?: string; taglia?: string | null }) {
    const existingSale = await this.getSaleById(id, activityId);
    if (!existingSale) {
      return null;
    }

    await this.restoreSaleQuantityToInventory(existingSale);

    const targetInventarioId = updates.inventarioId || existingSale.inventarioId;
    const [targetItem] = await db
      .select()
      .from(inventario)
      .where(and(eq(inventario.id, targetInventarioId), eq(inventario.activityId, activityId)));

    if (!targetItem) {
      throw new Error("Articolo non trovato nell'inventario");
    }

    const quantitaVenduta = Number(updates.quantita ?? existingSale.quantita ?? 1);
    const prezzoVendita = Number(updates.prezzoVendita ?? existingSale.prezzoVendita);

    if (targetItem.quantita < quantitaVenduta) {
      throw new Error("Quantità insufficiente in magazzino");
    }

    const fifoResult = await this.calculateFIFOMargin(targetInventarioId, quantitaVenduta, prezzoVendita);
    await this.updateBatchesAfterSale(fifoResult.batchesUsed);

    await db
      .update(inventario)
      .set({ quantita: targetItem.quantita - quantitaVenduta })
      .where(eq(inventario.id, targetItem.id));

    const payload = this.stripUndefined({
      ...updates,
      inventarioId: targetInventarioId,
      nomeArticolo: updates.nomeArticolo ?? targetItem.nomeArticolo,
      taglia: updates.taglia ?? targetItem.taglia,
      margine: this.formatMoney(fifoResult.margine),
    });

    const [updatedSale] = await db
      .update(vendite)
      .set(payload as any)
      .where(and(eq(vendite.id, id), eq(vendite.activityId, activityId)))
      .returning();

    if (!updatedSale) {
      return null;
    }

    await this.createShippingForSale(updatedSale);

    await db.insert(financialHistory).values({
      userId: updatedSale.userId,
      activityId: updatedSale.activityId,
      azione: "Vendita",
      descrizione: `Vendita aggiornata: ${updatedSale.nomeArticolo}${updatedSale.taglia ? ` - ${updatedSale.taglia}` : ""}`,
      importo: String(Number(updatedSale.prezzoVendita) * Number(updatedSale.quantita || 1)),
      dettagli: JSON.stringify({ saleId: updatedSale.id, inventarioId: updatedSale.inventarioId, updated: true }),
      itemId: updatedSale.inventarioId,
      data: updatedSale.data,
    });

    return updatedSale;
  }

  async deleteSale(id: string, activityId: string) {
    const sale = await this.getSaleById(id, activityId);
    if (!sale) {
      return false;
    }

    await this.restoreSaleQuantityToInventory(sale);
    await db.delete(spedizioni).where(and(eq(spedizioni.venditaId, id), eq(spedizioni.activityId, activityId)));
    const [deleted] = await db.delete(vendite).where(and(eq(vendite.id, id), eq(vendite.activityId, activityId))).returning();

    if (deleted) {
      await db.insert(financialHistory).values({
        userId: deleted.userId,
        activityId: deleted.activityId,
        azione: "Vendita",
        descrizione: `Vendita annullata: ${deleted.nomeArticolo}${deleted.taglia ? ` - ${deleted.taglia}` : ""}`,
        importo: String(Number(deleted.prezzoVendita) * Number(deleted.quantita || 1)),
        dettagli: JSON.stringify({ saleId: deleted.id, deleted: true }),
        itemId: deleted.inventarioId,
        data: new Date(),
      });
    }

    return !!deleted;
  }

  async getSaleById(id: string, activityId: string) {
    const [sale] = await db.select().from(vendite).where(and(eq(vendite.id, id), eq(vendite.activityId, activityId)));
    return sale ?? null;
  }

  async getSalesByActivity(activityId: string) {
    return await db
      .select()
      .from(vendite)
      .where(eq(vendite.activityId, activityId))
      .orderBy(desc(vendite.data), desc(vendite.createdAt));
  }

  async getVenditeConSpedizioni(activityId: string) {
    const rows = await db
      .select({ sale: vendite, spedizione: spedizioni })
      .from(vendite)
      .leftJoin(spedizioni, eq(spedizioni.venditaId, vendite.id))
      .where(eq(vendite.activityId, activityId))
      .orderBy(desc(vendite.data), desc(vendite.createdAt));

    return rows.map((row) => ({ ...row.sale, spedizione: row.spedizione }));
  }

  async getTopSellingItemsByActivity(activityId: string) {
    const result = await db.execute(sql`
      SELECT
        v.nome_articolo AS "nomeArticolo",
        COALESCE(v.taglia, '') AS taglia,
        COALESCE(SUM(v.quantita)::int, 0) AS "totalQuantity",
        COALESCE(SUM(CAST(v.prezzo_vendita AS numeric) * v.quantita), 0) AS "totalRevenue"
      FROM ${vendite} v
      WHERE v.activity_id = ${activityId}
      GROUP BY v.nome_articolo, COALESCE(v.taglia, '')
      ORDER BY "totalQuantity" DESC, "totalRevenue" DESC
      LIMIT 10
    `);

    return (result.rows as any[]).map((row) => ({
      ...row,
      totalQuantity: Number(row.totalQuantity || 0),
      totalRevenue: Number(row.totalRevenue || 0),
    }));
  }

  async updateSpedizioneStatus(venditaId: string, activityId: string, updates: { speditoConsegnato?: number; numeroTracking?: string | null }) {
    const [existing] = await db
      .select()
      .from(spedizioni)
      .where(and(eq(spedizioni.venditaId, venditaId), eq(spedizioni.activityId, activityId)));

    const payload = this.stripUndefined({
      ...updates,
      dataSpedizione: updates.speditoConsegnato === 1 ? new Date() : updates.speditoConsegnato === 0 ? null : undefined,
    });

    if (existing) {
      const [updated] = await db
        .update(spedizioni)
        .set(payload as any)
        .where(eq(spedizioni.id, existing.id))
        .returning();
      return updated ?? null;
    }

    const sale = await this.getSaleById(venditaId, activityId);
    if (!sale) return null;

    const [created] = await db.insert(spedizioni).values({
      userId: sale.userId,
      activityId: sale.activityId,
      venditaId: sale.id,
      nomeArticolo: sale.nomeArticolo,
      taglia: sale.taglia,
      quantita: sale.quantita,
      vendutoA: sale.vendutoA,
      speditoConsegnato: updates.speditoConsegnato ?? 0,
      numeroTracking: updates.numeroTracking ?? null,
      dataSpedizione: updates.speditoConsegnato === 1 ? new Date() : null,
    }).returning();

    return created;
  }

  async getExpensesByActivity(activityId: string) {
    return await db
      .select()
      .from(spese)
      .where(eq(spese.activityId, activityId))
      .orderBy(desc(spese.data), desc(spese.createdAt));
  }

  async createFundTransfers(transfers: Array<typeof fundTransfers.$inferInsert>) {
    return await db.transaction(async (trx) => {
      const created: any[] = [];
      for (const transfer of transfers) {
        const [row] = await trx.insert(fundTransfers).values({
          ...transfer,
          data: transfer.data ?? new Date(),
        } as any).returning();
        created.push(row);

        await trx.insert(financialHistory).values({
          userId: row.userId,
          activityId: row.activityId,
          azione: "Riunisci fondi",
          descrizione: row.descrizione || `Trasferimento da ${row.fromMember} (${row.fromAccount}) verso ${row.toAccount}`,
          importo: row.importo,
          dettagli: JSON.stringify({
            transferId: row.id,
            fromMember: row.fromMember,
            fromAccount: row.fromAccount,
            toAccount: row.toAccount,
            descrizione: row.descrizione,
          }),
          data: row.data,
        });
      }
      return created;
    });
  }

  async getFundTransfersByActivity(activityId: string) {
    return await db
      .select()
      .from(fundTransfers)
      .where(eq(fundTransfers.activityId, activityId))
      .orderBy(desc(fundTransfers.data));
  }

  async createEquityWithdrawal(
    activityId: string,
    userId: string,
    data: { importo: string | number; tipo: 'RIMBORSO' | 'DIVIDENDO' | 'ALTRO'; memberId?: string | null; descrizione?: string | null; data?: string | Date }
  ) {
    const operationDate = data.data ? new Date(data.data).toISOString() : new Date().toISOString();

    return await db.transaction(async (trx) => {
      const [withdrawal] = await trx.insert(equityWithdrawals).values({
        activityId,
        userId,
        memberId: data.memberId ?? null,
        importo: String(data.importo),
        tipo: data.tipo,
        descrizione: data.descrizione ?? null,
        dataOperazione: operationDate,
      }).returning();

      await trx.insert(financialHistory).values({
        userId,
        activityId,
        azione: "PRELIEVO_CASSA",
        descrizione: `Prelievo Equity${data.descrizione ? `: ${data.descrizione}` : ''}`,
        importo: String(data.importo),
        dettagli: JSON.stringify({
          scope: 'EQUITY',
          withdrawalId: withdrawal.id,
          tipo: withdrawal.tipo,
          memberId: withdrawal.memberId,
          descrizione: withdrawal.descrizione,
        }),
        data: new Date(operationDate),
      });

      return { success: true, withdrawal };
    });
  }

  async getEquityWithdrawals(
    activityId: string,
    filters?: { from?: string; to?: string; tipo?: string; memberId?: string }
  ) {
    const conditions = [eq(equityWithdrawals.activityId, activityId)];

    if (filters?.tipo && filters.tipo !== 'ALL') {
      conditions.push(eq(equityWithdrawals.tipo, filters.tipo as any));
    }
    if (filters?.memberId && filters.memberId !== 'ALL') {
      conditions.push(eq(equityWithdrawals.memberId, filters.memberId));
    }
    if (filters?.from) {
      conditions.push(sql`${equityWithdrawals.dataOperazione} >= ${filters.from}` as any);
    }
    if (filters?.to) {
      conditions.push(sql`${equityWithdrawals.dataOperazione} <= ${filters.to}T23:59:59.999Z` as any);
    }

    const withdrawals = await db
      .select()
      .from(equityWithdrawals)
      .where(and(...conditions))
      .orderBy(desc(equityWithdrawals.dataOperazione), desc(equityWithdrawals.createdAt));

    const active = withdrawals.filter((w) => w.annullato === 0);
    const totals = {
      totale: active.reduce((sum, w) => sum + Number(w.importo || 0), 0),
      rimborsi: active.filter((w) => w.tipo === 'RIMBORSO').reduce((sum, w) => sum + Number(w.importo || 0), 0),
      dividendi: active.filter((w) => w.tipo === 'DIVIDENDO').reduce((sum, w) => sum + Number(w.importo || 0), 0),
    };

    return { withdrawals, totals };
  }

  async annullaEquityWithdrawal(id: string, activityId: string, userId: string) {
    const [withdrawal] = await db
      .select()
      .from(equityWithdrawals)
      .where(and(eq(equityWithdrawals.id, id), eq(equityWithdrawals.activityId, activityId)));

    if (!withdrawal) {
      throw new Error("Prelievo non trovato");
    }
    if (withdrawal.annullato === 1) {
      throw new Error("Prelievo già annullato");
    }

    return await db.transaction(async (trx) => {
      const [updated] = await trx
        .update(equityWithdrawals)
        .set({ annullato: 1 })
        .where(eq(equityWithdrawals.id, id))
        .returning();

      await trx.insert(financialHistory).values({
        userId,
        activityId,
        azione: "DEPOSITO_CASSA",
        descrizione: `Annullamento prelievo Equity${withdrawal.descrizione ? `: ${withdrawal.descrizione}` : ''}`,
        importo: String(withdrawal.importo),
        dettagli: JSON.stringify({
          scope: 'EQUITY',
          withdrawalId: withdrawal.id,
          reversal: true,
          tipo: withdrawal.tipo,
          memberId: withdrawal.memberId,
        }),
        data: new Date(),
      });

      return { success: true, withdrawal: updated };
    });
  }

  async getFinancialHistoryByActivity(activityId: string) {
    return await db
      .select()
      .from(financialHistory)
      .where(eq(financialHistory.activityId, activityId))
      .orderBy(desc(financialHistory.data), desc(financialHistory.createdAt));
  }

  /**
   * Derives the "Cassa Reinvestimento" balance from durable ledgers rather
   * than a mutable counter: deposits come from fund_transfers rows targeting
   * this account, and every withdrawal/refund (from stock-in coverage,
   * manual expense coverage, or rollback restores) is recorded as a signed
   * entry in financial_history under a stable "azione" tag so the balance is
   * always re-derivable and auditable.
   */
  async getCassaReinvestimentoBalance(activityId: string, dbClient: any = db): Promise<number> {
    const [[deposits], [adjustments]] = await Promise.all([
      dbClient
        .select({ total: sql<number>`COALESCE(SUM(CAST(${fundTransfers.importo} AS numeric)), 0)` })
        .from(fundTransfers)
        .where(and(eq(fundTransfers.activityId, activityId), eq(fundTransfers.toAccount, "Cassa Reinvestimento"))),
      dbClient
        .select({ total: sql<number>`COALESCE(SUM(CAST(${financialHistory.importo} AS numeric)), 0)` })
        .from(financialHistory)
        .where(and(eq(financialHistory.activityId, activityId), eq(financialHistory.azione, "Cassa Reinvestimento"))),
    ]);

    return Number(deposits?.total || 0) + Number(adjustments?.total || 0);
  }

  /** Records a signed adjustment (negative = withdrawal, positive = refund/restore) to the reinvestment cash box. */
  async updateCassaReinvestimento(activityId: string, amount: number, descrizione: string, userId: string, dbClient: any = db) {
    const [entry] = await dbClient
      .insert(financialHistory)
      .values({
        userId,
        activityId,
        azione: "Cassa Reinvestimento",
        descrizione,
        importo: amount.toFixed(2),
        data: new Date(),
      })
      .returning();
    return entry;
  }

  async getActivityStats(activityId: string) {
    const [inventoryStats] = await db
      .select({
        inventoryCount: sql<number>`COALESCE(SUM(${inventario.quantita}), 0)`,
        inventoryItemsCount: sql<number>`COUNT(*)`,
        inventoryValue: sql<number>`COALESCE(SUM(CAST(${inventario.costo} AS numeric) * ${inventario.quantita}), 0)`,
      })
      .from(inventario)
      .where(and(eq(inventario.activityId, activityId), eq(inventario.archiviato, 0)));

    const [salesStats] = await db
      .select({
        totalSales: sql<number>`COALESCE(SUM(CAST(${vendite.prezzoVendita} AS numeric) * ${vendite.quantita}), 0)`,
        totalMargin: sql<number>`COALESCE(SUM(CAST(${vendite.margine} AS numeric)), 0)`,
        salesCount: sql<number>`COUNT(*)`,
        soldUnits: sql<number>`COALESCE(SUM(${vendite.quantita}), 0)`,
      })
      .from(vendite)
      .where(eq(vendite.activityId, activityId));

    const [expenseStats] = await db
      .select({
        totalExpenses: sql<number>`COALESCE(SUM(CAST(${spese.importo} AS numeric)), 0)`,
        expensesCount: sql<number>`COUNT(*)`,
      })
      .from(spese)
      .where(eq(spese.activityId, activityId));

    const totalSales = Number(salesStats?.totalSales || 0);
    const totalMargin = Number(salesStats?.totalMargin || 0);
    const totalExpenses = Number(expenseStats?.totalExpenses || 0);
    const netMargin = totalSales - totalExpenses;

    return {
      inventoryCount: Number(inventoryStats?.inventoryCount || 0),
      inventoryItemsCount: Number(inventoryStats?.inventoryItemsCount || 0),
      inventoryValue: Number(inventoryStats?.inventoryValue || 0),
      totalSales,
      totalRevenue: totalSales,
      totalExpenses,
      totalMargin,
      netMargin,
      salesCount: Number(salesStats?.salesCount || 0),
      soldUnits: Number(salesStats?.soldUnits || 0),
      expensesCount: Number(expenseStats?.expensesCount || 0),
    };
  }

  async getChartDataByActivity(activityId: string) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const sales = await db
      .select({ data: vendite.data, prezzoVendita: vendite.prezzoVendita, quantita: vendite.quantita, margine: vendite.margine })
      .from(vendite)
      .where(and(eq(vendite.activityId, activityId), sql`${vendite.data} >= ${start}`))
      .orderBy(vendite.data);

    const expenses = await db
      .select({ data: spese.data, importo: spese.importo })
      .from(spese)
      .where(and(eq(spese.activityId, activityId), sql`${spese.data} >= ${start}`))
      .orderBy(spese.data);

    const monthEntries = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = new Intl.DateTimeFormat('it-IT', { month: 'short', year: '2-digit' }).format(date);
      return { key, label };
    });

    const salesByMonth = new Map(monthEntries.map((m) => [m.key, 0]));
    const grossMarginByMonth = new Map(monthEntries.map((m) => [m.key, 0]));
    const expensesByMonth = new Map(monthEntries.map((m) => [m.key, 0]));

    for (const sale of sales) {
      if (!sale.data) continue;
      const date = new Date(sale.data);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!salesByMonth.has(key)) continue;
      salesByMonth.set(key, (salesByMonth.get(key) || 0) + (Number(sale.prezzoVendita) * Number(sale.quantita || 1)));
      grossMarginByMonth.set(key, (grossMarginByMonth.get(key) || 0) + Number(sale.margine || 0));
    }

    for (const expense of expenses) {
      if (!expense.data) continue;
      const date = new Date(expense.data);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!expensesByMonth.has(key)) continue;
      expensesByMonth.set(key, (expensesByMonth.get(key) || 0) + Number(expense.importo || 0));
    }

    return {
      months: monthEntries.map((m) => m.label),
      salesData: monthEntries.map((m) => ({ date: m.key, amount: Number((salesByMonth.get(m.key) || 0).toFixed(2)) })),
      expensesData: monthEntries.map((m) => ({ date: m.key, amount: Number((expensesByMonth.get(m.key) || 0).toFixed(2)) })),
      marginData: monthEntries.map((m) => ({
        date: m.key,
        amount: Number(((grossMarginByMonth.get(m.key) || 0) - (expensesByMonth.get(m.key) || 0)).toFixed(2)),
      })),
    };
  }
}

export const storage = new DatabaseStorage();
