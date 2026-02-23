# Quick Start Guide - Decentralized Identity System

Get up and running in 5 minutes!

## Prerequisites

- Node.js 18+ 
- npm or yarn
- Modern web browser

## Installation

```bash
# Clone the repository
git clone <repo-url>
cd did-system

# Install dependencies
npm install

# Start development server
npm run dev

# Open browser
open http://localhost:3000
```

## Your First DID (2 minutes)

1. **Visit the Dashboard**
   - Go to http://localhost:3000
   - See the welcome screen

2. **Create Your Identity**
   - Click "Create Identity" button
   - (Optional) Enter a name like "Alice's Identity"
   - Click "Create Identity"
   - Your DID is created instantly!

3. **Explore Your Identity**
   - View your DID, public key, wallet address
   - Export your identity (backup)
   - View your W3C DID Document

## Issue Your First Credential (2 minutes)

1. **Go to Credentials Tab**
   - Click "Credentials" tab in dashboard
   - Click "Create Credential" button (if available in your version)

2. **Using Code**
   ```typescript
   // In any React component
   import { useIdentity } from "@/lib/context/identity-context";

   export function MyComponent() {
     const { createCredential } = useIdentity();

     const issueCredential = async () => {
       const credential = await createCredential(
         "did:ethr:11155111:0x...", // recipient DID
         "KYCCredential",
         {
           name: "John Doe",
           verified: true,
           dateIssued: new Date().toISOString()
         },
         365 // expires in 1 year
       );

       console.log("Credential created:", credential);
     };

     return <button onClick={issueCredential}>Issue Credential</button>;
   }
   ```

## Create Your First Policy (2 minutes)

1. **Go to Policies Tab**
   - Click "Policies" tab
   - Click "New Policy" button

2. **Add Access Rules**
   - Subject: `did:ethr:11155111:0x...` (another DID)
   - Action: `read`
   - Effect: `allow`
   - Click "Add Rule"

3. **Save**
   - Click "Save Policy"
   - Your policy is now active!

## Code Examples

### 1. Create Identity Programmatically

```typescript
import DIDService from "@/lib/services/did-service";

// Create a new identity
const identity = DIDService.createIdentity("My Identity");

console.log("DID:", identity.did);
console.log("Address:", identity.walletAddress);
console.log("Public Key:", identity.publicKeyHex);
```

### 2. Sign a Message

```typescript
import KeyManagement from "@/lib/crypto/key-management";

const message = "Hello, Decentralized World!";
const signature = KeyManagement.signMessage(privateKey, message);

// Verify signature
const isValid = KeyManagement.verifySignature(
  message,
  signature,
  address
);

console.log("Signature valid:", isValid);
```

### 3. Create and Verify a Credential

```typescript
import VerificationService from "@/lib/services/verification-service";

// Create credential
const credential = VerificationService.createVerifiableCredential(
  issuerDID,
  subjectDID,
  "UniversityDegree",
  {
    name: "Alice Johnson",
    degree: "Bachelor of Science",
    field: "Computer Science",
    graduationDate: "2024-05-15"
  },
  issuerPrivateKey,
  365
);

// Verify credential
const result = VerificationService.verifyCredential(credential, issuerAddress);

if (result.valid) {
  console.log("Credential is valid!");
  console.log("Issuer:", result.issuer);
} else {
  console.log("Verification failed:", result.error);
}
```

### 4. Create Access Control Policy

```typescript
import AccessControlService from "@/lib/services/access-control-service";

// Create a policy
let policy = AccessControlService.createPolicy(
  "my-data-resource",
  "data"
);

// Grant read access to specific user
policy = AccessControlService.addRule(
  policy,
  "did:ethr:11155111:0xAlice...",
  "read",
  policy.resourceId,
  "allow"
);

// Deny write access to everyone except owner
policy = AccessControlService.addRule(
  policy,
  "*",
  "write",
  policy.resourceId,
  "deny"
);

// Evaluate access
const access = AccessControlService.evaluateAccess(
  policy,
  "did:ethr:11155111:0xAlice...",
  "read"
);

console.log("Access allowed:", access.allowed);
```

### 5. Send Encrypted Message

```typescript
import { useIdentity } from "@/lib/context/identity-context";

export function MessageComponent() {
  const { sendMessage, receiveMessage } = useIdentity();

  const handleSendSecureMessage = async () => {
    // Send encrypted message
    const message = await sendMessage(
      "did:ethr:11155111:0xBob...",
      "This is a secret message!"
    );

    console.log("Message sent:", message?.id);
  };

  return <button onClick={handleSendSecureMessage}>Send Secure Message</button>;
}
```

### 6. Zero-Knowledge Proof

```typescript
import VerificationService from "@/lib/services/verification-service";

// Request a ZK proof (age verification)
const request = VerificationService.createZKProofRequest(
  "age-over-21",
  { minAge: 21 },
  10 // valid for 10 minutes
);

// Create proof (without revealing actual age)
const proof = VerificationService.createZKProof(
  request,
  { userAge: 25 } // private
);

// Verify proof
const isValid = VerificationService.verifyZKProof(proof);

if (isValid) {
  console.log("✓ User is over 21 (verified without revealing age)");
}
```

## Common Tasks

### Export Your Identity (Backup)

```typescript
const { currentIdentity, exportIdentity } = useIdentity();

const handleExport = () => {
  const exported = exportIdentity(currentIdentity);
  
  // Save to file
  const element = document.createElement("a");
  element.setAttribute(
    "href",
    "data:text/plain;charset=utf-8," + encodeURIComponent(exported)
  );
  element.setAttribute("download", "my-identity.json");
  element.click();
};
```

### Import Identity (Restore)

```typescript
const { importIdentity } = useIdentity();

const handleImport = async (file: File) => {
  const content = await file.text();
  const identity = await importIdentity(content);
  
  if (identity) {
    console.log("Identity imported:", identity.did);
  }
};
```

### Check If Credential Is Expired

```typescript
import { getDaysUntilExpiry, isExpired } from "@/lib/utils/formatting";

const daysLeft = getDaysUntilExpiry(credential.expirationDate);
const expired = isExpired(credential.expirationDate);

if (expired) {
  console.log("Credential has expired");
} else {
  console.log(`Credential expires in ${daysLeft} days`);
}
```

### List All Credentials

```typescript
const { credentials } = useIdentity();

credentials.forEach(cred => {
  console.log(`Credential: ${cred.type}`);
  console.log(`Issuer: ${cred.issuer}`);
  console.log(`Expires: ${cred.expirationDate}`);
});
```

### Find Active Credentials Only

```typescript
const { credentials } = useIdentity();

const activeCredentials = credentials.filter(cred => {
  return !cred.expirationDate || 
         new Date(cred.expirationDate) > new Date();
});

console.log(`Active credentials: ${activeCredentials.length}`);
```

## File Structure Quick Reference

```
did-system/
├── app/
│   ├── page.tsx               ← Main dashboard
│   └── layout.tsx             ← Root layout
├── lib/
│   ├── types/did.ts           ← Data types
│   ├── crypto/
│   │   └── key-management.ts  ← Cryptography
│   ├── services/              ← Business logic
│   │   ├── did-service.ts
│   │   ├── verification-service.ts
│   │   ├── access-control-service.ts
│   │   ├── data-exchange-service.ts
│   │   └── blockchain-service.ts
│   ├── context/
│   │   └── identity-context.tsx ← State management
│   └── utils/
│       └── formatting.ts      ← Helpers
├── components/
│   ├── identity-card.tsx      ← UI Components
│   ├── credential-card.tsx
│   └── policy-editor.tsx
├── README.md                  ← Full documentation
├── IMPLEMENTATION_GUIDE.md    ← Detailed guide
└── QUICK_START.md             ← This file!
```

## Testing in Browser Console

```javascript
// Get current identity
const identity = JSON.parse(localStorage.getItem('identity-app-state')).currentIdentity;
console.log(identity);

// Get credentials
const creds = JSON.parse(localStorage.getItem('identity-app-state')).credentials;
console.log(creds);

// Get policies
const policies = JSON.parse(localStorage.getItem('identity-app-state')).policies;
console.log(policies);
```

## Troubleshooting

**Q: Page shows "No identity"?**
A: Create one by clicking "Create Identity" on the main page.

**Q: Credential verification fails?**
A: Check that the issuer address matches the credential issuer DID.

**Q: Can't decrypt message?**
A: Make sure you're using the receiver's private key, not public key.

**Q: Changes not saving?**
A: Check browser console for errors. Try refreshing the page.

**Q: Want to start fresh?**
A: Open browser DevTools → Application → LocalStorage → Clear all.

## Next Steps

1. **Read Full Documentation**: See [README.md](README.md)
2. **Learn Implementation Details**: See [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md)
3. **Explore Services**: Check out `/lib/services/`
4. **Build Custom Components**: Extend `/components/`
5. **Connect to Supabase**: Follow integration guide in IMPLEMENTATION_GUIDE.md
6. **Deploy to Blockchain**: Use BlockchainService with real RPC provider

## Key Concepts to Know

- **DID**: Decentralized Identifier - unique, self-controlled identity
- **Verifiable Credential**: W3C standard credential with cryptographic proof
- **Zero-Knowledge Proof**: Prove something without revealing sensitive data
- **Access Control**: Fine-grained policies for resource access
- **Blockchain**: Anchor identities on Ethereum Sepolia testnet

## Resources

- [W3C DIDs Specification](https://www.w3.org/TR/did-core/)
- [W3C Verifiable Credentials](https://www.w3.org/TR/vc-data-model-2.0/)
- [ethers.js Docs](https://docs.ethers.org/)
- [GitHub Issues](https://github.com/...issues)

## Support

- Check documentation files
- Review code examples in services
- Look at component implementations
- Search GitHub issues

---

**Happy decentralizing! 🚀**
