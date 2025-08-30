import { dataSyncService } from './data-sync.js';

export class SyncScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private syncInProgress = false;

  constructor() {
    console.log('🔄 SyncScheduler initialized');
  }

  start(): void {
    if (this.isRunning) {
      console.log('⚠️ SyncScheduler is already running');
      return;
    }

    // Controlla se il PRODUCTION_DATABASE_URL è configurato
    if (!process.env.PRODUCTION_DATABASE_URL) {
      console.log('⚠️ PRODUCTION_DATABASE_URL not configured, skipping automatic sync');
      return;
    }

    console.log('🚀 Starting automatic data synchronization (every 1 hour)');
    
    // Esegui la prima sincronizzazione dopo 1 minuto (per permettere all'app di avviarsi completamente)
    setTimeout(() => {
      this.runSync();
    }, 60 * 1000); // 1 minuto

    // Poi esegui ogni ora (3600000 ms = 1 ora)
    this.intervalId = setInterval(() => {
      this.runSync();
    }, 60 * 60 * 1000); // 1 ora

    this.isRunning = true;
    console.log('✅ SyncScheduler started successfully');
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('🛑 SyncScheduler stopped');
  }

  private async runSync(): Promise<void> {
    if (this.syncInProgress) {
      console.log('⏳ Sync already in progress, skipping this run');
      return;
    }

    this.syncInProgress = true;
    
    try {
      console.log('🔄 [SCHEDULED] Starting automatic data synchronization...');
      
      const result = await dataSyncService.syncFromProduction();
      
      if (result.success) {
        console.log(`✅ [SCHEDULED] Sync completed successfully:`, result.syncedCounts);
      } else {
        console.error(`❌ [SCHEDULED] Sync failed: ${result.message}`);
      }
    } catch (error: any) {
      console.error(`💥 [SCHEDULED] Sync error: ${error.message}`);
    } finally {
      this.syncInProgress = false;
    }
  }

  getStatus(): {
    isRunning: boolean;
    syncInProgress: boolean;
    hasProductionConnection: boolean;
    nextSyncIn?: number; // millisecondi
  } {
    let nextSyncIn: number | undefined;
    
    if (this.isRunning && this.intervalId) {
      // Stima approssimativa del prossimo sync (non precisa ma indicativa)
      nextSyncIn = 60 * 60 * 1000; // 1 ora in ms
    }

    return {
      isRunning: this.isRunning,
      syncInProgress: this.syncInProgress,
      hasProductionConnection: !!process.env.PRODUCTION_DATABASE_URL,
      nextSyncIn
    };
  }

  // Metodo per triggering manuale del sync
  async triggerManualSync(): Promise<any> {
    if (this.syncInProgress) {
      throw new Error('Sync already in progress');
    }

    console.log('🔄 [MANUAL] Starting manual data synchronization...');
    
    try {
      this.syncInProgress = true;
      const result = await dataSyncService.syncFromProduction();
      
      if (result.success) {
        console.log(`✅ [MANUAL] Sync completed successfully:`, result.syncedCounts);
      } else {
        console.error(`❌ [MANUAL] Sync failed: ${result.message}`);
      }
      
      return result;
    } finally {
      this.syncInProgress = false;
    }
  }
}

export const syncScheduler = new SyncScheduler();