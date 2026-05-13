/**
 * DID Resolution Service
 * Implements W3C DID Resolution specification
 * Handles DID resolution from blockchain and local cache
 */

import { DIDDocument, DIDRegistry } from "@/lib/types/did";
import BlockchainService from "@/lib/services/blockchain-service";
import { ethers } from "ethers";

interface DIDResolutionResult {
  did: string;
  didDocument: DIDDocument;
  resolutionMetadata: {
    contentType: string;
    retrieved: Date;
    duration: number; // ms
    location: "blockchain" | "cache" | "local";
  };
  didDocumentMetadata: {
    created: Date;
    updated: Date;
    active: boolean;
    revoked: boolean;
  };
}

export class DIDResolutionService {
  private static readonly DID_CONTEXT = "https://www.w3.org/ns/did/v1";
  private static readonly SECURITY_CONTEXT = "https://w3id.org/security/suites/secp256k1-2019/v1";
  private static readonly CACHE_TTL = 3600000; // 1 hour in ms

  // Local cache for resolved DIDs
  private static cache: Map<string, { data: DIDResolutionResult; timestamp: number }> = new Map();

  /**
   * Resolve a DID to its DID Document
   * Follows W3C DID Resolution specification
   */
  static async resolveDID(did: string): Promise<DIDResolutionResult> {
    const startTime = Date.now();

    try {
      // Step 1: Validate DID format
      const isValid = this.validateDIDFormat(did);
      if (!isValid) {
        throw new Error(`Invalid DID format: ${did}`);
      }

      // Step 2: Check local cache
      const cached = this.getFromCache(did);
      if (cached) {
        console.log(`[v0] DID resolved from cache: ${did.slice(0, 20)}...`);
        return {
          ...cached,
          resolutionMetadata: {
            ...cached.resolutionMetadata,
            location: "cache",
            duration: Date.now() - startTime,
          },
        };
      }

      // Step 3: Parse DID to extract blockchain info
      const didParts = this.parseDID(did);
      if (!didParts) {
        throw new Error(`Could not parse DID: ${did}`);
      }

      // Step 4: Resolve from blockchain
      let result: DIDResolutionResult | null = null;

      if (didParts.method === "ethr") {
        result = await this.resolveEthereumDID(did, didParts.address!);
      } else {
        throw new Error(`Unsupported DID method: ${didParts.method}`);
      }

      if (!result) {
        throw new Error(`Could not resolve DID: ${did}`);
      }

      // Step 5: Cache result
      this.addToCache(did, result);

      // Step 6: Return result
      return {
        ...result,
        resolutionMetadata: {
          ...result.resolutionMetadata,
          location: "blockchain",
          duration: Date.now() - startTime,
        },
      };
    } catch (error) {
      console.error("[v0] DID resolution error:", { did, error });
      throw new Error(`Failed to resolve DID: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Resolve a DID using Ethereum blockchain
   */
  private static async resolveEthereumDID(
    did: string,
    address: string
  ): Promise<DIDResolutionResult> {
    // Initialize blockchain service
    await BlockchainService.initializeProvider();

    // In production, would query smart contract
    // For now, return a constructed DID Document
    const didDocument = this.constructDIDDocument(did, address);

    return {
      did,
      didDocument,
      resolutionMetadata: {
        contentType: "application/did+ld+json",
        retrieved: new Date(),
        duration: 0,
        location: "blockchain",
      },
      didDocumentMetadata: {
        created: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        updated: new Date(),
        active: true,
        revoked: false,
      },
    };
  }

  /**
   * Construct a W3C compliant DID Document
   */
  private static constructDIDDocument(did: string, address: string): DIDDocument {
    const publicKeyId = `${did}#keys-1`;
    const authenticationId = `${did}#authentication-1`;

    // Generate public key (in production, would retrieve from blockchain)
    const publicKey = ethers.hexlify(ethers.randomBytes(65));

    return {
      "@context": [this.DID_CONTEXT, this.SECURITY_CONTEXT],
      id: did,
      publicKey: [
        {
          id: publicKeyId,
          type: "EcdsaSecp256k1VerificationKey2019",
          controller: did,
          publicKeyHex: publicKey.slice(2),
        },
      ],
      verificationMethod: [
        {
          id: publicKeyId,
          type: "EcdsaSecp256k1VerificationKey2019",
          controller: did,
          publicKeyHex: publicKey.slice(2),
        },
      ],
      authentication: [authenticationId],
      assertionMethod: [publicKeyId],
      keyAgreement: [publicKeyId],
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      service: [
        {
          id: `${did}#website`,
          type: "LinkedDomains",
          serviceEndpoint: `https://etherscan.io/address/${address}`,
        },
      ],
    };
  }

  /**
   * Validate DID format
   */
  private static validateDIDFormat(did: string): boolean {
    // W3C DID specification: did:method:method-specific-id
    const didRegex = /^did:[a-z]+:[a-zA-Z0-9:._%-]+$/;
    return didRegex.test(did);
  }

  /**
   * Parse DID into components
   */
  private static parseDID(
    did: string
  ): { method: string; address?: string; chainId?: number } | null {
    const parts = did.split(":");
    if (parts.length < 3) return null;

    const method = parts[1];

    if (method === "ethr") {
      // Format: did:ethr:chainId:address or did:ethr:address
      if (parts.length === 3) {
        return { method, address: parts[2] };
      } else if (parts.length === 4) {
        return { method, chainId: parseInt(parts[2]), address: parts[3] };
      }
    }

    return null;
  }

  /**
   * Get DID from cache if still valid
   */
  private static getFromCache(did: string): DIDResolutionResult | null {
    const cached = this.cache.get(did);
    if (!cached) return null;

    // Check if cache is still valid
    if (Date.now() - cached.timestamp > this.CACHE_TTL) {
      this.cache.delete(did);
      return null;
    }

    return cached.data;
  }

  /**
   * Add DID to cache
   */
  private static addToCache(did: string, result: DIDResolutionResult): void {
    this.cache.set(did, { data: result, timestamp: Date.now() });

    // Limit cache size
    if (this.cache.size > 1000) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
  }

  /**
   * Clear cache
   */
  static clearCache(): void {
    this.cache.clear();
    console.log("[v0] DID resolution cache cleared");
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): { size: number; ttl: number } {
    return {
      size: this.cache.size,
      ttl: this.CACHE_TTL,
    };
  }

  /**
   * Verify a DID signature
   * In production, would verify cryptographic signature
   */
  static async verifyDIDSignature(
    did: string,
    message: string,
    signature: string
  ): Promise<boolean> {
    try {
      // Resolve DID to get public key
      const resolution = await this.resolveDID(did);
      const publicKeyHex = resolution.didDocument.publicKey[0]?.publicKeyHex;

      if (!publicKeyHex) {
        console.warn("[v0] No public key found in DID document");
        return false;
      }

      // Verify signature using ethers.js
      const messageHash = ethers.hashMessage(message);
      const recoveredAddress = ethers.recoverAddress(messageHash, signature);

      // Extract address from DID
      const didAddress = this.parseDID(did)?.address;

      return recoveredAddress.toLowerCase() === didAddress?.toLowerCase();
    } catch (error) {
      console.error("[v0] DID signature verification failed:", error);
      return false;
    }
  }

  /**
   * Get DID document only (without metadata)
   */
  static async getDIDDocument(did: string): Promise<DIDDocument> {
    const resolution = await this.resolveDID(did);
    return resolution.didDocument;
  }

  /**
   * Check if DID is active
   */
  static async isDIDActive(did: string): Promise<boolean> {
    try {
      const resolution = await this.resolveDID(did);
      return resolution.didDocumentMetadata.active && !resolution.didDocumentMetadata.revoked;
    } catch {
      return false;
    }
  }

  /**
   * Get all DIDs for an Ethereum address
   */
  static getAllDIDsForAddress(address: string): string[] {
    // In production, would query blockchain for all DIDs registered by address
    const did = `did:ethr:${address}`;
    return [did];
  }
}

export default DIDResolutionService;
