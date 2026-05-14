import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/middleware/auth';
import AccessControlService from '@/lib/services/access-control-service';
import SupabaseRepository from '@/lib/services/supabase-repository';

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

    const identities = await SupabaseRepository.getUserIdentities(auth.userId);
    const ownerDid = identities[0]?.did;
    if (!ownerDid) {
      return NextResponse.json({ success: true, data: [] });
    }

    const policies = await SupabaseRepository.getPolicies(ownerDid);

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
    const { resourceId, resourceType, rules, policy } = body;

    if ((!policy && (!resourceId || !resourceType)) || (policy && !policy.resourceId)) {
      return NextResponse.json(
        { success: false, error: 'Validation error: resourceId and resourceType are required' },
        { status: 400 }
      );
    }

    const identities = await SupabaseRepository.getUserIdentities(auth.userId);
    const ownerDid = identities[0]?.did;
    if (!ownerDid) {
      return NextResponse.json(
        { success: false, error: 'No owner identity found' },
        { status: 400 }
      );
    }

    const policyToSave = policy
      ? { ...policy, owner: ownerDid }
      : {
          ...AccessControlService.createPolicy(resourceId, resourceType as any, ownerDid),
          rules: rules || [],
        };

    const saved = await SupabaseRepository.savePolicy(policyToSave, auth.userId);
    if (!saved) {
      return NextResponse.json(
        { success: false, error: 'Failed to persist policy' },
        { status: 500 }
      );
    }

    console.log('[v0] Saved policy:', { policyId: saved.id, resourceType: saved.resourceType });

    return NextResponse.json({ success: true, data: saved }, { status: 201 });
  } catch (error) {
    console.error('[v0] Create policy error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create policy' },
      { status: 500 }
    );
  }
}
