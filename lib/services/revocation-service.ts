// Revocation Management Service for BADIMAC
import {
  RevocationRecord,
  RevocationRegistry,
  RevocationType,
  RevocationReason,
} from "@/lib/types/did";
import BlockchainService from "@/lib/services/blockchain-service";
import { ethers } from "ethers";

export class RevocationService {
  /**
   * Create a revocation record
   */
  static createRevocationRecord(
    resourceId: string,
    resourceType: RevocationType,
    revocationReason: RevocationReason,
    revokedBy: string,
    metadata?: Record<string, unknown>
  ): RevocationRecord {
    return {
      id: ethers.keccak256(ethers.toUtf8Bytes(`revoke-${resourceId}-${Date.now()}`)),
      resourceId,
      resourceType,
      revocationReason,
      revokedBy,
      revokedAt: new Date(),
      effectiveAt: new Date(),
      metadata,
    };
  }

  /**
   * Revoke a credential on blockchain
   */
  static async revokeCredentialOnChain(
    credentialId: string,
    issuerAddress: string,
    reason: RevocationReason = "user-request"
  ): Promise<RevocationRecord> {
    const credentialHash = ethers.keccak256(ethers.toUtf8Bytes(credentialId));

    // Revoke on blockchain
    const txHash = await BlockchainService.revokeCredentialOnChain(credentialHash, issuerAddress);

    console.log("[v0] Credential revoked on blockchain:", {
      credential: credentialId.slice(0, 16),
      tx: txHash.hash,
    });

    const revocationRecord = this.createRevocationRecord(
      credentialId,
      "credential",
      reason,
      issuerAddress,
      {
        blockchainTxHash: txHash.hash,
        chainId: txHash.chainId,
      }
    );

    revocationRecord.blockchainTxHash = txHash.hash;
    return revocationRecord;
  }

  /**
   * Revoke an identity/DID
   */
  static async revokeIdentity(
    did: string,
    revokedBy: string,
    reason: RevocationReason = "user-request"
  ): Promise<RevocationRecord> {
    const didHash = ethers.keccak256(ethers.toUtf8Bytes(did));

    // Could integrate with DID Registry contract here
    console.log("[v0] Identity revocation initiated:", { did, revokedBy, reason });

    return this.createRevocationRecord(did, "identity", reason, revokedBy, {
      didHash,
      revokedVia: "DIDRegistry",
    });
  }

  /**
   * Revoke user consent
   */
  static revokeConsent(
    consentId: string,
    userId: string,
    reason: RevocationReason = "user-request"
  ): RevocationRecord {
    return this.createRevocationRecord(consentId, "consent", reason, userId, {
      reason: "User revoked data processing consent",
    });
  }

  /**
   * Revoke policy/access control
   */
  static revokePolicy(
    policyId: string,
    revokedBy: string,
    reason: RevocationReason = "authority-decision"
  ): RevocationRecord {
    return this.createRevocationRecord(policyId, "policy", reason, revokedBy, {
      reason: "Access policy revoked",
    });
  }

  /**
   * Check if resource is revoked
   */
  static isResourceRevoked(revocationRegistry: RevocationRegistry, resourceId: string): boolean {
    return revocationRegistry.revokedItems.some(
      (item) => item.resourceId === resourceId && !item.metadata?.restored
    );
  }

  /**
   * Get revocation details
   */
  static getRevocationDetails(
    revocationRegistry: RevocationRegistry,
    resourceId: string
  ): RevocationRecord | null {
    return revocationRegistry.revokedItems.find((item) => item.resourceId === resourceId) || null;
  }

  /**
   * Create or initialize revocation registry
   */
  static createRegistry(issuerId: string, registryAddress?: string): RevocationRegistry {
    return {
      id: ethers.keccak256(ethers.toUtf8Bytes(`registry-${issuerId}-${Date.now()}`)),
      registryAddress,
      revokedItems: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      issuerId,
    };
  }

  /**
   * Add revocation to registry
   */
  static addRevocationToRegistry(
    registry: RevocationRegistry,
    revocationRecord: RevocationRecord
  ): RevocationRegistry {
    return {
      ...registry,
      revokedItems: [...registry.revokedItems, revocationRecord],
      updatedAt: new Date(),
    };
  }

  /**
   * Restore (un-revoke) a resource
   */
  static restoreResource(
    revocationRegistry: RevocationRegistry,
    resourceId: string
  ): RevocationRegistry {
    return {
      ...revocationRegistry,
      revokedItems: revocationRegistry.revokedItems.map((item) =>
        item.resourceId === resourceId ? { ...item, metadata: { ...item.metadata, restored: true } } : item
      ),
      updatedAt: new Date(),
    };
  }

  /**
   * Get revocation statistics
   */
  static getRevocationStats(revocationRegistry: RevocationRegistry) {
    const byType = revocationRegistry.revokedItems.reduce(
      (acc, item) => {
        acc[item.resourceType] = (acc[item.resourceType] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const byReason = revocationRegistry.revokedItems.reduce(
      (acc, item) => {
        acc[item.revocationReason] = (acc[item.revocationReason] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      totalRevocations: revocationRegistry.revokedItems.length,
      byType,
      byReason,
      lastUpdated: revocationRegistry.updatedAt,
    };
  }

  /**
   * Batch check revocation status
   */
  static batchCheckRevocationStatus(
    revocationRegistry: RevocationRegistry,
    resourceIds: string[]
  ): Record<string, boolean> {
    const revokedIds = new Set(
      revocationRegistry.revokedItems.map((item) => item.resourceId)
    );

    return resourceIds.reduce(
      (acc, resourceId) => {
        acc[resourceId] = revokedIds.has(resourceId);
        return acc;
      },
      {} as Record<string, boolean>
    );
  }

  /**
   * Generate revocation audit report
   */
  static generateAuditReport(revocationRegistry: RevocationRegistry) {
    const oldestRevocation = revocationRegistry.revokedItems.reduce(
      (oldest, item) => (item.revokedAt < oldest.revokedAt ? item : oldest),
      revocationRegistry.revokedItems[0]
    );

    const newestRevocation = revocationRegistry.revokedItems.reduce(
      (newest, item) => (item.revokedAt > newest.revokedAt ? item : newest),
      revocationRegistry.revokedItems[0]
    );

    return {
      registryId: revocationRegistry.id,
      issuerId: revocationRegistry.issuerId,
      totalRevocations: revocationRegistry.revokedItems.length,
      oldestRevocation: oldestRevocation?.revokedAt,
      newestRevocation: newestRevocation?.revokedAt,
      stats: this.getRevocationStats(revocationRegistry),
      lastSynced: revocationRegistry.updatedAt,
    };
  }
}

export default RevocationService;
