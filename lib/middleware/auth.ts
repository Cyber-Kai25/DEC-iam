import { NextRequest, NextResponse } from 'next/server';
import type { UserRole } from '@/lib/types/did';

export interface AuthContext {
  userId: string;
  email?: string;
  roles: UserRole[];
  activeRole: UserRole;
  isAuthenticated: boolean;
}

/**
 * Extract JWT token from request headers
 */
export function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

/**
 * Parse and validate JWT token (mock - replace with real JWT validation)
 */
export function validateToken(token: string): Partial<AuthContext> | null {
  try {
    // In production, verify JWT signature using SECRET_KEY
    // This is a mock implementation - parse localStorage JWT
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    if (decoded.exp && decoded.exp < Date.now()) {
      return null; // Token expired
    }
    return {
      userId: decoded.userId || decoded.sub,
      email: decoded.email,
      roles: decoded.roles || [],
      activeRole: decoded.activeRole,
      isAuthenticated: true,
    };
  } catch {
    return null;
  }
}

/**
 * Extract auth context from request
 */
export async function getAuthContext(request: NextRequest): Promise<AuthContext> {
  const token = extractToken(request);
  
  if (!token) {
    return {
      userId: '',
      roles: [],
      activeRole: 'owner',
      isAuthenticated: false,
    };
  }

  const decoded = validateToken(token);
  if (!decoded) {
    return {
      userId: '',
      roles: [],
      activeRole: 'owner',
      isAuthenticated: false,
    };
  }

  return {
    userId: decoded.userId || '',
    email: decoded.email,
    roles: decoded.roles || [],
    activeRole: decoded.activeRole || 'owner',
    isAuthenticated: true,
  };
}

/**
 * Middleware to require authentication
 */
export function requireAuth(handler: Function) {
  return async (request: NextRequest) => {
    const auth = await getAuthContext(request);
    
    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: No valid authentication token' },
        { status: 401 }
      );
    }

    // Attach auth to request for use in handler
    (request as any).auth = auth;
    return handler(request);
  };
}

/**
 * Middleware to require specific role
 */
export function requireRole(...roles: UserRole[]) {
  return (handler: Function) => {
    return async (request: NextRequest) => {
      const auth = await getAuthContext(request);
      
      if (!auth.isAuthenticated) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized: No valid authentication token' },
          { status: 401 }
        );
      }

      if (!roles.includes(auth.activeRole)) {
        return NextResponse.json(
          { 
            success: false, 
            error: `Forbidden: This resource requires one of these roles: ${roles.join(', ')}` 
          },
          { status: 403 }
        );
      }

      (request as any).auth = auth;
      return handler(request);
    };
  };
}

/**
 * Middleware for permission-based access
 */
export function requirePermission(...permissions: string[]) {
  return (handler: Function) => {
    return async (request: NextRequest) => {
      const auth = await getAuthContext(request);
      
      if (!auth.isAuthenticated) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        );
      }

      const userPermissions = getRolePermissions(auth.activeRole);
      const hasPermission = permissions.some(p => userPermissions.includes(p));

      if (!hasPermission) {
        return NextResponse.json(
          { 
            success: false, 
            error: `Forbidden: Missing required permission` 
          },
          { status: 403 }
        );
      }

      (request as any).auth = auth;
      return handler(request);
    };
  };
}

/**
 * Get permissions for a role
 */
export function getRolePermissions(role: UserRole): string[] {
  const permissions: Record<UserRole, string[]> = {
    owner: [
      'identity:read',
      'identity:create',
      'identity:update',
      'credential:read',
      'credential:present',
      'policy:read',
      'policy:create',
      'policy:update',
      'verification:respond',
      'audit:read',
    ],
    issuer: [
      'identity:read',
      'identity:create',
      'identity:update',
      'credential:issue',
      'credential:revoke',
      'credential:list',
      'organization:read',
      'organization:update',
      'template:create',
      'template:read',
      'template:update',
      'audit:read',
      'audit:write',
    ],
    verifier: [
      'identity:read',
      'identity:create',
      'identity:update',
      'credential:verify',
      'credential:read',
      'organization:read',
      'organization:update',
      'verification:request',
      'verification:read',
      'verification:update',
      'policy:read',
      'policy:create',
      'policy:update',
      'analytics:read',
      'audit:read',
    ],
  };

  return permissions[role] || [];
}
