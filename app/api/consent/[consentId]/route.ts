// Consent Record Management Endpoints
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/middleware/auth';
import { RBACService } from '@/lib/services/rbac-service';
import ConsentManagementService from '@/lib/services/consent-management-service';
import SupabaseRepository from '@/lib/services/supabase-repository';

interface RouteParams {
  params: Promise<{
    consentId: string;
  }>;
}

/**
 * GET /api/consent/[consentId]
 * Get specific consent record
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getAuthContext(request);

    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { consentId } = await params;

    // Fetch from Supabase
    const consentRecord = await SupabaseRepository.getConsentRecord(consentId);

    if (!consentRecord) {
      return NextResponse.json(
        { success: false, error: 'Consent record not found' },
        { status: 404 }
      );
    }

    // Verify user owns this consent record
    if (consentRecord.userId !== auth.userId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Cannot access this consent record' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: consentRecord,
    });
  } catch (error) {
    console.error('[v0] Get consent record error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch consent record' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/consent/[consentId]/approve
 * Grant/approve consent
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getAuthContext(request);

    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { consentId } = await params;
    const body = await request.json();
    const { action } = body; // 'grant', 'deny', 'revoke'

    // Fetch consent record
    const consentRecord = await SupabaseRepository.getConsentRecord(consentId);

    if (!consentRecord) {
      return NextResponse.json(
        { success: false, error: 'Consent record not found' },
        { status: 404 }
      );
    }

    // Verify user owns this consent record
    if (consentRecord.userId !== auth.userId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Cannot modify this consent record' },
        { status: 403 }
      );
    }

    let updatedConsent;

    switch (action) {
      case 'grant':
        updatedConsent = ConsentManagementService.grantConsent(consentRecord);
        console.log('[v0] Consent granted:', { consentId: consentId.slice(0, 16) });
        break;

      case 'deny':
        updatedConsent = ConsentManagementService.denyConsent(consentRecord, body.reason);
        console.log('[v0] Consent denied:', { consentId: consentId.slice(0, 16) });
        break;

      case 'revoke':
        updatedConsent = ConsentManagementService.revokeConsent(consentRecord, body.reason);
        console.log('[v0] Consent revoked:', { consentId: consentId.slice(0, 16) });
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action. Must be: grant, deny, or revoke' },
          { status: 400 }
        );
    }

    // Save updated consent
    const saved = await SupabaseRepository.saveConsentRecord(updatedConsent) ?? updatedConsent;

    return NextResponse.json({
      success: true,
      data: saved,
      message: `Consent ${action}ed successfully`,
    });
  } catch (error) {
    console.error('[v0] Update consent error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update consent record' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/consent/[consentId]
 * Revoke consent (delete)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getAuthContext(request);

    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { consentId } = await params;

    // Fetch consent record
    const consentRecord = await SupabaseRepository.getConsentRecord(consentId);

    if (!consentRecord) {
      return NextResponse.json(
        { success: false, error: 'Consent record not found' },
        { status: 404 }
      );
    }

    // Verify user owns this consent record
    if (consentRecord.userId !== auth.userId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Cannot delete this consent record' },
        { status: 403 }
      );
    }

    // Revoke consent
    const revokedConsent = ConsentManagementService.revokeConsent(
      consentRecord,
      'User deleted consent record'
    );

    // Save revoked state
    await SupabaseRepository.saveConsentRecord(revokedConsent);

    console.log('[v0] Consent deleted/revoked:', { consentId: consentId.slice(0, 16) });

    return NextResponse.json({
      success: true,
      message: 'Consent revoked and deleted',
    });
  } catch (error) {
    console.error('[v0] Delete consent error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete consent record' },
      { status: 500 }
    );
  }
}
