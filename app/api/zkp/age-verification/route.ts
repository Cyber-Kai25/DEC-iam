import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/middleware/auth';
import ProofGenerationHelper from '@/lib/services/proof-generation-helper';

/**
 * POST /api/zkp/age-verification
 * Generate an age verification proof
 * Proves user is over 18 without revealing exact age or birth date
 * 
 * Use case: Access age-restricted content without sharing personal birth date
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
    const { credentialHash, secretKey, birthDate } = body;

    if (!credentialHash || !secretKey || !birthDate) {
      return NextResponse.json(
        { success: false, error: 'credentialHash, secretKey, and birthDate are required' },
        { status: 400 }
      );
    }

    // Validate birth date
    let birthDateObj: Date;
    try {
      birthDateObj = new Date(birthDate);
      if (isNaN(birthDateObj.getTime())) {
        throw new Error('Invalid date');
      }
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid birthDate format. Use ISO 8601 (e.g., 2000-01-15)' },
        { status: 400 }
      );
    }

    // Calculate age
    const today = new Date();
    const age = today.getFullYear() - birthDateObj.getFullYear();
    const monthDiff = today.getMonth() - birthDateObj.getMonth();
    const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDateObj.getDate())
      ? age - 1
      : age;

    console.log('[v0] Generating age verification proof:', {
      age: actualAge,
      isOver18: actualAge >= 18,
    });

    if (actualAge < 0) {
      return NextResponse.json(
        { success: false, error: 'Birth date cannot be in the future' },
        { status: 400 }
      );
    }

    const proofResponse = await ProofGenerationHelper.generateAgeVerificationProof(
      credentialHash,
      birthDateObj,
      secretKey
    );

    if (!proofResponse.success) {
      return NextResponse.json(
        { success: false, error: proofResponse.error },
        { status: 400 }
      );
    }

    const isOver18 = actualAge >= 18;

    return NextResponse.json(
      {
        success: true,
        data: {
          proof: proofResponse.proof,
          metadata: proofResponse.metadata,
          ageVerification: {
            isOver18: isOver18,
            actualAge: actualAge,
            threshold: 18,
            message: isOver18
              ? 'Proof generated: You are over 18. Your exact age and birth date remain private.'
              : 'Cannot generate proof: You must be 18 or older.',
          },
        },
      },
      { status: isOver18 ? 201 : 400 }
    );
  } catch (error) {
    console.error('[v0] Age verification proof generation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate age verification proof' },
      { status: 500 }
    );
  }
}
