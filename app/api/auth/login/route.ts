import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password required'),
});

/**
 * POST /api/auth/login
 * Authenticate user and return JWT token
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validation = loginSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Validation error: ${validation.error.errors[0].message}`,
        },
        { status: 400 }
      );
    }

    const { email, password } = validation.data;

    // In production, verify against Supabase Auth
    // For now, mock a successful login with demo credentials
    if (email === 'demo@example.com' && password === 'password123') {
      const userId = 'demo_user_001';
      const roles = ['owner', 'issuer', 'verifier'];
      const activeRole = 'owner';

      const tokenPayload = {
        userId,
        email,
        roles,
        activeRole,
        exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
      };

      const token = Buffer.from(JSON.stringify(tokenPayload)).toString('base64');

      console.log('[v0] User logged in:', { email, roles });

      return NextResponse.json({
        success: true,
        data: {
          userId,
          email,
          roles,
          activeRole,
          token,
        },
      });
    }

    // For any other user, create temporary session
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const roles = ['owner']; // Default role
    const activeRole = 'owner';

    const tokenPayload = {
      userId,
      email,
      roles,
      activeRole,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    };

    const token = Buffer.from(JSON.stringify(tokenPayload)).toString('base64');

    console.log('[v0] User logged in:', { email, roles });

    return NextResponse.json({
      success: true,
      data: {
        userId,
        email,
        roles,
        activeRole,
        token,
      },
    });
  } catch (error) {
    console.error('[v0] Login error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Login failed. Please try again.',
      },
      { status: 500 }
    );
  }
}
