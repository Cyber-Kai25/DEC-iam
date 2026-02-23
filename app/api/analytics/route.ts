import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/middleware/auth';

/**
 * GET /api/analytics
 * Get analytics data (issuer/verifier only)
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
        { success: false, error: 'Forbidden: Only issuers and verifiers can access analytics' },
        { status: 403 }
      );
    }

    const analytics = auth.activeRole === 'issuer' 
      ? {
          totalIssued: 156,
          activeCredentials: 142,
          revokedCredentials: 14,
          issuanceRate: 12.5,
          monthlyTrend: [
            { month: 'Jan', issued: 20, revoked: 2 },
            { month: 'Feb', issued: 25, revoked: 1 },
            { month: 'Mar', issued: 30, revoked: 3 },
            { month: 'Apr', issued: 35, revoked: 2 },
            { month: 'May', issued: 28, revoked: 2 },
            { month: 'Jun', issued: 18, revoked: 4 },
          ],
          credentialTypes: [
            { type: 'UniversityDegree', count: 45 },
            { type: 'VerifiedEmail', count: 62 },
            { type: 'ProofOfKYC', count: 49 },
          ],
        }
      : {
          totalVerifications: 89,
          successfulVerifications: 78,
          failedVerifications: 11,
          successRate: 87.6,
          verificationTrend: [
            { month: 'Jan', successful: 8, failed: 1 },
            { month: 'Feb', successful: 12, failed: 2 },
            { month: 'Mar', successful: 15, failed: 1 },
            { month: 'Apr', successful: 18, failed: 2 },
            { month: 'May', successful: 14, failed: 3 },
            { month: 'Jun', successful: 11, failed: 2 },
          ],
          verificationMethods: [
            { method: 'Digital Signature', count: 45 },
            { method: 'Verifiable Credential', count: 35 },
            { method: 'Zero-Knowledge Proof', count: 9 },
          ],
        };

    console.log('[v0] Fetched analytics for user:', { userId: auth.userId, role: auth.activeRole });

    return NextResponse.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    console.error('[v0] Get analytics error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
