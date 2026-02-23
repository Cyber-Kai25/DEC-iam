import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/middleware/auth';

/**
 * GET /api/organizations
 * Get organization for issuer/verifier
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

    if (!['issuer', 'verifier'].includes(auth.activeRole)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Only issuers and verifiers can have organizations' },
        { status: 403 }
      );
    }

    const organization = {
      id: `org_${auth.userId}`,
      name: auth.activeRole === 'issuer' ? 'My Credential Issuer' : 'My Credential Verifier',
      type: auth.activeRole,
      did: `did:ethr:11155111:${auth.userId}`,
      email: auth.email,
      createdAt: new Date(),
      description: `${auth.activeRole === 'issuer' ? 'Credential Issuer' : 'Credential Verifier'} Organization`,
    };

    console.log('[v0] Retrieved organization:', { orgId: organization.id, type: organization.type });

    return NextResponse.json({
      success: true,
      data: organization,
    });
  } catch (error) {
    console.error('[v0] Get organization error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch organization' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/organizations
 * Update organization details
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);

    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!['issuer', 'verifier'].includes(auth.activeRole)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, description, email } = body;

    const updatedOrg = {
      id: `org_${auth.userId}`,
      name: name || (auth.activeRole === 'issuer' ? 'My Credential Issuer' : 'My Credential Verifier'),
      type: auth.activeRole,
      did: `did:ethr:11155111:${auth.userId}`,
      email: email || auth.email,
      description: description || '',
      updatedAt: new Date(),
    };

    console.log('[v0] Updated organization:', { orgId: updatedOrg.id });

    return NextResponse.json({
      success: true,
      data: updatedOrg,
    });
  } catch (error) {
    console.error('[v0] Update organization error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update organization' },
      { status: 500 }
    );
  }
}
