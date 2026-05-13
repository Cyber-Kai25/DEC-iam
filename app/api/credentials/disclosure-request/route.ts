import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/middleware/auth';
import SelectiveDisclosureService from '@/lib/services/selective-disclosure-service';

/**
 * POST /api/credentials/disclosure-request
 * Create a disclosure request from a verifier
 * Verifier requests specific attributes from credential holder
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
    const { credentialId, requestedAttributes, purpose, expirationDays } = body;

    if (!credentialId || !requestedAttributes || !Array.isArray(requestedAttributes)) {
      return NextResponse.json(
        { success: false, error: 'credentialId and requestedAttributes (array) are required' },
        { status: 400 }
      );
    }

    if (!purpose) {
      return NextResponse.json(
        { success: false, error: 'purpose is required' },
        { status: 400 }
      );
    }

    console.log('[v0] Creating disclosure request:', {
      credentialId,
      attributeCount: requestedAttributes.length,
      purpose,
    });

    // Create disclosure request
    const disclosureRequest = SelectiveDisclosureService.createDisclosureRequest(
      credentialId,
      auth.userId,
      requestedAttributes,
      purpose,
      expirationDays || 7
    );

    // In production, save to database and notify credential holder
    // For now, return the request
    
    return NextResponse.json(
      {
        success: true,
        data: {
          request: disclosureRequest,
          requestId: `dreq_${Date.now()}`,
          status: 'pending',
          message: 'Disclosure request created. Awaiting holder consent.',
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[v0] Disclosure request creation failed:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create disclosure request' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/credentials/disclosure-request
 * Holder responds to disclosure request with consent
 * Specifies which attributes to disclose
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);

    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { requestId, credentialId, userConsent } = body;

    if (!requestId || !credentialId || !userConsent || typeof userConsent !== 'object') {
      return NextResponse.json(
        { success: false, error: 'requestId, credentialId, and userConsent (object) are required' },
        { status: 400 }
      );
    }

    console.log('[v0] Processing disclosure consent:', {
      requestId,
      consentCount: Object.keys(userConsent).length,
    });

    // Get disclosure request (from body or DB)
    // Validate consent
    const consentedAttributes = Object.entries(userConsent)
      .filter(([_, consent]) => consent === true)
      .map(([attr, _]) => attr);

    const deniedAttributes = Object.entries(userConsent)
      .filter(([_, consent]) => consent === false)
      .map(([attr, _]) => attr);

    return NextResponse.json(
      {
        success: true,
        data: {
          requestId,
          credentialId,
          consentedAttributes,
          deniedAttributes,
          status: 'consented',
          message: `Consent given for ${consentedAttributes.length} attributes. ${deniedAttributes.length} attributes denied.`,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[v0] Disclosure consent processing failed:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process disclosure consent' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/credentials/disclosure-request
 * Revoke a previous disclosure
 * Credential holder revokes previously disclosed attributes
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);

    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { credentialId, verifierId, disclosureTimestamp } = body;

    if (!credentialId || !verifierId) {
      return NextResponse.json(
        { success: false, error: 'credentialId and verifierId are required' },
        { status: 400 }
      );
    }

    console.log('[v0] Revoking disclosure:', {
      credentialId,
      verifierId,
    });

    // Revoke disclosure
    const revocation = SelectiveDisclosureService.revokeDisclosure(
      credentialId,
      verifierId,
      disclosureTimestamp ? new Date(disclosureTimestamp) : new Date()
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          ...revocation,
          message: 'Disclosure revoked. Verifier should no longer use disclosed attributes.',
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[v0] Disclosure revocation failed:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to revoke disclosure' },
      { status: 500 }
    );
  }
}
