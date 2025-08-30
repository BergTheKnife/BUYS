import { DataSyncService } from './data-sync.js';

export class SyncScheduler {
  private syncService: DataSyncService;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor() {
    this.syncService = new DataSyncService();
    console.log('🔄 SyncScheduler initialized');
  }

  start(intervalHours: number = 1): void {
    if (this.isRunning) {
      console.log('⚠️ SyncScheduler is already running');
      return;
    }

    console.log(`🚀 Starting automatic data synchronization (every ${intervalHours} hour${intervalHours !== 1 ? 's' : ''})`);
    
    // Set up the interval for automatic syncing
    const intervalMs = intervalHours * 60 * 60 * 1000; // Convert hours to milliseconds
    this.intervalId = setInterval(async () => {
      await this.performScheduledSync();
    }, intervalMs);

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

  private async performScheduledSync(): Promise<void> {
    try {
      console.log('🔄 [SCHEDULED] Starting automatic data synchronization...');
      const result = await this.syncService.synchronizeFromProduction();
      console.log('✅ [SCHEDULED] Sync completed successfully:', result);
    } catch (error: any) {
      console.error('❌ [SCHEDULED] Sync failed:', error.message);
    }
  }

  async triggerManualSync(): Promise<any> {
    try {
      console.log('🔄 [MANUAL] Starting manual data synchronization...');
      const result = await this.syncService.synchronizeFromProduction();
      console.log('✅ [MANUAL] Sync completed successfully:', result);
      return result;
    } catch (error: any) {
      console.error('❌ [MANUAL] Manual sync failed:', error.message);
      throw error;
    }
  }

  getSyncStatus(): any {
    return {
      isRunning: this.isRunning,
      lastStatus: this.syncService.getLastSyncStatus(),
      logs: this.syncService.getSyncLogs().slice(-10) // Last 10 logs
    };
  }
}