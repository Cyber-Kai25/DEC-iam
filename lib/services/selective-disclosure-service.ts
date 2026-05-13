import { ethers } from 'ethers';
import ZKProofService from './zkp-service';

/**
 * Selective Disclosure Service
 * Manages credential attribute privacy and selective revelation
 * Allows users to share only the attributes they want to disclose
 */

export interface CredentialAttribute {
  name: string;
  value: string | number | boolean;
  sensitive: boolean;
  category: 'personal' | 'professional' | 'identity' | 'medical' | 'financial' | 'other';
}

export interface AttributeSchema {
  credentialType: string;
  attributes: CredentialAttribute[];
  createdAt: Date;
}

export interface DisclosureRequest {
  credentialId: string;
  verifierId: string;
  requestedAttributes: string[]; // Names of attributes being requested
  purpose: string;
  expiresAt: Date;
}

export interface DisclosureResponse {
  credentialId: string;
  verifierId: string;
  disclosedAttributes: {
    [key: string]: any;
  };
  proof: any;
  timestamp: Date;
}

class SelectiveDisclosureService {
  /**
   * Define attribute schema for a credential type
   * Specifies which attributes can be disclosed and their sensitivity
   */
  static defineAttributeSchema(
    credentialType: string,
    attributes: CredentialAttribute[]
  ): AttributeSchema {
    return {
      credentialType,
      attributes,
      createdAt: new Date(),
    };
  }

  /**
   * Validate that requested attributes exist and can be disclosed
   * Returns list of disclosable attributes from the request
   */
  static validateAttributeRequest(
    schema: AttributeSchema,
    requestedAttributes: string[]
  ): {
    valid: boolean;
    disclosableAttributes: string[];
    nonExistentAttributes: string[];
    sensitiveAttributes: string[];
  } {
    const schemaAttributeNames = schema.attributes.map((a) => a.name);
    const disclosableAttributes: string[] = [];
    const nonExistentAttributes: string[] = [];
    const sensitiveAttributes: string[] = [];

    for (const requested of requestedAttributes) {
      const attribute = schema.attributes.find((a) => a.name === requested);

      if (!attribute) {
        nonExistentAttributes.push(requested);
      } else if (attribute.sensitive) {
        sensitiveAttributes.push(requested);
      } else {
        disclosableAttributes.push(requested);
      }
    }

    return {
      valid: nonExistentAttributes.length === 0,
      disclosableAttributes,
      nonExistentAttributes,
      sensitiveAttributes,
    };
  }

  /**
   * Create a disclosure request
   * Verifier requests specific attributes from credential holder
   */
  static createDisclosureRequest(
    credentialId: string,
    verifierId: string,
    requestedAttributes: string[],
    purpose: string,
    expirationDays: number = 7
  ): DisclosureRequest {
    return {
      credentialId,
      verifierId,
      requestedAttributes,
      purpose,
      expiresAt: new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000),
    };
  }

  /**
   * Prepare disclosure - filter attributes based on user consent
   * User decides which requested attributes to actually disclose
   */
  static prepareDisclosure(
    credentialId: string,
    credentialAttributes: CredentialAttribute[],
    disclosureRequest: DisclosureRequest,
    userConsent: {
      [attributeName: string]: boolean; // true = consent to disclose
    }
  ): {
    disclosedAttributes: CredentialAttribute[];
    deniedAttributes: string[];
    attributeMap: {
      [key: string]: string; // Map of attribute name to hash
    };
  } {
    const disclosedAttributes: CredentialAttribute[] = [];
    const deniedAttributes: string[] = [];
    const attributeMap: { [key: string]: string } = {};

    for (const requested of disclosureRequest.requestedAttributes) {
      const userConsented = userConsent[requested] === true;

      if (!userConsented) {
        deniedAttributes.push(requested);
        continue;
      }

      const attribute = credentialAttributes.find((a) => a.name === requested);
      if (attribute) {
        disclosedAttributes.push(attribute);
        // Hash the attribute for privacy
        const hash = ethers.keccak256(
          ethers.toUtf8Bytes(`${attribute.name}:${attribute.value}`)
        );
        attributeMap[attribute.name] = hash;
      }
    }

    return {
      disclosedAttributes,
      deniedAttributes,
      attributeMap,
    };
  }

  /**
   * Create selective disclosure response
   * Combines disclosed attributes with proof of ownership
   */
  static async createDisclosureResponse(
    credentialId: string,
    verifierId: string,
    disclosedAttributes: CredentialAttribute[],
    proof: any
  ): Promise<DisclosureResponse> {
    const attributeObject: { [key: string]: any } = {};

    for (const attr of disclosedAttributes) {
      attributeObject[attr.name] = attr.value;
    }

    return {
      credentialId,
      verifierId,
      disclosedAttributes: attributeObject,
      proof,
      timestamp: new Date(),
    };
  }

  /**
   * Verify disclosure response
   * Validates that disclosure is legitimate and within scope
   */
  static async verifyDisclosure(
    disclosureResponse: DisclosureResponse,
    originalRequest: DisclosureRequest
  ): Promise<{
    valid: boolean;
    details: {
      credentialId: string;
      verifierId: string;
      requestedAttributes: string[];
      disclosedAttributes: string[];
      partialDisclosure: boolean;
      withinExpiration: boolean;
      proofValid: boolean;
    };
    error?: string;
  }> {
    const now = new Date();
    const withinExpiration = now <= originalRequest.expiresAt;

    // Verify proof
    let proofValid = true;
    try {
      const verificationResult = await ZKProofService.verifyProof(
        disclosureResponse.proof.zkProof,
        disclosureResponse.proof.proofType
      );
      proofValid = verificationResult.valid;
    } catch {
      proofValid = false;
    }

    const disclosedAttributeNames = Object.keys(disclosureResponse.disclosedAttributes);
    const requestedSet = new Set(originalRequest.requestedAttributes);
    const disclosedSet = new Set(disclosedAttributeNames);

    // Check if extra attributes were disclosed
    const extraAttributes = disclosedAttributeNames.filter((a) => !requestedSet.has(a));

    if (extraAttributes.length > 0) {
      return {
        valid: false,
        details: {
          credentialId: disclosureResponse.credentialId,
          verifierId: disclosureResponse.verifierId,
          requestedAttributes: originalRequest.requestedAttributes,
          disclosedAttributes: disclosedAttributeNames,
          partialDisclosure: false,
          withinExpiration,
          proofValid,
        },
        error: `Extra attributes disclosed that were not requested: ${extraAttributes.join(', ')}`,
      };
    }

    const partialDisclosure = disclosedAttributeNames.length < originalRequest.requestedAttributes.length;

    return {
      valid: withinExpiration && proofValid,
      details: {
        credentialId: disclosureResponse.credentialId,
        verifierId: disclosureResponse.verifierId,
        requestedAttributes: originalRequest.requestedAttributes,
        disclosedAttributes: disclosedAttributeNames,
        partialDisclosure,
        withinExpiration,
        proofValid,
      },
    };
  }

  /**
   * Get disclosure audit trail
   * Track all attribute disclosures for transparency
   */
  static createAuditTrail(
    credentialId: string,
    disclosure: DisclosureResponse,
    originalRequest: DisclosureRequest
  ): {
    credentialId: string;
    timestamp: Date;
    verifierId: string;
    purpose: string;
    requestedAttributes: string[];
    disclosedAttributes: string[];
    deniedAttributes: string[];
  } {
    const disclosedSet = new Set(Object.keys(disclosure.disclosedAttributes));
    const deniedAttributes = originalRequest.requestedAttributes.filter(
      (a) => !disclosedSet.has(a)
    );

    return {
      credentialId,
      timestamp: new Date(),
      verifierId: originalRequest.verifierId,
      purpose: originalRequest.purpose,
      requestedAttributes: originalRequest.requestedAttributes,
      disclosedAttributes: Array.from(disclosedSet),
      deniedAttributes,
    };
  }

  /**
   * Generate disclosure report for user
   * Shows what was disclosed and to whom
   */
  static generateDisclosureReport(auditTrail: any[]): {
    totalDisclosures: number;
    attributeFrequency: { [key: string]: number };
    verifiers: Set<string>;
    purposes: string[];
    recentDisclosures: any[];
  } {
    const attributeFrequency: { [key: string]: number } = {};
    const verifiers = new Set<string>();
    const purposes: string[] = [];

    for (const trail of auditTrail) {
      verifiers.add(trail.verifierId);
      if (!purposes.includes(trail.purpose)) {
        purposes.push(trail.purpose);
      }

      for (const attr of trail.disclosedAttributes) {
        attributeFrequency[attr] = (attributeFrequency[attr] || 0) + 1;
      }
    }

    return {
      totalDisclosures: auditTrail.length,
      attributeFrequency,
      verifiers,
      purposes,
      recentDisclosures: auditTrail.slice(-5),
    };
  }

  /**
   * Create attribute commitment (hash-based) for ZKP support
   * Returns a commitment root and leaf hashes for each attribute
   */
  static createAttributeCommitment(
    attributes: Record<string, string>
  ): { commitment: string; leaves: string[] } {
    const { ethers } = require('ethers');
    const leaves = Object.entries(attributes).map(
      ([key, value]) => ethers.keccak256(ethers.toUtf8Bytes(`${key}:${value}`))
    );
    const commitment = ethers.keccak256(ethers.toUtf8Bytes(leaves.join('')));
    return { commitment, leaves };
  }

  /**
   * Revoke disclosure
   * User can revoke previous attribute disclosures
   */
  static revokeDisclosure(
    credentialId: string,
    verifierId: string,
    disclosureTimestamp: Date
  ): {
    credentialId: string;
    verifierId: string;
    originalDisclosureTime: Date;
    revokedAt: Date;
    status: 'revoked';
  } {
    return {
      credentialId,
      verifierId,
      originalDisclosureTime: disclosureTimestamp,
      revokedAt: new Date(),
      status: 'revoked',
    };
  }
}

export default SelectiveDisclosureService;
