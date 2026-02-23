// DID Creation, Management, and Verification Service
import { DIDDocument, Identity, VerificationMethod } from "@/lib/types/did";
import KeyManagement from "@/lib/crypto/key-management";
import { ethers } from "ethers";

const SEPOLIA_CHAIN_ID = 11155111;
const DID_CONTEXT = ["https://www.w3.org/ns/did/v1"];

export class DIDService {
  /**
   * Create a new DID identity
   */
  static createIdentity(name?: string): Identity {
    const { publicKey, privateKey, address } =
      KeyManagement.generateKeyPair();
    const did = KeyManagement.createDID(address, SEPOLIA_CHAIN_ID);

    const didDocument = this.createDIDDocument(did, address, publicKey);

    return {
      id: ethers.keccak256(ethers.toUtf8Bytes(did)),
      did,
      didDocument,
      publicKeyHex: publicKey,
      privateKeyHex: privateKey,
      publicKey: new Uint8Array(Buffer.from(publicKey.slice(2), "hex")),
      privateKey: new Uint8Array(Buffer.from(privateKey.slice(2), "hex")),
      walletAddress: address,
      createdAt: new Date(),
      updatedAt: new Date(),
      name: name || `Identity-${address.slice(-6)}`,
      metadata: {
        algorithm: "ECDSA",
        curve: "secp256k1",
        encoding: "hex",
      },
    };
  }

  /**
   * Create a W3C compliant DID Document
   */
  private static createDIDDocument(
    did: string,
    address: string,
    publicKey: string
  ): DIDDocument {
    const publicKeyId = `${did}#keys-1`;
    const authenticationId = `${did}#authentication-1`;

    const verificationMethod: VerificationMethod = {
      id: publicKeyId,
      type: "EcdsaSecp256k1VerificationKey2019",
      controller: did,
      publicKeyHex: publicKey.slice(2),
    };

    return {
      "@context": [
        "https://www.w3.org/ns/did/v1",
        "https://w3id.org/security/suites/secp256k1-2019/v1",
      ],
      id: did,
      publicKey: [
        {
          id: publicKeyId,
          type: "EcdsaSecp256k1VerificationKey2019",
          controller: did,
          publicKeyHex: publicKey.slice(2),
        },
      ],
      verificationMethod: [verificationMethod],
      authentication: [authenticationId],
      assertionMethod: [publicKeyId],
      keyAgreement: [publicKeyId],
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      service: [
        {
          id: `${did}#website`,
          type: "LinkedDomains",
          serviceEndpoint: "https://example.com",
        },
      ],
    };
  }

  /**
   * Parse and validate a DID string
   */
  static parseDID(did: string): {
    method: string;
    chainId?: number;
    address?: string;
    valid: boolean;
  } {
    const didRegex = /^did:([a-z]+)(?::([a-z0-9-]+))*:(.+)$/i;
    const match = did.match(didRegex);

    if (!match) {
      return { method: "", valid: false };
    }

    const [, method, chainId, identifier] = match;

    if (method.toLowerCase() === "ethr") {
      // did:ethr:11155111:0x...
      const ethRegex = /^(\d+):(.+)$/;
      const ethMatch = identifier.match(ethRegex);

      if (ethMatch) {
        const [, chain, address] = ethMatch;
        return {
          method,
          chainId: parseInt(chain),
          address,
          valid: KeyManagement.isValidAddress(address),
        };
      }
    }

    return { method, valid: false };
  }

  /**
   * Resolve DID to DID Document (local resolution for now)
   * In production, this would query a blockchain resolver
   */
  static resolveDID(did: string, identityStore: Map<string, Identity>): DIDDocument | null {
    const parsedDID = this.parseDID(did);

    if (!parsedDID.valid) {
      return null;
    }

    // Search for identity with matching DID
    for (const identity of identityStore.values()) {
      if (identity.did === did) {
        return identity.didDocument;
      }
    }

    return null;
  }

  /**
   * Update DID Document with new verification methods
   */
  static updateDIDDocument(
    identity: Identity,
    updates: Partial<DIDDocument>
  ): DIDDocument {
    const updated = {
      ...identity.didDocument,
      ...updates,
      id: identity.did,
      updated: new Date().toISOString(),
    };

    return updated;
  }

  /**
   * Add a new verification method to DID Document
   */
  static addVerificationMethod(
    identity: Identity,
    method: VerificationMethod
  ): DIDDocument {
    const updated = { ...identity.didDocument };

    // Add to verification method list
    if (!updated.verificationMethod) {
      updated.verificationMethod = [];
    }
    updated.verificationMethod.push(method);

    // Add reference to appropriate capability
    if (method.type.includes("VerificationKey")) {
      if (!updated.assertionMethod) {
        updated.assertionMethod = [];
      }
      updated.assertionMethod.push(method.id);
    }

    updated.updated = new Date().toISOString();
    return updated;
  }

  /**
   * Add a service endpoint to DID Document
   */
  static addService(
    identity: Identity,
    serviceType: string,
    serviceEndpoint: string
  ): DIDDocument {
    const updated = { ...identity.didDocument };

    if (!updated.service) {
      updated.service = [];
    }

    const serviceId = `${identity.did}#${serviceType.toLowerCase()}`;
    updated.service.push({
      id: serviceId,
      type: serviceType,
      serviceEndpoint,
    });

    updated.updated = new Date().toISOString();
    return updated;
  }

  /**
   * Export identity for backup (includes private key)
   * WARNING: This should only be done in secure environments
   */
  static exportIdentity(identity: Identity): string {
    return JSON.stringify(
      {
        did: identity.did,
        publicKeyHex: identity.publicKeyHex,
        privateKeyHex: identity.privateKeyHex,
        walletAddress: identity.walletAddress,
        name: identity.name,
        didDocument: identity.didDocument,
        createdAt: identity.createdAt,
      },
      null,
      2
    );
  }

  /**
   * Import identity from exported JSON
   */
  static importIdentity(exportedJson: string): Identity | null {
    try {
      const data = JSON.parse(exportedJson);

      return {
        id: ethers.keccak256(ethers.toBeHex(data.did)),
        did: data.did,
        didDocument: data.didDocument,
        publicKeyHex: data.publicKeyHex,
        privateKeyHex: data.privateKeyHex,
        publicKey: new Uint8Array(
          Buffer.from(data.publicKeyHex.slice(2), "hex")
        ),
        privateKey: data.privateKeyHex
          ? new Uint8Array(Buffer.from(data.privateKeyHex.slice(2), "hex"))
          : undefined,
        walletAddress: data.walletAddress,
        createdAt: new Date(data.createdAt),
        updatedAt: new Date(),
        name: data.name,
      };
    } catch {
      return null;
    }
  }

  /**
   * Verify DID Document integrity
   */
  static verifyDIDDocumentIntegrity(didDocument: DIDDocument): boolean {
    // Basic validation
    if (!didDocument.id || !this.parseDID(didDocument.id).valid) {
      return false;
    }

    if (!Array.isArray(didDocument.verificationMethod) || didDocument.verificationMethod.length === 0) {
      return false;
    }

    // Verify all verification methods have required fields
    for (const method of didDocument.verificationMethod) {
      if (!method.id || !method.type || !method.controller) {
        return false;
      }
    }

    return true;
  }
}

export default DIDService;
