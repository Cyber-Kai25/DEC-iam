import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/middleware/auth';
import ProofGenerationHelper from '@/lib/services/proof-generation-helper';

/**
 * POST /api/zkp/selective-disclosure
 * Generate a selective disclosure proof
 * Reveals only specific attributes of a credential without revealing others
 * 
 * Use case: Share that you have a valid driver's license without sharing your license number
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
    const { credentialHash, secretKey, attributesToReveal } = body;

    if (!credentialHash || !secretKey) {
      return NextResponse.json(
        { success: false, error: 'credentialHash and secretKey are required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(attributesToReveal) || attributesToReveal.length === 0) {
      return NextResponse.json(
        { success: false, error: 'attributesToReveal must be a non-empty array' },
        { status: 400 }
      );
    }

    console.log('[v0] Generating selective disclosure proof:', {
      attributeCount: attributesToReveal.length,
      attributes: attributesToReveal,
    });

    const proofResponse = await ProofGenerationHelper.generateSelectiveDisclosureProof(
      credentialHash,
      attributesToReveal,
      secretKey
    );

    if (!proofResponse.success) {
      return NextResponse.json(
        { success: false, error: proofResponse.error },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          proof: proofResponse.proof,
          metadata: proofResponse.metadata,
          revealedAttributes: attributesToReveal,
          message: `Selective disclosure proof generated for ${attributesToReveal.length} attributes. Other attributes remain private.`,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[v0] Selective disclosure proof generation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate selective disclosure proof' },
      { status: 500 }
    );
  }
}
