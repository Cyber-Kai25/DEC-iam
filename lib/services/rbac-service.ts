import type { UserRole } from '@/lib/types/did';

export interface RBACPolicy {
  role: UserRole;
  resource: string;
  action: string;
  conditions?: Record<string, any>;
}

export interface AccessRequest {
  userId: string;
  userRole: UserRole;
  resource: string;
  action: string;
  context?: Record<string, any>;
}

/**
 * Role-Based Access Control Service
 * Evaluates access decisions based on roles and permissions
 */
export class RBACService {
  /**
   * Check if user has access to resource/action
   */
  static canAccess(request: AccessRequest): boolean {
    const permissions = this.getRolePermissions(request.userRole);
    const requiredPermission = `${request.resource}:${request.action}`;
    
    return permissions.includes(requiredPermission);
  }

  /**
   * Get all permissions for a role
   */
  static getRolePermissions(role: UserRole): string[] {
    const rolePermissions: Record<UserRole, string[]> = {
      owner: [
        // Identity operations
        'identity:read:own',
        'identity:create',
        'identity:update:own',
        'identity:export',
        'identity:import',
        
        // Credential operations
        'credential:read:own',
        'credential:list:own',
        'credential:present',
        
        // Policy operations
        'policy:read:own',
        'policy:create',
        'policy:update:own',
        'policy:delete:own',
        
        // Verification operations
        'verification:read:own',
        'verification:respond',
        
        // Audit operations
        'audit:read:own',
      ],
      
      issuer: [
        // Organization operations
        'organization:read:own',
        'organization:create',
        'organization:update:own',
        'organization:delete:own',
        
        // Identity operations
        'identity:read:own',
        'identity:create',
        'identity:update:own',
        
        // Credential operations
        'credential:issue',
        'credential:revoke',
        'credential:list:own',
        'credential:read:any',
        
        // Template operations
        'template:create',
        'template:read:own',
        'template:update:own',
        'template:delete:own',
        'template:list:own',
        
        // Audit operations
        'audit:read:own',
        'audit:write',
      ],
      
      verifier: [
        // Organization operations
        'organization:read:own',
        'organization:create',
        'organization:update:own',
        'organization:delete:own',
        
        // Identity operations
        'identity:read:own',
        'identity:create',
        'identity:update:own',
        
        // Credential operations
        'credential:verify',
        'credential:read:any',
        
        // Verification operations
        'verification:create',
        'verification:read:own',
        'verification:update:own',
        'verification:list:own',
        
        // Policy operations
        'policy:read:own',
        'policy:create',
        'policy:update:own',
        'policy:delete:own',
        
        // Analytics operations
        'analytics:read:own',
        
        // Audit operations
        'audit:read:own',
      ],
    };

    return rolePermissions[role] || [];
  }

  /**
   * Check if resource is owned by user
   */
  static isResourceOwner(
    resource: any,
    userId: string,
    role: UserRole
  ): boolean {
    // Different ownership rules per role
    switch (role) {
      case 'owner':
        return resource.userId === userId || resource.ownerId === userId;
      case 'issuer':
        return resource.organizationId === userId || resource.issuerId === userId;
      case 'verifier':
        return resource.organizationId === userId || resource.verifierId === userId;
      default:
        return false;
    }
  }

  /**
   * Filter resources based on user access
   */
  static filterAccessibleResources(
    resources: any[],
    userId: string,
    role: UserRole,
    action: string = 'read'
  ): any[] {
    const resourceType = resources[0]?.type || 'unknown';
    const permission = `${resourceType}:${action}`;
    const permissions = this.getRolePermissions(role);

    // Check if user can read any of this resource type
    if (!permissions.includes(permission) && !permissions.includes(`${resourceType}:${action}:any`)) {
      return []; // No access
    }

    // Filter to own resources only if permission is scoped to :own
    if (permissions.includes(`${resourceType}:${action}:own`) && 
        !permissions.includes(`${resourceType}:${action}:any`)) {
      return resources.filter(r => this.isResourceOwner(r, userId, role));
    }

    return resources;
  }

  /**
   * Get dashboard features available to role
   */
  static getDashboardFeatures(role: UserRole): string[] {
    const features: Record<UserRole, string[]> = {
      owner: [
        'identities',
        'credentials',
        'verificationRequests',
        'accessPolicies',
        'trustedIssuers',
        'settings',
      ],
      issuer: [
        'organization',
        'templates',
        'issueCredentials',
        'credentialHistory',
        'revokeCredentials',
        'auditLogs',
        'analytics',
        'settings',
      ],
      verifier: [
        'organization',
        'verificationRequests',
        'verifyCredentials',
        'verificationHistory',
        'verificationPolicies',
        'analytics',
        'auditLogs',
        'settings',
      ],
    };

    return features[role] || [];
  }

  /**
   * Get navigation items for role
   */
  static getNavigationItems(role: UserRole) {
    const navigation: Record<UserRole, any[]> = {
      owner: [
        { label: 'Dashboard', href: '/owner/dashboard', icon: 'LayoutDashboard' },
        { label: 'Identity', href: '/owner/identity', icon: 'User' },
        { label: 'Credentials', href: '/owner/credentials', icon: 'Award' },
        { label: 'Verification Requests', href: '/owner/verify-requests', icon: 'CheckCircle' },
        { label: 'Access Policies', href: '/owner/policies', icon: 'Lock' },
        { label: 'Settings', href: '/owner/settings', icon: 'Settings' },
      ],
      issuer: [
        { label: 'Dashboard', href: '/issuer/dashboard', icon: 'LayoutDashboard' },
        { label: 'Organization', href: '/issuer/organization', icon: 'Building' },
        { label: 'Templates', href: '/issuer/templates', icon: 'Layout' },
        { label: 'Issue Credentials', href: '/issuer/issue', icon: 'PlusCircle' },
        { label: 'Credential History', href: '/issuer/history', icon: 'History' },
        { label: 'Revoke Credentials', href: '/issuer/revoke', icon: 'XCircle' },
        { label: 'Audit Logs', href: '/issuer/audit', icon: 'FileText' },
        { label: 'Settings', href: '/issuer/settings', icon: 'Settings' },
      ],
      verifier: [
        { label: 'Dashboard', href: '/verifier/dashboard', icon: 'LayoutDashboard' },
        { label: 'Organization', href: '/verifier/organization', icon: 'Building' },
        { label: 'Verification Requests', href: '/verifier/requests', icon: 'Send' },
        { label: 'Verify Credentials', href: '/verifier/verify', icon: 'CheckCircle' },
        { label: 'Verification History', href: '/verifier/history', icon: 'History' },
        { label: 'Verification Policies', href: '/verifier/policies', icon: 'Lock' },
        { label: 'Analytics', href: '/verifier/analytics', icon: 'BarChart3' },
        { label: 'Settings', href: '/verifier/settings', icon: 'Settings' },
      ],
    };

    return navigation[role] || [];
  }
}
