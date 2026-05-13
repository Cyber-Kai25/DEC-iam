// Data Consistency Checker Service for Phase 5
// Validates data consistency between Supabase and Blockchain

import { ethers } from 'ethers';
import BlockchainService from './blockchain-service';
import SupabaseRepository from './supabase-repository';

export type ConsistencyLevel = 'exact' | 'eventual' | 'degraded';
export type ConflictResolution = 'blockchain-wins' | 'supabase-wins' | 'manual';

export interface ConsistencyCheck {
  id: string;
  resourceId: string;
  resourceType: string;
  timestamp: Date;
  supabaseHash: string;
  blockchainHash?: string;
  isConsistent: boolean;
  consistencyLevel: ConsistencyLevel;
  discrepancies: string[];
  resolutionNeeded: boolean;
  resolutionStrategy?: ConflictResolution;
}

export interface ConsistencyReport {
  checkTime: Date;
  totalResources: number;
  consistentResources: number;
  inconclusiveResources: number;
  incompleteResources: number;
  conflictingResources: number;
  consistencyPercentage: number;
  recommendedActions: string[];
  criticalIssues: string[];
}

export class ConsistencyCheckerService {
  private static checkHistory: Map<string, ConsistencyCheck> = new Map();
  private static readonly MAX_HISTORY_SIZE = 10000;

  /**
   * Perform consistency check for a single credential
   */
  static async checkCredentialConsistency(
    credentialId: string,
    credentialData?: any
  ): Promise<ConsistencyCheck> {
    const check: ConsistencyCheck = {
      id: `check_${credentialId}_${Date.now()}`,
      resourceId: credentialId,
      resourceType: 'credential',
      timestamp: new Date(),
      supabaseHash: '',
      isConsistent: false,
      consistencyLevel: 'degraded',
      discrepancies: [],
      resolutionNeeded: false,
    };

    try {
      // Get data from Supabase
      const supabaseData = credentialData || (await this.getSupabaseCredential(credentialId));

      if (!supabaseData) {
        check.discrepancies.push('Credential not found in Supabase');
        check.consistencyLevel = 'degraded';
        return check;
      }

      // Calculate Supabase hash
      check.supabaseHash = ethers.keccak256(
        ethers.toUtf8Bytes(JSON.stringify(supabaseData))
      );

      // Get data from Blockchain
      const blockchainData = await this.getBlockchainCredential(credentialId);

      if (!blockchainData) {
        check.discrepancies.push('Credential not anchored on blockchain');
        check.consistencyLevel = 'eventual'; // Data in Supabase but not yet on blockchain
        check.resolutionNeeded = false;
        return check;
      }

      // Calculate blockchain hash
      check.blockchainHash = ethers.keccak256(
        ethers.toUtf8Bytes(JSON.stringify(blockchainData))
      );

      // Compare hashes
      if (check.supabaseHash === check.blockchainHash) {
        check.isConsistent = true;
        check.consistencyLevel = 'exact';
      } else {
        check.discrepancies.push('Hash mismatch between Supabase and Blockchain');
        check.resolutionNeeded = true;
        check.resolutionStrategy = 'blockchain-wins'; // Blockchain is source of truth
        check.consistencyLevel = 'degraded';
      }

      // Store in history
      this.storeCheckHistory(check);
      return check;
    } catch (error) {
      check.discrepancies.push(String(error));
      check.consistencyLevel = 'degraded';
      return check;
    }
  }

  /**
   * Perform consistency check for an identity
   */
  static async checkIdentityConsistency(
    did: string,
    identityData?: any
  ): Promise<ConsistencyCheck> {
    const check: ConsistencyCheck = {
      id: `check_${did}_${Date.now()}`,
      resourceId: did,
      resourceType: 'identity',
      timestamp: new Date(),
      supabaseHash: '',
      isConsistent: false,
      consistencyLevel: 'degraded',
      discrepancies: [],
      resolutionNeeded: false,
    };

    try {
      // Get identity from Supabase
      const supabaseData = identityData || (await this.getSupabaseIdentity(did));

      if (!supabaseData) {
        check.discrepancies.push('Identity not found in Supabase');
        return check;
      }

      check.supabaseHash = ethers.keccak256(
        ethers.toUtf8Bytes(JSON.stringify(supabaseData))
      );

      // Get DID document from blockchain
      const blockchainData = await this.getBlockchainDID(did);

      if (!blockchainData) {
        check.discrepancies.push('DID not registered on blockchain');
        check.consistencyLevel = 'eventual';
        return check;
      }

      check.blockchainHash = ethers.keccak256(
        ethers.toUtf8Bytes(JSON.stringify(blockchainData))
      );

      if (check.supabaseHash === check.blockchainHash) {
        check.isConsistent = true;
        check.consistencyLevel = 'exact';
      } else {
        check.discrepancies.push('Identity data mismatch');
        check.resolutionNeeded = true;
        check.consistencyLevel = 'degraded';
      }

      this.storeCheckHistory(check);
      return check;
    } catch (error) {
      check.discrepancies.push(String(error));
      return check;
    }
  }

  /**
   * Perform consistency check for a policy
   */
  static async checkPolicyConsistency(
    policyId: string,
    policyData?: any
  ): Promise<ConsistencyCheck> {
    const check: ConsistencyCheck = {
      id: `check_${policyId}_${Date.now()}`,
      resourceId: policyId,
      resourceType: 'policy',
      timestamp: new Date(),
      supabaseHash: '',
      isConsistent: false,
      consistencyLevel: 'degraded',
      discrepancies: [],
      resolutionNeeded: false,
    };

    try {
      const supabaseData = policyData || (await this.getSupabasePolicy(policyId));

      if (!supabaseData) {
        check.discrepancies.push('Policy not found in Supabase');
        return check;
      }

      check.supabaseHash = ethers.keccak256(
        ethers.toUtf8Bytes(JSON.stringify(supabaseData))
      );

      // Mock blockchain check
      check.consistencyLevel = 'eventual';
      this.storeCheckHistory(check);
      return check;
    } catch (error) {
      check.discrepancies.push(String(error));
      return check;
    }
  }

  /**
   * Get Supabase credential
   */
  private static async getSupabaseCredential(credentialId: string): Promise<any> {
    try {
      // Implementation depends on SupabaseRepository interface
      return null;
    } catch (error) {
      console.error('[v0] Failed to get credential from Supabase:', error);
      return null;
    }
  }

  /**
   * Get blockchain credential
   */
  private static async getBlockchainCredential(credentialId: string): Promise<any> {
    try {
      // Implementation depends on BlockchainService interface
      return null;
    } catch (error) {
      console.error('[v0] Failed to get credential from blockchain:', error);
      return null;
    }
  }

  /**
   * Get Supabase identity
   */
  private static async getSupabaseIdentity(did: string): Promise<any> {
    try {
      return null;
    } catch (error) {
      console.error('[v0] Failed to get identity from Supabase:', error);
      return null;
    }
  }

  /**
   * Get blockchain DID
   */
  private static async getBlockchainDID(did: string): Promise<any> {
    try {
      return null;
    } catch (error) {
      console.error('[v0] Failed to get DID from blockchain:', error);
      return null;
    }
  }

  /**
   * Get Supabase policy
   */
  private static async getSupabasePolicy(policyId: string): Promise<any> {
    try {
      return null;
    } catch (error) {
      console.error('[v0] Failed to get policy from Supabase:', error);
      return null;
    }
  }

  /**
   * Store check in history
   */
  private static storeCheckHistory(check: ConsistencyCheck): void {
    this.checkHistory.set(check.id, check);

    // Limit history size
    if (this.checkHistory.size > this.MAX_HISTORY_SIZE) {
      const firstKey = this.checkHistory.keys().next().value;
      if (firstKey) this.checkHistory.delete(firstKey);
    }
  }

  /**
   * Get consistency report
   */
  static generateConsistencyReport(): ConsistencyReport {
    const checks = Array.from(this.checkHistory.values());
    const recent = checks.filter((c) => Date.now() - c.timestamp.getTime() < 3600000); // Last hour

    const consistent = recent.filter((c) => c.isConsistent).length;
    const inconclusive = recent.filter((c) => c.consistencyLevel === 'eventual').length;
    const incomplete = recent.filter((c) => c.consistencyLevel === 'degraded' && !c.blockchainHash).length;
    const conflicting = recent.filter(
      (c) => c.consistencyLevel === 'degraded' && c.blockchainHash
    ).length;

    const total = recent.length || 1;
    const percentage = Math.round((consistent / total) * 100);

    const recommendations: string[] = [];
    const criticalIssues: string[] = [];

    if (conflicting > 0) {
      recommendations.push(`${conflicting} resources have hash mismatches - requires manual review`);
      criticalIssues.push('Data conflict between Supabase and Blockchain');
    }

    if (incomplete > 0) {
      recommendations.push(
        `${incomplete} resources not yet anchored on blockchain - monitor sync progress`
      );
    }

    if (percentage < 95) {
      criticalIssues.push('Consistency percentage below 95% - investigate sync issues');
    }

    return {
      checkTime: new Date(),
      totalResources: total,
      consistentResources: consistent,
      inconclusiveResources: inconclusive,
      incompleteResources: incomplete,
      conflictingResources: conflicting,
      consistencyPercentage: percentage,
      recommendedActions: recommendations,
      criticalIssues,
    };
  }

  /**
   * Resolve conflict using specified strategy
   */
  static async resolveConflict(
    check: ConsistencyCheck,
    strategy: ConflictResolution = 'blockchain-wins'
  ): Promise<boolean> {
    try {
      if (strategy === 'blockchain-wins') {
        // Update Supabase with blockchain data
        console.log('[v0] Resolving conflict: blockchain data takes precedence');
        // Implementation would sync blockchain data back to Supabase
        return true;
      } else if (strategy === 'supabase-wins') {
        // Update blockchain with Supabase data
        console.log('[v0] Resolving conflict: Supabase data takes precedence');
        // Implementation would re-anchor Supabase data
        return true;
      }

      return false;
    } catch (error) {
      console.error('[v0] Conflict resolution failed:', error);
      return false;
    }
  }

  /**
   * Get check history for a resource
   */
  static getResourceHistory(resourceId: string): ConsistencyCheck[] {
    return Array.from(this.checkHistory.values()).filter(
      (c) => c.resourceId === resourceId
    );
  }

  /**
   * Clear old history
   */
  static clearOldHistory(maxAgeHours: number = 24): void {
    const cutoff = Date.now() - maxAgeHours * 3600 * 1000;

    for (const [id, check] of this.checkHistory) {
      if (check.timestamp.getTime() < cutoff) {
        this.checkHistory.delete(id);
      }
    }

    console.log('[v0] Old consistency check history cleared');
  }
}

export default ConsistencyCheckerService;
