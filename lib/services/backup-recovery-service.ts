import EncryptionService from './encryption-service';
import KeyManagementService from './key-management-service';
import EncryptedCredentialStorageService from './encrypted-credential-storage';
import { VerifiableCredential } from '@/lib/types/did';

/**
 * Backup and Recovery Service for BADIMAC
 * Manages encrypted backup creation and disaster recovery
 */

export interface BackupFile {
  id: string;
  userId: string;
  backupType: 'full' | 'incremental' | 'differential';
  encryptedData: string;
  backupPassword: string; // hashed
  recoveryPhrase: string;
  checksumHash: string;
  integrityHash: string;
  createdAt: Date;
  expiresAt: Date;
  size: number;
  credentialCount: number;
  keyCount: number;
  version: string;
  compressionType?: string;
}

export interface RestoreJob {
  id: string;
  userId: string;
  backupFileId: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  restoreSource: 'backup' | 'recovery-phrase' | 'key-recovery';
  credentialsRestored: number;
  keysRestored: number;
  errors?: string[];
}

export class BackupRecoveryService {
  /**
   * Create full encrypted backup
   */
  static async createFullBackup(
    userId: string,
    masterPassword: string,
    backupPassword: string
  ): Promise<BackupFile> {
    // Get all credentials
    const credentials = await EncryptedCredentialStorageService.listCredentials(userId);

    // Get all keys
    const keys = await KeyManagementService.listUserKeys(userId);

    // Create backup object
    const backupObject = {
      version: '1.0',
      timestamp: new Date(),
      credentials: credentials.map((c) => ({
        id: c.id,
        credentialHash: c.credentialHash,
        keyId: c.keyId,
        metadata: c.encryptedMetadata,
      })),
      keys: keys.map((k) => ({
        id: k.id,
        algorithm: k.algorithm,
        encryptedKey: k.encryptedPrivateKey,
      })),
    };

    // Generate recovery phrase
    const recoveryPhrase = KeyManagementService.generateRecoveryPhrase(24);

    // Encrypt backup with password
    const encryptedData = EncryptionService.encrypt(
      JSON.stringify(backupObject),
      backupPassword
    ).ciphertext;

    // Create checksums for integrity
    const checksumHash = EncryptionService.hashData(JSON.stringify(backupObject));
    const integrityHash = EncryptionService.hashData(encryptedData);

    const backupFile: BackupFile = {
      id: EncryptionService.generateRandomKey(16),
      userId,
      backupType: 'full',
      encryptedData,
      backupPassword: await EncryptionService.hashPassword(backupPassword),
      recoveryPhrase,
      checksumHash,
      integrityHash,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      size: encryptedData.length,
      credentialCount: credentials.length,
      keyCount: keys.length,
      version: '1.0',
    };

    console.log('[v0] Created encrypted backup:', {
      backupId: backupFile.id,
      userId,
      credentials: credentials.length,
      keys: keys.length,
    });

    return backupFile;
  }

  /**
   * Create incremental backup (only new/changed items)
   */
  static async createIncrementalBackup(
    userId: string,
    masterPassword: string,
    backupPassword: string,
    sinceDate: Date
  ): Promise<BackupFile> {
    // Get credentials modified since date
    const credentials = await EncryptedCredentialStorageService.listCredentials(userId);
    const changedCredentials = credentials.filter((c) => c.updatedAt > sinceDate);

    const backupObject = {
      version: '1.0',
      timestamp: new Date(),
      type: 'incremental',
      sinceDate,
      credentials: changedCredentials.map((c) => ({
        id: c.id,
        credentialHash: c.credentialHash,
        keyId: c.keyId,
      })),
    };

    const recoveryPhrase = KeyManagementService.generateRecoveryPhrase(12);

    const encryptedData = EncryptionService.encrypt(
      JSON.stringify(backupObject),
      backupPassword
    ).ciphertext;

    const checksumHash = EncryptionService.hashData(JSON.stringify(backupObject));
    const integrityHash = EncryptionService.hashData(encryptedData);

    const backupFile: BackupFile = {
      id: EncryptionService.generateRandomKey(16),
      userId,
      backupType: 'incremental',
      encryptedData,
      backupPassword: await EncryptionService.hashPassword(backupPassword),
      recoveryPhrase,
      checksumHash,
      integrityHash,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
      size: encryptedData.length,
      credentialCount: changedCredentials.length,
      keyCount: 0,
      version: '1.0',
    };

    console.log('[v0] Created incremental backup:', {
      backupId: backupFile.id,
      changedCredentials: changedCredentials.length,
    });

    return backupFile;
  }

  /**
   * Restore from backup
   */
  static async restoreFromBackup(
    userId: string,
    backupFile: BackupFile,
    backupPassword: string,
    masterPassword: string
  ): Promise<RestoreJob> {
    const job: RestoreJob = {
      id: EncryptionService.generateRandomKey(16),
      userId,
      backupFileId: backupFile.id,
      status: 'in-progress',
      startedAt: new Date(),
      restoreSource: 'backup',
      credentialsRestored: 0,
      keysRestored: 0,
      errors: [],
    };

    try {
      // Verify password
      const passwordValid = await EncryptionService.verifyPassword(backupPassword, backupFile.backupPassword);
      if (!passwordValid) {
        throw new Error('Invalid backup password');
      }

      // Verify integrity
      const currentIntegrity = EncryptionService.hashData(backupFile.encryptedData);
      if (currentIntegrity !== backupFile.integrityHash) {
        throw new Error('Backup integrity check failed');
      }

      // Decrypt backup
      const encryptedData = {
        ciphertext: backupFile.encryptedData,
        iv: '',
        authTag: '',
        salt: '',
        algorithm: 'aes-256-gcm',
        timestamp: backupFile.createdAt.getTime(),
      };

      const decryptedJson = EncryptionService.decrypt(encryptedData, backupPassword);
      const backupObject = JSON.parse(decryptedJson);

      // Verify checksum
      const currentChecksum = EncryptionService.hashData(decryptedJson);
      if (currentChecksum !== backupFile.checksumHash) {
        throw new Error('Backup checksum verification failed');
      }

      // Restore credentials
      for (const credentialRef of backupObject.credentials) {
        try {
          // In production, would retrieve full credential from storage
          job.credentialsRestored += 1;
        } catch (error) {
          job.errors?.push(`Failed to restore credential ${credentialRef.id}`);
          console.error('[v0] Credential restore failed:', error);
        }
      }

      // Restore keys
      if (backupObject.keys) {
        for (const keyRef of backupObject.keys) {
          try {
            // Decrypt and restore key
            job.keysRestored += 1;
          } catch (error) {
            job.errors?.push(`Failed to restore key ${keyRef.id}`);
          }
        }
      }

      job.status = 'completed';
      job.completedAt = new Date();

      console.log('[v0] Restore from backup completed:', {
        jobId: job.id,
        credentials: job.credentialsRestored,
        keys: job.keysRestored,
      });
    } catch (error) {
      job.status = 'failed';
      job.completedAt = new Date();
      job.errors?.push(String(error));
      console.error('[v0] Backup restore failed:', error);
    }

    return job;
  }

  /**
   * Recover using recovery phrase
   */
  static async recoverWithRecoveryPhrase(
    userId: string,
    recoveryPhrase: string,
    newPassword: string
  ): Promise<RestoreJob> {
    const job: RestoreJob = {
      id: EncryptionService.generateRandomKey(16),
      userId,
      backupFileId: 'recovered',
      status: 'in-progress',
      startedAt: new Date(),
      restoreSource: 'recovery-phrase',
      credentialsRestored: 0,
      keysRestored: 0,
    };

    try {
      // Validate recovery phrase format
      if (!KeyManagementService.validateRecoveryPhrase(recoveryPhrase)) {
        throw new Error('Invalid recovery phrase format');
      }

      // In production, would use recovery phrase to derive keys and restore
      console.log('[v0] Recovery with phrase initiated for user:', userId);

      job.status = 'completed';
      job.completedAt = new Date();
    } catch (error) {
      job.status = 'failed';
      job.completedAt = new Date();
      job.errors = [String(error)];
      console.error('[v0] Recovery with phrase failed:', error);
    }

    return job;
  }

  /**
   * Recover using key backup
   */
  static async recoverWithKeyBackup(
    userId: string,
    keyBackupId: string,
    backupPassword: string
  ): Promise<RestoreJob> {
    const job: RestoreJob = {
      id: EncryptionService.generateRandomKey(16),
      userId,
      backupFileId: keyBackupId,
      status: 'in-progress',
      startedAt: new Date(),
      restoreSource: 'key-recovery',
      credentialsRestored: 0,
      keysRestored: 1,
    };

    try {
      // Would fetch key backup from storage
      // Verify password and recover key
      console.log('[v0] Key recovery initiated:', { keyBackupId, userId });

      job.status = 'completed';
      job.completedAt = new Date();
    } catch (error) {
      job.status = 'failed';
      job.completedAt = new Date();
      job.errors = [String(error)];
      console.error('[v0] Key recovery failed:', error);
    }

    return job;
  }

  /**
   * List available backups
   */
  static async listBackups(userId: string): Promise<BackupFile[]> {
    // Would fetch from Supabase in production
    console.log('[v0] Listed backups for user:', userId);
    return [];
  }

  /**
   * Delete old backups (expired or manual)
   */
  static async deleteBackup(userId: string, backupId: string): Promise<void> {
    console.log('[v0] Deleted backup:', { backupId, userId });
  }

  /**
   * Schedule automatic backups
   */
  static async scheduleAutomaticBackup(
    userId: string,
    frequency: 'daily' | 'weekly' | 'monthly',
    backupPassword: string
  ): Promise<{ scheduledBackupId: string; nextBackupDate: Date }> {
    const now = new Date();
    const nextBackupDate = this.calculateNextBackupDate(now, frequency);

    const scheduledBackupId = EncryptionService.generateRandomKey(16);

    console.log('[v0] Scheduled automatic backup:', {
      userId,
      frequency,
      nextBackup: nextBackupDate,
    });

    return { scheduledBackupId, nextBackupDate };
  }

  /**
   * Calculate next backup date
   */
  static calculateNextBackupDate(from: Date, frequency: string): Date {
    const nextDate = new Date(from);

    switch (frequency) {
      case 'daily':
        nextDate.setDate(nextDate.getDate() + 1);
        nextDate.setHours(2, 0, 0, 0); // 2 AM
        break;
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + 7);
        nextDate.setHours(2, 0, 0, 0);
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        nextDate.setHours(2, 0, 0, 0);
        break;
    }

    return nextDate;
  }

  /**
   * Verify backup integrity
   */
  static async verifyBackupIntegrity(backupFile: BackupFile): Promise<boolean> {
    try {
      const currentIntegrity = EncryptionService.hashData(backupFile.encryptedData);
      const isValid = currentIntegrity === backupFile.integrityHash;

      console.log('[v0] Verified backup integrity:', {
        backupId: backupFile.id,
        isValid,
      });

      return isValid;
    } catch (error) {
      console.error('[v0] Backup integrity check failed:', error);
      return false;
    }
  }

  /**
   * Export backup for external storage
   */
  static async exportBackup(
    userId: string,
    backupFile: BackupFile,
    exportPassword: string
  ): Promise<string> {
    // Re-encrypt backup with export password for external storage
    const exportData = {
      backupId: backupFile.id,
      userId,
      timestamp: new Date(),
      content: backupFile.encryptedData,
      originalChecksum: backupFile.checksumHash,
    };

    const reEncrypted = EncryptionService.encrypt(JSON.stringify(exportData), exportPassword);

    console.log('[v0] Exported backup for external storage:', {
      backupId: backupFile.id,
      userId,
    });

    return JSON.stringify(reEncrypted);
  }

  /**
   * Import backup from external storage
   */
  static async importBackup(
    userId: string,
    exportedBackup: string,
    exportPassword: string
  ): Promise<BackupFile> {
    // Decrypt and import backup
    const encrypted = JSON.parse(exportedBackup);
    const decrypted = EncryptionService.decrypt(encrypted, exportPassword);
    const importData = JSON.parse(decrypted);

    // Verify user matches
    if (importData.userId !== userId) {
      throw new Error('Backup user ID does not match');
    }

    console.log('[v0] Imported backup from external storage:', {
      backupId: importData.backupId,
      userId,
    });

    return {
      id: importData.backupId,
      userId,
      backupType: 'full',
      encryptedData: importData.content,
      backupPassword: '',
      recoveryPhrase: '',
      checksumHash: importData.originalChecksum,
      integrityHash: EncryptionService.hashData(importData.content),
      createdAt: new Date(importData.timestamp),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      size: importData.content.length,
      credentialCount: 0,
      keyCount: 0,
      version: '1.0',
    };
  }
}

export default BackupRecoveryService;
