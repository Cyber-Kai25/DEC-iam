import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/middleware/auth';
import DIDService from '@/lib/services/did-service';
import { RBACService } from '@/lib/services/rbac-service';

/**
 * GET /api/identities
 * List user's identities (role-based filtering)
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

    // Check permission
    const hasPermission = RBACService.getRolePermissions(auth.activeRole).includes('identity:read:own');
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: No permission to read identities' },
        { status: 403 }
      );
    }

    // In production, fetch from Supabase
    // For now, return mock identities
    const mockIdentities = [
      {
        id: `identity_${auth.userId}_1`,
        did: `did:ethr:11155111:${auth.userId}`,
        walletAddress: `0x${Math.random().toString(16).slice(2, 42).padEnd(40, '0')}`,
        createdAt: new Date(),
        name: 'My Primary Identity',
        role: auth.activeRole,
      },
    ];

    console.log('[v0] Fetched identities for user:', { userId: auth.userId, count: mockIdentities.length });

    return NextResponse.json({
      success: true,
      data: mockIdentities,
    });
  } catch (error) {
    console.error('[v0] Get identities error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch identities' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/identities
 * Create a new identity
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

    // Check permission
    const hasPermission = RBACService.getRolePermissions(auth.activeRole).includes('identity:create');
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: No permission to create identities' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Validation error: name is required' },
        { status: 400 }
      );
    }

    // Create new identity using DIDService
    const identity = DIDService.generateDID();

    console.log('[v0] Created identity for user:', { userId: auth.userId, did: identity.did });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: `identity_${auth.userId}_${Date.now()}`,
          ...identity,
          name,
          description,
          role: auth.activeRole,
          createdAt: new Date(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[v0] Create identity error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create identity' },
      { status: 500 }
    );
  }
}
