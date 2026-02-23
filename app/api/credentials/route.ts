import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/middleware/auth';
import { RBACService } from '@/lib/services/rbac-service';
import VerificationService from '@/lib/services/verification-service';

/**
 * GET /api/credentials
 * List credentials (varies by role)
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

    // Role-specific credential retrieval
    let credentials = [];

    if (auth.activeRole === 'owner') {
      // Owners see credentials issued to them
      credentials = [
        {
          id: `cred_1`,
          subjectDid: `did:ethr:11155111:${auth.userId}`,
          type: 'UniversityDegree',
          status: 'active',
          issuedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          issuer: 'did:ethr:11155111:0x1234567890123456789012345678901234567890',
        },
      ];
    } else if (auth.activeRole === 'issuer') {
      // Issuers see credentials they issued
      credentials = [
        {
          id: `cred_issued_1`,
          subjectDid: 'did:ethr:11155111:0x9999999999999999999999999999999999999999',
          type: 'VerifiedEmail',
          status: 'active',
          issuedAt: new Date(),
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          issuerDid: `did:ethr:11155111:${auth.userId}`,
        },
      ];
    } else if (auth.activeRole === 'verifier') {
      // Verifiers see credentials they verified
      credentials = [];
    }

    console.log('[v0] Fetched credentials for user:', { userId: auth.userId, role: auth.activeRole, count: credentials.length });

    return NextResponse.json({
      success: true,
      data: credentials,
    });
  } catch (error) {
    console.error('[v0] Get credentials error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch credentials' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/credentials
 * Issue a new credential (issuer only)
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

    // Check issuer role
    if (auth.activeRole !== 'issuer') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Only issuers can issue credentials' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { subjectDid, credentialType, claims } = body;

    if (!subjectDid || !credentialType) {
      return NextResponse.json(
        { success: false, error: 'Validation error: subjectDid and credentialType are required' },
        { status: 400 }
      );
    }

    // Create verifiable credential
    const credential = {
      id: `cred_${Date.now()}`,
      subjectDid,
      type: credentialType,
      claims: claims || {},
      status: 'active',
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      issuerDid: `did:ethr:11155111:${auth.userId}`,
      signature: 'mock_signature_' + Math.random().toString(36).substr(2, 9),
    };

    console.log('[v0] Issued credential:', { credentialId: credential.id, type: credentialType });

    return NextResponse.json(
      {
        success: true,
        data: credential,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[v0] Issue credential error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to issue credential' },
      { status: 500 }
    );
  }
}
