// Secure Data Exchange Service for Trustless Communication
import {
  DataExchangeMessage,
  CredentialRequest,
  VerifiableCredential,
  VerifiablePresentation,
} from "@/lib/types/did";
import KeyManagement from "@/lib/crypto/key-management";
import VerificationService from "@/lib/services/verification-service";
import { ethers } from "ethers";

export class DataExchangeService {
  /**
   * Create a credential request
   */
  static createCredentialRequest(
    requesterId: string,
    credentialTypes: string[],
    context?: Record<string, unknown>,
    expirationMinutes: number = 10
  ): CredentialRequest {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + expirationMinutes);

    return {
      id: `urn:uuid:${this.generateUUID()}`,
      requesterId,
      credentialTypes,
      challenge: KeyManagement.generateNonce(),
      createdAt: new Date(),
      expiresAt,
      context,
    };
  }

  /**
   * Create a secure data exchange message
   */
  static async createExchangeMessage(
    from: string,
    to: string,
    data: string,
    toPublicKey: string,
    credentialRequest?: CredentialRequest
  ): Promise<DataExchangeMessage> {
    const nonce = KeyManagement.generateNonce();
    const encryptedData = await KeyManagement.encryptData(data, toPublicKey);
    const dataHash = ethers.keccak256(ethers.toBeHex(data));

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    return {
      id: `urn:uuid:${this.generateUUID()}`,
      from,
      to,
      dataHash,
      encryptedData,
      encryptionAlgorithm: "AES-256-GCM",
      nonce,
      timestamp: new Date(),
      expiresAt,
      credentialRequest,
      status: "pending",
    };
  }

  /**
   * Decrypt exchange message
   */
  static async decryptExchangeMessage(
    message: DataExchangeMessage,
    privateKey: string
  ): Promise<string> {
    return KeyManagement.decryptData(message.encryptedData, privateKey);
  }

  /**
   * Verify message hasn't been tampered with
   */
  static async verifyMessageIntegrity(
    message: DataExchangeMessage,
    decryptedData: string
  ): Promise<boolean> {
    const computedHash = ethers.keccak256(ethers.toBeHex(decryptedData));
    return computedHash === message.dataHash;
  }

  /**
   * Check if message has expired
   */
  static isMessageExpired(message: DataExchangeMessage): boolean {
    if (!message.expiresAt) {
      return false;
    }
    return new Date() > new Date(message.expiresAt);
  }

  /**
   * Create a credential response for a request
   */
  static createCredentialResponse(
    credentialRequest: CredentialRequest,
    credentials: VerifiableCredential[],
    issuerDID: string,
    issuerPrivateKey: string
  ): {
    credentials: VerifiableCredential[];
    presentation: VerifiablePresentation;
    proofValue: string;
  } {
    // Create a presentation of the requested credentials
    const { presentation, proofValue } = VerificationService.createPresentation(
      credentials,
      issuerDID,
      credentialRequest.requesterId,
      credentialRequest.challenge,
      issuerPrivateKey
    );

    return {
      credentials,
      presentation,
      proofValue,
    };
  }

  /**
   * Verify credential request is valid
   */
  static verifyCredentialRequest(request: CredentialRequest): {
    valid: boolean;
    reason: string;
  } {
    // Check expiration
    if (new Date() > new Date(request.expiresAt)) {
      return {
        valid: false,
        reason: "Credential request has expired",
      };
    }

    // Check required fields
    if (!request.requesterId || !request.credentialTypes.length) {
      return {
        valid: false,
        reason: "Invalid credential request: missing required fields",
      };
    }

    return {
      valid: true,
      reason: "Credential request is valid",
    };
  }

  /**
   * Create a data sharing agreement
   */
  static createDataSharingAgreement(
    dataOwnerId: string,
    dataConsumerId: string,
    dataDescription: string,
    usageRestrictions: string[],
    expirationDays: number = 30
  ): {
    id: string;
    agreement: Record<string, unknown>;
    hash: string;
  } {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expirationDays);

    const agreement = {
      id: `urn:uuid:${this.generateUUID()}`,
      type: "DataSharingAgreement",
      dataOwner: dataOwnerId,
      dataConsumer: dataConsumerId,
      dataDescription,
      usageRestrictions,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      terms: {
        purpose: "Data processing and analysis",
        limitations: usageRestrictions,
        retention: "90 days after agreement expiration",
        sublicense: false,
        derivative: "Not permitted",
      },
    };

    const agreementStr = JSON.stringify(agreement);
    const hash = ethers.keccak256(ethers.toBeHex(agreementStr));

    return {
      id: agreement.id as string,
      agreement,
      hash,
    };
  }

  /**
   * Create an audit log entry
   */
  static createAuditLogEntry(
    actorDID: string,
    action: string,
    resourceId: string,
    status: "success" | "failure",
    details?: Record<string, unknown>
  ): {
    id: string;
    timestamp: Date;
    actor: string;
    action: string;
    resource: string;
    status: string;
    details?: Record<string, unknown>;
    hash: string;
  } {
    const entry = {
      id: `urn:uuid:${this.generateUUID()}`,
      timestamp: new Date().toISOString(),
      actor: actorDID,
      action,
      resource: resourceId,
      status,
      details: details || {},
    };

    const entryStr = JSON.stringify(entry);
    const hash = ethers.keccak256(ethers.toBeHex(entryStr));

    return {
      id: entry.id,
      timestamp: new Date(entry.timestamp),
      actor: entry.actor,
      action: entry.action,
      resource: entry.resource,
      status: entry.status,
      details: entry.details,
      hash,
    };
  }

  /**
   * Batch verify multiple messages
   */
  static async verifyMessageBatch(
    messages: DataExchangeMessage[],
    privateKey: string
  ): Promise<
    Array<{
      messageId: string;
      valid: boolean;
      error?: string;
      decryptedData?: string;
    }>
  > {
    const results = [];

    for (const message of messages) {
      try {
        // Check expiration
        if (this.isMessageExpired(message)) {
          results.push({
            messageId: message.id,
            valid: false,
            error: "Message expired",
          });
          continue;
        }

        // Decrypt
        const decryptedData = await this.decryptExchangeMessage(
          message,
          privateKey
        );

        // Verify integrity
        const integrityValid = await this.verifyMessageIntegrity(
          message,
          decryptedData
        );

        if (!integrityValid) {
          results.push({
            messageId: message.id,
            valid: false,
            error: "Data integrity check failed",
          });
          continue;
        }

        results.push({
          messageId: message.id,
          valid: true,
          decryptedData,
        });
      } catch (error) {
        results.push({
          messageId: message.id,
          valid: false,
          error: `Verification failed: ${(error as Error).message}`,
        });
      }
    }

    return results;
  }

  /**
   * Create a revocation notice
   */
  static createRevocationNotice(
    revokerDID: string,
    credentialId: string,
    reason: string,
    revocationDate: Date = new Date()
  ): {
    id: string;
    credentialId: string;
    revoker: string;
    reason: string;
    revocationDate: Date;
    hash: string;
  } {
    const notice = {
      id: `urn:uuid:${this.generateUUID()}`,
      credentialId,
      revoker: revokerDID,
      reason,
      revocationDate: revocationDate.toISOString(),
    };

    const noticeStr = JSON.stringify(notice);
    const hash = ethers.keccak256(ethers.toBeHex(noticeStr));

    return {
      id: notice.id,
      credentialId: notice.credentialId,
      revoker: notice.revoker,
      reason: notice.reason,
      revocationDate: new Date(notice.revocationDate),
      hash,
    };
  }

  /**
   * Format message for secure transmission
   */
  static formatForTransmission(message: DataExchangeMessage): string {
    return JSON.stringify({
      id: message.id,
      from: message.from,
      to: message.to,
      dataHash: message.dataHash,
      encryptedData: message.encryptedData,
      encryptionAlgorithm: message.encryptionAlgorithm,
      nonce: message.nonce,
      timestamp: message.timestamp.toISOString(),
      expiresAt: message.expiresAt?.toISOString(),
      status: message.status,
      // Credential request is omitted from transmission for privacy
    });
  }

  /**
   * Parse received transmission
   */
  static parseFromTransmission(transmissionJson: string): DataExchangeMessage | null {
    try {
      const data = JSON.parse(transmissionJson);
      return {
        id: data.id,
        from: data.from,
        to: data.to,
        dataHash: data.dataHash,
        encryptedData: data.encryptedData,
        encryptionAlgorithm: data.encryptionAlgorithm,
        nonce: data.nonce,
        timestamp: new Date(data.timestamp),
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
        status: data.status,
      };
    } catch {
      return null;
    }
  }

  /**
   * Generate UUID v4
   */
  private static generateUUID(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

export default DataExchangeService;
