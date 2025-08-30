import { drizzle, NeonDatabase } from 'drizzle-orm/neon-serverless';
import { Pool } from '@neondatabase/serverless';
import { 
  users, 
  activities, 
  inventario, 
  vendite, 
  spese, 
  fundTransfers, 
  financialHistory,
  activityUsers
} from '../shared/schema.js';
import { db } from './db.js';
import { eq, and, sql } from 'drizzle-orm';

export class DataSyncService {
  private prodDb: NeonDatabase<typeof import('../shared/schema.js')>;
  private syncLogs: Array<{ timestamp: Date; action: string; status: 'success' | 'error'; details: string }> = [];

  constructor() {
    if (!process.env.PRODUCTION_DATABASE_URL) {
      throw new Error('PRODUCTION_DATABASE_URL environment variable is required');
    }

    // Connessione READ-ONLY al database di produzione
    const prodConnection = new Pool({
      connectionString: process.env.PRODUCTION_DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    
    this.prodDb = drizzle(prodConnection);
    this.log('info', 'DataSyncService initialized with production database connection');
  }

  private log(status: 'success' | 'error' | 'info', details: string) {
    const logEntry = {
      timestamp: new Date(),
      action: 'sync',
      status: status as 'success' | 'error',
      details
    };
    
    this.syncLogs.push(logEntry);
    console.log(`[DATA-SYNC] ${status.toUpperCase()}: ${details}`);
    
    // Mantieni solo gli ultimi 100 log
    if (this.syncLogs.length > 100) {
      this.syncLogs = this.syncLogs.slice(-100);
    }
  }

  async createBackup(): Promise<string> {
    try {
      this.log('info', 'Creating backup before sync...');
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupData = {
        timestamp,
        users: await db.select().from(users),
        activities: await db.select().from(activities),
        activityUsers: await db.select().from(activityUsers),
        inventario: await db.select().from(inventario),
        vendite: await db.select().from(vendite),
        spese: await db.select().from(spese),
        fundTransfers: await db.select().from(fundTransfers),
        financialHistory: await db.select().from(financialHistory)
      };

      // Salva il backup come JSON string per ora (in futuro si potrebbe salvare su file o storage)
      const backupString = JSON.stringify(backupData);
      this.log('success', `Backup created with ${backupData.users.length} users, ${backupData.activities.length} activities`);
      
      return backupString;
    } catch (error: any) {
      this.log('error', `Backup failed: ${error.message}`);
      throw error;
    }
  }

  private async syncTable(tableName: string, data: any[]): Promise<void> {
    try {
      this.log('info', `Syncing ${tableName} table with ${data.length} records...`);

      // Get the table reference dynamically
      let table;
      switch (tableName) {
        case 'users': table = users; break;
        case 'activities': table = activities; break;
        case 'activityUsers': table = activityUsers; break;
        case 'inventario': table = inventario; break;
        case 'vendite': table = vendite; break;
        case 'spese': table = spese; break;
        case 'fundTransfers': table = fundTransfers; break;
        case 'financialHistory': table = financialHistory; break;
        default:
          throw new Error(`Unknown table: ${tableName}`);
      }

      // Clear existing data
      await db.delete(table);

      // Insert new data in chunks to avoid memory issues
      if (data.length > 0) {
        const chunkSize = 100;
        for (let i = 0; i < data.length; i += chunkSize) {
          const chunk = data.slice(i, i + chunkSize);
          await db.insert(table).values(chunk);
        }
      }

      this.log('success', `${tableName} table synced: ${data.length} records`);
    } catch (error: any) {
      this.log('error', `Failed to sync ${tableName}: ${error.message}`);
      throw error;
    }
  }

  async synchronizeFromProduction(): Promise<any> {
    try {
      this.log('info', 'Starting data synchronization from production...');

      // 1. Create backup before sync
      await this.createBackup();

      // 2. Read all data from production
      this.log('info', 'Reading data from production database...');
      
      // Test connection with basic query first
      try {
        const testQuery = await this.prodDb.execute(sql`SELECT COUNT(*) as total FROM inventario`);
        console.log('🔍 [DEBUG] Direct inventario count from production:', testQuery);
      } catch (error: any) {
        console.log('❌ [DEBUG] Direct query failed:', error.message);
      }
      
      const prodUsers = await this.prodDb.select().from(users);
      const prodActivities = await this.prodDb.select().from(activities);
      const prodActivityUsers = await this.prodDb.select().from(activityUsers);
      const prodInventario = await this.prodDb.select().from(inventario);
      const prodVendite = await this.prodDb.select().from(vendite);
      const prodSpese = await this.prodDb.select().from(spese);
      const prodFundTransfers = await this.prodDb.select().from(fundTransfers);
      const prodFinancialHistory = await this.prodDb.select().from(financialHistory);

      this.log('info', `Read ${prodUsers.length} users, ${prodActivities.length} activities from production`);
      
      // DEBUG: Stampa dati grezzi dalla produzione
      console.log('📊 [DEBUG] Raw production data counts:');
      console.log(`- Inventario: ${prodInventario.length}`);
      console.log(`- Vendite: ${prodVendite.length}`);
      console.log(`- Spese: ${prodSpese.length}`);
      
      if (prodInventario.length > 0) {
        console.log('📦 [DEBUG] First inventario item:', prodInventario[0]);
      }
      if (prodVendite.length > 0) {
        console.log('💰 [DEBUG] First vendita item:', prodVendite[0]);
      }
      if (prodSpese.length > 0) {
        console.log('💸 [DEBUG] First spesa item:', prodSpese[0]);
      }

      // 🔧 CORREZIONE AUTOMATICA: Assegna dati orfani all'attività DAVALB
      const validActivityIds = prodActivities.map(a => a.id);
      const orphanInventario = prodInventario.filter(i => !validActivityIds.includes(i.activityId));
      const orphanVendite = prodVendite.filter(v => !validActivityIds.includes(v.activityId));
      const orphanSpese = prodSpese.filter(s => !validActivityIds.includes(s.activityId));
      
      const davalbActivity = prodActivities.find(a => a.nome === 'DAVALB');
      if (davalbActivity && (orphanInventario.length > 0 || orphanVendite.length > 0 || orphanSpese.length > 0)) {
        this.log('info', `Auto-fixing ${orphanInventario.length + orphanVendite.length + orphanSpese.length} orphan records to DAVALB`);
        
        orphanInventario.forEach(item => item.activityId = davalbActivity.id);
        orphanVendite.forEach(item => item.activityId = davalbActivity.id);
        orphanSpese.forEach(item => item.activityId = davalbActivity.id);
      }

      // 3. Svuota e sincronizza le tabelle nell'ordine corretto (rispettando le foreign keys)
      // Prima le tabelle PADRE (senza foreign key), poi le FIGLIE (con foreign key)
      await this.syncTable('users', prodUsers);
      await this.syncTable('activities', prodActivities);
      await this.syncTable('activityUsers', prodActivityUsers);
      await this.syncTable('inventario', prodInventario);
      await this.syncTable('vendite', prodVendite);
      await this.syncTable('spese', prodSpese);
      await this.syncTable('fundTransfers', prodFundTransfers);
      await this.syncTable('financialHistory', prodFinancialHistory);

      const syncedCounts = {
        users: prodUsers.length,
        activities: prodActivities.length,
        inventario: prodInventario.length,
        vendite: prodVendite.length,
        spese: prodSpese.length,
        fundTransfers: prodFundTransfers.length,
        financialHistory: prodFinancialHistory.length
      };

      this.log('success', `Synchronization completed successfully. Synced: ${JSON.stringify(syncedCounts)}`);
      return syncedCounts;

    } catch (error: any) {
      this.log('error', `Synchronization failed: ${error.message}`);
      throw error;
    }
  }

  getSyncLogs(): any[] {
    return [...this.syncLogs];
  }

  getLastSyncStatus(): { success: boolean; lastSync: Date | null; error?: string } {
    const lastLog = this.syncLogs[this.syncLogs.length - 1];
    if (!lastLog) {
      return { success: false, lastSync: null, error: 'No sync performed yet' };
    }

    return {
      success: lastLog.status === 'success',
      lastSync: lastLog.timestamp,
      error: lastLog.status === 'error' ? lastLog.details : undefined
    };
  }
}