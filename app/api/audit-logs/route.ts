import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/middleware/auth';

/**
 * GET /api/audit-logs
 * Get audit logs (issuer/verifier only)
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

    if (!['issuer', 'verifier'].includes(auth.activeRole)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Only issuers and verifiers can access audit logs' },
        { status: 403 }
      );
    }

    const logs = [
      {
        id: `log_1`,
        userId: auth.userId,
        action: auth.activeRole === 'issuer' ? 'credential_issued' : 'verification_created',
        resourceType: auth.activeRole === 'issuer' ? 'credential' : 'verification',
        resourceId: `${auth.activeRole}_res_1`,
        result: 'success',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0...',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      },
      {
        id: `log_2`,
        userId: auth.userId,
        action: 'organization_updated',
        resourceType: 'organization',
        resourceId: `org_${auth.userId}`,
        result: 'success',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0...',
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    ];

    console.log('[v0] Fetched audit logs for user:', { userId: auth.userId, count: logs.length });

    return NextResponse.json({
      success: true,
      data: logs,
    });
  } catch (error) {
    console.error('[v0] Get audit logs error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}
