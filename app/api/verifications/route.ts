import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/middleware/auth';
import { RBACService } from '@/lib/services/rbac-service';
import SupabaseRepository from '@/lib/services/supabase-repository';
import { ethers } from 'ethers';

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

    const identities = await SupabaseRepository.getUserIdentities(auth.userId);
    const did = identities[0]?.did;
    if (!did) {
      return NextResponse.json({ success: true, data: [] });
    }

    const direction = auth.activeRole === 'owner' ? 'inbox' : 'outbox';
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
    const { action, subjectDid, requestedCredentials, response, requestId, presentation } = body;

    if (action === 'create' && auth.activeRole === 'verifier') {
      // Create verification request
      if (!subjectDid || !requestedCredentials) {
        return NextResponse.json(
          { success: false, error: 'Validation error: subjectDid and requestedCredentials are required' },
          { status: 400 }
        );
      }

      const identities = await SupabaseRepository.getUserIdentities(auth.userId);
      const verifierDid = identities[0]?.did;
      if (!verifierDid) {
        return NextResponse.json(
          { success: false, error: 'No verifier identity found' },
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

      const saved = await SupabaseRepository.saveDataExchangeMessage(message);
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
    } else if (action === 'respond' && auth.activeRole === 'owner') {
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

      const updated = await SupabaseRepository.updateDataExchangeMessageStatus(
        requestId,
        nextStatus,
        responsePayload
      );

      if (!updated) {
        return NextResponse.json(
          { success: false, error: 'Failed to persist verification response' },
          { status: 500 }
        );
      }

      console.log('[v0] Owner responded to verification:', { requestId, response });

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
