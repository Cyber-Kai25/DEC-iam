import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/middleware/auth';

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);

    if (!auth.isAuthenticated) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized: No valid authentication token',
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        userId: auth.userId,
        email: auth.email,
        roles: auth.roles,
        activeRole: auth.activeRole,
        isAuthenticated: true,
      },
    });
  } catch (error) {
    console.error('[v0] Get user error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get user information',
      },
      { status: 500 }
    );
  }
}
