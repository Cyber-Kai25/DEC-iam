// Key Management and Cryptographic Operations
import { ethers } from "ethers";

export class KeyManagement {
  /**
   * Generate a new Ethereum keypair suitable for DID creation
   */
  static generateKeyPair(): {
    publicKey: string;
    privateKey: string;
    address: string;
  } {
    const wallet = ethers.Wallet.createRandom();
    return {
      publicKey: wallet.publicKey,
      privateKey: wallet.privateKey,
      address: wallet.address,
    };
  }

  /**
   * Create a DID identifier for Ethereum (did:ethr)
   */
  static createDID(address: string, chainId: number = 11155111): string {
    // Sepolia testnet chain ID is 11155111
    const checksumAddress = ethers.getAddress(address);
    return `did:ethr:${chainId}:${checksumAddress}`;
  }

  /**
   * Recover public key from signature
   */
  static recoverPublicKey(
    message: string,
    signature: string
  ): string | null {
    try {
      const messageHash = ethers.hashMessage(message);
      const publicKey = ethers.recoverPublicKey(messageHash, signature);
      return publicKey;
    } catch {
      return null;
    }
  }

  /**
   * Sign a message with a private key
   */
  static signMessage(privateKey: string, message: string): string {
    const wallet = new ethers.Wallet(privateKey);
    return wallet.signMessageSync(message);
  }

  /**
   * Verify a signature
   */
  static verifySignature(
    message: string,
    signature: string,
    address: string
  ): boolean {
    try {
      const recoveredAddress = ethers.verifyMessage(message, signature);
      return (
        recoveredAddress.toLowerCase() === ethers.getAddress(address).toLowerCase()
      );
    } catch {
      return false;
    }
  }

  /**
   * Create a verifiable message with timestamp and nonce
   */
  static createVerifiableMessage(
    content: string,
    nonce: string,
    timestamp: number = Date.now()
  ): string {
    return JSON.stringify({
      content,
      nonce,
      timestamp,
    });
  }

  /**
   * Hash data using Keccak-256 (Ethereum standard)
   */
  static hashData(data: string): string {
    return ethers.keccak256(ethers.toBeHex(data));
  }

  /**
   * Encrypt data using AES-256-GCM
   * Returns: base64 encoded string of IV:ciphertext:authTag
   */
  static async encryptData(data: string, publicKey: string): Promise<string> {
    // For browser compatibility, we'll use a simplified encryption method
    // In production, use libsodium or TweetNaCl.js
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);

    // Create a random 256-bit key from the public key
    const keyHash = await this.sha256Hash(publicKey);
    const key = await crypto.subtle.importKey(
      "raw",
      new Uint8Array(keyHash),
      { name: "AES-GCM" },
      false,
      ["encrypt"]
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      dataBuffer
    );

    const result = new Uint8Array(iv.length + encrypted.byteLength);
    result.set(iv);
    result.set(new Uint8Array(encrypted), iv.length);

    return btoa(String.fromCharCode(...Array.from(result)));
  }

  /**
   * Decrypt data
   */
  static async decryptData(
    encryptedData: string,
    privateKey: string
  ): Promise<string> {
    const decoder = new TextDecoder();
    const dataBuffer = Uint8Array.from(atob(encryptedData), (c) =>
      c.charCodeAt(0)
    );

    const keyHash = await this.sha256Hash(privateKey);
    const key = await crypto.subtle.importKey(
      "raw",
      new Uint8Array(keyHash),
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );

    const iv = dataBuffer.slice(0, 12);
    const encrypted = dataBuffer.slice(12);

    try {
      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        encrypted
      );
      return decoder.decode(decrypted);
    } catch {
      throw new Error("Decryption failed");
    }
  }

  /**
   * SHA-256 hash
   */
  static async sha256Hash(data: string): Promise<ArrayBuffer> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    return crypto.subtle.digest("SHA-256", dataBuffer);
  }

  /**
   * Generate a random nonce
   */
  static generateNonce(): string {
    return ethers.hexlify(ethers.randomBytes(16));
  }

  /**
   * Validate if address is a valid Ethereum address
   */
  static isValidAddress(address: string): boolean {
    return ethers.isAddress(address);
  }

  /**
   * Format address to checksum format
   */
  static toChecksum(address: string): string {
    return ethers.getAddress(address);
  }
}

export default KeyManagement;
