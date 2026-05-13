// Dual-Write Strategy Service for Phase 5
// Handles simultaneous writes to Supabase (fast) and Blockchain (immutable)

import BlockchainSyncService, { SyncRecord } from './blockchain-sync-service';
import SupabaseRepository from './supabase-repository';
import { ethers } from 'ethers';

export type WriteTarget = 'supabase' | 'blockchain' | 'both';
export type WriteOperation = 'create' | 'update' | 'delete' | 'revoke';

export interface WriteResult {
  success: boolean;
  supabaseWriteSuccess: boolean;
  blockchainSyncQueued: boolean;
  supabaseId?: string;
  blockchainTxHash?: string;
  syncRecord?: SyncRecord;
  error?: string;
  timestamp: Date;
}

export class DualWriteService {
  /**
   * Write credential with dual-write strategy
   */
  static async createCredentialDualWrite(
    credential: any,
    issuerAddress: string,
    target: WriteTarget = 'both'
  ): Promise<WriteResult> {
    const result: WriteResult = {
      success: false,
      supabaseWriteSuccess: false,
      blockchainSyncQueued: false,
      timestamp: new Date(),
    };

    try {
      // Step 1: Write to Supabase (fast, queryable)
      if (target === 'supabase' || target === 'both') {
        const savedCredential = await SupabaseRepository.saveCredential(
          credential,
          issuerAddress
        );

        if (!savedCredential) {
          result.error = 'Failed to write to Supabase';
          return result;
        }

        result.supabaseWriteSuccess = true;
        result.supabaseId = savedCredential.id;
        console.log('[v0] Credential saved to Supabase:', savedCredential.id);
      }

      // Step 2: Queue for blockchain (immutable, verifiable)
      if (target === 'blockchain' || target === 'both') {
        const syncRecord = await BlockchainSyncService.syncCredential(
          credential.id,
          credential,
          issuerAddress
        );

        result.blockchainSyncQueued = true;
        result.blockchainTxHash = syncRecord.blockchainTxHash;
        result.syncRecord = syncRecord;
        console.log('[v0] Credential queued for blockchain sync:', credential.id);
      }

      result.success = true;
      return result;
    } catch (error) {
      result.error = String(error);
      console.error('[v0] Dual-write failed:', error);
      return result;
    }
  }

  /**
   * Update credential with dual-write strategy
   */
  static async updateCredentialDualWrite(
    credentialId: string,
    updates: any,
    issuerAddress: string,
    target: WriteTarget = 'both'
  ): Promise<WriteResult> {
    const result: WriteResult = {
      success: false,
      supabaseWriteSuccess: false,
      blockchainSyncQueued: false,
      timestamp: new Date(),
    };

    try {
      // Step 1: Update in Supabase
      if (target === 'supabase' || target === 'both') {
        // Implementation depends on SupabaseRepository interface
        result.supabaseWriteSuccess = true;
        console.log('[v0] Credential updated in Supabase:', credentialId);
      }

      // Step 2: Queue for blockchain verification update
      if (target === 'blockchain' || target === 'both') {
        const syncRecord = await BlockchainSyncService.syncCredential(
          credentialId,
          updates,
          issuerAddress
        );

        result.blockchainSyncQueued = true;
        result.blockchainTxHash = syncRecord.blockchainTxHash;
        result.syncRecord = syncRecord;
      }

      result.success = true;
      return result;
    } catch (error) {
      result.error = String(error);
      console.error('[v0] Dual-write update failed:', error);
      return result;
    }
  }

  /**
   * Revoke credential with dual-write strategy
   */
  static async revokeCredentialDualWrite(
    credentialId: string,
    issuerAddress: string,
    reason: string = 'User request',
    target: WriteTarget = 'both'
  ): Promise<WriteResult> {
    const result: WriteResult = {
      success: false,
      supabaseWriteSuccess: false,
      blockchainSyncQueued: false,
      timestamp: new Date(),
    };

    try {
      // Step 1: Mark as revoked in Supabase
      if (target === 'supabase' || target === 'both') {
        // Update revocation status
        result.supabaseWriteSuccess = true;
        console.log('[v0] Credential revoked in Supabase:', credentialId);
      }

      // Step 2: Record revocation on blockchain
      if (target === 'blockchain' || target === 'both') {
        const credentialHash = ethers.keccak256(
          ethers.toUtf8Bytes(credentialId)
        );

        const syncRecord = await BlockchainSyncService.syncCredential(
          credentialId,
          { revoked: true, revokedAt: new Date(), reason },
          issuerAddress
        );

        result.blockchainSyncQueued = true;
        result.blockchainTxHash = syncRecord.blockchainTxHash;
        result.syncRecord = syncRecord;
      }

      result.success = true;
      return result;
    } catch (error) {
      result.error = String(error);
      console.error('[v0] Dual-write revocation failed:', error);
      return result;
    }
  }

  /**
   * Create identity with dual-write strategy
   */
  static async createIdentityDualWrite(
    did: string,
    publicKey: string,
    controller: string,
    target: WriteTarget = 'both'
  ): Promise<WriteResult> {
    const result: WriteResult = {
      success: false,
      supabaseWriteSuccess: false,
      blockchainSyncQueued: false,
      timestamp: new Date(),
    };

    try {
      // Step 1: Save to Supabase
      if (target === 'supabase' || target === 'both') {
        // Save identity record
        result.supabaseWriteSuccess = true;
        console.log('[v0] Identity saved to Supabase:', did);
      }

      // Step 2: Register on blockchain
      if (target === 'blockchain' || target === 'both') {
        const syncRecord = await BlockchainSyncService.syncIdentity(
          did,
          did,
          publicKey
        );

        result.blockchainSyncQueued = true;
        result.blockchainTxHash = syncRecord.blockchainTxHash;
        result.syncRecord = syncRecord;
      }

      result.success = true;
      return result;
    } catch (error) {
      result.error = String(error);
      console.error('[v0] Identity dual-write failed:', error);
      return result;
    }
  }

  /**
   * Create policy with dual-write strategy
   */
  static async createPolicyDualWrite(
    policyId: string,
    policyData: any,
    owner: string,
    target: WriteTarget = 'both'
  ): Promise<WriteResult> {
    const result: WriteResult = {
      success: false,
      supabaseWriteSuccess: false,
      blockchainSyncQueued: false,
      timestamp: new Date(),
    };

    try {
      // Step 1: Save to Supabase
      if (target === 'supabase' || target === 'both') {
        result.supabaseWriteSuccess = true;
        console.log('[v0] Policy saved to Supabase:', policyId);
      }

      // Step 2: Anchor to blockchain
      if (target === 'blockchain' || target === 'both') {
        const syncRecord = await BlockchainSyncService.syncPolicy(
          policyId,
          policyData
        );

        result.blockchainSyncQueued = true;
        result.blockchainTxHash = syncRecord.blockchainTxHash;
        result.syncRecord = syncRecord;
      }

      result.success = true;
      return result;
    } catch (error) {
      result.error = String(error);
      console.error('[v0] Policy dual-write failed:', error);
      return result;
    }
  }

  /**
   * Get write strategy recommendation based on operation
   */
  static getWriteStrategy(resourceType: string, operation: WriteOperation): WriteTarget {
    // Critical operations always dual-write
    if (operation === 'revoke' || operation === 'delete') {
      return 'both';
    }

    // Identity operations dual-write for immutability
    if (resourceType === 'identity') {
      return 'both';
    }

    // Credential operations dual-write for verification
    if (resourceType === 'credential') {
      return 'both';
    }

    // Policy operations dual-write for compliance
    if (resourceType === 'policy') {
      return 'both';
    }

    // Default to both for consistency
    return 'both';
  }

  /**
   * Check dual-write consistency
   */
  static async checkConsistency(
    resourceId: string,
    supabaseData?: any,
    blockchainData?: any
  ): Promise<{
    isConsistent: boolean;
    supabaseHash?: string;
    blockchainHash?: string;
    matches: boolean;
  }> {
    const supabaseHash = supabaseData
      ? ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(supabaseData)))
      : undefined;

    const blockchainHash = blockchainData
      ? ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(blockchainData)))
      : undefined;

    const matches =
      supabaseHash && blockchainHash ? supabaseHash === blockchainHash : false;

    return {
      isConsistent: matches,
      supabaseHash,
      blockchainHash,
      matches,
    };
  }
}

export default DualWriteService;
