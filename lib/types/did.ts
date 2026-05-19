// DID and Identity Types for the Decentralized Identity System

export interface DIDDocument {
  "@context": string[];
  id: string;
  publicKey: PublicKeySpec[];
  authentication: string[];
  assertionMethod: string[];
  keyAgreement: string[];
  verificationMethod: VerificationMethod[];
  service?: Service[];
  created: string;
  updated?: string;
}

export interface PublicKeySpec {
  id: string;
  type: string;
  controller: string;
  publicKeyPem?: string;
  publicKeyHex?: string;
  publicKeyJwk?: Record<string, unknown>;
}

export interface VerificationMethod {
  id: string;
  type: "EcdsaSecp256k1VerificationKey2019" | "Ed25519VerificationKey2018" | string;
  controller: string;
  publicKeyPem?: string;
  publicKeyHex?: string;
  publicKeyJwk?: Record<string, unknown>;
  publicKeyMultibase?: string;
}

export interface Service {
  id: string;
  type: string;
  serviceEndpoint: string | Record<string, unknown>;
}

export type UserRole = "owner" | "issuer" | "verifier";

export interface User {
  id: string;
  email?: string;
  roles: UserRole[];
  activeRole: UserRole;
  primaryIdentityId?: string;
  organizationId?: string; // For issuer/verifier roles
  createdAt: Date;
  lastLoginAt?: Date;
  preferences?: {
    theme?: "light" | "dark";
    defaultRole?: UserRole;
    notifications?: boolean;
  };
}

export interface Organization {
  id: string;
  name: string;
  description?: string;
  didDocument?: DIDDocument;
  issuerEnabled: boolean;
  verifierEnabled: boolean;
  verifiedAt?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface Identity {
  id: string;
  did: string;
  didDocument: DIDDocument;
  publicKeyHex: string;
  privateKeyHex?: string; // Only stored locally, never transmitted
  publicKey: Uint8Array;
  privateKey?: Uint8Array; // Only stored locally
  walletAddress: string;
  createdAt: Date;
  updatedAt: Date;
  name?: string;
  description?: string;
  role?: UserRole; // Primary role for this identity
  organizationId?: string; // If this is an organization identity
  metadata?: Record<string, unknown>;
}

export interface VerifiableCredential {
  "@context": string[];
  id: string;
  type: string[];
  issuer: string;
  issuanceDate: string;
  expirationDate?: string;
  credentialSubject: Record<string, unknown>;
  credentialStatus?: {
    id: string;
    type: string;
  };
  proof: Proof;
}

export interface VerifiablePresentation {
  "@context": string[];
  id: string;
  type: string[];
  holder: string;
  verifiableCredential: VerifiableCredential[];
  created: string;
  proof: Proof;
}

export interface Proof {
  type: string;
  created: string;
  verificationMethod: string;
  signatureValue?: string;
  proofValue?: string;
  jws?: string;
  challenge?: string;
  domain?: string;
}

export interface VerificationResult {
  valid: boolean;
  issuer?: string;
  subject?: string;
  credentialType?: string;
  expirationDate?: string;
  error?: string;
}

export interface AccessControlPolicy {
  id: string;
  resourceId: string;
  resourceType: "credential" | "data" | "service";
  owner: string;
  rules: AccessRule[];
  createdAt: Date;
  updatedAt: Date;
  active: boolean;
  // Consent tracking fields
  requiresConsent?: boolean;
  consentRecords?: ConsentRecord[];
  consentHistory?: ConsentAuditEntry[];
  // Revocation integration
  revocationEnabled?: boolean;
  revocationRegistry?: string; // Reference to revocation registry
  // Data lifecycle
  dataRetention?: DataRetention;
  lifecycleEvents?: DataLifecycleEvent[];
}

export interface AccessRule {
  id: string;
  subject: string | string[]; // DID(s)
  action: "read" | "write" | "execute" | "share" | "revoke" | "*";
  resource: string;
  effect: "allow" | "deny";
  conditions?: AccessCondition[];
  expiresAt?: Date;
}

export interface AccessCondition {
  type: "time" | "zk-proof" | "credential-requirement" | "rate-limit";
  value: unknown;
  operator?: "equals" | "greater-than" | "less-than" | "contains";
}

export interface DataExchangeMessage {
  id: string;
  from: string; // DID
  to: string; // DID
  dataHash: string;
  encryptedData: string;
  encryptionAlgorithm: string;
  nonce: string;
  timestamp: Date;
  expiresAt?: Date;
  credentialRequest?: CredentialRequest;
  status: "pending" | "accepted" | "rejected" | "revoked";
}

export interface CredentialRequest {
  id: string;
  requesterId: string;
  credentialTypes: string[];
  challenge: string;
  createdAt: Date;
  expiresAt: Date;
  context?: Record<string, unknown>;
}

export interface ZKProofRequest {
  id: string;
  proofType: string;
  publicInputs: Record<string, unknown>;
  challenge: string;
  createdAt: Date;
}

export interface ZKProof {
  id: string;
  proofType: string;
  proof: string;
  publicInputs: Record<string, unknown>;
  verificationKey: string;
  verified: boolean;
  verifiedAt?: Date;
}

export interface BlockchainTransaction {
  hash: string;
  from: string;
  to: string;
  data: string;
  gasLimit: string;
  gasPrice: string;
  nonce: number;
  chainId: number;
  status: "pending" | "confirmed" | "failed";
  blockNumber?: number;
  timestamp?: Date;
  confirmations?: number;
}

export interface DIDRegistry {
  did: string;
  walletAddress: string;
  publicKey: string;
  created: Date;
  updated: Date;
  active: boolean;
  transactionHash: string;
}

// Consent Management Types
export type ConsentStatus = "pending" | "granted" | "denied" | "revoked" | "expired";
export type ConsentType = "credential-sharing" | "data-processing" | "verification" | "analytics" | "marketing";

export interface ConsentRecord {
  id: string;
  userId: string;
  dataControllerDid: string;
  consentType: ConsentType;
  description: string;
  status: ConsentStatus;
  scope: string[]; // Which attributes are covered
  purposes: string[]; // Why the data is being processed
  grantedAt?: Date;
  expiresAt: Date;
  revokedAt?: Date;
  auditLog: ConsentAuditEntry[];
  metadata?: Record<string, unknown>;
}

export interface ConsentAuditEntry {
  id: string;
  timestamp: Date;
  action: "created" | "granted" | "denied" | "revoked" | "accessed";
  actor: string; // DID of who made the change
  reason?: string;
  metadata?: Record<string, unknown>;
}

// Revocation Registry Types
export type RevocationType = "credential" | "identity" | "consent" | "policy";
export type RevocationReason = "user-request" | "expired" | "compromised" | "authority-decision" | "data-breach";

export interface RevocationRecord {
  id: string;
  resourceId: string; // Credential ID, DID, etc.
  resourceType: RevocationType;
  revocationReason: RevocationReason;
  revokedBy: string; // DID of who initiated revocation
  revokedAt: Date;
  effectiveAt: Date;
  blockchainTxHash?: string;
  metadata?: Record<string, unknown>;
}

export interface RevocationRegistry {
  id: string;
  registryAddress?: string; // Smart contract address if on-chain
  revokedItems: RevocationRecord[];
  createdAt: Date;
  updatedAt: Date;
  issuerId: string;
}

// Data Lifecycle Management Types
export type DataLifecycleStage = "collection" | "processing" | "storage" | "sharing" | "deletion";
export type DataRetentionPolicy = "short-term" | "medium-term" | "long-term" | "permanent" | "until-revoked";

export interface DataLifecycleEvent {
  id: string;
  credentialId: string;
  stage: DataLifecycleStage;
  timestamp: Date;
  actor: string; // DID of who performed action
  action: string;
  metadata?: Record<string, unknown>;
}

export interface DataRetention {
  id: string;
  resourceId: string;
  resourceType: string;
  retentionPolicy: DataRetentionPolicy;
  retentionPeriodDays?: number;
  createdAt: Date;
  willExpireAt?: Date;
  autoDeleteAt?: Date;
}
