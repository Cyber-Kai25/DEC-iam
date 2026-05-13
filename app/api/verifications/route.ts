import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/middleware/auth';
import { RBACService } from '@/lib/services/rbac-service';

/**
 * GET /api/verifications
 * List verification requests (role-based)
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

    let verifications: Record<string, unknown>[] = [];

    if (auth.activeRole === 'owner') {
      // Owners see verification requests they've received
      verifications = [
        {
          id: 'vreq_1',
          verifierDid: 'did:ethr:11155111:0x2222222222222222222222222222222222222222',
          verifierName: 'Acme Corp Verifier',
          requestedCredentials: ['UniversityDegree'],
          status: 'pending',
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      ];
    } else if (auth.activeRole === 'verifier') {
      // Verifiers see verification requests they created
      verifications = [
        {
          id: 'vreq_created_1',
          subjectDid: 'did:ethr:11155111:0x3333333333333333333333333333333333333333',
          requestedCredentials: ['VerifiedEmail', 'ProofOfKYC'],
          status: 'pending',
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      ];
    }

    console.log('[v0] Fetched verifications for user:', { userId: auth.userId, role: auth.activeRole, count: verifications.length });

    return NextResponse.json({
      success: true,
      data: verifications,
    });
  } catch (error) {
    console.error('[v0] Get verifications error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch verifications' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/verifications
 * Create verification request (verifier) or respond to request (owner)
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
    const { action, subjectDid, requestedCredentials, response, requestId } = body;

    if (action === 'create' && auth.activeRole === 'verifier') {
      // Create verification request
      if (!subjectDid || !requestedCredentials) {
        return NextResponse.json(
          { success: false, error: 'Validation error: subjectDid and requestedCredentials are required' },
          { status: 400 }
        );
      }

      const verification = {
        id: `vreq_${Date.now()}`,
        verifierDid: `did:ethr:11155111:${auth.userId}`,
        subjectDid,
        requestedCredentials,
        status: 'pending',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };

      console.log('[v0] Created verification request:', { requestId: verification.id });

      return NextResponse.json(
        { success: true, data: verification },
        { status: 201 }
      );
    } else if (action === 'respond' && auth.activeRole === 'owner') {
      // Respond to verification request
      if (!requestId || !response) {
        return NextResponse.json(
          { success: false, error: 'Validation error: requestId and response are required' },
          { status: 400 }
        );
      }

      console.log('[v0] Owner responded to verification:', { requestId, response });

      return NextResponse.json({
        success: true,
        data: {
          requestId,
          response,
          respondedAt: new Date(),
        },
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid action or insufficient permissions' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[v0] Verification operation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process verification' },
      { status: 500 }
    );
  }
}
