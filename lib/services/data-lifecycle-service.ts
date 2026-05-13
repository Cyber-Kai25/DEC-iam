// Data Lifecycle Management Service for BADIMAC
import {
  DataLifecycleEvent,
  DataRetention,
  DataLifecycleStage,
  DataRetentionPolicy,
} from "@/lib/types/did";
import { ethers } from "ethers";

export class DataLifecycleService {
  /**
   * Create data retention policy
   */
  static createRetentionPolicy(
    resourceId: string,
    resourceType: string,
    retentionPolicy: DataRetentionPolicy,
    retentionPeriodDays?: number
  ): DataRetention {
    const now = new Date();
    let willExpireAt: Date | undefined;
    let autoDeleteAt: Date | undefined;

    if (retentionPeriodDays) {
      willExpireAt = new Date(now.getTime() + retentionPeriodDays * 24 * 60 * 60 * 1000);
      autoDeleteAt = new Date(willExpireAt.getTime() + 7 * 24 * 60 * 60 * 1000); // 7-day grace period
    }

    return {
      id: ethers.keccak256(ethers.toUtf8Bytes(`retention-${resourceId}-${Date.now()}`)),
      resourceId,
      resourceType,
      retentionPolicy,
      retentionPeriodDays,
      createdAt: now,
      willExpireAt,
      autoDeleteAt,
    };
  }

  /**
   * Record a lifecycle event
   */
  static recordLifecycleEvent(
    credentialId: string,
    stage: DataLifecycleStage,
    actor: string,
    action: string,
    metadata?: Record<string, unknown>
  ): DataLifecycleEvent {
    return {
      id: ethers.keccak256(ethers.toUtf8Bytes(`lifecycle-${credentialId}-${Date.now()}`)),
      credentialId,
      stage,
      timestamp: new Date(),
      actor,
      action,
      metadata,
    };
  }

  /**
   * Track credential collection
   */
  static recordCollection(
    credentialId: string,
    collectedBy: string,
    collectionMethod: string,
    userConsent: boolean
  ): DataLifecycleEvent {
    return this.recordLifecycleEvent(credentialId, "collection", collectedBy, "credential-collected", {
      collectionMethod,
      userConsent,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Track credential processing
   */
  static recordProcessing(
    credentialId: string,
    processedBy: string,
    processingType: string,
    dataUsed: string[]
  ): DataLifecycleEvent {
    return this.recordLifecycleEvent(credentialId, "processing", processedBy, "credential-processed", {
      processingType,
      dataUsed,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Track credential storage
   */
  static recordStorage(
    credentialId: string,
    storedBy: string,
    storageLocation: string,
    encrypted: boolean
  ): DataLifecycleEvent {
    return this.recordLifecycleEvent(credentialId, "storage", storedBy, "credential-stored", {
      storageLocation,
      encrypted,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Track credential sharing/disclosure
   */
  static recordSharing(
    credentialId: string,
    sharedBy: string,
    sharedWith: string,
    purpose: string,
    consentReceived: boolean
  ): DataLifecycleEvent {
    return this.recordLifecycleEvent(credentialId, "sharing", sharedBy, "credential-shared", {
      sharedWith,
      purpose,
      consentReceived,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Track credential deletion
   */
  static recordDeletion(
    credentialId: string,
    deletedBy: string,
    deletionReason: string,
    permanent: boolean
  ): DataLifecycleEvent {
    return this.recordLifecycleEvent(credentialId, "deletion", deletedBy, "credential-deleted", {
      deletionReason,
      permanent,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Check if credential should be auto-deleted
   */
  static shouldAutoDelete(retention: DataRetention): boolean {
    if (!retention.autoDeleteAt) {
      return false;
    }
    return new Date() > retention.autoDeleteAt;
  }

  /**
   * Check if credential retention period is expiring soon
   */
  static isExpiringBrief(retention: DataRetention, warningDays: number = 30): boolean {
    if (!retention.willExpireAt) {
      return false;
    }

    const now = new Date();
    const warningDate = new Date(now.getTime() + warningDays * 24 * 60 * 60 * 1000);
    return retention.willExpireAt <= warningDate && retention.willExpireAt > now;
  }

  /**
   * Get days remaining before auto-deletion
   */
  static getDaysUntilDeletion(retention: DataRetention): number {
    if (!retention.autoDeleteAt) {
      return -1;
    }

    const now = new Date();
    const daysRemaining = Math.floor((retention.autoDeleteAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, daysRemaining);
  }

  /**
   * Extend data retention
   */
  static extendRetention(
    retention: DataRetention,
    additionalDays: number
  ): DataRetention {
    if (!retention.willExpireAt) {
      const newWillExpireAt = new Date();
      newWillExpireAt.setDate(newWillExpireAt.getDate() + additionalDays);
      return {
        ...retention,
        willExpireAt: newWillExpireAt,
        autoDeleteAt: new Date(newWillExpireAt.getTime() + 7 * 24 * 60 * 60 * 1000),
      };
    }

    const newWillExpireAt = new Date(retention.willExpireAt);
    newWillExpireAt.setDate(newWillExpireAt.getDate() + additionalDays);

    return {
      ...retention,
      willExpireAt: newWillExpireAt,
      autoDeleteAt: new Date(newWillExpireAt.getTime() + 7 * 24 * 60 * 60 * 1000),
    };
  }

  /**
   * Get lifecycle summary for credential
   */
  static getLifecycleSummary(events: DataLifecycleEvent[]) {
    const stageCounts = events.reduce(
      (acc, event) => {
        acc[event.stage] = (acc[event.stage] || 0) + 1;
        return acc;
      },
      {} as Record<DataLifecycleStage, number>
    );

    const actors = new Set(events.map((e) => e.actor));
    const timeline = [...events].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return {
      totalEvents: events.length,
      stages: stageCounts,
      uniqueActors: Array.from(actors),
      firstEvent: timeline[0]?.timestamp,
      lastEvent: timeline[timeline.length - 1]?.timestamp,
      timeline,
    };
  }

  /**
   * Generate compliance report
   */
  static generateComplianceReport(
    retention: DataRetention,
    lifecycleEvents: DataLifecycleEvent[]
  ) {
    const summary = this.getLifecycleSummary(lifecycleEvents);

    return {
      resourceId: retention.resourceId,
      retentionPolicy: retention.retentionPolicy,
      retentionPeriodDays: retention.retentionPeriodDays,
      daysUntilDeletion: this.getDaysUntilDeletion(retention),
      isExpiringBrief: this.isExpiringBrief(retention),
      shouldAutoDelete: this.shouldAutoDelete(retention),
      lifecycleSummary: summary,
      createdAt: retention.createdAt,
      willExpireAt: retention.willExpireAt,
      autoDeleteAt: retention.autoDeleteAt,
    };
  }

  /**
   * Check GDPR compliance (right to be forgotten)
   */
  static canBeDeleted(events: DataLifecycleEvent[]): boolean {
    // Check if there are any active sharing or processing activities
    const recentActivities = events.filter((e) => {
      const eventAge = Date.now() - e.timestamp.getTime();
      return eventAge < 30 * 24 * 60 * 60 * 1000; // Last 30 days
    });

    const activeProcessing = recentActivities.some(
      (e) => e.stage === "processing" || e.stage === "sharing"
    );

    return !activeProcessing;
  }

  /**
   * Get deletion eligibility report
   */
  static getDeletionEligibility(
    retention: DataRetention,
    events: DataLifecycleEvent[]
  ) {
    return {
      resourceId: retention.resourceId,
      canBeDeleted: this.canBeDeleted(events),
      reason: this.shouldAutoDelete(retention)
        ? "Retention period expired"
        : "User deletion request",
      autoDeleteAt: retention.autoDeleteAt,
      daysUntilAutoDelete: this.getDaysUntilDeletion(retention),
      lastActivity: events.length > 0
        ? events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0]?.timestamp
        : undefined,
    };
  }
}

export default DataLifecycleService;
