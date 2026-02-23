import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/middleware/auth';
import AccessControlService from '@/lib/services/access-control-service';

/**
 * GET /api/policies
 * List access control policies
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

    // Owners and verifiers can manage policies
    if (!['owner', 'verifier'].includes(auth.activeRole)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Only owners and verifiers can manage policies' },
        { status: 403 }
      );
    }

    const policies = [
      {
        id: `policy_${auth.userId}_1`,
        resourceId: 'all_credentials',
        resourceType: 'credential',
        owner: auth.userId,
        name: 'Default Access Policy',
        description: 'Allow verified verifiers to access credentials',
        rules: [
          {
            id: `rule_1`,
            subject: 'verified-verifier',
            action: 'read',
            resource: 'credential:*',
            effect: 'allow',
            conditions: [
              {
                type: 'credential-requirement',
                credentialType: 'VerifiedOrganization',
              },
            ],
          },
        ],
        active: true,
        createdAt: new Date(),
      },
    ];

    console.log('[v0] Fetched policies for user:', { userId: auth.userId, count: policies.length });

    return NextResponse.json({
      success: true,
      data: policies,
    });
  } catch (error) {
    console.error('[v0] Get policies error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch policies' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/policies
 * Create new access control policy
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

    if (!['owner', 'verifier'].includes(auth.activeRole)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { resourceId, resourceType, name, description, rules } = body;

    if (!resourceId || !resourceType || !name) {
      return NextResponse.json(
        { success: false, error: 'Validation error: resourceId, resourceType, and name are required' },
        { status: 400 }
      );
    }

    const policy = AccessControlService.createPolicy(resourceId, resourceType as any, auth.userId);

    console.log('[v0] Created policy:', { policyId: policy.id, resourceType });

    return NextResponse.json(
      {
        success: true,
        data: {
          ...policy,
          name,
          description,
          rules: rules || [],
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[v0] Create policy error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create policy' },
      { status: 500 }
    );
  }
}
