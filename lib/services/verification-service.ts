// Identity Verification Service
// Implements Zero-Knowledge Proofs, Digital Signatures, and Verifiable Credentials

import {
  VerifiableCredential,
  VerifiablePresentation,
  Proof,
  VerificationResult,
  ZKProof,
  ZKProofRequest,
} from "@/lib/types/did";
import KeyManagement from "@/lib/crypto/key-management";
import { ethers } from "ethers";

export class VerificationService {
  /**
   * Create a signed verifiable credential
   */
  static createVerifiableCredential(
    issuerDID: string,
    subjectDID: string,
    credentialType: string,
    credentialSubject: Record<string, unknown>,
    privateKey: string,
    expirationDays: number = 365
  ): VerifiableCredential {
    const issuanceDate = new Date();
    const expirationDate = new Date(issuanceDate);
    expirationDate.setDate(expirationDate.getDate() + expirationDays);

    const credentialId = `urn:uuid:${this.generateUUID()}`;

    const unsignedCredential: Partial<VerifiableCredential> = {
      "@context": [
        "https://www.w3.org/2018/credentials/v1",
        "https://w3id.org/security/suites/secp256k1-2019/v1",
      ],
      id: credentialId,
      type: ["VerifiableCredential", credentialType],
      issuer: issuerDID,
      issuanceDate: issuanceDate.toISOString(),
      expirationDate: expirationDate.toISOString(),
      credentialSubject: {
        id: subjectDID,
        ...credentialSubject,
      },
    };

    // Create proof
    const proofStr = JSON.stringify(unsignedCredential);
    const signature = KeyManagement.signMessage(privateKey, proofStr);

    const proof: Proof = {
      type: "EcdsaSecp256k1Signature2019",
      created: new Date().toISOString(),
      verificationMethod: `${issuerDID}#keys-1`,
      signatureValue: signature,
      domain: "identity-system",
      challenge: KeyManagement.generateNonce(),
    };

    return {
      ...(unsignedCredential as VerifiableCredential),
      proof,
    };
  }

  /**
   * Verify a verifiable credential signature
   */
  static verifyCredentialSignature(
    credential: VerifiableCredential,
    issuerAddress: string
  ): boolean {
    if (!credential.proof || !credential.proof.signatureValue) {
      return false;
    }

    try {
      // Reconstruct the original credential for signing
      const { proof, ...credentialWithoutProof } = credential;
      const credentialStr = JSON.stringify(credentialWithoutProof);

      return KeyManagement.verifySignature(
        credentialStr,
        credential.proof.signatureValue,
        issuerAddress
      );
    } catch {
      return false;
    }
  }

  /**
   * Verify credential expiration
   */
  static isCredentialValid(credential: VerifiableCredential): boolean {
    if (credential.expirationDate) {
      const expDate = new Date(credential.expirationDate);
      return expDate > new Date();
    }
    return true;
  }

  /**
   * Verify complete credential
   */
  static verifyCredential(
    credential: VerifiableCredential,
    issuerAddress?: string
  ): VerificationResult {
    // Check expiration
    if (!this.isCredentialValid(credential)) {
      return {
        valid: false,
        issuer: credential.issuer,
        error: "Credential has expired",
      };
    }

    // Verify signature if issuer address provided
    if (issuerAddress) {
      if (!this.verifyCredentialSignature(credential, issuerAddress)) {
        return {
          valid: false,
          issuer: credential.issuer,
          error: "Credential signature verification failed",
        };
      }
    }

    return {
      valid: true,
      issuer: credential.issuer,
      subject: credential.credentialSubject?.id as string,
      credentialType: Array.isArray(credential.type)
        ? credential.type[1]
        : credential.type,
      expirationDate: credential.expirationDate,
    };
  }

  /**
   * Create a Zero-Knowledge Proof request
   */
  static createZKProofRequest(
    proofType: string,
    publicInputs: Record<string, unknown>,
    expirationMinutes: number = 10
  ): ZKProofRequest {
    const challenge = KeyManagement.generateNonce();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + expirationMinutes);

    return {
      id: `urn:uuid:${this.generateUUID()}`,
      proofType,
      publicInputs,
      challenge,
      createdAt: new Date(),
    };
  }

  /**
   * Verify a Zero-Knowledge Proof (simplified implementation)
   * In production, use libraries like circom, snarkjs, or zk-SNARK protocols
   */
  static verifyZKProof(proof: ZKProof): boolean {
    // Basic validation
    if (!proof.proof || !proof.verificationKey) {
      return false;
    }

    // In a real implementation, this would:
    // 1. Parse the proof format (typically JSON encoded)
    // 2. Use a ZK verification library to verify against the public inputs
    // 3. Ensure the proof was created within the valid time window

    // For demonstration, we'll do basic structure validation
    try {
      const proofData = JSON.parse(proof.proof);
      return (
        proofData.pi_a &&
        proofData.pi_b &&
        proofData.pi_c &&
        proof.publicInputs &&
        Object.keys(proof.publicInputs).length > 0
      );
    } catch {
      return false;
    }
  }

  /**
   * Create a simple ZKP proof (mock for demonstration)
   * In production, use actual ZK-SNARK libraries
   */
  static createZKProof(
    request: ZKProofRequest,
    privateInputs: Record<string, unknown>
  ): ZKProof {
    // This is a simplified mock. In production, use:
    // - circom for circuit design
    // - snarkjs for proof generation
    // - or other ZK libraries

    const proofData = {
      pi_a: this.generateProofComponent(),
      pi_b: [this.generateProofComponent(), this.generateProofComponent()],
      pi_c: this.generateProofComponent(),
      protocol: "groth16",
      curve: "bn128",
    };

    return {
      id: `urn:uuid:${this.generateUUID()}`,
      proofType: request.proofType,
      proof: JSON.stringify(proofData),
      publicInputs: request.publicInputs,
      verificationKey: ethers.keccak256(ethers.toBeHex("verification-key")),
      verified: false,
    };
  }

  /**
   * Verify multiple credentials (for policy enforcement)
   */
  static verifyCredentialSet(
    credentials: VerifiableCredential[],
    requiredTypes: string[]
  ): VerificationResult {
    const credentialTypes: Set<string> = new Set();

    for (const credential of credentials) {
      if (!this.isCredentialValid(credential)) {
        return {
          valid: false,
          error: `Credential ${credential.id} has expired`,
        };
      }

      const types = Array.isArray(credential.type)
        ? credential.type.filter((t) => t !== "VerifiableCredential")
        : [];
      types.forEach((t) => credentialTypes.add(t));
    }

    // Check if all required types are present
    const missingTypes = requiredTypes.filter((t) => !credentialTypes.has(t));

    if (missingTypes.length > 0) {
      return {
        valid: false,
        error: `Missing required credential types: ${missingTypes.join(", ")}`,
      };
    }

    return {
      valid: true,
      credentialType: Array.from(credentialTypes).join(", "),
    };
  }

  /**
   * Create a credential presentation
   * Used when sharing credentials with a verifier
   */
  static createPresentation(
    credentials: VerifiableCredential[],
    holderDID: string,
    verifierDID: string,
    challenge: string,
    privateKey: string
  ): {
    presentation: VerifiablePresentation;
    proofValue: string;
  } {
    const presentationWithoutProof: Omit<VerifiablePresentation, "proof"> = {
      "@context": [
        "https://www.w3.org/2018/credentials/v1",
        "https://w3id.org/security/suites/secp256k1-2019/v1",
      ],
      type: ["VerifiablePresentation"],
      holder: holderDID,
      verifiableCredential: credentials,
      id: `urn:uuid:${this.generateUUID()}`,
      created: new Date().toISOString(),
    };

    // Sign the presentation content WITHOUT the proof (mirrors VC signing flow)
    const proofStr = JSON.stringify(presentationWithoutProof);
    const proofValue = KeyManagement.signMessage(privateKey, proofStr);

    const proof: Proof = {
      type: "EcdsaSecp256k1Signature2019",
      challenge,
      domain: verifierDID,
      created: new Date().toISOString(),
      verificationMethod: `${holderDID}#keys-1`,
      signatureValue: proofValue,
    };

    return {
      presentation: {
        ...(presentationWithoutProof as VerifiablePresentation),
        proof,
      },
      proofValue,
    };
  }

  /**
   * Verify a presentation
   */
  static verifyPresentation(
    presentation: VerifiablePresentation,
    holderAddress: string
  ): VerificationResult {
    if (!presentation.verifiableCredential || presentation.verifiableCredential.length === 0) {
      return {
        valid: false,
        error: "Presentation contains no credentials",
      };
    }

    // Verify all credentials in the presentation
    for (const credential of presentation.verifiableCredential) {
      if (!this.isCredentialValid(credential)) {
        return {
          valid: false,
          error: `Credential in presentation has expired`,
        };
      }
    }

    // Verify presentation proof
    if (presentation.proof && presentation.proof.signatureValue) {
      const { proof, ...presentationWithoutProof } = presentation;
      const presentationStr = JSON.stringify(presentationWithoutProof);

      const isValid = KeyManagement.verifySignature(
        presentationStr,
        presentation.proof.signatureValue,
        holderAddress
      );

      if (!isValid) {
        return {
          valid: false,
          error: "Presentation signature verification failed",
        };
      }
    }

    return {
      valid: true,
      subject: presentation.holder,
      credentialType: `${presentation.verifiableCredential.length} credentials`,
    };
  }

  /**
   * Generate UUID v4
   */
  private static generateUUID(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Generate a proof component for mock ZK proofs
   */
  private static generateProofComponent(): string {
    return ethers.hexlify(ethers.randomBytes(32));
  }
}

export default VerificationService;
