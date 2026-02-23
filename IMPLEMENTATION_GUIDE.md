# Decentralized Identity System - Implementation Guide

This guide walks through the key implementation patterns and best practices for using the DID system.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Components](#core-components)
3. [Workflow Examples](#workflow-examples)
4. [Security Best Practices](#security-best-practices)
5. [Integration with Supabase](#integration-with-supabase)
6. [Blockchain Integration](#blockchain-integration)
7. [Troubleshooting](#troubleshooting)

## Architecture Overview

The system is built in layers:

```
┌─────────────────────────────────────────────┐
│        React Components & Pages              │
│  (Dashboard, Identity Card, Policy Editor)   │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│      Identity Context (State Management)     │
│          (useIdentity hook)                  │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│      Business Logic Services                 │
│  • DIDService      • VerificationService    │
│  • AccessControl   • DataExchange           │
│  • BlockchainService                        │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│      Cryptography Layer                      │
│  • KeyManagement (secp256k1, AES-256)       │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│      Data Persistence                        │
│  • localStorage (local)                     │
│  • Supabase/PostgreSQL (production)         │
│  • Ethereum Sepolia (blockchain)            │
└─────────────────────────────────────────────┘
```

## Core Components

### 1. Type System (`/lib/types/did.ts`)

All TypeScript interfaces are defined here. Key types:

- `Identity`: User's DID and associated keys
- `VerifiableCredential`: W3C standard credential
- `AccessControlPolicy`: Policy with rules
- `DataExchangeMessage`: Encrypted message
- `ZKProof`: Zero-knowledge proof
- `BlockchainTransaction`: On-chain transaction record

### 2. Cryptography (`/lib/crypto/key-management.ts`)

Handles all cryptographic operations:

```typescript
// Generate new keypair
const { publicKey, privateKey, address } = KeyManagement.generateKeyPair();

// Create DID from address
const did = KeyManagement.createDID(address, chainId);

// Sign message
const signature = KeyManagement.signMessage(privateKey, message);

// Verify signature
const isValid = KeyManagement.verifySignature(message, signature, address);

// Encrypt data
const encrypted = await KeyManagement.encryptData(data, publicKey);

// Decrypt data
const decrypted = await KeyManagement.decryptData(encrypted, privateKey);
```

### 3. Services Layer

Each service handles a specific domain:

#### DIDService
- Identity creation/management
- DID document operations
- DID parsing and validation

#### VerificationService
- Credential issuance
- Signature verification
- ZK proof creation/verification
- Credential presentations

#### AccessControlService
- Policy creation/management
- Rule enforcement
- Access evaluation
- Policy templates

#### DataExchangeService
- Secure messaging
- Credential requests
- Data integrity verification
- Audit logging

#### BlockchainService
- DID registration on-chain
- Transaction management
- Network connectivity

### 4. State Management (`/lib/context/identity-context.tsx`)

React Context provides:
- Current identity state
- Credential management
- Policy management
- Message handling
- Blockchain operations
- Local storage persistence

Usage with hook:

```typescript
const { currentIdentity, createIdentity, createCredential } = useIdentity();
```

## Workflow Examples

### Workflow 1: Create an Identity

```typescript
import { useIdentity } from "@/lib/context/identity-context";

export function CreateIdentityComponent() {
  const { createIdentity, isLoading, error } = useIdentity();

  const handleCreate = async () => {
    const identity = await createIdentity("My Digital Identity");
    
    if (identity) {
      console.log("Identity created:", identity.did);
      // Store in context automatically
    } else {
      console.error("Failed to create identity:", error);
    }
  };

  return (
    <button onClick={handleCreate} disabled={isLoading}>
      {isLoading ? "Creating..." : "Create Identity"}
    </button>
  );
}
```

### Workflow 2: Issue a Verifiable Credential

```typescript
import { useIdentity } from "@/lib/context/identity-context";

export function IssueCredentialComponent() {
  const { currentIdentity, createCredential } = useIdentity();

  const handleIssueKYC = async () => {
    if (!currentIdentity) return;

    const credential = await createCredential(
      "did:ethr:11155111:0x...", // recipient DID
      "KYCCredential",
      {
        name: "Jane Doe",
        dateOfBirth: "1990-01-01",
        verified: true,
        verificationDate: new Date().toISOString(),
      },
      365 // 1 year expiration
    );

    if (credential) {
      console.log("Credential issued:", credential.id);
    }
  };

  return <button onClick={handleIssueKYC}>Issue KYC Credential</button>;
}
```

### Workflow 3: Verify a Credential

```typescript
import VerificationService from "@/lib/services/verification-service";

function verifyCredentialExample(credential: VerifiableCredential) {
  // Verify credential is not expired
  const isNotExpired = VerificationService.isCredentialValid(credential);
  
  // Verify signature (need issuer's address)
  const isSignatureValid = VerificationService.verifyCredentialSignature(
    credential,
    issuerAddress
  );

  // Full verification
  const result = VerificationService.verifyCredential(credential, issuerAddress);

  if (result.valid) {
    console.log("Credential is valid");
    console.log("Issuer:", result.issuer);
    console.log("Subject:", result.subject);
    console.log("Type:", result.credentialType);
  } else {
    console.error("Credential verification failed:", result.error);
  }
}
```

### Workflow 4: Create Access Control Policy

```typescript
import { useIdentity } from "@/lib/context/identity-context";
import AccessControlService from "@/lib/services/access-control-service";

export function CreatePolicyComponent() {
  const { currentIdentity, createPolicy, policies, updatePolicy } = useIdentity();

  const handleCreatePolicy = async () => {
    if (!currentIdentity) return;

    // Create policy
    let policy = await createPolicy(currentIdentity.id, "credential");
    if (!policy) return;

    // Add rule: Allow specific user to read
    policy = AccessControlService.addRule(
      policy,
      "did:ethr:11155111:0x...", // subject DID
      "read",
      policy.resourceId,
      "allow"
    );

    // Add rule: Deny anyone else
    policy = AccessControlService.addRule(
      policy,
      "*", // anyone
      "write",
      policy.resourceId,
      "deny"
    );

    // Save policy
    await updatePolicy(policy);
  };

  return <button onClick={handleCreatePolicy}>Create Policy</button>;
}
```

### Workflow 5: Evaluate Access

```typescript
import AccessControlService from "@/lib/services/access-control-service";

function checkAccess(
  policy: AccessControlPolicy,
  requesterDID: string,
  action: string
) {
  const result = AccessControlService.evaluateAccess(
    policy,
    requesterDID,
    action
  );

  if (result.allowed) {
    console.log(`Access allowed: ${result.reason}`);
  } else {
    console.log(`Access denied: ${result.reason}`);
  }

  return result.allowed;
}
```

### Workflow 6: Secure Data Exchange

```typescript
import { useIdentity } from "@/lib/context/identity-context";
import DataExchangeService from "@/lib/services/data-exchange-service";

export function SecureMessageComponent() {
  const { currentIdentity, sendMessage, receiveMessage } = useIdentity();

  // Send encrypted message
  const handleSendData = async (recipientDID: string, data: string) => {
    if (!currentIdentity) return;

    const message = await sendMessage(recipientDID, data);
    
    if (message) {
      console.log("Message sent:", message.id);
      console.log("Message is encrypted and secure");
    }
  };

  // Receive and decrypt message
  const handleReceiveData = async (message: DataExchangeMessage) => {
    const decrypted = await receiveMessage(message);
    
    if (decrypted) {
      console.log("Decrypted data:", decrypted);
    }
  };

  return (
    <div>
      <button onClick={() => handleSendData("did:ethr:...", "secret data")}>
        Send Encrypted Message
      </button>
    </div>
  );
}
```

### Workflow 7: Zero-Knowledge Proof Verification

```typescript
import VerificationService from "@/lib/services/verification-service";

function zkProofWorkflow() {
  // Create ZK proof request
  const request = VerificationService.createZKProofRequest(
    "age-over-18",
    { minAge: 18 },
    10 // 10 minute expiration
  );

  // Prover creates proof
  const proof = VerificationService.createZKProof(
    request,
    { userAge: 25 } // Private input
  );

  // Verifier verifies proof
  const isValid = VerificationService.verifyZKProof(proof);

  if (isValid) {
    console.log("Zero-knowledge proof verified");
    console.log("User is over 18 (without revealing actual age)");
  }
}
```

## Security Best Practices

### 1. Private Key Management

```typescript
// ✅ CORRECT: Keep private key secure
const identity = DIDService.createIdentity();
// Private key only used for cryptographic operations
const signature = KeyManagement.signMessage(identity.privateKeyHex, message);

// ❌ WRONG: Never send private key to server
// const response = await fetch('/api/sign', {
//   body: JSON.stringify({ privateKey: identity.privateKeyHex })
// });
```

### 2. Signature Verification

```typescript
// ✅ CORRECT: Always verify signatures
const isValid = KeyManagement.verifySignature(
  message,
  signature,
  knownAddress
);
if (!isValid) throw new Error("Signature verification failed");

// ❌ WRONG: Trust unverified signatures
// const data = JSON.parse(receivedMessage);
```

### 3. Access Control Enforcement

```typescript
// ✅ CORRECT: Always check access before granting
const policy = accessControl.getPolicy(resourceId);
const allowed = AccessControlService.evaluateAccess(
  policy,
  requesterDID,
  "read"
);
if (!allowed) return error("Access denied");

// ❌ WRONG: Skip access control
// return resource; // Anyone can access
```

### 4. Data Encryption

```typescript
// ✅ CORRECT: Always encrypt sensitive data
const encrypted = await KeyManagement.encryptData(
  sensitiveData,
  recipientPublicKey
);
// Transmit encrypted data

// ❌ WRONG: Send unencrypted sensitive data
// await fetch('/api/share', { body: sensitiveData });
```

### 5. Credential Expiration

```typescript
// ✅ CORRECT: Check expiration
const isValid = VerificationService.isCredentialValid(credential);
if (!isValid) return error("Credential expired");

// ❌ WRONG: Ignore expiration
// return credential; // Could be expired
```

## Integration with Supabase

### Step 1: Setup Supabase

```bash
# Create Supabase project at https://supabase.com

# Get your credentials
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key
```

### Step 2: Run Database Schema

```bash
# Connect to Supabase PostgreSQL
# Run the schema from /lib/database/schema.sql
```

### Step 3: Update Identity Context

```typescript
// In /lib/context/identity-context.tsx

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Replace localStorage operations with:
const saveToDatabase = async (identity: Identity) => {
  const { error } = await supabase
    .from("identities")
    .upsert({
      id: identity.id,
      did: identity.did,
      wallet_address: identity.walletAddress,
      public_key_hex: identity.publicKeyHex,
      private_key_hex: identity.privateKeyHex, // Encrypt in production!
      name: identity.name,
      did_document: identity.didDocument,
      metadata: identity.metadata,
    });

  if (error) throw error;
};
```

## Blockchain Integration

### Connect to Real Network

```typescript
// In /lib/services/blockchain-service.ts
import { ethers } from "ethers";

// Use real RPC provider
const SEPOLIA_RPC_URL = "https://sepolia.infura.io/v3/YOUR_INFURA_KEY";

BlockchainService.setRpcUrl(SEPOLIA_RPC_URL);

// Set DID Registry contract address (deploy your own)
const DID_REGISTRY_ADDRESS = "0x...";
BlockchainService.setRegistryAddress(DID_REGISTRY_ADDRESS);
```

### Smart Contract Example

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract SimpleDIDRegistry {
  mapping(string => DIDs) public dids;
  
  struct DIDs {
    address controller;
    string publicKey;
    uint256 updated;
  }

  function registerDID(string calldata did, string calldata publicKey) external {
    dids[did] = DIDs({
      controller: msg.sender,
      publicKey: publicKey,
      updated: block.timestamp
    });
  }

  function resolveDID(string calldata did) external view returns (address, string memory) {
    return (dids[did].controller, dids[did].publicKey);
  }
}
```

### Register DID On-Chain

```typescript
async function registerOnBlockchain(identity: Identity) {
  const tx = await BlockchainService.registerDID(
    identity.did,
    identity.publicKeyHex,
    identity.walletAddress
  );

  console.log("Transaction hash:", tx.hash);
  
  // Wait for confirmation
  const receipt = await BlockchainService.getTransactionStatus(tx.hash);
  console.log("Confirmations:", receipt?.confirmations);
}
```

## Troubleshooting

### Issue: "Decryption failed"

```typescript
// Ensure you're using the correct private key
// The encrypted message was encrypted with the PUBLIC key
// You need the corresponding PRIVATE key to decrypt

const decrypted = await KeyManagement.decryptData(
  encryptedData,
  myPrivateKeyHex // Not public key!
);
```

### Issue: "Signature verification failed"

```typescript
// Ensure you have the correct address
// The address must be the one that signed the message

const isValid = KeyManagement.verifySignature(
  originalMessage, // Must be exact same message
  signature,
  signerAddress // The address that signed
);
```

### Issue: "Policy evaluation returns false unexpectedly"

```typescript
// Check if rule has expired
if (rule.expiresAt && new Date(rule.expiresAt) < new Date()) {
  // Rule is expired, will be skipped
}

// Check if deny rules take precedence
// Deny rules are evaluated first - even one matching deny rule blocks access

// Verify subject DID format matches exactly
// "did:ethr:11155111:0x123..." !== "did:ethr:11155111:0x123..." (case matters)
```

### Issue: "Credential verification fails"

```typescript
// Check all three conditions:
1. Signature is valid
2. Credential is not expired
3. Issuer address matches

const result = VerificationService.verifyCredential(
  credential,
  issuerAddress // Must match credential.issuer
);

if (!result.valid) {
  console.log("Error:", result.error);
}
```

### Issue: "Messages not persisting"

```typescript
// Ensure saveToLocalStorage is called after state changes
// Or implement Supabase persistence as shown above

const { currentIdentity, saveToLocalStorage } = useIdentity();

useEffect(() => {
  if (currentIdentity) {
    saveToLocalStorage();
  }
}, [currentIdentity, saveToLocalStorage]);
```

---

For more help, check:
- README.md for architecture overview
- /lib/services/* for API documentation
- /components/* for UI component usage
- Issue tracker for known issues
