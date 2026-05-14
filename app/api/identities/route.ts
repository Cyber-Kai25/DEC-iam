import { NextRequest, NextResponse } from 'next/server';
import DIDService from '@/lib/services/did-service';
import { RBACService } from '@/lib/services/rbac-service';
import SupabaseRepository from '@/lib/services/supabase-repository';
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/identities
 * List user's identities from Supabase (role-based filtering)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check permission
    const activeRole = (request.headers.get('x-active-role') as any) || 'owner';
    const hasPermission = RBACService.getRolePermissions(activeRole).includes('identity:read:own');
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: No permission to read identities' },
        { status: 403 }
      );
    }

    // Fetch identities from Supabase
    const identities = await SupabaseRepository.getUserIdentities(user.id);

    console.log('[v0] Fetched identities for user:', { userId: user.id, count: identities.length });

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
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check permission
    const activeRole = (request.headers.get('x-active-role') as any) || 'owner';
    const hasPermission = RBACService.getRolePermissions(activeRole).includes('identity:create');
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: No permission to create identities' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, description } = body;

    const safeName = name || 'Owner Identity';

    // Create new identity using DIDService
    const identity = DIDService.createIdentity(safeName);
    
    // Attach metadata
    const identityWithMetadata = {
      ...identity,
      name: safeName,
      description,
      metadata: {
        userId: user.id,
        role: activeRole,
        createdAt: new Date().toISOString(),
      },
    };

    // Save to Supabase database - CRITICAL: Persist to DB
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('identities')
      .upsert(
        {
          did: identityWithMetadata.did,
          wallet_address: identityWithMetadata.walletAddress,
          public_key_hex: identityWithMetadata.publicKeyHex,
          private_key_hex: identityWithMetadata.privateKeyHex,
          name: identityWithMetadata.name,
          description: identityWithMetadata.description,
          did_document: identityWithMetadata.didDocument,
          metadata: identityWithMetadata.metadata,
          active: true,
        },
        { onConflict: 'did' }
      )
      .select()
      .single();

    const savedIdentity = !error && data ? (data as any) : null;
    
    if (!savedIdentity) {
      console.error('[v0] Failed to persist identity (admin insert):', error);
      return NextResponse.json(
        {
          success: false,
          error:
            (error as any)?.message ||
            'Failed to persist identity to database',
        },
        { status: 500 }
      );
    }

    console.log('[v0] Created and saved identity to Supabase:', { userId: user.id, did: (savedIdentity as any).did });

    return NextResponse.json(
      {
        success: true,
        data: await SupabaseRepository.getIdentity((savedIdentity as any).did),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[v0] Create identity error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create identity',
      },
      { status: 500 }
    );
  }
}
