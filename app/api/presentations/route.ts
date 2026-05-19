import { NextRequest, NextResponse } from 'next/server';
import SupabaseRepository from '@/lib/services/supabase-repository';
import { RBACService } from '@/lib/services/rbac-service';
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrganizationDid } from '@/lib/services/organization-service';
import { ethers } from 'ethers';

/**
 * GET /api/presentations
 * List verifiable presentations exchanged via data_exchange_messages (role-based)
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

    const activeRole = (request.headers.get('x-active-role') as any) || 'owner';
    const hasPermission =
      activeRole === 'verifier'
        ? RBACService.getRolePermissions(activeRole).includes('credential:verify')
        : RBACService.getRolePermissions(activeRole).includes('credential:present');
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: No permission to read presentations' },
        { status: 403 }
      );
    }

    const admin = createAdminClient();

    const direction = activeRole === 'verifier' ? 'inbox' : 'outbox';

    let messages: any[] = [];

    if (activeRole === 'verifier') {
      const orgDid = (await getOrganizationDid(admin, user.id)) || undefined;
      const identities = await SupabaseRepository.getUserIdentities(user.id);
      const personalDid = identities[0]?.did;

      const dids = [orgDid, personalDid].filter((d): d is string => typeof d === 'string' && d.length > 0);
      if (dids.length === 0) {
        return NextResponse.json({ success: true, data: [] });
      }

      const chunks = await Promise.all(
        dids.map((d) => SupabaseRepository.getDataExchangeMessagesForDid(d, direction))
      );

      const merged = chunks.flat();
      const unique = new Map<string, any>();
      for (const m of merged) {
        unique.set(String(m.id), m);
      }
      messages = [...unique.values()];
    } else {
      const identities = await SupabaseRepository.getUserIdentities(user.id);
      const did = identities[0]?.did;
      if (!did) {
        return NextResponse.json({ success: true, data: [] });
      }

      messages = await SupabaseRepository.getDataExchangeMessagesForDid(did, direction);
    }

    const presentations = messages
      .filter((m) => {
        if (!m.encryptedData) return false;
        try {
          const parsed = JSON.parse(m.encryptedData);
          if (parsed?.kind === 'presentation' && parsed?.presentation) return true;
          if (parsed?.kind === 'verification-response' && parsed?.presentation) return true;
          return false;
        } catch {
          return false;
        }
      })
      .map((m) => {
        let parsed: any = null;
        try {
          parsed = JSON.parse(m.encryptedData);
        } catch {
          parsed = null;
        }

        const presentation = parsed?.presentation || null;

        return {
          id: m.id,
          fromDid: m.from,
          toDid: m.to,
          status: m.status,
          createdAt: m.timestamp,
          expiresAt: m.expiresAt,
          presentation,
        };
      });

    return NextResponse.json({
      success: true,
      data: presentations,
    });
  } catch (error) {
    console.error('[v0] Get presentations error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch presentations' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/presentations
 * Owner sends a verifiable presentation to a verifier via Supabase data_exchange_messages
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

    const activeRole = (request.headers.get('x-active-role') as any) || 'owner';
    if (activeRole !== 'owner') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Only owners can send presentations' },
        { status: 403 }
      );
    }

    const hasPermission = RBACService.getRolePermissions(activeRole).includes('credential:present');
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: No permission to send presentations' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { verifierDid, presentation, expiresInDays } = body as {
      verifierDid?: string;
      presentation?: unknown;
      expiresInDays?: number;
    };

    if (!verifierDid || !presentation) {
      return NextResponse.json(
        { success: false, error: 'Validation error: verifierDid and presentation are required' },
        { status: 400 }
      );
    }

    const identities = await SupabaseRepository.getUserIdentities(user.id);
    const ownerDid = identities[0]?.did;
    if (!ownerDid) {
      return NextResponse.json(
        { success: false, error: 'No owner identity found' },
        { status: 400 }
      );
    }

    const now = new Date();
    const expiresAt = new Date(
      Date.now() + (expiresInDays || 30) * 24 * 60 * 60 * 1000
    );

    const payload = JSON.stringify({ kind: 'presentation', presentation });

    const message = {
      id: `vp_${Date.now()}`,
      from: ownerDid,
      to: verifierDid,
      dataHash: ethers.keccak256(ethers.toUtf8Bytes(payload)),
      encryptedData: payload,
      encryptionAlgorithm: 'none',
      nonce: ethers.hexlify(ethers.randomBytes(8)),
      timestamp: now,
      expiresAt,
      status: 'pending' as const,
    };

    const admin = createAdminClient();
    const { data: savedRow, error: saveError } = await admin
      .from('data_exchange_messages')
      .upsert(
        {
          message_id: message.id,
          from_did: message.from,
          to_did: message.to,
          data_hash: message.dataHash,
          encrypted_data: message.encryptedData,
          encryption_algorithm: message.encryptionAlgorithm,
          nonce: message.nonce,
          status: message.status,
          credential_request: null,
          expires_at: message.expiresAt ? new Date(message.expiresAt) : null,
          read_at: null,
        },
        { onConflict: 'message_id' }
      )
      .select()
      .single();

    if (saveError || !savedRow) {
      return NextResponse.json(
        { success: false, error: (saveError as any)?.message || 'Failed to persist presentation message' },
        { status: 500 }
      );
    }

    const saved = (SupabaseRepository as any).mapDataExchangeMessageFromDB(savedRow) as any;

    return NextResponse.json({ success: true, data: saved }, { status: 201 });
  } catch (error) {
    console.error('[v0] Send presentation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send presentation' },
      { status: 500 }
    );
  }
}
