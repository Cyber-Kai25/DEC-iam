// Comprehensive Consent Management Service for BADIMAC
import {
  ConsentRecord,
  ConsentAuditEntry,
  ConsentStatus,
  ConsentType,
  AccessControlPolicy,
} from "@/lib/types/did";
import { ethers } from "ethers";

export class ConsentManagementService {
  /**
   * Create a new consent record
   */
  static createConsentRecord(
    userId: string,
    dataControllerDid: string,
    consentType: ConsentType,
    description: string,
    scope: string[],
    purposes: string[],
    expirationDays: number = 365
  ): ConsentRecord {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expirationDays);

    const auditEntry: ConsentAuditEntry = {
      id: ethers.keccak256(ethers.toUtf8Bytes(`consent-${Date.now()}`)),
      timestamp: new Date(),
      action: "created",
      actor: userId,
      metadata: {
        consentType,
        scope: scope.join(","),
        purposes: purposes.join(","),
      },
    };

    return {
      id: ethers.keccak256(ethers.toUtf8Bytes(`${userId}-${dataControllerDid}-${Date.now()}`)),
      userId,
      dataControllerDid,
      consentType,
      description,
      status: "pending",
      scope,
      purposes,
      expiresAt,
      auditLog: [auditEntry],
    };
  }

  /**
   * Grant consent (user explicitly approves)
   */
  static grantConsent(consentRecord: ConsentRecord): ConsentRecord {
    const auditEntry: ConsentAuditEntry = {
      id: ethers.keccak256(ethers.toUtf8Bytes(`audit-${Date.now()}`)),
      timestamp: new Date(),
      action: "granted",
      actor: consentRecord.userId,
      reason: "User explicitly granted consent",
    };

    return {
      ...consentRecord,
      status: "granted",
      grantedAt: new Date(),
      auditLog: [...consentRecord.auditLog, auditEntry],
    };
  }

  /**
   * Deny consent (user rejects)
   */
  static denyConsent(consentRecord: ConsentRecord, reason?: string): ConsentRecord {
    const auditEntry: ConsentAuditEntry = {
      id: ethers.keccak256(ethers.toUtf8Bytes(`audit-${Date.now()}`)),
      timestamp: new Date(),
      action: "denied",
      actor: consentRecord.userId,
      reason: reason || "User explicitly denied consent",
    };

    return {
      ...consentRecord,
      status: "denied",
      auditLog: [...consentRecord.auditLog, auditEntry],
    };
  }

  /**
   * Revoke previously granted consent
   */
  static revokeConsent(consentRecord: ConsentRecord, reason?: string): ConsentRecord {
    if (consentRecord.status !== "granted") {
      throw new Error("Can only revoke granted consent");
    }

    const auditEntry: ConsentAuditEntry = {
      id: ethers.keccak256(ethers.toUtf8Bytes(`audit-${Date.now()}`)),
      timestamp: new Date(),
      action: "revoked",
      actor: consentRecord.userId,
      reason: reason || "User revoked consent",
    };

    return {
      ...consentRecord,
      status: "revoked",
      revokedAt: new Date(),
      auditLog: [...consentRecord.auditLog, auditEntry],
    };
  }

  /**
   * Check if consent is valid and active
   */
  static isConsentActive(consentRecord: ConsentRecord): boolean {
    if (consentRecord.status !== "granted") {
      return false;
    }

    if (consentRecord.expiresAt && new Date() > consentRecord.expiresAt) {
      return false;
    }

    if (consentRecord.revokedAt) {
      return false;
    }

    return true;
  }

  /**
   * Check if consent covers a specific scope item
   */
  static consentCoversScope(
    consentRecord: ConsentRecord,
    scopeItem: string
  ): boolean {
    return consentRecord.scope.includes(scopeItem);
  }

  /**
   * Check if consent covers all required scopes
   */
  static consentCoversAllScopes(
    consentRecord: ConsentRecord,
    requiredScopes: string[]
  ): boolean {
    return requiredScopes.every((scope) => consentRecord.scope.includes(scope));
  }

  /**
   * Update consent scope (add/remove attributes)
   */
  static updateConsentScope(
    consentRecord: ConsentRecord,
    newScope: string[]
  ): ConsentRecord {
    const auditEntry: ConsentAuditEntry = {
      id: ethers.keccak256(ethers.toUtf8Bytes(`audit-${Date.now()}`)),
      timestamp: new Date(),
      action: "accessed",
      actor: consentRecord.userId,
      metadata: {
        oldScope: consentRecord.scope.join(","),
        newScope: newScope.join(","),
      },
    };

    return {
      ...consentRecord,
      scope: newScope,
      auditLog: [...consentRecord.auditLog, auditEntry],
    };
  }

  /**
   * Extend consent expiration
   */
  static extendConsent(
    consentRecord: ConsentRecord,
    additionalDays: number
  ): ConsentRecord {
    const newExpiresAt = new Date(consentRecord.expiresAt);
    newExpiresAt.setDate(newExpiresAt.getDate() + additionalDays);

    const auditEntry: ConsentAuditEntry = {
      id: ethers.keccak256(ethers.toUtf8Bytes(`audit-${Date.now()}`)),
      timestamp: new Date(),
      action: "accessed",
      actor: consentRecord.userId,
      metadata: {
        additionalDays,
        newExpiresAt: newExpiresAt.toISOString(),
      },
    };

    return {
      ...consentRecord,
      expiresAt: newExpiresAt,
      auditLog: [...consentRecord.auditLog, auditEntry],
    };
  }

  /**
   * Generate consent report for user
   */
  static generateConsentReport(consentRecord: ConsentRecord): {
    summary: string;
    status: string;
    scopeCoverage: string[];
    purposes: string[];
    history: ConsentAuditEntry[];
    expiresIn: number;
  } {
    const expiresIn = Math.max(
      0,
      Math.floor((consentRecord.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    );

    const summary = `Consent to ${consentRecord.consentType} with ${consentRecord.scope.length} scopes`;

    return {
      summary,
      status: consentRecord.status,
      scopeCoverage: consentRecord.scope,
      purposes: consentRecord.purposes,
      history: consentRecord.auditLog,
      expiresIn,
    };
  }

  /**
   * Validate consent against policy requirements
   */
  static validateConsentAgainstPolicy(
    consentRecord: ConsentRecord,
    policy: AccessControlPolicy
  ): {
    valid: boolean;
    missing: string[];
    message: string;
  } {
    if (!consentRecord || consentRecord.status !== "granted") {
      return {
        valid: false,
        missing: ["consent"],
        message: "No active consent found",
      };
    }

    if (new Date() > consentRecord.expiresAt) {
      return {
        valid: false,
        missing: ["expiration"],
        message: "Consent has expired",
      };
    }

    // Check if consent covers the policy requirements
    const requiredScopes = policy.requiresConsent ? ["data-access"] : [];
    const missing = requiredScopes.filter((scope) => !consentRecord.scope.includes(scope));

    if (missing.length > 0) {
      return {
        valid: false,
        missing,
        message: `Consent missing required scopes: ${missing.join(", ")}`,
      };
    }

    return {
      valid: true,
      missing: [],
      message: "Consent is valid and covers all requirements",
    };
  }

  /**
   * Mark consent as accessed (for audit)
   */
  static recordConsentAccess(
    consentRecord: ConsentRecord,
    accessor: string
  ): ConsentRecord {
    const auditEntry: ConsentAuditEntry = {
      id: ethers.keccak256(ethers.toUtf8Bytes(`audit-${Date.now()}`)),
      timestamp: new Date(),
      action: "accessed",
      actor: accessor,
      metadata: {
        reason: "Consent was accessed for data processing",
      },
    };

    return {
      ...consentRecord,
      auditLog: [...consentRecord.auditLog, auditEntry],
    };
  }

  /**
   * Get consent statistics
   */
  static getConsentStats(consentRecord: ConsentRecord) {
    return {
      id: consentRecord.id,
      status: consentRecord.status,
      createdAt: consentRecord.auditLog[0]?.timestamp,
      grantedAt: consentRecord.grantedAt,
      expiresAt: consentRecord.expiresAt,
      totalAuditEntries: consentRecord.auditLog.length,
      accesses: consentRecord.auditLog.filter((e) => e.action === "accessed").length,
      scopeCount: consentRecord.scope.length,
    };
  }
}

export default ConsentManagementService;
