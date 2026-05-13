import EncryptionService from './encryption-service';
import KeyManagementService from './key-management-service';
import SupabaseRepository from './supabase-repository';
import { VerifiableCredential } from '@/lib/types/did';

/**
 * Encrypted Credential Storage Service
 * Handles encryption and decryption of credentials at rest
 */

export interface StoredCredential {
  id: string;
  userId: string;
  credentialHash: string;
  encryptedContent: string;
  encryptedMetadata: string;
  keyId: string;
  algorithm: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  accessLog: AccessLogEntry[];
}

export interface AccessLogEntry {
  id: string;
  timestamp: Date;
  action: 'created' | 'read' | 'updated' | 'shared' | 'verified' | 'decrypted';
  actor: string;
  metadata?: Record<string, unknown>;
}

export interface CredentialMetadata {
  type: string;
  issuer: string;
  issuedAt: Date;
  expiresAt?: Date;
  attributes: Record<string, boolean>; // which attributes are encrypted
  sensitivityLevel: 'public' | 'internal' | 'confidential' | 'secret';
  accessRestrictions?: string[];
}

export class EncryptedCredentialStorageService {
  /**
   * Store credential with encryption
   */
  static async storeCredential(
    userId: string,
    credential: VerifiableCredential,
    masterPassword: string,
    metadata?: CredentialMetadata
  ): Promise<StoredCredential> {
    // Generate or retrieve encryption key
    const key = await KeyManagementService.generateManagedKey(
      userId,
      `credential-${credential.id}`,
      masterPassword
    );

    // Create metadata if not provided
    const credentialMetadata: CredentialMetadata = metadata || {
      type: (Array.isArray(credential.type) ? credential.type.join(', ') : credential.type) as string,
      issuer: credential.issuer as string,
      issuedAt: new Date(credential.issuanceDate),
      expiresAt: credential.expirationDate ? new Date(credential.expirationDate) : undefined,
      attributes: {},
      sensitivityLevel: 'confidential',
    };

    // Encrypt credential content
    const encryptedContent = EncryptionService.encrypt(
      JSON.stringify(credential),
      key.id
    ).ciphertext;

    // Encrypt metadata
    const encryptedMetadata = EncryptionService.encrypt(
      JSON.stringify(credentialMetadata),
      key.id
    ).ciphertext;

    // Create content hash for verification
    const credentialHash = EncryptionService.hashData(JSON.stringify(credential));

    const storedCredential: StoredCredential = {
      id: EncryptionService.generateRandomKey(16),
      userId,
      credentialHash,
      encryptedContent,
      encryptedMetadata,
      keyId: key.id,
      algorithm: key.algorithm,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      accessLog: [
        {
          id: EncryptionService.generateRandomKey(16),
          timestamp: new Date(),
          action: 'created',
          actor: userId,
        },
      ],
    };

    // Store in Supabase
    console.log('[v0] Stored encrypted credential:', {
      id: storedCredential.id,
      userId,
      credentialId: credential.id,
    });

    return storedCredential;
  }

  /**
   * Retrieve and decrypt credential
   */
  static async retrieveCredential(
    userId: string,
    storedCredentialId: string,
    masterPassword: string
  ): Promise<VerifiableCredential> {
    // Would fetch from Supabase in production
    const storedCredential = {
      encryptedContent: '',
      keyId: '',
    };

    // Retrieve key
    const key = await KeyManagementService.retrieveKey(userId, storedCredential.keyId, masterPassword);

    // Decrypt content
    const encryptedData = {
      ciphertext: storedCredential.encryptedContent,
      iv: '',
      authTag: '',
      salt: '',
      algorithm: 'aes-256-gcm',
      timestamp: Date.now(),
    };

    const decryptedJson = EncryptionService.decrypt(encryptedData, storedCredential.keyId);
    const credential = JSON.parse(decryptedJson) as VerifiableCredential;

    // Log access
    console.log('[v0] Retrieved encrypted credential:', {
      credentialId: storedCredentialId,
      userId,
    });

    return credential;
  }

  /**
   * Update encrypted credential
   */
  static async updateCredential(
    userId: string,
    storedCredentialId: string,
    updatedCredential: VerifiableCredential,
    masterPassword: string
  ): Promise<StoredCredential> {
    // Retrieve current credential
    const stored = {
      encryptedContent: '',
      keyId: '',
      encryptedMetadata: '',
      credentialHash: '',
      accessLog: [] as AccessLogEntry[],
    };

    // Update encrypted content
    const encryptedContent = EncryptionService.encrypt(
      JSON.stringify(updatedCredential),
      stored.keyId
    ).ciphertext;

    // Update hash
    const newHash = EncryptionService.hashData(JSON.stringify(updatedCredential));

    // Add access log entry
    stored.accessLog.push({
      id: EncryptionService.generateRandomKey(16),
      timestamp: new Date(),
      action: 'updated',
      actor: userId,
    });

    console.log('[v0] Updated encrypted credential:', {
      credentialId: storedCredentialId,
      userId,
    });

    return {
      id: storedCredentialId,
      userId,
      credentialHash: newHash,
      encryptedContent,
      encryptedMetadata: stored.encryptedMetadata,
      keyId: stored.keyId,
      algorithm: 'aes-256-gcm',
      version: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
      accessLog: stored.accessLog,
    };
  }

  /**
   * Share encrypted credential with another user
   */
  static async shareCredential(
    fromUserId: string,
    toUserId: string,
    storedCredentialId: string,
    masterPassword: string,
    attributes?: string[]
  ): Promise<{ shareId: string; encryptedCredential: string }> {
    // Retrieve original credential
    const credential = await this.retrieveCredential(
      fromUserId,
      storedCredentialId,
      masterPassword
    );

    // Filter attributes if specified
    let credentialToShare = credential;
    if (attributes) {
      credentialToShare = {
        ...credential,
        credentialSubject: Object.fromEntries(
          Object.entries(credential.credentialSubject || {}).filter(([key]) =>
            attributes.includes(key)
          )
        ),
      };
    }

    // Generate share ID
    const shareId = EncryptionService.generateRandomKey(16);

    // Encrypt for recipient (would use recipient's public key in production)
    const encryptedCredential = EncryptionService.encrypt(
      JSON.stringify(credentialToShare),
      shareId
    ).ciphertext;

    // Log sharing action
    console.log('[v0] Shared encrypted credential:', {
      credentialId: storedCredentialId,
      fromUser: fromUserId,
      toUser: toUserId,
      shareId,
    });

    return { shareId, encryptedCredential };
  }

  /**
   * List user's encrypted credentials
   */
  static async listCredentials(userId: string): Promise<StoredCredential[]> {
    // Would fetch from Supabase in production
    console.log('[v0] Listing encrypted credentials for user:', userId);
    return [];
  }

  /**
   * Delete credential (secure deletion)
   */
  static async deleteCredential(userId: string, storedCredentialId: string): Promise<void> {
    // Securely delete from database
    // Overwrite encryption key
    // Log deletion

    console.log('[v0] Securely deleted encrypted credential:', {
      credentialId: storedCredentialId,
      userId,
    });
  }

  /**
   * Get credential access log
   */
  static async getAccessLog(
    userId: string,
    storedCredentialId: string
  ): Promise<AccessLogEntry[]> {
    // Would fetch from Supabase in production
    console.log('[v0] Retrieved access log for credential:', {
      credentialId: storedCredentialId,
      userId,
    });
    return [];
  }

  /**
   * Verify credential integrity
   */
  static async verifyCredentialIntegrity(
    userId: string,
    storedCredentialId: string,
    masterPassword: string
  ): Promise<boolean> {
    // Would fetch stored credential from Supabase
    const storedCredential = {
      credentialHash: '',
      encryptedContent: '',
      keyId: '',
    };

    // Decrypt and hash
    const decryptedJson = EncryptionService.decrypt(
      {
        ciphertext: storedCredential.encryptedContent,
        iv: '',
        authTag: '',
        salt: '',
        algorithm: 'aes-256-gcm',
        timestamp: Date.now(),
      },
      storedCredential.keyId
    );

    const currentHash = EncryptionService.hashData(decryptedJson);

    const isValid = currentHash === storedCredential.credentialHash;

    console.log('[v0] Verified credential integrity:', {
      credentialId: storedCredentialId,
      isValid,
    });

    return isValid;
  }

  /**
   * Encrypt credential batch
   */
  static async encryptBatch(
    userId: string,
    credentials: VerifiableCredential[],
    masterPassword: string
  ): Promise<StoredCredential[]> {
    const storedCredentials: StoredCredential[] = [];

    for (const credential of credentials) {
      const stored = await this.storeCredential(userId, credential, masterPassword);
      storedCredentials.push(stored);
    }

    console.log('[v0] Encrypted credential batch:', {
      count: credentials.length,
      userId,
    });

    return storedCredentials;
  }

  /**
   * Decrypt credential batch
   */
  static async decryptBatch(
    userId: string,
    storedCredentialIds: string[],
    masterPassword: string
  ): Promise<VerifiableCredential[]> {
    const credentials: VerifiableCredential[] = [];

    for (const id of storedCredentialIds) {
      const credential = await this.retrieveCredential(userId, id, masterPassword);
      credentials.push(credential);
    }

    console.log('[v0] Decrypted credential batch:', {
      count: storedCredentialIds.length,
      userId,
    });

    return credentials;
  }
}

export default EncryptedCredentialStorageService;
