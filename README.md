# Decentralized Identity Management & Access Control System

A comprehensive Next.js application implementing a decentralized identity (DID) and access control system with blockchain integration, zero-knowledge proofs, and verifiable credentials.

## Features

### Core Identity Management
- **DID Creation & Management**: Create self-sovereign identities using did:ethr standard
- **DID Document Management**: W3C compliant DID documents with verification methods
- **Key Management**: Secure ECDSA secp256k1 key generation and management
- **Identity Export/Import**: Backup and restore identities securely

### Identity Verification (3 Methods)
1. **Digital Signatures**: ECDSA-based cryptographic signatures for authentication
2. **Verifiable Credentials (W3C)**: Standards-compliant credentials with proof
3. **Zero-Knowledge Proofs**: Privacy-preserving verification mechanisms

### Access Control
- **Policy Management**: Create and enforce access control policies
- **Fine-grained Rules**: Allow/deny rules with conditions
- **Role-based Access**: Subject-based access evaluation
- **Policy Templates**: Pre-built templates for common scenarios (open, private, shared, time-limited)
- **Condition Types**: Time-based, ZK-proof, credential requirements, rate limiting

### Secure Data Exchange
- **Encrypted Messaging**: AES-256-GCM encrypted data transfer
- **Credential Requests**: Request specific credentials from other identities
- **Data Integrity**: Hash verification for message integrity
- **Audit Logging**: Complete audit trail of all actions
- **Message Expiration**: Automatic expiration of old messages

### Blockchain Integration (Sepolia Testnet)
- **DID Registry**: Register DIDs on Ethereum Sepolia testnet
- **Transaction Management**: Track DID operations on blockchain
- **Credential Anchoring**: Hash credentials on-chain for verification
- **Smart Contract Ready**: Architecture for DID Registry contracts

## Technology Stack

- **Frontend**: Next.js 16, React 19, TypeScript
- **Styling**: Tailwind CSS 4, shadcn/ui components
- **Cryptography**: ethers.js (secp256k1, AES-256-GCM, SHA-256)
- **State Management**: React Context with local storage
- **UI Components**: Radix UI, Recharts
- **Notifications**: Sonner toast library

## Project Structure

```
├── app/
│   ├── layout.tsx              # Root layout with providers
│   └── page.tsx                # Dashboard page
├── lib/
│   ├── types/
│   │   └── did.ts              # Type definitions
│   ├── crypto/
│   │   └── key-management.ts   # Cryptographic operations
│   ├── services/
│   │   ├── did-service.ts      # DID creation/management
│   │   ├── verification-service.ts  # Signature, VC, ZKP
│   │   ├── access-control-service.ts # Policy enforcement
│   │   ├── data-exchange-service.ts  # Secure messaging
│   │   └── blockchain-service.ts    # Ethereum integration
│   ├── context/
│   │   └── identity-context.tsx # State management
│   └── utils/
│       └── formatting.ts        # Utility functions
└── components/
    ├── identity-card.tsx        # Identity display
    ├── credential-card.tsx      # Credential display
    └── policy-editor.tsx        # Policy management UI
```

## Getting Started

### Installation

```bash
# Clone repository
git clone <repo-url>

# Install dependencies
npm install

# Run development server
npm run dev

# Open browser
open http://localhost:3000
```

### Quick Start

1. **Create an Identity**: Click "Create Identity" button on the landing page
2. **View DID Document**: See your W3C compliant DID document
3. **Create Credentials**: Issue verifiable credentials to other identities
4. **Manage Policies**: Set access control policies for your resources
5. **Verify Credentials**: Verify signatures and credentials
6. **Exchange Data**: Securely send encrypted messages

## Core Services

### DIDService
Create and manage decentralized identifiers.

```typescript
import { DIDService } from "@/lib/services/did-service";

// Create identity
const identity = DIDService.createIdentity("My Identity");

// Parse DID
const parsed = DIDService.parseDID("did:ethr:11155111:0x...");

// Export/Import identity
const exported = DIDService.exportIdentity(identity);
const imported = DIDService.importIdentity(exported);
```

### VerificationService
Create and verify credentials, signatures, and proofs.

```typescript
import { VerificationService } from "@/lib/services/verification-service";

// Create verifiable credential
const credential = VerificationService.createVerifiableCredential(
  issuerDID,
  subjectDID,
  "KYCCredential",
  { name: "John Doe", verified: true },
  privateKey
);

// Verify credential
const result = VerificationService.verifyCredential(credential);

// Create digital signature
const signature = VerificationService.createSignature(message, privateKey);
```

### AccessControlService
Define and enforce access control policies.

```typescript
import { AccessControlService } from "@/lib/services/access-control-service";

// Create policy
const policy = AccessControlService.createPolicy(
  resourceId,
  "credential",
  ownerDID
);

// Add rule
let updated = AccessControlService.addRule(
  policy,
  subjectDID,
  "read",
  resourceId,
  "allow"
);

// Evaluate access
const result = AccessControlService.evaluateAccess(
  policy,
  requesterDID,
  "read"
);
```

### DataExchangeService
Exchange data securely between identities.

```typescript
import { DataExchangeService } from "@/lib/services/data-exchange-service";

// Create credential request
const request = DataExchangeService.createCredentialRequest(
  requesterId,
  ["KYCCredential"]
);

// Send encrypted message
const message = await DataExchangeService.createExchangeMessage(
  fromDID,
  toDID,
  data,
  toPublicKey
);

// Decrypt message
const decrypted = await DataExchangeService.decryptExchangeMessage(
  message,
  privateKey
);
```

### BlockchainService
Integrate with Ethereum Sepolia testnet.

```typescript
import { BlockchainService } from "@/lib/services/blockchain-service";

// Initialize provider
await BlockchainService.initializeProvider();

// Register DID on-chain
const tx = await BlockchainService.registerDID(
  did,
  publicKey,
  controller
);

// Resolve DID
const registry = await BlockchainService.resolveDIDOnchain(did);
```

## API Reference

### Identity Management

#### `useIdentity()`
React hook for accessing identity context.

```typescript
const {
  currentIdentity,
  isLoading,
  error,
  createIdentity,
  exportIdentity,
  importIdentity,
} = useIdentity();
```

### Credential Operations

```typescript
// Create credential
const credential = await createCredential(
  subjectDID,
  credentialType,
  claims,
  expirationDays
);

// Verify credential
const isValid = await verifyCredential(credential);

// Revoke credential
await revokeCredential(credentialId);
```

### Access Control

```typescript
// Create policy
const policy = await createPolicy(resourceId, resourceType);

// Evaluate access
const allowed = await evaluateAccess(policyId, requesterDID, action);

// Update policy
await updatePolicy(policy);
```

### Data Exchange

```typescript
// Send message
const message = await sendMessage(recipientDID, data);

// Receive message
const decrypted = await receiveMessage(message);

// Add message
addMessage(message);
```

## Security Features

- **Private Key Protection**: Private keys kept secure, never transmitted
- **Encryption**: AES-256-GCM encryption for data in transit
- **Signature Verification**: ECDSA-based message authentication
- **Access Control**: Fine-grained policy-based access control
- **Audit Trail**: Complete audit log of all operations
- **Message Integrity**: Hash-based integrity verification
- **Expiration Handling**: Automatic expiration of credentials and messages

## DID & W3C Standards

This implementation follows:
- **W3C Decentralized Identifiers (DIDs)**: https://www.w3.org/TR/did-core/
- **W3C Verifiable Credentials Data Model**: https://www.w3.org/TR/vc-data-model-2.0/
- **EIP-1056**: Ethereum Identifier (did:ethr)

## Blockchain Integration

### Supported Networks
- **Sepolia Testnet** (default)
  - Chain ID: 11155111
  - Testnet Faucet: https://sepoliafaucet.com

### Smart Contract Integration
The system is designed to work with DID Registry smart contracts:

```solidity
interface IDIDRegistry {
  function registerDID(string did, string publicKey, string controller) external;
  function updateDID(string did, string publicKey) external;
  function resolveDID(string did) external view returns (string);
  function revokeDID(string did) external;
}
```

## Configuration

### Environment Variables
No required environment variables for demo mode. For production blockchain integration, set:

```bash
NEXT_PUBLIC_INFURA_KEY=your_infura_key
NEXT_PUBLIC_DID_REGISTRY_ADDRESS=0x...
```

### Blockchain RPC URL
```typescript
BlockchainService.setRpcUrl("https://sepolia.infura.io/v3/YOUR_KEY");
BlockchainService.setRegistryAddress("0x...");
```

## Use Cases

### 1. Self-Sovereign Identity
Users maintain complete control over their identity without relying on centralized authorities.

### 2. Zero-Trust Data Exchange
Share credentials and data with organizations while maintaining privacy through ZKPs.

### 3. Decentralized Authentication
Use DIDs for authentication across multiple applications and platforms.

### 4. Credential Issuance
Organizations issue verifiable credentials that can be independently verified.

### 5. Access Control
Fine-grained control over who can access sensitive resources.

## Example Workflows

### Workflow 1: Create Identity → Issue Credential

```typescript
const { createIdentity, createCredential } = useIdentity();

// Step 1: Create identity
const identity = await createIdentity("John Doe");

// Step 2: Issue credential to someone else
const credential = await createCredential(
  "did:ethr:11155111:0x...", // recipient
  "KYCCredential",
  { name: "Jane Smith", verified: true },
  365 // 1 year expiration
);
```

### Workflow 2: Request & Share Credentials

```typescript
// Step 1: Create credential request
const request = DataExchangeService.createCredentialRequest(
  requesterDID,
  ["KYCCredential", "EducationCredential"]
);

// Step 2: Respond with credentials
const { presentation } = VerificationService.createPresentation(
  myCredentials,
  myDID,
  requesterDID,
  request.challenge,
  myPrivateKey
);

// Step 3: Send presentation
await sendMessage(requesterDID, JSON.stringify(presentation));
```

### Workflow 3: Enforce Access Control

```typescript
// Step 1: Create policy
const policy = await createPolicy(resourceId, "credential");

// Step 2: Add access rules
policy = AccessControlService.addRule(
  policy,
  trustedPartnerDID,
  "read",
  resourceId,
  "allow"
);

// Step 3: Save policy
await updatePolicy(policy);

// Step 4: Evaluate access
const allowed = await evaluateAccess(policyId, requesterDID, "read");
```

## Performance Considerations

- **Cryptographic Operations**: All crypto operations run client-side (fast)
- **Storage**: Uses browser localStorage (limited to ~5-10MB)
- **Blockchain Calls**: Mock transactions for demo (configurable for real networks)
- **Credential Verification**: O(1) signature verification time

## Testing

```bash
# Run tests
npm run test

# Build for production
npm run build

# Start production server
npm run start
```

## Limitations & Future Enhancements

### Current Limitations
- No persistent backend (uses localStorage)
- Mock blockchain transactions (can be connected to real networks)
- ZK proofs are simplified (use circom/snarkjs in production)
- No credential revocation registry (can be added)

### Future Enhancements
1. **Backend Integration**: Connect to Supabase or PostgreSQL
2. **Real Blockchain**: Deploy actual DID Registry contracts
3. **ZK Circuits**: Implement real ZK-SNARK circuits with circom
4. **IPFS Integration**: Store DID documents on IPFS
5. **Mobile Support**: React Native mobile app
6. **Key Rotation**: Automated key rotation mechanisms
7. **Social Recovery**: Account recovery using social connections
8. **Multi-Signature**: Support for multi-signature DIDs

## Contributing

Contributions are welcome! Please follow these guidelines:
1. Write clear commit messages
2. Add tests for new features
3. Update documentation
4. Follow the existing code style

## License

MIT License - see LICENSE file for details

## Resources

- [W3C DIDs Specification](https://www.w3.org/TR/did-core/)
- [W3C Verifiable Credentials](https://www.w3.org/TR/vc-data-model-2.0/)
- [EIP-1056: Ethereum Identifiers](https://eips.ethereum.org/EIPS/eip-1056)
- [ethers.js Documentation](https://docs.ethers.org/)
- [Zero-Knowledge Proofs](https://z.cash/technology/zksnarks/)

## Support

For issues, questions, or suggestions:
1. Open an issue on GitHub
2. Contact the development team
3. Check the documentation for answers

---

**Built with ❤️ for decentralized identity**
