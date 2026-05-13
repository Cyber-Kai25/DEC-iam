import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/middleware/auth';
import DIDService from '@/lib/services/did-service';
import { RBACService } from '@/lib/services/rbac-service';
import SupabaseRepository from '@/lib/services/supabase-repository';

/**
 * GET /api/identities
 * List user's identities from Supabase (role-based filtering)
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

    // Fetch identities from Supabase
    const identities = await SupabaseRepository.getUserIdentities(auth.userId);

    console.log('[v0] Fetched identities for user:', { userId: auth.userId, count: identities.length });

    return NextResponse.json({
      success: true,
      data: identities,
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
    const identity = DIDService.createIdentity(name);
    
    // Attach metadata
    const identityWithMetadata = {
      ...identity,
      name,
      description,
      metadata: {
        userId: auth.userId,
        role: auth.activeRole,
        createdAt: new Date().toISOString(),
      },
    };

    // Save to Supabase database - CRITICAL: Persist to DB
    const savedIdentity = await SupabaseRepository.saveIdentity(identityWithMetadata, auth.userId);
    
    if (!savedIdentity) {
      return NextResponse.json(
        { success: false, error: 'Failed to persist identity to database' },
        { status: 500 }
      );
    }

    console.log('[v0] Created and saved identity to Supabase:', { userId: auth.userId, did: savedIdentity.did });

    return NextResponse.json(
      {
        success: true,
        data: savedIdentity,
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
