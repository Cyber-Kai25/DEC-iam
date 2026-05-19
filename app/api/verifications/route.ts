import { NextRequest, NextResponse } from 'next/server';
import { RBACService } from '@/lib/services/rbac-service';
import SupabaseRepository from '@/lib/services/supabase-repository';
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrganizationDid } from '@/lib/services/organization-service';
import { ethers } from 'ethers';
import crypto from 'crypto';

/**
 * GET /api/verifications
 * List verification requests (role-based)
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
    const hasPermission = RBACService.getRolePermissions(activeRole).includes('verification:read:own');
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: No permission to read verifications' },
        { status: 403 }
      );
    }

    const admin = createAdminClient();

    let did: string | undefined;
    if (activeRole === 'verifier') {
      did = (await getOrganizationDid(admin, user.id)) || undefined;
    } else {
      const identities = await SupabaseRepository.getUserIdentities(user.id);
      did = identities[0]?.did;
    }

    if (!did) {
      return NextResponse.json({ success: true, data: [] });
    }

    const direction = activeRole === 'owner' ? 'inbox' : 'outbox';
    const messages = await SupabaseRepository.getDataExchangeMessagesForDid(
      did,
      direction
    );

    const verifications = messages
      .filter((m) => !!m.credentialRequest)
      .map((m) => ({
        id: m.id,
        verifierDid: m.from,
        subjectDid: m.to,
        requestedCredentials: m.credentialRequest?.credentialTypes || [],
        challenge: m.credentialRequest?.challenge,
        status: m.status,
        createdAt: m.timestamp,
        expiresAt: m.expiresAt,
        responsePayload: m.encryptedData,
      }));

    console.log('[v0] Fetched verifications for user:', { userId: user.id, role: activeRole, count: verifications.length });

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

    const body = await request.json();
    const { action, subjectDid, requestedCredentials, response, requestId, presentation } = body;

    if (action === 'create' && activeRole === 'verifier') {
      const hasPermission = RBACService.getRolePermissions(activeRole).includes('verification:create');
      if (!hasPermission) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: No permission to create verification requests' },
          { status: 403 }
        );
      }

      // Create verification request
      if (!subjectDid || !requestedCredentials) {
        return NextResponse.json(
          { success: false, error: 'Validation error: subjectDid and requestedCredentials are required' },
          { status: 400 }
        );
      }

      const admin = createAdminClient();
      const verifierDid = await getOrganizationDid(admin, user.id);
      if (!verifierDid) {
        return NextResponse.json(
          {
            success: false,
            error:
              'No verifier organization identity found. Visit Verifier > Organization to initialize your organization DID.',
          },
          { status: 400 }
        );
      }

      const now = new Date();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const challenge = ethers.hexlify(ethers.randomBytes(16));
      const credentialRequest = {
        id: `urn:uuid:${crypto.randomUUID()}`,
        requesterId: verifierDid,
        credentialTypes: requestedCredentials,
        challenge,
        createdAt: now,
        expiresAt,
      };

      const payload = JSON.stringify({ kind: 'verification-request', credentialRequest });
      const message = {
        id: `vreq_${Date.now()}`,
        from: verifierDid,
        to: subjectDid,
        dataHash: ethers.keccak256(ethers.toUtf8Bytes(payload)),
        encryptedData: payload,
        encryptionAlgorithm: 'none',
        nonce: ethers.hexlify(ethers.randomBytes(8)),
        timestamp: now,
        expiresAt,
        credentialRequest,
        status: 'pending' as const,
      };

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
            credential_request: (message.credentialRequest || null) as any,
            expires_at: message.expiresAt ? new Date(message.expiresAt) : null,
            read_at: null,
          },
          { onConflict: 'message_id' }
        )
        .select()
        .single();

      if (saveError || !savedRow) {
        console.error('[v0] Failed to persist verification request (admin upsert):', saveError);
        return NextResponse.json(
          { success: false, error: (saveError as any)?.message || 'Failed to persist verification request' },
          { status: 500 }
        );
      }

      const saved = (savedRow ? (SupabaseRepository as any).mapDataExchangeMessageFromDB(savedRow) : null) as any;
      if (!saved) {
        return NextResponse.json(
          { success: false, error: 'Failed to persist verification request' },
          { status: 500 }
        );
      }

      console.log('[v0] Created verification request:', { requestId: saved.id });

      return NextResponse.json(
        { success: true, data: saved },
        { status: 201 }
      );
    } else if (action === 'respond' && activeRole === 'owner') {
      const hasPermission = RBACService.getRolePermissions(activeRole).includes('verification:respond');
      if (!hasPermission) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: No permission to respond to verifications' },
          { status: 403 }
        );
      }

      // Respond to verification request
      if (!requestId || !response) {
        return NextResponse.json(
          { success: false, error: 'Validation error: requestId and response are required' },
          { status: 400 }
        );
      }

      const nextStatus = response === 'approved' ? 'accepted' : 'rejected';
      const responsePayload = JSON.stringify({
        kind: 'verification-response',
        response,
        respondedAt: new Date().toISOString(),
        presentation: presentation || null,
      });

      const admin = createAdminClient();
      const { data: updatedRow, error: updateError } = await admin
        .from('data_exchange_messages')
        .update({ status: nextStatus, encrypted_data: responsePayload })
        .eq('message_id', requestId)
        .select()
        .single();

      if (updateError || !updatedRow) {
        console.error('[v0] Failed to persist verification response (admin update):', updateError);
        return NextResponse.json(
          { success: false, error: (updateError as any)?.message || 'Failed to persist verification response' },
          { status: 500 }
        );
      }

      const updated = (SupabaseRepository as any).mapDataExchangeMessageFromDB(updatedRow) as any;

      console.log('[v0] Owner responded to verification:', { requestId, response, userId: user.id });

      return NextResponse.json({
        success: true,
        data: updated,
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
