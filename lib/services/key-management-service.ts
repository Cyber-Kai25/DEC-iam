import EncryptionService from './encryption-service';
import SupabaseRepository from './supabase-repository';

/**
 * Key Management Service for BADIMAC
 * Manages encryption keys, storage, and lifecycle
 */

export interface ManagedKey {
  id: string;
  userId: string;
  keyType: 'symmetric' | 'asymmetric' | 'derivation';
  algorithm: string;
  publicKey?: string;
  encryptedPrivateKey: string;
  keyMetadata: {
    purpose: string;
    createdAt: Date;
    expiresAt?: Date;
    rotationPolicy?: 'monthly' | 'quarterly' | 'annually' | 'manual';
    status: 'active' | 'rotated' | 'revoked' | 'expired';
  };
  parentKeyId?: string;
  derivationSalt?: string;
  auditLog: KeyAuditEntry[];
}

export interface KeyAuditEntry {
  id: string;
  timestamp: Date;
  action: 'created' | 'used' | 'rotated' | 'revoked' | 'exported' | 'imported';
  actor: string;
  metadata?: Record<string, unknown>;
}

export interface KeyBackup {
  id: string;
  userId: string;
  keyId: string;
  encryptedBackup: string;
  backupPassword: string;
  createdAt: Date;
  expiresAt: Date;
  recoveryPhrase?: string;
  checksumHash: string;
}

export class KeyManagementService {
  /**
   * Generate and store a new encryption key
   */
  static async generateManagedKey(
    userId: string,
    purpose: string,
    masterPassword: string,
    keyType: 'symmetric' | 'asymmetric' = 'symmetric'
  ): Promise<ManagedKey> {
    let publicKey: string | undefined;
    let encryptedPrivateKey: string;
    let algorithm: string;

    if (keyType === 'asymmetric') {
      const keyPair = EncryptionService.generateKeyPair();
      publicKey = keyPair.publicKey;
      encryptedPrivateKey = EncryptionService.encrypt(keyPair.privateKey, masterPassword).ciphertext;
      algorithm = keyPair.algorithm;
    } else {
      const randomKey = EncryptionService.generateRandomKey(32);
      encryptedPrivateKey = EncryptionService.encrypt(randomKey, masterPassword).ciphertext;
      algorithm = 'AES-256-GCM';
    }

    const managedKey: ManagedKey = {
      id: EncryptionService.generateRandomKey(16),
      userId,
      keyType,
      algorithm,
      publicKey,
      encryptedPrivateKey,
      keyMetadata: {
        purpose,
        createdAt: new Date(),
        expiresAt: undefined,
        rotationPolicy: 'quarterly',
        status: 'active',
      },
      auditLog: [
        {
          id: EncryptionService.generateRandomKey(16),
          timestamp: new Date(),
          action: 'created',
          actor: userId,
          metadata: { keyType, purpose },
        },
      ],
    };

    // Store in Supabase (would be implemented in Supabase repository)
    console.log('[v0] Generated managed key:', { keyId: managedKey.id, userId, purpose });

    return managedKey;
  }

  /**
   * Retrieve and decrypt a stored key
   */
  static async retrieveKey(
    userId: string,
    keyId: string,
    masterPassword: string
  ): Promise<{ publicKey?: string; privateKey: string }> {
    // This would fetch from Supabase repository
    // For now, returning mock structure
    console.log('[v0] Retrieving key:', { keyId, userId });

    return {
      privateKey: EncryptionService.generateRandomKey(32),
    };
  }

  /**
   * Rotate a key (create new key, keep old one for decryption)
   */
  static async rotateKey(
    userId: string,
    keyId: string,
    masterPassword: string
  ): Promise<ManagedKey> {
    // Retrieve old key
    const oldKey = await this.retrieveKey(userId, keyId, masterPassword);

    // Generate new key
    const newKey = await this.generateManagedKey(userId, 'rotated-key', masterPassword);

    // Record rotation in audit log
    newKey.auditLog.push({
      id: EncryptionService.generateRandomKey(16),
      timestamp: new Date(),
      action: 'rotated',
      actor: userId,
      metadata: { previousKeyId: keyId },
    });

    console.log('[v0] Rotated key:', { oldKeyId: keyId, newKeyId: newKey.id });

    return newKey;
  }

  /**
   * Revoke a key
   */
  static async revokeKey(userId: string, keyId: string, reason: string): Promise<void> {
    console.log('[v0] Revoking key:', { keyId, userId, reason });

    // Update key status in Supabase to 'revoked'
    // Add audit entry for revocation
  }

  /**
   * Create encrypted backup of key
   */
  static async createKeyBackup(
    userId: string,
    keyId: string,
    backupPassword: string,
    recoveryPhraseLength: number = 12
  ): Promise<KeyBackup> {
    // Generate recovery phrase (BIP39-like)
    const recoveryPhrase = this.generateRecoveryPhrase(recoveryPhraseLength);

    // Create backup structure
    const backupData = {
      keyId,
      timestamp: new Date(),
      recoveryPhrase,
    };

    // Encrypt backup with backup password
    const encryptedBackup = EncryptionService.encrypt(
      JSON.stringify(backupData),
      backupPassword
    ).ciphertext;

    // Create checksum for integrity verification
    const checksumHash = EncryptionService.hashData(JSON.stringify(backupData));

    const backup: KeyBackup = {
      id: EncryptionService.generateRandomKey(16),
      userId,
      keyId,
      encryptedBackup,
      backupPassword: await EncryptionService.hashPassword(backupPassword),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
      recoveryPhrase,
      checksumHash,
    };

    console.log('[v0] Created key backup:', { backupId: backup.id, keyId });

    return backup;
  }

  /**
   * Recover key from backup
   */
  static async recoverKeyFromBackup(
    backup: KeyBackup,
    backupPassword: string
  ): Promise<{ keyId: string; recoveryPhrase: string }> {
    // Verify password
    const passwordValid = await EncryptionService.verifyPassword(backupPassword, backup.backupPassword);

    if (!passwordValid) {
      throw new Error('Invalid backup password');
    }

    // Decrypt backup data
    const encryptedData = {
      ciphertext: backup.encryptedBackup,
      iv: '', // Would come from encrypted storage
      authTag: '',
      salt: '',
      algorithm: 'aes-256-gcm',
      timestamp: backup.createdAt.getTime(),
    };

    try {
      const decryptedJson = EncryptionService.decrypt(encryptedData, backupPassword);
      const backupData = JSON.parse(decryptedJson);

      // Verify checksum
      const currentChecksum = EncryptionService.hashData(decryptedJson);
      if (currentChecksum !== backup.checksumHash) {
        throw new Error('Backup integrity check failed');
      }

      console.log('[v0] Recovered key from backup:', { keyId: backupData.keyId });

      return {
        keyId: backupData.keyId,
        recoveryPhrase: backupData.recoveryPhrase,
      };
    } catch (error) {
      console.error('[v0] Key recovery failed:', error);
      throw new Error('Failed to recover key from backup');
    }
  }

  /**
   * Generate BIP39-style recovery phrase
   */
  static generateRecoveryPhrase(wordCount: number = 12): string {
    // Simplified recovery phrase (in production, use BIP39 wordlist)
    const words = [];
    for (let i = 0; i < wordCount; i++) {
      words.push(EncryptionService.generateRandomKey(4).substring(0, 6));
    }
    return words.join(' ');
  }

  /**
   * Validate recovery phrase format
   */
  static validateRecoveryPhrase(phrase: string, expectedWordCount: number = 12): boolean {
    const words = phrase.trim().split(/\s+/);
    return words.length === expectedWordCount && words.every((w) => w.length > 0);
  }

  /**
   * Export key (encrypted)
   */
  static async exportKey(
    userId: string,
    keyId: string,
    masterPassword: string,
    exportPassword: string
  ): Promise<string> {
    // Retrieve key
    const key = await this.retrieveKey(userId, keyId, masterPassword);

    // Encrypt with export password
    const encrypted = EncryptionService.encrypt(JSON.stringify(key), exportPassword);

    // Record export in audit log
    console.log('[v0] Exported key:', { keyId, userId });

    return JSON.stringify(encrypted);
  }

  /**
   * Import key (encrypted)
   */
  static async importKey(
    userId: string,
    exportedKey: string,
    exportPassword: string,
    masterPassword: string,
    purpose: string
  ): Promise<ManagedKey> {
    // Parse exported key
    const encrypted = JSON.parse(exportedKey);

    // Decrypt with export password
    const decrypted = EncryptionService.decrypt(encrypted, exportPassword);
    const keyData = JSON.parse(decrypted);

    // Create managed key
    const managedKey: ManagedKey = {
      id: EncryptionService.generateRandomKey(16),
      userId,
      keyType: 'symmetric',
      algorithm: 'AES-256-GCM',
      encryptedPrivateKey: EncryptionService.encrypt(keyData.privateKey, masterPassword).ciphertext,
      keyMetadata: {
        purpose,
        createdAt: new Date(),
        status: 'active',
      },
      auditLog: [
        {
          id: EncryptionService.generateRandomKey(16),
          timestamp: new Date(),
          action: 'imported',
          actor: userId,
        },
      ],
    };

    console.log('[v0] Imported key:', { keyId: managedKey.id, userId, purpose });

    return managedKey;
  }

  /**
   * List all keys for user
   */
  static async listUserKeys(userId: string): Promise<ManagedKey[]> {
    // Would fetch from Supabase repository
    console.log('[v0] Listing keys for user:', userId);
    return [];
  }

  /**
   * Check key expiration and rotation status
   */
  static checkKeyStatus(key: ManagedKey): {
    isExpired: boolean;
    needsRotation: boolean;
    daysUntilExpiry?: number;
    daysUntilRotation?: number;
  } {
    const now = new Date();
    const createdAt = new Date(key.keyMetadata.createdAt);
    const ageInDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

    let rotationThresholdDays = 90; // quarterly
    if (key.keyMetadata.rotationPolicy === 'monthly') rotationThresholdDays = 30;
    if (key.keyMetadata.rotationPolicy === 'annually') rotationThresholdDays = 365;

    const isExpired = key.keyMetadata.expiresAt ? now > new Date(key.keyMetadata.expiresAt) : false;
    const needsRotation = ageInDays > rotationThresholdDays;

    return {
      isExpired,
      needsRotation,
      daysUntilExpiry: key.keyMetadata.expiresAt
        ? Math.ceil((new Date(key.keyMetadata.expiresAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : undefined,
      daysUntilRotation: Math.ceil(rotationThresholdDays - ageInDays),
    };
  }
}

export default KeyManagementService;
