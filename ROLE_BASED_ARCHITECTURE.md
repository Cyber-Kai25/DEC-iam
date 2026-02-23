# Role-Based Decentralized Identity System - Architecture Guide

## Overview

This is a **unified, single-project application** that supports three distinct user roles with tailored interfaces and functionality. Users can operate in multiple roles simultaneously or switch between roles as needed.

## Architectural Decision: Unified vs. Separate Projects

### Why Unified Single Project?

✅ **Chosen Approach: Single Project with Role-Based UI/UX**

**Advantages:**
- **Seamless interoperability**: Roles need to interact (issuers create credentials for owners, verifiers validate credentials from owners)
- **Shared infrastructure**: Single blockchain connection, one DID registry, unified credential storage
- **User flexibility**: Users can hold multiple roles and switch contexts without re-authentication
- **Simplified deployment**: One codebase, one database, one deployment
- **Better UX**: No context switching between different apps or projects
- **Credential ecosystem**: All participants on same platform for credential exchange

**vs. Separate Projects:**
- Would require multiple deployments, separate blockchains connections, complex API coordination
- Users couldn't easily issue/verify credentials across project boundaries
- Significantly increased complexity and operational overhead

## Three Core Roles

### 1. **Identity Owner**
**Purpose**: Users who own and manage their digital identity

**Responsibilities:**
- Create and manage their own DID
- Receive credentials from issuers
- Present credentials for verification
- Manage access control policies
- Participate in data exchange
- Revoke/update their identity

**Key Permissions:**
- Read/write own DIDs
- Receive credentials
- Present credentials for verification
- Define access policies
- Export identity backup

**Typical User Journey:**
- Creates personal DID
- Receives education/work credentials
- Presents credentials when needed
- Manages who can access what

---

### 2. **Identity Issuer**
**Purpose**: Organizations/institutions that issue credentials to others

**Responsibilities:**
- Issue verifiable credentials to identity owners
- Manage credential templates
- Track issued credentials
- Revoke credentials when necessary
- Maintain issuer reputation
- Audit credential issuance

**Key Permissions:**
- Create credential templates
- Issue credentials to any DID
- Revoke issued credentials
- View issuance history/audit logs
- Manage issuer settings

**Typical User Journey:**
- Sets up issuer organization identity
- Creates credential templates (degree, certification, employment)
- Issues credentials to recipients
- Manages issued credentials
- Views audit logs

---

### 3. **Identity Verifier**
**Purpose**: Services/organizations that verify credentials from owners

**Responsibilities:**
- Verify credentials presented by owners
- Request credentials via credential requests
- Audit verification history
- Define verification policies
- Maintain verification standards

**Key Permissions:**
- Create credential requests
- Verify presented credentials
- View verification history
- Create verification policies
- Access verifier analytics

**Typical User Journey:**
- Sets up verifier organization identity
- Creates credential request templates
- Receives credential presentations from owners
- Verifies credentials via proofs
- Logs verification for compliance

---

## Application Architecture

### User Authentication & Role Assignment

```
Login Flow:
  1. User authenticates (email/web3/DID)
  2. System loads user profile with assigned roles
  3. User selects active role (or defaults to primary)
  4. UI/navigation updates based on active role
  5. Backend enforces role-based permissions on all operations
```

### Navigation & Layout Structure

```
App Shell (Header + Sidebar Navigation)
├── Header
│   ├── App Logo/Branding
│   ├── Role Selector (dropdown to switch roles)
│   ├── Search (global)
│   ├── Notifications
│   └── User Menu (profile, settings, logout)
│
├── Sidebar (Dynamic based on role)
│   │
│   ├── IDENTITY OWNER MODE
│   │   ├── Dashboard
│   │   ├── My Identity
│   │   ├── My Credentials
│   │   ├── Verification Requests
│   │   ├── Access Policies
│   │   ├── Trusted Issuers
│   │   └── Settings
│   │
│   ├── ISSUER MODE
│   │   ├── Dashboard
│   │   ├── Organization Identity
│   │   ├── Credential Templates
│   │   ├── Issue Credentials
│   │   ├── Credential History
│   │   ├── Revoke Credentials
│   │   ├── Audit Logs
│   │   └── Settings
│   │
│   └── VERIFIER MODE
│       ├── Dashboard
│       ├── Organization Identity
│       ├── Verification Requests
│       ├── Verify Credentials
│       ├── Verification History
│       ├── Verification Policies
│       ├── Analytics
│       └── Settings
│
└── Main Content Area (Role-specific pages)
```

---

## Core Pages by Role

### Identity Owner Pages

**1. Owner Dashboard** (`/owner/dashboard`)
- Overview of owned identities
- Recent credentials received
- Pending verification requests
- Quick actions

**2. My Identity** (`/owner/identity`)
- View/manage own DID
- View DID document
- Manage keys and verification methods
- Export/backup identity
- Identity revocation option

**3. My Credentials** (`/owner/credentials`)
- All received credentials
- Credential details (issuer, type, expiration)
- Share/present credential options
- Credential verification status
- Credential timeline

**4. Verification Requests** (`/owner/verify-requests`)
- Incoming verification requests from verifiers
- Request details (what's being asked)
- Accept/decline requests
- Present matching credentials
- Request history

**5. Access Policies** (`/owner/policies`)
- Create policies controlling who accesses what
- Define rules for credential sharing
- Time-based access control
- Revoke access to previously granted permissions
- Audit access logs

**6. Trusted Issuers** (`/owner/trusted-issuers`)
- List of trusted credential issuers
- Add/remove trusted issuers
- Issuer verification status
- Issuer reputation metrics

---

### Issuer Pages

**1. Issuer Dashboard** (`/issuer/dashboard`)
- Organization overview
- Credentials issued (this period)
- Pending issuances
- Key metrics (total issued, active, revoked)

**2. Organization Identity** (`/issuer/identity`)
- Issuer organization DID
- Organization details
- Credential issuance settings
- Issuer verification status
- Organization reputation

**3. Credential Templates** (`/issuer/templates`)
- Create new templates (degree, certification, employment, etc.)
- Edit existing templates
- Define credential schema
- Manage template versions
- Template usage analytics

**4. Issue Credentials** (`/issuer/issue`)
- Issue new credentials
- Select template
- Enter recipient DID/email
- Set credential properties (issue date, expiration)
- Add credential-specific data
- Preview before issue
- Bulk issuance support

**5. Credential History** (`/issuer/history`)
- All issued credentials
- Search/filter by recipient, type, date
- View credential details
- Revoke credentials
- Export credential list

**6. Revoke Credentials** (`/issuer/revoke`)
- Revoke issued credentials
- Bulk revocation
- Revocation reasons
- Revocation history
- Recipient notification

**7. Audit Logs** (`/issuer/audit`)
- Complete audit trail
- Who issued what, when
- Failed issuances
- Revocations
- System events
- Compliance export

---

### Verifier Pages

**1. Verifier Dashboard** (`/verifier/dashboard`)
- Verification overview
- Verifications completed (this period)
- Pending requests
- Verification success rate

**2. Organization Identity** (`/verifier/identity`)
- Verifier organization DID
- Organization details
- Verification settings
- Verifier trust status

**3. Verification Requests** (`/verifier/requests`)
- Create credential requests
- Request templates (education, employment, etc.)
- Select credential types needed
- Set requirements (issuer whitelist, expiration limits)
- Send request to identity owner

**4. Verify Credentials** (`/verifier/verify`)
- Receive credential presentations
- Verify signature/proof
- Check issuer reputation
- Verify credential status (not revoked)
- View credential details
- Accept/reject verification
- Add verification notes

**5. Verification History** (`/verifier/history`)
- All verifications performed
- Verification details
- Verification status (passed/failed)
- Verified identity owner info (hashed/anonymized)
- Export for compliance

**6. Verification Policies** (`/verifier/policies`)
- Define verification requirements
- Acceptable issuers list
- Credential type requirements
- Expiration constraints
- Custom verification rules

**7. Analytics** (`/verifier/analytics`)
- Verification metrics
- Success rates
- Common credential types
- Issuer distribution
- Trend analysis

---

## Shared Resources

### Common Pages

**1. Settings** (`/settings`)
- Role-agnostic settings
- Profile management
- Password/security
- Notification preferences
- Privacy settings
- Data export

**2. Wallet/Keys** (`/wallet`)
- Manage blockchain wallet
- View private/public keys
- Key rotation
- Backup/restore keys
- Export encrypted keys

---

## UI Components by Context

### Role-Specific Components

**1. Identity Card Component** (Used in: Owner, Issuer, Verifier contexts)
- Shows DID, name, address
- Context-aware actions (issue, verify, receive)
- Trust indicators

**2. Credential Card Component** (Used in: Owner, Issuer, Verifier contexts)
- Displays credential info
- Role-specific actions
- Verification status
- Expiration indicators

**3. Policy Editor Component** (Owner & Verifier)
- Create/edit access policies
- Rule builder interface
- Condition selectors

**4. Request Builder Component** (Issuer & Verifier)
- Create credential/verification requests
- Schema selector
- Recipients/requirement editor

**5. Audit Log Component** (Issuer & Verifier)
- Searchable/filterable logs
- Export capability
- Timestamp details

---

## Data Flow Examples

### Credential Issuance Flow

```
Issuer Workflow:
1. Issuer logs in → Issuer Dashboard
2. Creates/selects credential template
3. Enters recipient DID (owner identity)
4. Issues credential (signed with issuer's private key)
5. Credential sent to owner's inbox
6. Blockchain transaction records issuance

Owner Workflow:
1. Receives credential notification
2. Reviews credential in "My Credentials"
3. Can accept/store or reject
4. Can share/present to verifiers

Verifier Workflow:
1. Verifier sends verification request
2. Owner receives request notification
3. Owner selects matching credential to present
4. Verifier receives credential presentation
5. Verifier validates signature and issuer status
6. Verification logged
```

### Access Control Flow

```
Role-based Access:
- Owner A issues policy: "allow Verifier B to view my education credentials"
- Verifier B creates request for education credentials
- Owner A receives request, reviews, accepts
- Verifier B receives credential presentation
- Access logged in Owner A's audit trail
```

---

## Security & Privacy Considerations

### Role-Based Access Control (RBAC)

```
Backend Enforcement:
- Every API endpoint checks user's role(s)
- Operations validated against user's DID and role
- Credentials only visible to:
  - Owning user
  - Issuing organization (with retention limits)
  - Authorized verifiers (with explicit permission)
```

### Privacy Protection

- **Owners**: Full privacy for received credentials
- **Issuers**: Can view issued credentials but respects owner revocation
- **Verifiers**: Only see credentials presented to them; no cross-verifier data

### Audit Trails

- All role-specific operations logged
- Immutable records on blockchain
- User can review their audit logs
- Compliance-ready exports

---

## State Management

### Context Provider Enhancements

```typescript
interface AuthContext {
  user: User | null;
  roles: Role[];  // User's assigned roles
  activeRole: Role;
  switchRole: (role: Role) => void;
  permissions: Permission[];
}

interface RoleContext {
  activeRole: Role;
  activeOrganization?: Organization;  // For issuer/verifier
  switchToRole: (role: Role) => void;
}
```

### Local Storage / Session Management

- User preferences per role
- Last active role
- Saved searches/filters per role
- Session state

---

## Deployment & Scalability

### Single Project Benefits

1. **Unified Database Schema**
   - One set of tables
   - Role-based row-level security (RLS) in Supabase
   - Shared blockchain contracts

2. **Shared Infrastructure**
   - One Next.js app
   - One blockchain connection
   - One API gateway
   - Automatic scaling for all roles

3. **Cross-Role Features**
   - Search across issuers/verifiers/owners
   - Reputation systems
   - Network effects
   - Ecosystem growth

---

## Implementation Roadmap

### Phase 1: Core Infrastructure (Current)
- ✅ Identity creation and management
- ✅ DID operations
- ✅ Credential management (basic)
- ✅ Access control policies

### Phase 2: Multi-Role UI (This Phase)
- Role selector and switcher
- Dashboard per role
- Navigation by role
- Basic role-specific pages

### Phase 3: Issuer Functionality
- Credential template management
- Bulk issuance
- Issuer audit logs
- Credential revocation

### Phase 4: Verifier Functionality
- Verification request creation
- Credential verification workflows
- Verification policies
- Analytics dashboard

### Phase 5: Advanced Features
- Reputation systems
- Zero-knowledge proof verification
- Compliance reporting
- Mobile app support

---

## Conclusion

This unified, single-project approach enables a complete decentralized identity ecosystem where users can operate across roles while maintaining security, privacy, and auditability. The role-based UI ensures each user type has exactly the functionality they need, with seamless interactions between roles.
