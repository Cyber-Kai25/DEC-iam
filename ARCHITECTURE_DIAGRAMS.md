# Multi-Role DID System - Architecture Diagrams

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    UNIFIED WEB APPLICATION                       │
│                      (Next.js + React)                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │   LANDING PAGE   │  │  ROLE SELECTION  │  │   ROLE MGMT   │  │
│  │   (Public)       │  │     (/roles)     │  │   SERVICE     │  │
│  └──────────────────┘  └──────────────────┘  └──────────────┘  │
│           │                     │                   ▲            │
│           └─────────────────────┴───────────────────┘            │
│                                 │                                │
│                         ┌───────▼────────┐                      │
│                         │  ROLE CONTEXT  │                      │
│                         │  (State Mgmt)  │                      │
│                         └───────┬────────┘                      │
│                                 │                                │
│        ┌────────────────────────┼────────────────────────┐     │
│        │                        │                        │      │
│        ▼                        ▼                        ▼      │
│  ┌─────────────┐         ┌─────────────┐        ┌──────────┐  │
│  │   OWNER     │         │   ISSUER    │        │ VERIFIER │  │
│  │  DASHBOARD  │         │  DASHBOARD  │        │ DASHBOARD│  │
│  └─────────────┘         └─────────────┘        └──────────┘  │
│        │                        │                        │      │
│   Identity               Credential              Verification │
│   Pages                  Pages                   Pages        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
         │                        │                        │
         │                        │                        │
         ▼                        ▼                        ▼
┌──────────────────────┬──────────────────────┬──────────────────┐
│  IDENTITY CONTEXT    │  CREDENTIAL SERVICE  │  VERIFICATION    │
│  - identities        │  - create credential │  - check issuer  │
│  - credentials       │  - verify signature  │  - validate proof│
│  - policies          │  - revoke credential │  - expiration    │
└──────────────────────┴──────────────────────┴──────────────────┘
         │                        │                        │
         ▼                        ▼                        ▼
┌──────────────────────┬──────────────────────┬──────────────────┐
│   DID SERVICE        │ ACCESS CONTROL       │  DATA EXCHANGE   │
│  - DID generation    │ SERVICE              │  SERVICE         │
│  - DID document      │  - create policies   │  - encrypt data  │
│  - key management    │  - evaluate rules    │  - audit logs    │
└──────────────────────┴──────────────────────┴──────────────────┘
         │                                            │
         ▼                                            ▼
     ┌─────────────────────────────────────────────────────┐
     │        BLOCKCHAIN SERVICE                           │
     │  - Register DID (Sepolia)                          │
     │  - Anchor credentials                              │
     │  - Verify signatures                               │
     └─────────────────────────────────────────────────────┘
             │
             ▼
     ┌─────────────────────────────────────────────────────┐
     │   ETHEREUM SEPOLIA TESTNET (Chain ID: 11155111)    │
     │  - DID Registry Contract (EIP-1056)                │
     │  - Transaction History                             │
     └─────────────────────────────────────────────────────┘
```

---

## User Role Data Flow

### Identity Owner Workflow

```
┌──────────────┐
│ Landing Page │
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│ Select "Owner"   │
│ Role Selection   │
└──────┬───────────┘
       │
       ▼
┌──────────────────────┐
│ Owner Dashboard      │
│ - View DIDs          │
│ - Recent credentials │
│ - Policy overview    │
└──────┬───────────────┘
       │
    ┌──┴──────────┬──────────────────┬──────────────┐
    │             │                  │              │
    ▼             ▼                  ▼              ▼
┌─────────┐ ┌──────────┐ ┌────────────────┐ ┌────────┐
│My DID   │ │Credentia │ │Verification    │ │Policies│
│         │ │ls        │ │Requests        │ │        │
└────┬────┘ └────┬─────┘ └────┬───────────┘ └────┬───┘
     │           │            │                  │
     │       Store locally     │                  │
     │       (encrypted)       │                  │
     │                         │ Accept/Present  │
     └─────────────────────────┴──────────────────┘
                         │
                         ▼
         ┌───────────────────────────────┐
         │ Credential presented to       │
         │ Verifier or Access granted    │
         └───────────────────────────────┘
```

### Credential Issuer Workflow

```
┌──────────────┐
│ Landing Page │
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│ Select "Issuer"  │
│ Role Selection   │
└──────┬───────────┘
       │
       ▼
┌──────────────────────┐
│ Issuer Dashboard     │
│ - Metrics            │
│ - Recent issuances   │
│ - Templates          │
└──────┬───────────────┘
       │
    ┌──┴──────────┬──────────────┬──────────────┐
    │             │              │              │
    ▼             ▼              ▼              ▼
┌──────────┐ ┌────────┐ ┌──────────┐ ┌───────┐
│Templates │ │Issue   │ │History &  │ │Audit  │
│          │ │New     │ │Revoke    │ │Logs   │
└────┬─────┘ └────┬───┘ └────┬────┘ └───┬───┘
     │            │          │          │
     │            ▼          │          │
     │     1. Select Template│          │
     │     2. Select Recipient
     │     3. Add Data           │          │
     │     4. Set Expiration     │          │
     │     5. Sign & Issue       │          │
     │                           │          │
     └───────────────────────────┴──────────┘
                     │
                     ▼
     ┌──────────────────────────────────┐
     │ Sign Credential with Private Key │
     │ (ECDSA secp256k1)                │
     └────────────┬─────────────────────┘
                  │
                  ▼
     ┌──────────────────────────────────┐
     │ Broadcast to Sepolia (optional)  │
     │ Create transaction (anchor)      │
     └────────────┬─────────────────────┘
                  │
                  ▼
     ┌──────────────────────────────────┐
     │ Store in History & Audit Logs    │
     │ (localStorage -> Supabase)       │
     └──────────────────────────────────┘
```

### Credential Verifier Workflow

```
┌──────────────┐
│ Landing Page │
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│ Select "Verifier"    │
│ Role Selection       │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Verifier Dashboard   │
│ - Metrics            │
│ - Verification trends│
│ - Policies           │
└──────┬───────────────┘
       │
    ┌──┴───────────┬──────────────┬────────────┐
    │              │              │            │
    ▼              ▼              ▼            ▼
┌───────────┐ ┌────────┐ ┌─────────┐ ┌───────┐
│Verification│ │Verify   │ │Policies │ │Analytics
│Requests   │ │Credentia│ │         │ │
└────┬──────┘ │ls      │ └─────┬───┘ └───┬───┘
     │        └────┬───┘       │         │
     │             │           │         │
     │ Send Request│ Receive   │         │
     │ to Owner    │ Credential│         │
     │             │ from Owner│         │
     │             ▼           │         │
     │     Check:              │         │
     │     ✓ Signature Valid   │         │
     │     ✓ Issuer Trusted    │         │
     │     ✓ Not Revoked       │         │
     │     ✓ Not Expired       │         │
     │     ✓ ZK Proof (opt)    │         │
     │             │           │         │
     │             ▼           │         │
     │     Accept/Reject       │         │
     │     Verification        │         │
     │                         │         │
     └─────────────────────────┴─────────┘
                     │
                     ▼
     ┌────────────────────────────────┐
     │ Log Verification in History    │
     │ (View later for compliance)    │
     └────────────────────────────────┘
```

---

## UI Component Hierarchy

```
AppShell
├── Header
│   ├── Logo
│   ├── RoleSwitcher (Dropdown)
│   │   └── Role selection options
│   ├── Notifications Bell
│   └── User Menu (Profile, Settings, Logout)
│
├── Sidebar (Dynamic based on role)
│   ├── RoleNavigation
│   │   ├── Owner Links
│   │   │   ├── Dashboard
│   │   │   ├── My Identity
│   │   │   ├── My Credentials
│   │   │   ├── Verification Requests
│   │   │   ├── Access Policies
│   │   │   └── Trusted Issuers
│   │   │
│   │   ├── Issuer Links
│   │   │   ├── Dashboard
│   │   │   ├── Organization
│   │   │   ├── Credential Templates
│   │   │   ├── Issue Credentials
│   │   │   ├── Credential History
│   │   │   ├── Revoke Credentials
│   │   │   └── Audit Logs
│   │   │
│   │   └── Verifier Links
│   │       ├── Dashboard
│   │       ├── Organization
│   │       ├── Verification Requests
│   │       ├── Verify Credentials
│   │       ├── Verification History
│   │       ├── Policies
│   │       └── Analytics
│   │
│   └── User Section
│       ├── Current Role Badge
│       └── Logout Button
│
└── Main Content
    └── Page Content (Role-Specific)
        ├── Header with Title
        ├── Stats Cards
        └── Content Cards
            ├── IdentityCard
            ├── CredentialCard
            ├── PolicyEditor
            └── Custom Components
```

---

## Data Flow: Credential Issuance

```
Issuer Creates Credential
        │
        ▼
┌────────────────────────────────────┐
│ IssuerService.createCredential()   │
│ - Generate credential ID           │
│ - Add issuer DID                   │
│ - Add recipient DID                │
│ - Set dates                        │
└────────────────────────────────────┘
        │
        ▼
┌────────────────────────────────────┐
│ Sign with issuer's private key     │
│ - ECDSA secp256k1 signature        │
│ - Add proof to credential          │
└────────────────────────────────────┘
        │
        ▼
┌────────────────────────────────────┐
│ Store in state                     │
│ - Add to credentials array         │
│ - Save to localStorage             │
└────────────────────────────────────┘
        │
        ▼
┌────────────────────────────────────┐
│ (Optional) Anchor on blockchain    │
│ - Create transaction               │
│ - Send to Sepolia                  │
│ - Store transaction hash           │
└────────────────────────────────────┘
        │
        ▼
┌────────────────────────────────────┐
│ Credential Available               │
│ - In Owner's inbox                 │
│ - Ready to present to verifiers    │
└────────────────────────────────────┘
```

---

## Data Flow: Credential Verification

```
Verifier Receives Credential Presentation
        │
        ▼
┌────────────────────────────────────┐
│ Verification Steps                 │
│ 1. Extract credential data         │
│ 2. Validate proof signature        │
└────────────────────────────────────┘
        │
        ├─────────────────┬──────────────┬─────────────┐
        ▼                 ▼              ▼             ▼
   Check Issuer    Check Revocation  Check Expiration Check ZKP
   - Is issuer     - Status on chain - Current date  - Verify proof
     trusted?      - In revocation    vs expiration  - No reveal
   - Verify DID      registry         date           - Privacy
   - Issuer rep
        │                 │              │             │
        └─────────────────┴──────────────┴─────────────┘
                          │
                          ▼
                ┌──────────────────────┐
                │ Verification Result  │
                │ Valid or Invalid     │
                └──────────────────────┘
                          │
                          ▼
                ┌──────────────────────┐
                │ Log Verification     │
                │ - Timestamp          │
                │ - Verifier           │
                │ - Credential         │
                │ - Result             │
                └──────────────────────┘
                          │
                          ▼
                ┌──────────────────────┐
                │ Store in History     │
                │ localStorage/DB      │
                └──────────────────────┘
```

---

## Data Persistence Architecture

```
┌─────────────────────────────────────────────────────┐
│               FRONTEND (React)                       │
│  - RoleContext                                      │
│  - IdentityContext                                  │
│  - Component State                                  │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
        ┌─────────────────────┐
        │  localStorage       │
        │  (Session State)    │
        │  - User data        │
        │  - Identities       │
        │  - Credentials      │
        │  - Policies         │
        └─────────────────────┘
                   │
        (Future Integration)
                   │
                   ▼
        ┌──────────────────────┐
        │ Supabase PostgreSQL  │
        │  - users             │
        │  - identities        │
        │  - credentials       │
        │  - policies          │
        │  - audit_logs        │
        └──────────────────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │ Ethereum Sepolia     │
        │  - DID Registry      │
        │  - Credential        │
        │    Anchors           │
        │  - Transactions      │
        └──────────────────────┘
```

---

## Permission Model

```
User
├── roles: ["owner", "issuer", "verifier"]
└── activeRole: "owner"

Role → Permissions Mapping:

OWNER Role Permissions:
├── create:own-identity
├── read:own-identity
├── update:own-identity
├── delete:own-identity
├── receive:credential
├── present:credential
├── create:own-policy
└── manage:trusted-issuers

ISSUER Role Permissions:
├── create:organization-identity
├── issue:credential
├── revoke:issued-credential
├── create:credential-template
├── read:issuance-history
└── read:audit-logs

VERIFIER Role Permissions:
├── create:organization-identity
├── create:verification-request
├── verify:credential
├── read:verification-history
├── create:verification-policy
└── read:analytics
```

---

## State Management Architecture

```
┌─────────────────────────────────────────────────────┐
│           RoleProvider (Top Level)                  │
├─────────────────────────────────────────────────────┤
│ State:                                              │
│ - currentUser: User | null                          │
│ - activeRole: UserRole                              │
│ - organizations: Organization[]                     │
│ - activeOrganization: Organization | null           │
│                                                     │
│ Methods:                                            │
│ - switchRole(role)                                  │
│ - hasRole(role)                                     │
│ - hasPermission(action)                             │
│ - setCurrentUser(user)                              │
└──────────────────────┬──────────────────────────────┘
                       │
            ┌──────────┴──────────┐
            │                     │
            ▼                     ▼
┌──────────────────────┐ ┌──────────────────────┐
│ IdentityProvider     │ │ Component Level      │
├──────────────────────┤ │ (useState)           │
│ State:               │ │                      │
│ - currentIdentity    │ │ - showCreateIdentity │
│ - credentials        │ │ - identityName       │
│ - policies           │ │ - selectedPolicy     │
│ - messages           │ │ - zkProofVerified    │
│                      │ │ - etc.               │
│ Methods:             │ │                      │
│ - createIdentity()   │ │ (Local UI state)     │
│ - createCredential() │ │                      │
│ - createPolicy()     │ │                      │
│ - sendMessage()      │ │                      │
│ - etc.               │ │                      │
└──────────────────────┘ └──────────────────────┘
```

---

## Deployment Architecture

```
┌──────────────────────────────────────────┐
│          Developer Machine               │
│  - Code in TypeScript                    │
│  - Local testing with Next.js dev server │
└──────────────┬───────────────────────────┘
               │
               ▼
        ┌──────────────┐
        │ GitHub Repo  │
        │  (with .git) │
        └──────┬───────┘
               │
               ▼
        ┌──────────────┐
        │ Vercel CI/CD │
        │  - Auto build│
        │  - Tests     │
        │  - Deploy    │
        └──────┬───────┘
               │
               ▼
        ┌──────────────────────────┐
        │ Vercel Edge Network      │
        │  - Static assets (CDN)   │
        │  - API routes (serverless│
        │  - Environment variables │
        └──────┬───────────────────┘
               │
        ┌──────┴──────────┬────────────┐
        │                 │            │
        ▼                 ▼            ▼
    ┌────────────┐  ┌──────────┐  ┌──────────┐
    │ Browser   │  │ Supabase │  │ Ethereum │
    │ (Client)  │  │ Database │  │ Sepolia  │
    │           │  │ (Backend)│  │ (Chain)  │
    └────────────┘  └──────────┘  └──────────┘
```

---

## Summary

These diagrams illustrate:

1. **System Architecture**: How all components fit together
2. **User Workflows**: Complete journeys for each role
3. **Component Hierarchy**: UI structure and relationships
4. **Data Flows**: How data moves through the system
5. **State Management**: Global and local state organization
6. **Deployment**: How the application is built and deployed

The architecture is designed for scalability, maintainability, and seamless multi-role operation.
