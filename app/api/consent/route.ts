// Consent Management API Endpoints
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/middleware/auth';
import { RBACService } from '@/lib/services/rbac-service';
import ConsentManagementService from '@/lib/services/consent-management-service';
import SupabaseRepository from '@/lib/services/supabase-repository';

/**
 * GET /api/consent
 * List user's consent records
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
    const hasPermission = RBACService.getRolePermissions(auth.activeRole).includes('consent:read:own');
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: No permission to read consent records' },
        { status: 403 }
      );
    }

    // Fetch from Supabase
    const consentRecords = await SupabaseRepository.getUserConsentRecords(auth.userId);

    console.log('[v0] Fetched consent records for user:', { userId: auth.userId, count: consentRecords.length });

    return NextResponse.json({
      success: true,
      data: consentRecords,
    });
  } catch (error) {
    console.error('[v0] Get consent records error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch consent records' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/consent
 * Create a new consent record
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
    const hasPermission = RBACService.getRolePermissions(auth.activeRole).includes('consent:create');
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: No permission to create consent records' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { dataControllerDid, consentType, description, scope, purposes, expirationDays } = body;

    // Validation
    if (!dataControllerDid || !consentType || !scope || !purposes) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: dataControllerDid, consentType, scope, purposes' },
        { status: 400 }
      );
    }

    // Create consent record
    const consentRecord = ConsentManagementService.createConsentRecord(
      auth.userId,
      dataControllerDid,
      consentType,
      description || `Consent for ${consentType}`,
      Array.isArray(scope) ? scope : [scope],
      Array.isArray(purposes) ? purposes : [purposes],
      expirationDays || 365
    );

    // Save to Supabase
    const savedConsent = await SupabaseRepository.saveConsentRecord(consentRecord) ?? consentRecord;

    console.log('[v0] Consent record created:', { 
      consentId: savedConsent.id.slice(0, 16), 
      type: consentType,
      userId: auth.userId
    });

    return NextResponse.json(
      {
        success: true,
        data: savedConsent,
        message: 'Consent record created. Status: pending approval.',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[v0] Create consent error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create consent record' },
      { status: 500 }
    );
  }
}
