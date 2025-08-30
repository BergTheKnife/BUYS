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
import { eq, and } from 'drizzle-orm';

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

  async syncFromProduction(): Promise<{
    success: boolean;
    message: string;
    syncedCounts: {
      users: number;
      activities: number;
      inventario: number;
      vendite: number;
      spese: number;
      fundTransfers: number;
      financialHistory: number;
    };
  }> {
    try {
      this.log('info', 'Starting data synchronization from production...');

      // 1. Crea backup
      await this.createBackup();

      // 2. Leggi dati dalla produzione
      this.log('info', 'Reading data from production database...');
      
      const prodUsers = await this.prodDb.select().from(users);
      const prodActivities = await this.prodDb.select().from(activities);
      const prodActivityUsers = await this.prodDb.select().from(activityUsers);
      const prodInventario = await this.prodDb.select().from(inventario);
      const prodVendite = await this.prodDb.select().from(vendite);
      const prodSpese = await this.prodDb.select().from(spese);
      const prodFundTransfers = await this.prodDb.select().from(fundTransfers);
      const prodFinancialHistory = await this.prodDb.select().from(financialHistory);

      this.log('info', `Read ${prodUsers.length} users, ${prodActivities.length} activities from production`);

      // 3. Svuota e sincronizza le tabelle nell'ordine corretto (rispettando le foreign keys)
      await this.syncTable('financialHistory', prodFinancialHistory);
      await this.syncTable('fundTransfers', prodFundTransfers);
      await this.syncTable('spese', prodSpese);
      await this.syncTable('vendite', prodVendite);
      await this.syncTable('inventario', prodInventario);
      await this.syncTable('activityUsers', prodActivityUsers);
      await this.syncTable('activities', prodActivities);
      await this.syncTable('users', prodUsers);

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

      return {
        success: true,
        message: 'Data synchronized successfully from production',
        syncedCounts
      };

    } catch (error: any) {
      this.log('error', `Synchronization failed: ${error.message}`);
      return {
        success: false,
        message: `Synchronization failed: ${error.message}`,
        syncedCounts: {
          users: 0,
          activities: 0,
          inventario: 0,
          vendite: 0,
          spese: 0,
          fundTransfers: 0,
          financialHistory: 0
        }
      };
    }
  }

  private async syncTable(tableName: string, data: any[]): Promise<void> {
    try {
      this.log('info', `Syncing ${tableName} table with ${data.length} records...`);

      let table: any;
      switch (tableName) {
        case 'users': table = users; break;
        case 'activities': table = activities; break;
        case 'activityUsers': table = activityUsers; break;
        case 'inventario': table = inventario; break;
        case 'vendite': table = vendite; break;
        case 'spese': table = spese; break;
        case 'fundTransfers': table = fundTransfers; break;
        case 'financialHistory': table = financialHistory; break;
        default: throw new Error(`Unknown table: ${tableName}`);
      }

      // Svuota la tabella
      await db.delete(table);

      // Inserisci i nuovi dati se ce ne sono
      if (data.length > 0) {
        await db.insert(table).values(data);
      }

      this.log('success', `${tableName} table synced: ${data.length} records`);
    } catch (error: any) {
      this.log('error', `Failed to sync ${tableName}: ${error.message}`);
      throw error;
    }
  }

  getSyncLogs(): Array<{ timestamp: Date; action: string; status: 'success' | 'error'; details: string }> {
    return [...this.syncLogs];
  }

  async testProductionConnection(): Promise<{ success: boolean; message: string }> {
    try {
      this.log('info', 'Testing production database connection...');
      
      // Test semplice: contiamo gli utenti
      const userCount = await this.prodDb.select().from(users);
      
      this.log('success', `Production connection test successful. Found ${userCount.length} users.`);
      return {
        success: true,
        message: `Connection successful. Found ${userCount.length} users in production.`
      };
    } catch (error: any) {
      this.log('error', `Production connection test failed: ${error.message}`);
      return {
        success: false,
        message: `Connection failed: ${error.message}`
      };
    }
  }
}

export const dataSyncService = new DataSyncService();