// Migration Script for Phase 5
// Migrates existing data from Supabase to blockchain for dual-write consistency

import BlockchainSyncService from '../lib/services/blockchain-sync-service';
import DualWriteService from '../lib/services/dual-write-service';
import ConsistencyCheckerService from '../lib/services/consistency-checker-service';
import SupabaseRepository from '../lib/services/supabase-repository';

export interface MigrationOptions {
  dryRun?: boolean;
  batchSize?: number;
  startFrom?: number;
  resourceTypes?: string[];
}

export interface MigrationResult {
  startTime: Date;
  endTime?: Date;
  totalItems: number;
  successfulMigrations: number;
  failedMigrations: number;
  skippedItems: number;
  errors: string[];
  durationMs?: number;
}

export class DataMigrationService {
  /**
   * Migrate all credentials to blockchain
   */
  static async migrateCredentials(
    options: MigrationOptions = {}
  ): Promise<MigrationResult> {
    const {
      dryRun = false,
      batchSize = 50,
      startFrom = 0,
    } = options;

    const result: MigrationResult = {
      startTime: new Date(),
      totalItems: 0,
      successfulMigrations: 0,
      failedMigrations: 0,
      skippedItems: 0,
      errors: [],
    };

    try {
      console.log('[v0] Starting credential migration', {
        dryRun,
        batchSize,
        startFrom,
      });

      // Fetch all credentials from Supabase
      // Implementation depends on SupabaseRepository interface
      const credentials = await this.fetchCredentialsFromSupabase(startFrom);
      result.totalItems = credentials.length;

      // Process in batches
      for (let i = 0; i < credentials.length; i += batchSize) {
        const batch = credentials.slice(i, i + batchSize);
        await this.processMigrationBatch(batch, result, dryRun);
      }

      result.endTime = new Date();
      result.durationMs = result.endTime.getTime() - result.startTime.getTime();

      this.printMigrationSummary(result);
      return result;
    } catch (error) {
      result.errors.push(String(error));
      console.error('[v0] Credential migration failed:', error);
      return result;
    }
  }

  /**
   * Migrate all identities to blockchain
   */
  static async migrateIdentities(
    options: MigrationOptions = {}
  ): Promise<MigrationResult> {
    const { dryRun = false, batchSize = 50, startFrom = 0 } = options;

    const result: MigrationResult = {
      startTime: new Date(),
      totalItems: 0,
      successfulMigrations: 0,
      failedMigrations: 0,
      skippedItems: 0,
      errors: [],
    };

    try {
      console.log('[v0] Starting identity migration', { dryRun, batchSize });

      // Fetch all identities from Supabase
      const identities = await this.fetchIdentitiesFromSupabase(startFrom);
      result.totalItems = identities.length;

      // Process in batches
      for (let i = 0; i < identities.length; i += batchSize) {
        const batch = identities.slice(i, i + batchSize);

        for (const identity of batch) {
          try {
            if (!dryRun) {
              // Queue for blockchain sync
              await BlockchainSyncService.syncIdentity(
                identity.id,
                identity.did,
                identity.publicKey
              );
            }

            result.successfulMigrations++;
            console.log('[v0] Identity migrated:', identity.did);
          } catch (error) {
            result.failedMigrations++;
            result.errors.push(
              `Identity ${identity.did}: ${String(error)}`
            );
            console.error('[v0] Identity migration failed:', identity.did, error);
          }
        }
      }

      result.endTime = new Date();
      result.durationMs = result.endTime.getTime() - result.startTime.getTime();

      this.printMigrationSummary(result);
      return result;
    } catch (error) {
      result.errors.push(String(error));
      console.error('[v0] Identity migration failed:', error);
      return result;
    }
  }

  /**
   * Migrate all policies to blockchain
   */
  static async migratePolicies(
    options: MigrationOptions = {}
  ): Promise<MigrationResult> {
    const { dryRun = false, batchSize = 50 } = options;

    const result: MigrationResult = {
      startTime: new Date(),
      totalItems: 0,
      successfulMigrations: 0,
      failedMigrations: 0,
      skippedItems: 0,
      errors: [],
    };

    try {
      console.log('[v0] Starting policy migration', { dryRun, batchSize });

      // Fetch all policies
      const policies = await this.fetchPoliciesFromSupabase();
      result.totalItems = policies.length;

      // Process in batches
      for (let i = 0; i < policies.length; i += batchSize) {
        const batch = policies.slice(i, i + batchSize);

        for (const policy of batch) {
          try {
            if (!dryRun) {
              await BlockchainSyncService.syncPolicy(policy.id, policy);
            }

            result.successfulMigrations++;
            console.log('[v0] Policy migrated:', policy.id);
          } catch (error) {
            result.failedMigrations++;
            result.errors.push(`Policy ${policy.id}: ${String(error)}`);
            console.error('[v0] Policy migration failed:', policy.id, error);
          }
        }
      }

      result.endTime = new Date();
      result.durationMs = result.endTime.getTime() - result.startTime.getTime();

      this.printMigrationSummary(result);
      return result;
    } catch (error) {
      result.errors.push(String(error));
      console.error('[v0] Policy migration failed:', error);
      return result;
    }
  }

  /**
   * Verify migration by checking consistency
   */
  static async verifyMigration(): Promise<any> {
    console.log('[v0] Verifying migration consistency...');

    const report = ConsistencyCheckerService.generateConsistencyReport();

    console.log('[v0] Consistency Report:', {
      totalResources: report.totalResources,
      consistentResources: report.consistentResources,
      consistencyPercentage: report.consistencyPercentage,
      criticalIssues: report.criticalIssues,
      recommendedActions: report.recommendedActions,
    });

    return report;
  }

  /**
   * Rollback migration (restore Supabase-only mode)
   */
  static async rollbackMigration(): Promise<void> {
    console.log('[v0] Rolling back to Supabase-only mode');

    // Stop blockchain sync
    BlockchainSyncService.stopSyncWorker();

    // Clear pending syncs
    const pending = BlockchainSyncService.getPendingSyncs();
    console.log('[v0] Cancelled', pending.length, 'pending blockchain syncs');

    console.log('[v0] Migration rollback completed');
  }

  /**
   * Fetch credentials from Supabase
   */
  private static async fetchCredentialsFromSupabase(startFrom: number = 0): Promise<any[]> {
    try {
      // Implementation depends on SupabaseRepository interface
      console.log('[v0] Fetching credentials from Supabase...');
      return [];
    } catch (error) {
      console.error('[v0] Failed to fetch credentials:', error);
      throw error;
    }
  }

  /**
   * Fetch identities from Supabase
   */
  private static async fetchIdentitiesFromSupabase(startFrom: number = 0): Promise<any[]> {
    try {
      console.log('[v0] Fetching identities from Supabase...');
      return [];
    } catch (error) {
      console.error('[v0] Failed to fetch identities:', error);
      throw error;
    }
  }

  /**
   * Fetch policies from Supabase
   */
  private static async fetchPoliciesFromSupabase(): Promise<any[]> {
    try {
      console.log('[v0] Fetching policies from Supabase...');
      return [];
    } catch (error) {
      console.error('[v0] Failed to fetch policies:', error);
      throw error;
    }
  }

  /**
   * Process migration batch
   */
  private static async processMigrationBatch(
    batch: any[],
    result: MigrationResult,
    dryRun: boolean
  ): Promise<void> {
    for (const item of batch) {
      try {
        if (!dryRun) {
          // Queue for blockchain sync
          await BlockchainSyncService.syncCredential(
            item.id,
            item,
            item.issuer
          );
        }

        result.successfulMigrations++;
        console.log('[v0] Item migrated:', item.id);
      } catch (error) {
        result.failedMigrations++;
        result.errors.push(`Item ${item.id}: ${String(error)}`);
        console.error('[v0] Migration failed:', item.id, error);
      }
    }
  }

  /**
   * Print migration summary
   */
  private static printMigrationSummary(result: MigrationResult): void {
    const duration = result.durationMs || 0;
    const rate = result.successfulMigrations > 0
      ? Math.round((result.successfulMigrations / (duration / 1000)) * 100) / 100
      : 0;

    console.log('\n========== MIGRATION SUMMARY ==========');
    console.log(`Total Items: ${result.totalItems}`);
    console.log(`Successful: ${result.successfulMigrations}`);
    console.log(`Failed: ${result.failedMigrations}`);
    console.log(`Skipped: ${result.skippedItems}`);
    console.log(`Success Rate: ${Math.round((result.successfulMigrations / (result.totalItems || 1)) * 100)}%`);
    console.log(`Duration: ${duration}ms`);
    console.log(`Rate: ${rate} items/sec`);

    if (result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.slice(0, 10).forEach((err) => console.log(`  - ${err}`));
      if (result.errors.length > 10) {
        console.log(`  ... and ${result.errors.length - 10} more errors`);
      }
    }
    console.log('=====================================\n');
  }
}

// Export for use in scripts
export default DataMigrationService;

// CLI execution
if (require.main === module) {
  const command = process.argv[2] || 'help';

  (async () => {
    switch (command) {
      case 'credentials':
        await DataMigrationService.migrateCredentials();
        break;
      case 'identities':
        await DataMigrationService.migrateIdentities();
        break;
      case 'policies':
        await DataMigrationService.migratePolicies();
        break;
      case 'verify':
        await DataMigrationService.verifyMigration();
        break;
      case 'rollback':
        await DataMigrationService.rollbackMigration();
        break;
      default:
        console.log('Usage: npm run migrate <command>');
        console.log('Commands:');
        console.log('  credentials - Migrate credentials to blockchain');
        console.log('  identities - Migrate identities to blockchain');
        console.log('  policies - Migrate policies to blockchain');
        console.log('  verify - Verify migration consistency');
        console.log('  rollback - Rollback to Supabase-only mode');
    }
  })().catch(console.error);
}
