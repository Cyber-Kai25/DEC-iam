import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/middleware/auth';
import { RBACService } from '@/lib/services/rbac-service';
import ProofGenerationHelper from '@/lib/services/proof-generation-helper';
import ZKProofService from '@/lib/services/zkp-service';
import { ethers } from 'ethers';

/**
 * Zero-Knowledge Proof API Endpoints
 * Handles proof generation and verification for privacy-preserving credential operations
 */

/**
 * POST /api/zkp
 * Generate a zero-knowledge proof for a credential
 * Supports: ownership, selective disclosure, age verification
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);

    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { credentialId, credentialHash, proofType, secretKey, additionalData } = body;

    // Validation
    if (!credentialHash || !proofType) {
      return NextResponse.json(
        { success: false, error: 'credentialHash and proofType are required' },
        { status: 400 }
      );
    }

    if (!secretKey) {
      return NextResponse.json(
        { success: false, error: 'secretKey is required for proof generation' },
        { status: 400 }
      );
    }

    // Validate proof type
    const validProofTypes = ['ownership', 'selectiveDisclosure', 'ageVerification'];
    if (!validProofTypes.includes(proofType)) {
      return NextResponse.json(
        { success: false, error: `Invalid proofType. Must be one of: ${validProofTypes.join(', ')}` },
        { status: 400 }
      );
    }

    console.log('[v0] Generating ZK proof:', {
      credentialId,
      proofType,
      userId: auth.userId,
    });

    // Generate proof using helper
    const proofResponse = await ProofGenerationHelper.generateProof({
      credentialId: credentialId || credentialHash,
      credentialHash: credentialHash,
      proofType: proofType as any,
      secretKey: secretKey,
      additionalData: additionalData,
    });

    if (!proofResponse.success) {
      return NextResponse.json(
        { success: false, error: proofResponse.error },
        { status: 400 }
      );
    }

    console.log('[v0] ZK proof generated successfully:', {
      credentialId,
      proofType,
      generationTime: proofResponse.metadata?.generationTime,
      proofSize: proofResponse.metadata?.proofSize,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          proof: proofResponse.proof,
          metadata: proofResponse.metadata,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[v0] Proof generation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate proof' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/zkp/verify
 * Verify a zero-knowledge proof
 * Query params: proof (JSON stringified proof object)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);

    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const proofJson = searchParams.get('proof');

    if (!proofJson) {
      return NextResponse.json(
        { success: false, error: 'proof parameter is required' },
        { status: 400 }
      );
    }

    try {
      const proof = JSON.parse(proofJson);

      console.log('[v0] Verifying ZK proof:', {
        credentialHash: proof.credentialHash?.slice(0, 16),
        proofType: proof.proofType,
      });

      // Verify proof
      const verificationResult = await ZKProofService.verifyProof(
        proof.zkProof,
        proof.proofType
      );

      console.log('[v0] Proof verification result:', {
        valid: verificationResult.valid,
        proofType: proof.proofType,
      });

      return NextResponse.json({
        success: true,
        data: {
          valid: verificationResult.valid,
          credentialHash: verificationResult.credentialHash,
          proofType: verificationResult.proofType,
          revealedAttributes: verificationResult.revealedAttributes,
          timestamp: verificationResult.timestamp,
          error: verificationResult.error,
        },
      });
    } catch (parseError) {
      return NextResponse.json(
        { success: false, error: 'Invalid proof JSON' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[v0] Proof verification error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to verify proof' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/zkp
 * Batch verify multiple proofs
 * Body: { proofs: Array<{ proof, type }> }
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);

    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { proofs } = body;

    if (!Array.isArray(proofs)) {
      return NextResponse.json(
        { success: false, error: 'proofs must be an array' },
        { status: 400 }
      );
    }

    console.log('[v0] Batch verifying proofs:', { count: proofs.length });

    // Batch verify
    const results = await ZKProofService.batchVerifyProofs(proofs);

    const validCount = results.filter((r) => r.valid).length;

    console.log('[v0] Batch verification complete:', {
      total: proofs.length,
      valid: validCount,
      invalid: proofs.length - validCount,
    });

    return NextResponse.json({
      success: true,
      data: {
        results: results,
        summary: {
          total: proofs.length,
          valid: validCount,
          invalid: proofs.length - validCount,
        },
      },
    });
  } catch (error) {
    console.error('[v0] Batch verification error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to batch verify proofs' },
      { status: 500 }
    );
  }
}
