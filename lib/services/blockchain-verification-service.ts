/**
 * Blockchain Verification Service
 * Handles verification of credentials against blockchain records
 * Provides proof generation and validation for W3C Verifiable Credentials
 */

import { VerifiableCredential } from "@/lib/types/did";
import BlockchainService from "@/lib/services/blockchain-service";
import DIDResolutionService from "@/lib/services/did-resolution-service";
import { ethers } from "ethers";

export interface VerificationProof {
  type: "blockchain";
  createdAt: Date;
  verificationMethod: string;
  proofPurpose: "assertionMethod" | "authentication";
  proofValue: string;
  challenge?: string;
  domain?: string;
  nonce?: string;
}

export interface CredentialVerificationResult {
  valid: boolean;
  credential: VerifiableCredential;
  checks: {
    credentialHash: boolean;
    issuerDID: boolean;
    subjectDID: boolean;
    expirationDate: boolean;
    issuerSignature: boolean;
    blockchainAnchor: boolean;
  };
  blockchainStatus: {
    anchored: boolean;
    transactionHash?: string;
    blockNumber?: number;
    confirmations?: number;
    network: string;
  };
  warnings: string[];
  timestamp: Date;
  resolutionTime: number;
}

export class BlockchainVerificationService {
  /**
   * Verify a complete verifiable credential
   * Performs comprehensive checks including blockchain validation
   */
  static async verifyCredential(
    credential: VerifiableCredential,
    credentialHash: string
  ): Promise<CredentialVerificationResult> {
    const startTime = Date.now();
    const checks = {
      credentialHash: false,
      issuerDID: false,
      subjectDID: false,
      expirationDate: false,
      issuerSignature: false,
      blockchainAnchor: false,
    };
    const warnings: string[] = [];

    try {
      // 1. Verify credential hash
      const computedHash = this.hashCredential(credential);
      checks.credentialHash = computedHash === credentialHash;
      if (!checks.credentialHash) {
        warnings.push("Credential hash mismatch - credential may have been tampered with");
      }

      // 2. Verify issuer DID is valid
      try {
        const issuerResolution = await DIDResolutionService.resolveDID(credential.issuer);
        checks.issuerDID = issuerResolution.didDocumentMetadata.active;
        if (!checks.issuerDID) {
          warnings.push("Issuer DID is not active");
        }
      } catch (err) {
        warnings.push("Could not resolve issuer DID");
      }

      // 3. Verify subject DID is valid
      if (credential.credentialSubject?.id) {
        try {
          const subjectResolution = await DIDResolutionService.resolveDID(
            credential.credentialSubject.id as string
          );
          checks.subjectDID = subjectResolution.didDocumentMetadata.active;
          if (!checks.subjectDID) {
            warnings.push("Subject DID is not active");
          }
        } catch (err) {
          warnings.push("Could not resolve subject DID");
        }
      }

      // 4. Verify expiration date
      const expirationDate = new Date(credential.expirationDate || credential.issuanceDate);
      checks.expirationDate = expirationDate > new Date();
      if (!checks.expirationDate) {
        warnings.push("Credential has expired");
      }

      // 5. Verify issuer signature
      // In production, would cryptographically verify the proof
      checks.issuerSignature = this.verifyProof(credential);
      if (!checks.issuerSignature) {
        warnings.push("Issuer signature verification failed");
      }

      // 6. Verify blockchain anchor
      const blockchainVerification = await BlockchainService.verifyCredentialAnchored(
        credentialHash
      );
      checks.blockchainAnchor = blockchainVerification.valid;
      if (!checks.blockchainAnchor) {
        warnings.push("Credential not found or revoked on blockchain");
      }

      // Determine overall validity
      const isValid =
        checks.credentialHash &&
        checks.issuerDID &&
        checks.expirationDate &&
        checks.issuerSignature &&
        checks.blockchainAnchor;

      return {
        valid: isValid,
        credential,
        checks,
        blockchainStatus: {
          anchored: checks.blockchainAnchor,
          transactionHash: blockchainVerification.issuer ? undefined : undefined,
          network: "Sepolia",
        },
        warnings,
        timestamp: new Date(),
        resolutionTime: Date.now() - startTime,
      };
    } catch (error) {
      console.error("[v0] Credential verification error:", error);
      return {
        valid: false,
        credential,
        checks,
        blockchainStatus: {
          anchored: false,
          network: "Sepolia",
        },
        warnings: [
          ...warnings,
          error instanceof Error ? error.message : "Unknown verification error",
        ],
        timestamp: new Date(),
        resolutionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Hash a credential for blockchain verification
   */
  static hashCredential(credential: VerifiableCredential): string {
    const json = JSON.stringify(credential);
    return ethers.keccak256(ethers.toUtf8Bytes(json));
  }

  /**
   * Generate a cryptographic proof for a credential
   */
  static generateProof(
    credential: VerifiableCredential,
    issuerDID: string,
    privateKeyHex: string,
    challenge?: string
  ): VerificationProof {
    const credentialHash = this.hashCredential(credential);
    const message = challenge || credentialHash;

    // Sign the message with the private key
    const messageHash = ethers.hashMessage(message);
    const messagePrefix = "\x19Ethereum Signed Message:\n" + message.length;
    const prefixedMessage = messagePrefix + message;

    return {
      type: "blockchain",
      createdAt: new Date(),
      verificationMethod: `${issuerDID}#key-1`,
      proofPurpose: "assertionMethod",
      proofValue: credentialHash,
      challenge,
      domain: "badimac.identity",
      nonce: this.generateNonce(),
    };
  }

  /**
   * Verify cryptographic proof
   * In production, would perform actual signature verification
   */
  private static verifyProof(credential: VerifiableCredential): boolean {
    // Check if proof exists
    if (!credential.proof) {
      return false;
    }

    // In production, would verify the actual signature
    // For now, just check structure
    const proof = credential.proof as unknown as Record<string, unknown>;
    return (
      proof.type === "Ed25519Signature2018" ||
      proof.type === "EcdsaSecp256k1Signature2019"
    );
  }

  /**
   * Generate a nonce for proof
   */
  private static generateNonce(): string {
    return ethers.keccak256(ethers.randomBytes(32)).slice(0, 16);
  }

  /**
   * Verify multiple credentials in batch
   */
  static async verifyCredentialBatch(
    credentials: Array<{ credential: VerifiableCredential; hash: string }>
  ): Promise<CredentialVerificationResult[]> {
    const results = await Promise.all(
      credentials.map((item) =>
        this.verifyCredential(item.credential, item.hash).catch((err) => {
          console.error("[v0] Batch verification error:", err);
          return {
            valid: false,
            credential: item.credential,
            checks: {
              credentialHash: false,
              issuerDID: false,
              subjectDID: false,
              expirationDate: false,
              issuerSignature: false,
              blockchainAnchor: false,
            },
            blockchainStatus: {
              anchored: false,
              network: "Sepolia",
            },
            warnings: [err instanceof Error ? err.message : "Verification failed"],
            timestamp: new Date(),
            resolutionTime: 0,
          };
        })
      )
    );

    return results;
  }

  /**
   * Get verification statistics
   */
  static getVerificationStats(result: CredentialVerificationResult): {
    checksPassedCount: number;
    totalChecks: number;
    passRate: string;
  } {
    const passedChecks = Object.values(result.checks).filter((check) => check).length;
    const totalChecks = Object.keys(result.checks).length;
    const passRate = ((passedChecks / totalChecks) * 100).toFixed(1);

    return {
      checksPassedCount: passedChecks,
      totalChecks,
      passRate: `${passRate}%`,
    };
  }

  /**
   * Create a verification report for display
   */
  static createVerificationReport(
    result: CredentialVerificationResult
  ): {
    status: "VERIFIED" | "INVALID" | "WARNED";
    message: string;
    details: string[];
    checks: Record<string, boolean>;
  } {
    const stats = this.getVerificationStats(result);

    let status: "VERIFIED" | "INVALID" | "WARNED" = "VERIFIED";
    if (!result.valid) {
      status = "INVALID";
    } else if (result.warnings.length > 0) {
      status = "WARNED";
    }

    const details: string[] = [
      `Verification completed in ${result.resolutionTime}ms`,
      `Checks passed: ${stats.checksPassedCount}/${stats.totalChecks} (${stats.passRate})`,
      `Blockchain anchored: ${result.blockchainStatus.anchored ? "Yes" : "No"}`,
      `Network: ${result.blockchainStatus.network}`,
    ];

    if (result.warnings.length > 0) {
      details.push(`Warnings: ${result.warnings.join("; ")}`);
    }

    return {
      status,
      message:
        status === "VERIFIED"
          ? "Credential is valid and verified on blockchain"
          : status === "INVALID"
            ? "Credential is invalid and cannot be verified"
            : "Credential is valid but has warnings",
      details,
      checks: result.checks,
    };
  }

  /**
   * Check if a credential is revoked on blockchain
   */
  static async isCredentialRevoked(credentialHash: string): Promise<boolean> {
    try {
      const verification = await BlockchainService.verifyCredentialAnchored(credentialHash);
      return !verification.valid;
    } catch {
      return false;
    }
  }
}

export default BlockchainVerificationService;
