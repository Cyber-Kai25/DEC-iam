import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/middleware/auth';
import SupabaseRepository from '@/lib/services/supabase-repository';
import { ethers } from 'ethers';

/**
 * GET /api/presentations
 * List verifiable presentations exchanged via data_exchange_messages (role-based)
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

    const direction = auth.activeRole === 'verifier' ? 'inbox' : 'outbox';
    const messages = await SupabaseRepository.getDataExchangeMessagesForDid(
      did,
      direction
    );

    const presentations = messages
      .filter((m) => {
        if (!m.encryptedData) return false;
        try {
          const parsed = JSON.parse(m.encryptedData);
          return parsed?.kind === 'presentation';
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

        return {
          id: m.id,
          fromDid: m.from,
          toDid: m.to,
          status: m.status,
          createdAt: m.timestamp,
          expiresAt: m.expiresAt,
          presentation: parsed?.presentation || null,
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
    const auth = await getAuthContext(request);

    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (auth.activeRole !== 'owner') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Only owners can send presentations' },
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

    const identities = await SupabaseRepository.getUserIdentities(auth.userId);
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

    const saved = await SupabaseRepository.saveDataExchangeMessage(message);
    if (!saved) {
      return NextResponse.json(
        { success: false, error: 'Failed to persist presentation message' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: saved }, { status: 201 });
  } catch (error) {
    console.error('[v0] Send presentation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send presentation' },
      { status: 500 }
    );
  }
}
