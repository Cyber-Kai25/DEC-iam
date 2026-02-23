import { User, UserRole, Organization, Identity } from "@/lib/types/did";

/**
 * Role Management Service
 * Handles user roles, permissions, and role-specific operations
 */
class RoleManagementService {
  /**
   * Check if user has a specific role
   */
  static hasRole(user: User, role: UserRole): boolean {
    return user.roles.includes(role);
  }

  /**
   * Check if user has any of the specified roles
   */
  static hasAnyRole(user: User, roles: UserRole[]): boolean {
    return roles.some((role) => user.roles.includes(role));
  }

  /**
   * Check if user has all specified roles
   */
  static hasAllRoles(user: User, roles: UserRole[]): boolean {
    return roles.every((role) => user.roles.includes(role));
  }

  /**
   * Add role to user
   */
  static addRole(user: User, role: UserRole): User {
    if (!user.roles.includes(role)) {
      user.roles.push(role);
    }
    return user;
  }

  /**
   * Remove role from user
   */
  static removeRole(user: User, role: UserRole): User {
    user.roles = user.roles.filter((r) => r !== role);
    return user;
  }

  /**
   * Switch active role
   */
  static switchRole(user: User, role: UserRole): User | null {
    if (!this.hasRole(user, role)) {
      console.error(`User does not have role: ${role}`);
      return null;
    }
    user.activeRole = role;
    return user;
  }

  /**
   * Get role-specific permissions
   */
  static getPermissions(role: UserRole): string[] {
    const permissions: Record<UserRole, string[]> = {
      owner: [
        "create:own-identity",
        "read:own-identity",
        "update:own-identity",
        "delete:own-identity",
        "receive:credential",
        "present:credential",
        "revoke:own-credential",
        "create:own-policy",
        "read:own-policy",
        "update:own-policy",
        "delete:own-policy",
        "receive:verification-request",
        "manage:trusted-issuers",
        "export:identity",
        "import:identity",
      ],
      issuer: [
        "create:organization-identity",
        "read:organization-identity",
        "update:organization-identity",
        "create:credential-template",
        "read:credential-template",
        "update:credential-template",
        "delete:credential-template",
        "issue:credential",
        "revoke:issued-credential",
        "read:issuance-history",
        "export:issuance-history",
        "read:audit-logs",
        "read:organization-settings",
        "update:organization-settings",
      ],
      verifier: [
        "create:organization-identity",
        "read:organization-identity",
        "update:organization-identity",
        "create:verification-request",
        "read:verification-request",
        "verify:credential",
        "read:verification-history",
        "export:verification-history",
        "create:verification-policy",
        "read:verification-policy",
        "update:verification-policy",
        "read:analytics",
        "read:organization-settings",
        "update:organization-settings",
      ],
    };

    return permissions[role] || [];
  }

  /**
   * Check if user can perform an action
   */
  static canPerformAction(user: User, action: string): boolean {
    const userPermissions = user.roles.flatMap((role) =>
      this.getPermissions(role)
    );
    return userPermissions.includes(action);
  }

  /**
   * Get role-specific navigation items
   */
  static getNavigationItems(role: UserRole) {
    const navigation: Record<
      UserRole,
      Array<{
        label: string;
        href: string;
        icon: string;
        description: string;
      }>
    > = {
      owner: [
        {
          label: "Dashboard",
          href: "/owner/dashboard",
          icon: "LayoutDashboard",
          description: "Overview of your identities and credentials",
        },
        {
          label: "My Identity",
          href: "/owner/identity",
          icon: "User",
          description: "Manage your decentralized identity",
        },
        {
          label: "My Credentials",
          href: "/owner/credentials",
          icon: "FileCheck",
          description: "View and manage received credentials",
        },
        {
          label: "Verification Requests",
          href: "/owner/verify-requests",
          icon: "CheckCircle2",
          description: "Handle verification requests from verifiers",
        },
        {
          label: "Access Policies",
          href: "/owner/policies",
          icon: "Shield",
          description: "Control who can access your data",
        },
        {
          label: "Trusted Issuers",
          href: "/owner/trusted-issuers",
          icon: "Star",
          description: "Manage trusted credential issuers",
        },
      ],
      issuer: [
        {
          label: "Dashboard",
          href: "/issuer/dashboard",
          icon: "LayoutDashboard",
          description: "Organization overview and metrics",
        },
        {
          label: "Organization",
          href: "/issuer/organization",
          icon: "Building2",
          description: "Manage issuer organization",
        },
        {
          label: "Credential Templates",
          href: "/issuer/templates",
          icon: "FileText",
          description: "Create and manage credential templates",
        },
        {
          label: "Issue Credentials",
          href: "/issuer/issue",
          icon: "Plus",
          description: "Issue new credentials to recipients",
        },
        {
          label: "Credential History",
          href: "/issuer/history",
          icon: "History",
          description: "View all issued credentials",
        },
        {
          label: "Revoke Credentials",
          href: "/issuer/revoke",
          icon: "XCircle",
          description: "Revoke issued credentials",
        },
        {
          label: "Audit Logs",
          href: "/issuer/audit",
          icon: "FileText",
          description: "View audit trail",
        },
      ],
      verifier: [
        {
          label: "Dashboard",
          href: "/verifier/dashboard",
          icon: "LayoutDashboard",
          description: "Verification metrics and overview",
        },
        {
          label: "Organization",
          href: "/verifier/organization",
          icon: "Building2",
          description: "Manage verifier organization",
        },
        {
          label: "Verification Requests",
          href: "/verifier/requests",
          icon: "Mail",
          description: "Create and manage verification requests",
        },
        {
          label: "Verify Credentials",
          href: "/verifier/verify",
          icon: "CheckCircle2",
          description: "Verify presented credentials",
        },
        {
          label: "Verification History",
          href: "/verifier/history",
          icon: "History",
          description: "View verification records",
        },
        {
          label: "Verification Policies",
          href: "/verifier/policies",
          icon: "Settings",
          description: "Define verification requirements",
        },
        {
          label: "Analytics",
          href: "/verifier/analytics",
          icon: "BarChart3",
          description: "Verification analytics and insights",
        },
      ],
    };

    return navigation[role] || [];
  }

  /**
   * Get role display name
   */
  static getRoleDisplayName(role: UserRole): string {
    const names: Record<UserRole, string> = {
      owner: "Identity Owner",
      issuer: "Credential Issuer",
      verifier: "Credential Verifier",
    };
    return names[role];
  }

  /**
   * Get role description
   */
  static getRoleDescription(role: UserRole): string {
    const descriptions: Record<UserRole, string> = {
      owner:
        "Manage your digital identity, receive credentials, and control access",
      issuer: "Issue verifiable credentials to identity owners",
      verifier: "Verify credentials presented by identity owners",
    };
    return descriptions[role];
  }

  /**
   * Create a new organization (for issuer/verifier)
   */
  static createOrganization(
    name: string,
    type: "issuer" | "verifier",
    description?: string
  ): Organization {
    return {
      id: `org-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name,
      type,
      description,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Get role badge color for UI
   */
  static getRoleBadgeColor(role: UserRole): string {
    const colors: Record<UserRole, string> = {
      owner: "bg-blue-100 text-blue-800",
      issuer: "bg-green-100 text-green-800",
      verifier: "bg-purple-100 text-purple-800",
    };
    return colors[role];
  }

  /**
   * Get role badge icon for UI
   */
  static getRoleBadgeIcon(role: UserRole): string {
    const icons: Record<UserRole, string> = {
      owner: "User",
      issuer: "Award",
      verifier: "CheckCircle2",
    };
    return icons[role];
  }

  /**
   * Check if identity is an organization (issuer/verifier)
   */
  static isOrganizationIdentity(identity: Identity): boolean {
    return !!(identity.organizationId || identity.role === "issuer" || identity.role === "verifier");
  }

  /**
   * Get role-specific welcome message
   */
  static getWelcomeMessage(role: UserRole, userName?: string): string {
    const messages: Record<UserRole, string> = {
      owner: `Welcome, ${userName || "Identity Owner"}! Manage your digital identity and credentials securely.`,
      issuer: `Welcome, ${userName || "Issuer"}! Issue and manage verifiable credentials for your recipients.`,
      verifier: `Welcome, ${userName || "Verifier"}! Verify credentials presented by identity owners.`,
    };
    return messages[role];
  }

  /**
   * Get role icon for display
   */
  static getRoleIcon(role: UserRole): string {
    const icons: Record<UserRole, string> = {
      owner: "👤",
      issuer: "🏢",
      verifier: "✓",
    };
    return icons[role];
  }
}

export default RoleManagementService;
