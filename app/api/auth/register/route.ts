import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { UserRole } from '@/lib/types/did';

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  roles: z.array(z.enum(['owner', 'issuer', 'verifier'])).min(1, 'At least one role required'),
});

interface RegisterRequest {
  email: string;
  password: string;
  roles: UserRole[];
}

interface RegisterResponse {
  success: boolean;
  data?: {
    userId: string;
    email: string;
    roles: UserRole[];
    activeRole: UserRole;
    token: string;
  };
  error?: string;
}

/**
 * POST /api/auth/register
 * Register a new user with specified roles
 */
export async function POST(request: NextRequest): Promise<NextResponse<RegisterResponse>> {
  try {
    const body: RegisterRequest = await request.json();

    // Validate input
    const validation = registerSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Validation error: ${validation.error.errors[0].message}`,
        },
        { status: 400 }
      );
    }

    const { email, password, roles } = validation.data;

    // In production, integrate with Supabase Auth
    // For now, simulate registration by storing in memory
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create JWT token (in production, use actual JWT library)
    const tokenPayload = {
      userId,
      email,
      roles,
      activeRole: roles[0],
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    };

    const token = Buffer.from(JSON.stringify(tokenPayload)).toString('base64');

    console.log('[v0] User registered:', { userId, email, roles });

    return NextResponse.json(
      {
        success: true,
        data: {
          userId,
          email,
          roles,
          activeRole: roles[0],
          token,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[v0] Registration error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Registration failed. Please try again.',
      },
      { status: 500 }
    );
  }
}
