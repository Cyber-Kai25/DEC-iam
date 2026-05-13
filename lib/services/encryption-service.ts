import crypto from 'crypto';
// @ts-expect-error bcryptjs has no type declarations
import bcryptjs from 'bcryptjs';

/**
 * Encryption Service for BADIMAC
 * Provides AES-256-GCM encryption/decryption with authentication
 */

export interface EncryptedData {
  ciphertext: string;
  iv: string;
  authTag: string;
  salt: string;
  algorithm: string;
  timestamp: number;
}

export interface KeyPair {
  publicKey: string;
  privateKey: string;
  keyId: string;
  createdAt: Date;
  algorithm: string;
}

export class EncryptionService {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly SALT_ROUNDS = 12;
  private static readonly IV_LENGTH = 16;

  /**
   * Generate a random encryption key from password
   */
  static deriveKeyFromPassword(password: string, salt: string = ''): Buffer {
    const actualSalt = salt || crypto.randomBytes(32).toString('hex');
    const iterations = 100000;
    const keyLength = 32;
    const digest = 'sha256';

    const derivedKey = crypto.pbkdf2Sync(password, actualSalt, iterations, keyLength, digest);
    return derivedKey;
  }

  /**
   * Encrypt data with AES-256-GCM
   */
  static encrypt(data: string, password: string): EncryptedData {
    const salt = crypto.randomBytes(32).toString('hex');
    const key = this.deriveKeyFromPassword(password, salt);
    const iv = crypto.randomBytes(this.IV_LENGTH);

    const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      ciphertext: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      salt: salt,
      algorithm: this.ALGORITHM,
      timestamp: Date.now(),
    };
  }

  /**
   * Decrypt data with AES-256-GCM
   */
  static decrypt(encryptedData: EncryptedData, password: string): string {
    const key = this.deriveKeyFromPassword(password, encryptedData.salt);
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const authTag = Buffer.from(encryptedData.authTag, 'hex');

    const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData.ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Hash password with bcrypt for storage
   */
  static async hashPassword(password: string): Promise<string> {
    return bcryptjs.hash(password, this.SALT_ROUNDS);
  }

  /**
   * Verify password against bcrypt hash
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcryptjs.compare(password, hash);
  }

  /**
   * Generate random hex string of specified length
   */
  static generateRandomKey(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate RSA key pair for asymmetric encryption
   */
  static generateKeyPair(keySize: number = 4096): KeyPair {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: keySize,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    return {
      publicKey: publicKey as string,
      privateKey: privateKey as string,
      keyId: this.generateRandomKey(16),
      createdAt: new Date(),
      algorithm: `RSA-${keySize}`,
    };
  }

  /**
   * Encrypt data with public key
   */
  static encryptWithPublicKey(data: string, publicKey: string): string {
    const buffer = Buffer.from(data, 'utf8');
    const encrypted = crypto.publicEncrypt(publicKey, buffer);
    return encrypted.toString('hex');
  }

  /**
   * Decrypt data with private key
   */
  static decryptWithPrivateKey(encrypted: string, privateKey: string): string {
    const buffer = Buffer.from(encrypted, 'hex');
    const decrypted = crypto.privateDecrypt(privateKey, buffer);
    return decrypted.toString('utf8');
  }

  /**
   * Create HMAC signature
   */
  static createSignature(data: string, secretKey: string): string {
    const hmac = crypto.createHmac('sha256', secretKey);
    hmac.update(data);
    return hmac.digest('hex');
  }

  /**
   * Verify HMAC signature
   */
  static verifySignature(data: string, signature: string, secretKey: string): boolean {
    const expectedSignature = this.createSignature(data, secretKey);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Encrypt object to JSON string
   */
  static encryptObject<T>(obj: T, password: string): EncryptedData {
    const jsonString = JSON.stringify(obj);
    return this.encrypt(jsonString, password);
  }

  /**
   * Decrypt object from encrypted JSON string
   */
  static decryptObject<T>(encryptedData: EncryptedData, password: string): T {
    const jsonString = this.decrypt(encryptedData, password);
    return JSON.parse(jsonString) as T;
  }

  /**
   * Create secure hash of data (SHA-256)
   */
  static hashData(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Generate zero-knowledge proof challenge
   */
  static generateChallenge(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Verify data integrity with checksum
   */
  static createChecksum(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Verify data with checksum
   */
  static verifyChecksum(data: string, checksum: string): boolean {
    return this.createChecksum(data) === checksum;
  }
}

export default EncryptionService;
