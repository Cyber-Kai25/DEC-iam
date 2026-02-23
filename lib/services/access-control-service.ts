// Access Control Policy Management and Enforcement
import {
  AccessControlPolicy,
  AccessRule,
  AccessCondition,
  Identity,
  VerifiableCredential,
} from "@/lib/types/did";
import { ethers } from "ethers";

export class AccessControlService {
  /**
   * Create a new access control policy
   */
  static createPolicy(
    resourceId: string,
    resourceType: "credential" | "data" | "service",
    owner: string
  ): AccessControlPolicy {
    return {
      id: ethers.keccak256(ethers.toUtf8Bytes(`${resourceId}-${Date.now()}`)),
      resourceId,
      resourceType,
      owner,
      rules: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      active: true,
    };
  }

  /**
   * Add an access rule to a policy
   */
  static addRule(
    policy: AccessControlPolicy,
    subject: string | string[],
    action: "read" | "write" | "execute" | "share" | "revoke" | "*",
    resource: string,
    effect: "allow" | "deny",
    conditions?: AccessCondition[],
    expiresAt?: Date
  ): AccessControlPolicy {
    const rule: AccessRule = {
      id: ethers.keccak256(ethers.toUtf8Bytes(`${resource}-${Date.now()}`)),
      subject,
      action,
      resource,
      effect,
      conditions,
      expiresAt,
    };

    return {
      ...policy,
      rules: [...policy.rules, rule],
      updatedAt: new Date(),
    };
  }

  /**
   * Remove a specific rule from a policy
   */
  static removeRule(
    policy: AccessControlPolicy,
    ruleId: string
  ): AccessControlPolicy {
    return {
      ...policy,
      rules: policy.rules.filter((r) => r.id !== ruleId),
      updatedAt: new Date(),
    };
  }

  /**
   * Evaluate access request against policy
   */
  static evaluateAccess(
    policy: AccessControlPolicy,
    requesterDID: string,
    action: string,
    context?: Record<string, unknown>
  ): {
    allowed: boolean;
    reason: string;
    matchedRule?: AccessRule;
  } {
    if (!policy.active) {
      return {
        allowed: false,
        reason: "Policy is inactive",
      };
    }

    // Collect all applicable rules
    const applicableRules = policy.rules.filter((rule) => {
      // Check if rule applies to this requester
      if (Array.isArray(rule.subject)) {
        return rule.subject.includes(requesterDID);
      }
      return rule.subject === requesterDID || rule.subject === "*";
    });

    if (applicableRules.length === 0) {
      return {
        allowed: false,
        reason: "No applicable rules found",
      };
    }

    // Apply deny rules first (deny takes precedence)
    for (const rule of applicableRules) {
      if (rule.effect === "deny") {
        // Check if action matches
        if (rule.action === "*" || rule.action === action) {
          // Evaluate conditions if present
          if (rule.conditions && rule.conditions.length > 0) {
            if (this.evaluateConditions(rule.conditions, context)) {
              return {
                allowed: false,
                reason: `Access denied by rule ${rule.id}`,
                matchedRule: rule,
              };
            }
          } else {
            return {
              allowed: false,
              reason: `Access denied by rule ${rule.id}`,
              matchedRule: rule,
            };
          }
        }
      }
    }

    // Check if rule has expired
    const now = new Date();
    for (const rule of applicableRules) {
      if (rule.expiresAt && new Date(rule.expiresAt) < now) {
        continue; // Skip expired rules
      }

      // Check action match
      if (rule.action === "*" || rule.action === action) {
        if (rule.effect === "allow") {
          // Evaluate conditions if present
          if (rule.conditions && rule.conditions.length > 0) {
            if (this.evaluateConditions(rule.conditions, context)) {
              return {
                allowed: true,
                reason: `Access allowed by rule ${rule.id}`,
                matchedRule: rule,
              };
            }
          } else {
            return {
              allowed: true,
              reason: `Access allowed by rule ${rule.id}`,
              matchedRule: rule,
            };
          }
        }
      }
    }

    return {
      allowed: false,
      reason: "No matching allow rule found",
    };
  }

  /**
   * Evaluate access conditions
   */
  private static evaluateConditions(
    conditions: AccessCondition[],
    context?: Record<string, unknown>
  ): boolean {
    if (!context) {
      return false;
    }

    for (const condition of conditions) {
      const conditionMet = this.evaluateSingleCondition(condition, context);
      if (!conditionMet) {
        return false; // All conditions must be met
      }
    }

    return true;
  }

  /**
   * Evaluate a single condition
   */
  private static evaluateSingleCondition(
    condition: AccessCondition,
    context: Record<string, unknown>
  ): boolean {
    switch (condition.type) {
      case "time": {
        const now = new Date().getTime();
        const conditionTime = (condition.value as Record<string, unknown>)?.after
          ? new Date(
              (condition.value as Record<string, unknown>).after as string
            ).getTime()
          : 0;
        return now >= conditionTime;
      }

      case "credential-requirement": {
        const requiredType = condition.value as string;
        const hasCredential = (
          context.credentials as VerifiableCredential[] | undefined
        )?.some((c) => {
          const types = Array.isArray(c.type) ? c.type : [c.type];
          return types.includes(requiredType);
        });
        return hasCredential || false;
      }

      case "rate-limit": {
        const limit = (condition.value as Record<string, number>)?.maxRequests || 0;
        const currentRequests = (context.requestCount as number) || 0;
        return currentRequests < limit;
      }

      case "zk-proof": {
        // Check if ZK proof has been verified
        return context.zkProofVerified === true;
      }

      default:
        return false;
    }
  }

  /**
   * Create a policy template for common scenarios
   */
  static createTemplate(
    templateType: "open" | "private" | "shared" | "time-limited",
    resourceId: string,
    owner: string,
    sharedWith?: string[]
  ): AccessControlPolicy {
    let policy = this.createPolicy(
      resourceId,
      "credential",
      owner
    );

    switch (templateType) {
      case "open":
        // Anyone can read
        policy = this.addRule(
          policy,
          "*",
          "read",
          resourceId,
          "allow"
        );
        // Only owner can write
        policy = this.addRule(
          policy,
          owner,
          "write",
          resourceId,
          "allow"
        );
        break;

      case "private":
        // Only owner can access
        policy = this.addRule(
          policy,
          owner,
          "*",
          resourceId,
          "allow"
        );
        break;

      case "shared":
        // Only owner and specified users can access
        policy = this.addRule(
          policy,
          owner,
          "*",
          resourceId,
          "allow"
        );
        if (sharedWith && sharedWith.length > 0) {
          policy = this.addRule(
            policy,
            sharedWith,
            "read",
            resourceId,
            "allow"
          );
        }
        break;

      case "time-limited": {
        // Access expires after 24 hours
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        policy = this.addRule(
          policy,
          "*",
          "read",
          resourceId,
          "allow",
          [],
          expiresAt
        );
        break;
      }
    }

    return policy;
  }

  /**
   * Revoke all access for a subject
   */
  static revokeAccess(
    policy: AccessControlPolicy,
    subjectDID: string
  ): AccessControlPolicy {
    // Add deny rules for all actions
    let updated = policy;

    updated = this.addRule(
      updated,
      subjectDID,
      "*",
      policy.resourceId,
      "deny"
    );

    return updated;
  }

  /**
   * Transfer ownership of a resource
   */
  static transferOwnership(
    policy: AccessControlPolicy,
    newOwner: string
  ): AccessControlPolicy {
    // Give new owner all permissions
    let updated = { ...policy, owner: newOwner };

    updated = this.addRule(
      updated,
      newOwner,
      "*",
      policy.resourceId,
      "allow"
    );

    return updated;
  }

  /**
   * Export policy as JSON for backup
   */
  static exportPolicy(policy: AccessControlPolicy): string {
    return JSON.stringify(policy, null, 2);
  }

  /**
   * Import policy from JSON
   */
  static importPolicy(json: string): AccessControlPolicy | null {
    try {
      const data = JSON.parse(json);
      return {
        ...data,
        createdAt: new Date(data.createdAt),
        updatedAt: new Date(data.updatedAt),
        rules: data.rules.map(
          (rule: Record<string, unknown>) => ({
            ...rule,
            expiresAt: rule.expiresAt ? new Date(rule.expiresAt) : undefined,
          })
        ),
      };
    } catch {
      return null;
    }
  }

  /**
   * Get policy statistics
   */
  static getPolicyStats(policy: AccessControlPolicy): {
    totalRules: number;
    allowRules: number;
    denyRules: number;
    rulesWithConditions: number;
    activeRules: number;
  } {
    const now = new Date();

    return {
      totalRules: policy.rules.length,
      allowRules: policy.rules.filter((r) => r.effect === "allow").length,
      denyRules: policy.rules.filter((r) => r.effect === "deny").length,
      rulesWithConditions: policy.rules.filter(
        (r) => r.conditions && r.conditions.length > 0
      ).length,
      activeRules: policy.rules.filter(
        (r) => !r.expiresAt || new Date(r.expiresAt) > now
      ).length,
    };
  }
}

export default AccessControlService;
