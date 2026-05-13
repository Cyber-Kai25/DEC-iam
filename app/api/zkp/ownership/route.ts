import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/middleware/auth';
import ProofGenerationHelper from '@/lib/services/proof-generation-helper';

/**
 * POST /api/zkp/ownership
 * Generate a credential ownership proof
 * Proves the user owns a credential without revealing the credential itself
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
    const { credentialHash, secretKey } = body;

    if (!credentialHash || !secretKey) {
      return NextResponse.json(
        { success: false, error: 'credentialHash and secretKey are required' },
        { status: 400 }
      );
    }

    console.log('[v0] Generating ownership proof for credential');

    const proofResponse = await ProofGenerationHelper.generateOwnershipProof(
      credentialHash,
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
          message: 'Credential ownership proof generated. Can be used to prove ownership without revealing the credential.',
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[v0] Ownership proof generation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate ownership proof' },
      { status: 500 }
    );
  }
}
