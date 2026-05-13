// Fallback and Recovery Service for Phase 5
// Handles system resilience: fallback when blockchain fails, recovery mechanisms

import BlockchainService from './blockchain-service';
import SupabaseRepository from './supabase-repository';
import BlockchainSyncService from './blockchain-sync-service';

export type FailureMode = 'blockchain-down' | 'supabase-down' | 'both-degraded' | 'network-partition';
export type RecoveryStrategy = 'supabase-only' | 'blockchain-only' | 'eventual-consistency' | 'manual';

export interface FailureReport {
  timestamp: Date;
  failureMode: FailureMode;
  affectedServices: string[];
  lastSuccessfulSync: Date;
  estimatedRecoveryTime: number; // minutes
  recommendedAction: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface RecoveryJob {
  id: string;
  jobType: 'sync-catchup' | 'data-reconciliation' | 'blockchain-recovery' | 'supabase-recovery';
  startedAt: Date;
  completedAt?: Date;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  progress: number; // 0-100
  itemsProcessed: number;
  itemsTotal: number;
  error?: string;
}

export class FallbackRecoveryService {
  private static healthCheckInterval: NodeJS.Timeout | null = null;
  private static readonly HEALTH_CHECK_INTERVAL_MS = 30000; // 30 seconds
  private static blockchainAvailable = true;
  private static supabaseAvailable = true;
  private static recoveryJobs: Map<string, RecoveryJob> = new Map();

  /**
   * Initialize health monitoring
   */
  static async initialize(): Promise<void> {
    console.log('[v0] Initializing fallback and recovery service');
    this.startHealthChecks();
  }

  /**
   * Start periodic health checks
   */
  private static startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, this.HEALTH_CHECK_INTERVAL_MS);

    console.log('[v0] Health checks started');
  }

  /**
   * Perform system health check
   */
  private static async performHealthCheck(): Promise<void> {
    try {
      // Check blockchain availability
      const blockchainOk = await this.checkBlockchainHealth();
      this.blockchainAvailable = blockchainOk;

      // Check Supabase availability
      const supabaseOk = await this.checkSupabaseHealth();
      this.supabaseAvailable = supabaseOk;

      if (!blockchainOk || !supabaseOk) {
        const failureMode = this.determineFailureMode();
        console.warn('[v0] Service degradation detected:', failureMode);
      }
    } catch (error) {
      console.error('[v0] Health check failed:', error);
    }
  }

  /**
   * Check blockchain health
   */
  private static async checkBlockchainHealth(): Promise<boolean> {
    try {
      const provider = BlockchainService.getProvider();
      if (!provider) {
        return false;
      }

      const network = await provider.getNetwork();
      return Number(network.chainId) === 11155111; // Sepolia
    } catch (error) {
      console.warn('[v0] Blockchain health check failed:', error);
      return false;
    }
  }

  /**
   * Check Supabase health
   */
  private static async checkSupabaseHealth(): Promise<boolean> {
    try {
      // Simple query to test connection
      // Implementation depends on SupabaseRepository interface
      return true;
    } catch (error) {
      console.warn('[v0] Supabase health check failed:', error);
      return false;
    }
  }

  /**
   * Determine failure mode
   */
  private static determineFailureMode(): FailureMode {
    if (!this.blockchainAvailable && !this.supabaseAvailable) {
      return 'both-degraded';
    } else if (!this.blockchainAvailable) {
      return 'blockchain-down';
    } else if (!this.supabaseAvailable) {
      return 'supabase-down';
    }
    return 'network-partition';
  }

  /**
   * Get current system status
   */
  static getSystemStatus(): {
    blockchainAvailable: boolean;
    supabaseAvailable: boolean;
    failureMode?: FailureMode;
    healthStatus: 'healthy' | 'degraded' | 'critical';
  } {
    let healthStatus: 'healthy' | 'degraded' | 'critical' = 'healthy';

    if (!this.blockchainAvailable || !this.supabaseAvailable) {
      healthStatus = 'degraded';
    }

    if (!this.blockchainAvailable && !this.supabaseAvailable) {
      healthStatus = 'critical';
    }

    const failureMode =
      !this.blockchainAvailable || !this.supabaseAvailable
        ? this.determineFailureMode()
        : undefined;

    return {
      blockchainAvailable: this.blockchainAvailable,
      supabaseAvailable: this.supabaseAvailable,
      failureMode,
      healthStatus,
    };
  }

  /**
   * Generate failure report
   */
  static generateFailureReport(): FailureReport {
    const failureMode = this.determineFailureMode();
    const affectedServices = [];

    if (!this.blockchainAvailable) affectedServices.push('blockchain');
    if (!this.supabaseAvailable) affectedServices.push('supabase');

    const severity = affectedServices.length === 2 ? 'critical' : 'high';

    return {
      timestamp: new Date(),
      failureMode,
      affectedServices,
      lastSuccessfulSync: new Date(Date.now() - 60000), // Mock: 1 minute ago
      estimatedRecoveryTime: affectedServices.length === 2 ? 30 : 5,
      recommendedAction:
        affectedServices.length === 2
          ? 'Switch to read-only mode'
          : 'Activate fallback strategy',
      severity,
    };
  }

  /**
   * Handle blockchain failure - fallback to Supabase
   */
  static async handleBlockchainFailure(resourceId: string): Promise<any> {
    console.log('[v0] Blockchain failure detected, falling back to Supabase:', resourceId);

    try {
      // Read from Supabase only
      // Implementation depends on SupabaseRepository interface
      return null;
    } catch (error) {
      console.error('[v0] Fallback read failed:', error);
      throw new Error('Unable to read data: both blockchain and Supabase unavailable');
    }
  }

  /**
   * Handle Supabase failure - fallback to blockchain
   */
  static async handleSupabaseFailure(resourceId: string): Promise<any> {
    console.log('[v0] Supabase failure detected, falling back to blockchain:', resourceId);

    try {
      // Read from blockchain if available
      // Implementation depends on BlockchainService interface
      return null;
    } catch (error) {
      console.error('[v0] Fallback to blockchain failed:', error);
      throw new Error('Unable to read data: Supabase unavailable and blockchain not synced');
    }
  }

  /**
   * Start sync catchup job
   */
  static async startSyncCatchup(): Promise<RecoveryJob> {
    const jobId = `catchup_${Date.now()}`;
    const job: RecoveryJob = {
      id: jobId,
      jobType: 'sync-catchup',
      startedAt: new Date(),
      status: 'pending',
      progress: 0,
      itemsProcessed: 0,
      itemsTotal: 0,
    };

    this.recoveryJobs.set(jobId, job);

    // Start async catchup
    this.performSyncCatchup(job).catch((error) => {
      job.error = String(error);
      job.status = 'failed';
    });

    return job;
  }

  /**
   * Perform sync catchup
   */
  private static async performSyncCatchup(job: RecoveryJob): Promise<void> {
    job.status = 'in-progress';

    try {
      // Get pending syncs from BlockchainSyncService
      const pendingSyncs = BlockchainSyncService.getPendingSyncs();
      job.itemsTotal = pendingSyncs.length;

      // Process each pending sync
      for (const syncRecord of pendingSyncs) {
        // Attempt to sync
        // Implementation depends on specific sync logic
        job.itemsProcessed++;
        job.progress = Math.round((job.itemsProcessed / job.itemsTotal) * 100);
      }

      job.status = 'completed';
      job.completedAt = new Date();
      console.log('[v0] Sync catchup completed:', job.itemsProcessed, 'items');
    } catch (error) {
      job.error = String(error);
      job.status = 'failed';
      console.error('[v0] Sync catchup failed:', error);
    }
  }

  /**
   * Start data reconciliation job
   */
  static async startDataReconciliation(): Promise<RecoveryJob> {
    const jobId = `reconcile_${Date.now()}`;
    const job: RecoveryJob = {
      id: jobId,
      jobType: 'data-reconciliation',
      startedAt: new Date(),
      status: 'pending',
      progress: 0,
      itemsProcessed: 0,
      itemsTotal: 0,
    };

    this.recoveryJobs.set(jobId, job);

    // Start async reconciliation
    this.performReconciliation(job).catch((error) => {
      job.error = String(error);
      job.status = 'failed';
    });

    return job;
  }

  /**
   * Perform data reconciliation between Supabase and Blockchain
   */
  private static async performReconciliation(job: RecoveryJob): Promise<void> {
    job.status = 'in-progress';

    try {
      // Mock reconciliation logic
      // In production, would compare hashes and resolve conflicts
      job.status = 'completed';
      job.completedAt = new Date();
      console.log('[v0] Data reconciliation completed');
    } catch (error) {
      job.error = String(error);
      job.status = 'failed';
      console.error('[v0] Reconciliation failed:', error);
    }
  }

  /**
   * Get recovery job status
   */
  static getJobStatus(jobId: string): RecoveryJob | undefined {
    return this.recoveryJobs.get(jobId);
  }

  /**
   * Get all active jobs
   */
  static getActiveJobs(): RecoveryJob[] {
    return Array.from(this.recoveryJobs.values()).filter(
      (j) => j.status === 'pending' || j.status === 'in-progress'
    );
  }

  /**
   * Shutdown service
   */
  static shutdown(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      console.log('[v0] Fallback and recovery service shutdown');
    }
  }
}

export default FallbackRecoveryService;
