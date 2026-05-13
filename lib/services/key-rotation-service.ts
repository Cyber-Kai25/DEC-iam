import KeyManagementService, { ManagedKey } from './key-management-service';
import EncryptionService from './encryption-service';
import EncryptedCredentialStorageService from './encrypted-credential-storage';

/**
 * Key Rotation Service for BADIMAC
 * Manages automated key rotation and re-encryption of credentials
 */

export interface RotationSchedule {
  id: string;
  userId: string;
  keyId: string;
  rotationPolicy: 'monthly' | 'quarterly' | 'annually' | 'manual';
  lastRotatedAt: Date;
  nextRotationDate: Date;
  autoRotate: boolean;
  notificationDaysBefore: number;
  enabled: boolean;
}

export interface RotationJob {
  id: string;
  userId: string;
  keyId: string;
  oldKeyId: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  totalCredentials: number;
  rotatedCredentials: number;
  failedCredentials: number;
  errorDetails?: string[];
}

export class KeyRotationService {
  /**
   * Check if key needs rotation
   */
  static needsRotation(key: ManagedKey): boolean {
    const status = KeyManagementService.checkKeyStatus(key);
    return status.needsRotation && key.keyMetadata.status === 'active';
  }

  /**
   * Create rotation schedule for key
   */
  static async createRotationSchedule(
    userId: string,
    keyId: string,
    rotationPolicy: 'monthly' | 'quarterly' | 'annually' = 'quarterly',
    autoRotate: boolean = true,
    notificationDaysBefore: number = 7
  ): Promise<RotationSchedule> {
    const schedule: RotationSchedule = {
      id: EncryptionService.generateRandomKey(16),
      userId,
      keyId,
      rotationPolicy,
      lastRotatedAt: new Date(),
      nextRotationDate: this.calculateNextRotationDate(new Date(), rotationPolicy),
      autoRotate,
      notificationDaysBefore,
      enabled: true,
    };

    console.log('[v0] Created rotation schedule:', {
      scheduleId: schedule.id,
      keyId,
      policy: rotationPolicy,
      nextDate: schedule.nextRotationDate,
    });

    return schedule;
  }

  /**
   * Calculate next rotation date based on policy
   */
  static calculateNextRotationDate(from: Date, policy: string): Date {
    const nextDate = new Date(from);

    switch (policy) {
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case 'quarterly':
        nextDate.setMonth(nextDate.getMonth() + 3);
        break;
      case 'annually':
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
      default:
        nextDate.setMonth(nextDate.getMonth() + 3); // quarterly by default
    }

    return nextDate;
  }

  /**
   * Start key rotation process
   */
  static async rotateKey(
    userId: string,
    keyId: string,
    masterPassword: string
  ): Promise<RotationJob> {
    // Create rotation job record
    const job: RotationJob = {
      id: EncryptionService.generateRandomKey(16),
      userId,
      keyId,
      oldKeyId: keyId,
      status: 'in-progress',
      startedAt: new Date(),
      totalCredentials: 0,
      rotatedCredentials: 0,
      failedCredentials: 0,
      errorDetails: [],
    };

    try {
      // Generate new key
      const oldKey = await KeyManagementService.retrieveKey(userId, keyId, masterPassword);
      const newKey = await KeyManagementService.generateManagedKey(
        userId,
        'rotated-key',
        masterPassword
      );

      // Get all credentials encrypted with old key
      const credentials = await EncryptedCredentialStorageService.listCredentials(userId);
      job.totalCredentials = credentials.length;

      // Re-encrypt each credential with new key
      for (const credential of credentials) {
        try {
          if (credential.keyId === keyId) {
            // Decrypt with old key, re-encrypt with new key
            const decrypted = await EncryptedCredentialStorageService.retrieveCredential(
              userId,
              credential.id,
              masterPassword
            );

            // Re-encrypt with new key
            const reEncrypted = EncryptionService.encrypt(
              JSON.stringify(decrypted),
              newKey.id
            );

            // Update in storage (would update in Supabase)
            console.log('[v0] Re-encrypted credential:', {
              credentialId: credential.id,
              newKeyId: newKey.id,
            });

            job.rotatedCredentials += 1;
          }
        } catch (error) {
          job.failedCredentials += 1;
          job.errorDetails?.push(`Failed to rotate credential ${credential.id}: ${error}`);
          console.error('[v0] Credential rotation failed:', { credentialId: credential.id, error });
        }
      }

      // Mark old key as rotated
      await KeyManagementService.revokeKey(userId, keyId, 'key-rotated');

      // Update job status
      job.status = 'completed';
      job.completedAt = new Date();

      console.log('[v0] Completed key rotation:', {
        jobId: job.id,
        rotated: job.rotatedCredentials,
        failed: job.failedCredentials,
      });
    } catch (error) {
      job.status = 'failed';
      job.completedAt = new Date();
      job.errorDetails?.push(String(error));
      console.error('[v0] Key rotation failed:', error);
    }

    return job;
  }

  /**
   * Batch rotate multiple keys
   */
  static async batchRotateKeys(
    userId: string,
    keyIds: string[],
    masterPassword: string
  ): Promise<RotationJob[]> {
    const jobs: RotationJob[] = [];

    for (const keyId of keyIds) {
      const job = await this.rotateKey(userId, keyId, masterPassword);
      jobs.push(job);
    }

    console.log('[v0] Batch rotation completed:', {
      userId,
      totalKeys: keyIds.length,
      successfulRotations: jobs.filter((j) => j.status === 'completed').length,
    });

    return jobs;
  }

  /**
   * Check if key is approaching rotation date
   */
  static isApproachingRotation(
    schedule: RotationSchedule,
    daysThreshold: number = 7
  ): boolean {
    const now = new Date();
    const daysUntilRotation = Math.ceil(
      (schedule.nextRotationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    return daysUntilRotation <= daysThreshold && daysUntilRotation > 0;
  }

  /**
   * Get rotation status for all user keys
   */
  static async getRotationStatus(userId: string): Promise<{
    schedules: RotationSchedule[];
    keysNeedingRotation: string[];
    keysApproachingRotation: string[];
    nextRotationDate?: Date;
  }> {
    // Would fetch schedules from Supabase in production
    const schedules: RotationSchedule[] = [];
    const keysNeedingRotation: string[] = [];
    const keysApproachingRotation: string[] = [];

    let nextRotationDate: Date | undefined;

    for (const schedule of schedules) {
      if (this.isApproachingRotation(schedule, schedule.notificationDaysBefore)) {
        keysApproachingRotation.push(schedule.keyId);

        if (!nextRotationDate || schedule.nextRotationDate < nextRotationDate) {
          nextRotationDate = schedule.nextRotationDate;
        }
      }
    }

    console.log('[v0] Retrieved rotation status:', {
      userId,
      totalSchedules: schedules.length,
      approachingRotation: keysApproachingRotation.length,
    });

    return {
      schedules,
      keysNeedingRotation,
      keysApproachingRotation,
      nextRotationDate,
    };
  }

  /**
   * Enable/disable auto rotation for key
   */
  static async updateAutoRotation(
    userId: string,
    scheduleId: string,
    autoRotate: boolean
  ): Promise<RotationSchedule> {
    // Would update in Supabase in production
    const schedule: RotationSchedule = {
      id: scheduleId,
      userId,
      keyId: '',
      rotationPolicy: 'quarterly',
      lastRotatedAt: new Date(),
      nextRotationDate: new Date(),
      autoRotate,
      notificationDaysBefore: 7,
      enabled: true,
    };

    console.log('[v0] Updated auto rotation setting:', {
      scheduleId,
      autoRotate,
    });

    return schedule;
  }

  /**
   * Cancel pending rotation job
   */
  static async cancelRotationJob(userId: string, jobId: string): Promise<void> {
    // Would update job status in Supabase
    console.log('[v0] Cancelled rotation job:', { jobId, userId });
  }

  /**
   * Resume failed rotation job
   */
  static async resumeRotationJob(
    userId: string,
    jobId: string,
    masterPassword: string
  ): Promise<RotationJob> {
    // Would fetch job from Supabase, resume from where it failed
    const job: RotationJob = {
      id: jobId,
      userId,
      keyId: '',
      oldKeyId: '',
      status: 'in-progress',
      startedAt: new Date(),
      totalCredentials: 0,
      rotatedCredentials: 0,
      failedCredentials: 0,
    };

    console.log('[v0] Resumed rotation job:', { jobId, userId });

    return job;
  }

  /**
   * Get rotation history
   */
  static async getRotationHistory(
    userId: string,
    keyId?: string,
    limit: number = 50
  ): Promise<RotationJob[]> {
    // Would fetch from Supabase in production
    console.log('[v0] Retrieved rotation history:', {
      userId,
      keyId,
      limit,
    });

    return [];
  }

  /**
   * Estimate rotation impact
   */
  static async estimateRotationImpact(
    userId: string,
    keyId: string
  ): Promise<{
    credentialsToRotate: number;
    estimatedTimeMinutes: number;
    riskLevel: 'low' | 'medium' | 'high';
    recommendations: string[];
  }> {
    // Get all credentials for user
    const credentials = await EncryptedCredentialStorageService.listCredentials(userId);
    const credentialsToRotate = credentials.filter((c) => c.keyId === keyId).length;

    // Estimate time (roughly 100ms per credential)
    const estimatedTimeMinutes = Math.ceil((credentialsToRotate * 100) / (1000 * 60));

    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (estimatedTimeMinutes > 30) riskLevel = 'high';
    else if (estimatedTimeMinutes > 10) riskLevel = 'medium';

    const recommendations: string[] = [];
    if (estimatedTimeMinutes > 30) {
      recommendations.push('Consider rotating during low-traffic hours');
    }
    if (credentialsToRotate > 1000) {
      recommendations.push('Large credential set - ensure backup is available');
    }

    return {
      credentialsToRotate,
      estimatedTimeMinutes,
      riskLevel,
      recommendations,
    };
  }
}

export default KeyRotationService;
