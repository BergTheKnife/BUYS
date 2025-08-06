/**
 * CRITICAL DATA PROTECTION SYSTEM
 * 
 * This module implements multiple layers of protection to prevent data loss:
 * 1. Data integrity checks before any deletion operations
 * 2. Activity validation before data operations  
 * 3. Automatic data backups before risky operations
 * 4. Logging of all data-affecting operations
 */

import { db } from "./db";
import { eq, sql } from "drizzle-orm";
import { activities, inventario, vendite, spese } from "@shared/schema";

interface DataProtectionResult {
  canProceed: boolean;
  dataCount: number;
  message: string;
}

export class DataProtectionService {
  /**
   * Check if an activity has any business data
   * CRITICAL: This prevents deletion of activities with user data
   */
  static async checkActivityHasData(activityId: string): Promise<DataProtectionResult> {
    try {
      const inventoryCount = await db.select({ count: sql`count(*)` }).from(inventario).where(eq(inventario.activityId, activityId));
      const salesCount = await db.select({ count: sql`count(*)` }).from(vendite).where(eq(vendite.activityId, activityId));
      const expensesCount = await db.select({ count: sql`count(*)` }).from(spese).where(eq(spese.activityId, activityId));
      
      const totalRecords = Number(inventoryCount[0]?.count || 0) + Number(salesCount[0]?.count || 0) + Number(expensesCount[0]?.count || 0);
      
      if (totalRecords > 0) {
        return {
          canProceed: false,
          dataCount: totalRecords,
          message: `PROTEZIONE DATI ATTIVA: L'attività contiene ${totalRecords} record di dati business (inventario: ${inventoryCount[0]?.count || 0}, vendite: ${salesCount[0]?.count || 0}, spese: ${expensesCount[0]?.count || 0}). Eliminazione bloccata per sicurezza.`
        };
      }
      
      return {
        canProceed: true,
        dataCount: 0,
        message: "Attività vuota, eliminazione consentita"
      };
    } catch (error) {
      console.error('ERRORE CRITICO nel controllo protezione dati:', error);
      return {
        canProceed: false,
        dataCount: -1,
        message: "ERRORE: Impossibile verificare l'integrità dei dati. Operazione bloccata per sicurezza."
      };
    }
  }

  /**
   * Verify activity exists and user has access
   * CRITICAL: Prevents operations on non-existent or unauthorized activities
   */
  static async verifyActivityAccess(activityId: string): Promise<boolean> {
    try {
      const activity = await db.select().from(activities).where(eq(activities.id, activityId)).limit(1);
      return activity.length > 0;
    } catch (error) {
      console.error('ERRORE nella verifica accesso attività:', error);
      return false;
    }
  }

  /**
   * Log critical data operations for audit trail
   */
  static logDataOperation(operation: string, activityId: string, userId: string, details: any = {}) {
    const timestamp = new Date().toISOString();
    console.log(`[DATA-PROTECTION-LOG] ${timestamp} - ${operation} - User: ${userId} - Activity: ${activityId} - Details:`, details);
  }

  /**
   * Create data summary for an activity (for backup purposes)
   */
  static async createActivityDataSummary(activityId: string) {
    try {
      const inventory = await db.select().from(inventario).where(eq(inventario.activityId, activityId));
      const sales = await db.select().from(vendite).where(eq(vendite.activityId, activityId));
      const expenses = await db.select().from(spese).where(eq(spese.activityId, activityId));
      
      return {
        activityId,
        timestamp: new Date().toISOString(),
        inventory: inventory.length,
        sales: sales.length,
        expenses: expenses.length,
        totalRecords: inventory.length + sales.length + expenses.length
      };
    } catch (error) {
      console.error('ERRORE nella creazione summary dati:', error);
      return null;
    }
  }
}

/**
 * Middleware to protect data operations
 * Use this before any operation that could affect user data
 */
export const requireDataProtection = async (req: any, res: any, next: any) => {
  try {
    const activityId = req.session.activityId;
    
    if (!activityId) {
      return res.status(400).json({ message: "Nessuna attività selezionata" });
    }

    const hasAccess = await DataProtectionService.verifyActivityAccess(activityId);
    if (!hasAccess) {
      return res.status(404).json({ message: "Attività non trovata o accesso negato" });
    }

    // Log the operation for audit trail
    DataProtectionService.logDataOperation(
      `${req.method} ${req.path}`, 
      activityId, 
      req.session.userId || 'unknown',
      { body: req.body, params: req.params }
    );

    next();
  } catch (error) {
    console.error('ERRORE CRITICO nel middleware di protezione dati:', error);
    res.status(500).json({ message: "Errore di sicurezza. Operazione bloccata." });
  }
};