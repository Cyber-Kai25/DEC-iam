import ZKProofService, { ZKProof, CredentialProof } from './zkp-service';
import { ethers } from 'ethers';

/**
 * Proof Generation Helper
 * High-level API for generating various types of ZK proofs
 * Handles user-friendly proof creation workflow
 */

export interface ProofRequest {
  credentialId: string;
  credentialHash: string;
  proofType: 'ownership' | 'selectiveDisclosure' | 'ageVerification';
  secretKey: string;
  additionalData?: {
    attributesToReveal?: string[];
    birthDate?: Date;
  };
}

export interface ProofResponse {
  success: boolean;
  proof?: CredentialProof;
  error?: string;
  metadata?: {
    generationTime: number;
    circuitName: string;
    proofSize: number;
  };
}

class ProofGenerationHelper {
  /**
   * Generate a proof based on request type
   * Handles all proof generation workflows
   */
  static async generateProof(request: ProofRequest): Promise<ProofResponse> {
    const startTime = Date.now();

    try {
      console.log('[v0] Generating proof:', { 
        credentialId: request.credentialId, 
        type: request.proofType 
      });

      let zkProof: ZKProof;
      let circuitName: string;

      // Generate appropriate proof based on type
      switch (request.proofType) {
        case 'ownership':
          zkProof = await ZKProofService.generateCredentialOwnershipProof(
            request.credentialHash,
            request.secretKey
          );
          circuitName = 'credentialOwnership.circom';
          break;

        case 'selectiveDisclosure':
          if (!request.additionalData?.attributesToReveal) {
            return {
              success: false,
              error: 'attributesToReveal is required for selective disclosure proofs',
            };
          }
          zkProof = await ZKProofService.generateSelectiveDisclosureProof(
            request.credentialHash,
            request.additionalData.attributesToReveal,
            request.secretKey
          );
          circuitName = 'selectiveDisclosure.circom';
          break;

        case 'ageVerification':
          if (!request.additionalData?.birthDate) {
            return {
              success: false,
              error: 'birthDate is required for age verification proofs',
            };
          }
          zkProof = await ZKProofService.generateAgeVerificationProof(
            request.credentialHash,
            request.additionalData.birthDate,
            request.secretKey
          );
          circuitName = 'ageVerification.circom';
          break;

        default:
          return {
            success: false,
            error: `Unknown proof type: ${request.proofType}`,
          };
      }

      // Create credential proof with metadata
      const credentialProof: CredentialProof = {
        credentialHash: request.credentialHash,
        proofType: request.proofType as any,
        zkProof: zkProof,
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      };

      const generationTime = Date.now() - startTime;

      console.log('[v0] Proof generated successfully:', {
        credentialId: request.credentialId,
        type: request.proofType,
        generationTime: `${generationTime}ms`,
      });

      return {
        success: true,
        proof: credentialProof,
        metadata: {
          generationTime: generationTime,
          circuitName: circuitName,
          proofSize: JSON.stringify(zkProof).length,
        },
      };
    } catch (error) {
      console.error('[v0] Proof generation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during proof generation',
      };
    }
  }

  /**
   * Generate ownership proof for a credential
   * Quickest proof type - just proves ownership
   */
  static async generateOwnershipProof(
    credentialHash: string,
    secretKey: string
  ): Promise<ProofResponse> {
    return this.generateProof({
      credentialId: credentialHash,
      credentialHash: credentialHash,
      proofType: 'ownership',
      secretKey: secretKey,
    });
  }

  /**
   * Generate selective disclosure proof
   * Reveals only specific attributes
   */
  static async generateSelectiveDisclosureProof(
    credentialHash: string,
    attributesToReveal: string[],
    secretKey: string
  ): Promise<ProofResponse> {
    return this.generateProof({
      credentialId: credentialHash,
      credentialHash: credentialHash,
      proofType: 'selectiveDisclosure',
      secretKey: secretKey,
      additionalData: { attributesToReveal },
    });
  }

  /**
   * Generate age verification proof
   * Proves user is over 18 without revealing age
   */
  static async generateAgeVerificationProof(
    credentialHash: string,
    birthDate: Date,
    secretKey: string
  ): Promise<ProofResponse> {
    return this.generateProof({
      credentialId: credentialHash,
      credentialHash: credentialHash,
      proofType: 'ageVerification',
      secretKey: secretKey,
      additionalData: { birthDate },
    });
  }

  /**
   * Verify a generated proof
   * Validates proof without learning secrets
   */
  static async verifyProof(proof: CredentialProof): Promise<{
    valid: boolean;
    details: {
      credentialHash: string;
      proofType: string;
      revealedAttributes: Record<string, any>;
      generatedAt: Date;
      expiresAt: Date;
      isExpired: boolean;
    };
    error?: string;
  }> {
    try {
      // Check if proof is expired
      const isExpired = new Date() > proof.expiresAt;

      if (isExpired) {
        return {
          valid: false,
          details: {
            credentialHash: proof.credentialHash,
            proofType: proof.proofType,
            revealedAttributes: {},
            generatedAt: proof.generatedAt,
            expiresAt: proof.expiresAt,
            isExpired: true,
          },
          error: 'Proof has expired',
        };
      }

      // Verify the proof
      const verificationResult = await ZKProofService.verifyProof(
        proof.zkProof,
        proof.proofType
      );

      return {
        valid: verificationResult.valid,
        details: {
          credentialHash: proof.credentialHash,
          proofType: proof.proofType,
          revealedAttributes: verificationResult.revealedAttributes,
          generatedAt: proof.generatedAt,
          expiresAt: proof.expiresAt,
          isExpired: false,
        },
        error: verificationResult.error,
      };
    } catch (error) {
      console.error('[v0] Proof verification failed:', error);
      return {
        valid: false,
        details: {
          credentialHash: proof.credentialHash,
          proofType: proof.proofType,
          revealedAttributes: {},
          generatedAt: proof.generatedAt,
          expiresAt: proof.expiresAt,
          isExpired: false,
        },
        error: error instanceof Error ? error.message : 'Unknown verification error',
      };
    }
  }

  /**
   * Create a secret key for a user
   * Used to generate proofs - must be kept private
   */
  static generateSecretKey(userId: string, credentialId: string): string {
    const combined = `${userId}:${credentialId}:${Date.now()}`;
    return ethers.keccak256(ethers.toUtf8Bytes(combined));
  }

  /**
   * Hash credential data for proof input
   */
  static hashCredentialData(credentialData: Record<string, any>): string {
    return ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(credentialData)));
  }

  /**
   * Get proof metadata for UI display
   */
  static getProofMetadata(proof: CredentialProof): {
    type: string;
    isValid: boolean;
    isExpired: boolean;
    ageInSeconds: number;
    timeToExpire: number;
  } {
    const now = new Date();
    const ageInSeconds = Math.floor((now.getTime() - proof.generatedAt.getTime()) / 1000);
    const timeToExpire = Math.floor((proof.expiresAt.getTime() - now.getTime()) / 1000);

    return {
      type: proof.proofType,
      isValid: timeToExpire > 0,
      isExpired: timeToExpire <= 0,
      ageInSeconds: ageInSeconds,
      timeToExpire: Math.max(0, timeToExpire),
    };
  }
}

export default ProofGenerationHelper;
