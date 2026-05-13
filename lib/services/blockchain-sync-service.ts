// Blockchain Data Sync Service for Phase 5
// Handles dual-write pattern: Supabase (fast) + Blockchain (immutable)

import BlockchainService from '@/lib/services/blockchain-service';
import SupabaseRepository from '@/lib/services/supabase-repository';
import { ethers } from 'ethers';

export type SyncResource = 'credential' | 'identity' | 'policy' | 'consent';
export type SyncStatus = 'pending' | 'synced' | 'failed' | 'conflict';

export interface SyncRecord {
  id: string;
  resourceId: string;
  resourceType: SyncResource;
  supabaseHash: string;
  blockchainHash?: string;
  blockchainTxHash?: string;
  status: SyncStatus;
  createdAt: Date;
  syncedAt?: Date;
  failureReason?: string;
  retryCount: number;
  metadata?: Record<string, unknown>;
}

export class BlockchainSyncService {
  private static syncQueue: Map<string, SyncRecord> = new Map();
  private static syncInterval: NodeJS.Timeout | null = null;
  private static readonly MAX_RETRIES = 3;
  private static readonly SYNC_INTERVAL_MS = 5000; // 5 seconds

  /**
   * Initialize sync service and start polling
   */
  static async initialize(): Promise<void> {
    console.log('[v0] Initializing blockchain sync service');
    await BlockchainService.initializeProvider();
    this.startSyncWorker();
  }

  /**
   * Queue credential for blockchain sync
   */
  static async syncCredential(
    credentialId: string,
    credentialData: any,
    issuerAddress: string
  ): Promise<SyncRecord> {
    const credentialHash = ethers.keccak256(
      ethers.toUtf8Bytes(JSON.stringify(credentialData))
    );

    const syncRecord: SyncRecord = {
      id: `sync_${credentialId}_${Date.now()}`,
      resourceId: credentialId,
      resourceType: 'credential',
      supabaseHash: credentialHash,
      status: 'pending',
      createdAt: new Date(),
      retryCount: 0,
      metadata: { issuer: issuerAddress },
    };

    this.syncQueue.set(syncRecord.id, syncRecord);
    console.log('[v0] Credential queued for blockchain sync:', credentialId);

    // Attempt immediate sync
    await this.processSyncRecord(syncRecord);
    return syncRecord;
  }

  /**
   * Queue identity for blockchain sync
   */
  static async syncIdentity(
    identityId: string,
    did: string,
    publicKey: string
  ): Promise<SyncRecord> {
    const syncRecord: SyncRecord = {
      id: `sync_identity_${identityId}_${Date.now()}`,
      resourceId: identityId,
      resourceType: 'identity',
      supabaseHash: ethers.keccak256(ethers.toUtf8Bytes(did)),
      status: 'pending',
      createdAt: new Date(),
      retryCount: 0,
      metadata: { did, publicKey },
    };

    this.syncQueue.set(syncRecord.id, syncRecord);
    console.log('[v0] Identity queued for blockchain sync:', did);

    await this.processSyncRecord(syncRecord);
    return syncRecord;
  }

  /**
   * Queue policy for blockchain sync
   */
  static async syncPolicy(
    policyId: string,
    policyData: any
  ): Promise<SyncRecord> {
    const policyHash = ethers.keccak256(
      ethers.toUtf8Bytes(JSON.stringify(policyData))
    );

    const syncRecord: SyncRecord = {
      id: `sync_policy_${policyId}_${Date.now()}`,
      resourceId: policyId,
      resourceType: 'policy',
      supabaseHash: policyHash,
      status: 'pending',
      createdAt: new Date(),
      retryCount: 0,
    };

    this.syncQueue.set(syncRecord.id, syncRecord);
    console.log('[v0] Policy queued for blockchain sync:', policyId);

    await this.processSyncRecord(syncRecord);
    return syncRecord;
  }

  /**
   * Get sync status for a resource
   */
  static getSyncStatus(resourceId: string): SyncRecord | undefined {
    for (const record of this.syncQueue.values()) {
      if (record.resourceId === resourceId) {
        return record;
      }
    }
    return undefined;
  }

  /**
   * Process individual sync record
   */
  private static async processSyncRecord(record: SyncRecord): Promise<void> {
    if (record.retryCount >= this.MAX_RETRIES) {
      record.status = 'failed';
      record.failureReason = 'Max retries exceeded';
      console.warn('[v0] Sync failed after max retries:', record.resourceId);
      return;
    }

    try {
      switch (record.resourceType) {
        case 'credential':
          await this.syncCredentialToBlockchain(record);
          break;
        case 'identity':
          await this.syncIdentityToBlockchain(record);
          break;
        case 'policy':
          await this.syncPolicyToBlockchain(record);
          break;
        case 'consent':
          await this.syncConsentToBlockchain(record);
          break;
      }

      record.status = 'synced';
      record.syncedAt = new Date();
      console.log('[v0] Sync completed:', {
        resourceId: record.resourceId,
        txHash: record.blockchainTxHash,
      });
    } catch (error) {
      record.retryCount++;
      record.failureReason = String(error);
      console.warn('[v0] Sync failed (will retry):', {
        resourceId: record.resourceId,
        attempt: record.retryCount,
        error: String(error),
      });
    }
  }

  /**
   * Sync credential to blockchain
   */
  private static async syncCredentialToBlockchain(
    record: SyncRecord
  ): Promise<void> {
    const issuer = record.metadata?.issuer as string;
    if (!issuer) {
      throw new Error('Issuer address required for credential sync');
    }

    const tx = await BlockchainService.issueCredentialOnChain(
      record.supabaseHash,
      issuer,
      issuer,
      365
    );

    record.blockchainHash = record.supabaseHash;
    record.blockchainTxHash = tx.hash;
  }

  /**
   * Sync identity to blockchain
   */
  private static async syncIdentityToBlockchain(
    record: SyncRecord
  ): Promise<void> {
    const { did, publicKey } = record.metadata as {
      did: string;
      publicKey: string;
    };

    const tx = await BlockchainService.registerDID(
      did,
      publicKey,
      'user' // Mock controller
    );

    record.blockchainTxHash = tx.hash;
  }

  /**
   * Sync policy to blockchain
   */
  private static async syncPolicyToBlockchain(
    record: SyncRecord
  ): Promise<void> {
    // Mock policy sync
    record.blockchainHash = record.supabaseHash;
    record.blockchainTxHash = ethers.id(`policy-${record.resourceId}`);
  }

  /**
   * Sync consent to blockchain
   */
  private static async syncConsentToBlockchain(
    record: SyncRecord
  ): Promise<void> {
    // Mock consent sync
    record.blockchainHash = record.supabaseHash;
    record.blockchainTxHash = ethers.id(`consent-${record.resourceId}`);
  }

  /**
   * Start background sync worker
   */
  private static startSyncWorker(): void {
    this.syncInterval = setInterval(async () => {
      const pendingRecords = Array.from(this.syncQueue.values()).filter(
        (r) => r.status === 'pending'
      );

      for (const record of pendingRecords) {
        await this.processSyncRecord(record);
      }
    }, this.SYNC_INTERVAL_MS);

    console.log('[v0] Blockchain sync worker started');
  }

  /**
   * Stop sync worker
   */
  static stopSyncWorker(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('[v0] Blockchain sync worker stopped');
    }
  }

  /**
   * Get all pending syncs
   */
  static getPendingSyncs(): SyncRecord[] {
    return Array.from(this.syncQueue.values()).filter(
      (r) => r.status === 'pending'
    );
  }

  /**
   * Get sync statistics
   */
  static getSyncStats(): {
    total: number;
    synced: number;
    pending: number;
    failed: number;
  } {
    const records = Array.from(this.syncQueue.values());
    return {
      total: records.length,
      synced: records.filter((r) => r.status === 'synced').length,
      pending: records.filter((r) => r.status === 'pending').length,
      failed: records.filter((r) => r.status === 'failed').length,
    };
  }
}

export default BlockchainSyncService;
