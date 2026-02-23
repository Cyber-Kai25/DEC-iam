# Role-Based Decentralized Identity System - UI/UX Design Documentation

## Overview

This document provides comprehensive UI/UX design specifications for the multi-role decentralized identity system. The application uses a **unified, single-project architecture** with tailored interfaces for three distinct user roles: Identity Owner, Credential Issuer, and Credential Verifier.

---

## Design Philosophy

### Core Principles

1. **Role-Centric Navigation**: Each role has a dedicated navigation flow and dashboard
2. **Seamless Switching**: Users can instantly switch between roles without re-authentication
3. **Context Awareness**: UI elements and actions adapt based on active role
4. **Security First**: Visual indicators for security status and action implications
5. **Accessibility**: WCAG 2.1 compliant, semantic HTML, proper ARIA labels
6. **Consistency**: Unified design system with role-specific color coding

---

## Color Palette

### Primary Colors
- **Blue** (#3B82F6): Identity Owner, primary actions
- **Green** (#10B981): Credential Issuer, success states
- **Purple** (#8B5CF6): Credential Verifier, verification states

### Neutral Colors
- **Background**: #F9FAFB (light) / #0F172A (dark)
- **Foreground**: #111827 (light) / #F9FAFB (dark)
- **Muted**: #6B7280 (light) / #9CA3AF (dark)

### Status Colors
- **Success**: #10B981
- **Warning**: #F59E0B
- **Error**: #EF4444
- **Info**: #3B82F6

---

## Application Shell Architecture

### Layout Structure

```
┌─────────────────────────────────────────────────┐
│  Header (Logo | Role Selector | Notifications)  │
├──────────────┬──────────────────────────────────┤
│              │                                  │
│  Sidebar     │      Main Content Area           │
│  (Dynamic    │      (Role-Specific Pages)       │
│   per role)  │                                  │
│              │                                  │
│              │                                  │
└──────────────┴──────────────────────────────────┘
```

### Header Components

**Left Section:**
- Menu toggle (mobile)
- Welcome message (desktop)
- Current user email

**Center Section:**
- App logo and branding

**Right Section:**
- Role switcher (dropdown with active role)
- Notifications bell
- User profile menu

### Sidebar Navigation

**Dynamic content based on active role:**

#### Identity Owner Navigation
```
Dashboard          → /owner/dashboard
├─ My Identity      → /owner/identity
├─ My Credentials   → /owner/credentials
├─ Verification Requests → /owner/verify-requests
├─ Access Policies  → /owner/policies
└─ Trusted Issuers  → /owner/trusted-issuers
```

#### Issuer Navigation
```
Dashboard          → /issuer/dashboard
├─ Organization     → /issuer/organization
├─ Credential Templates → /issuer/templates
├─ Issue Credentials → /issuer/issue
├─ Credential History → /issuer/history
├─ Revoke Credentials → /issuer/revoke
└─ Audit Logs       → /issuer/audit
```

#### Verifier Navigation
```
Dashboard          → /verifier/dashboard
├─ Organization     → /verifier/organization
├─ Verification Requests → /verifier/requests
├─ Verify Credentials → /verifier/verify
├─ Verification History → /verifier/history
├─ Verification Policies → /verifier/policies
└─ Analytics        → /verifier/analytics
```

---

## Page Layouts by Role

### Identity Owner Pages

#### 1. Owner Dashboard (`/owner/dashboard`)

**Purpose**: Overview of identities, credentials, and policies

**Layout:**
```
┌─ Header: "Identity Owner Dashboard" ─────────────────┐
│                                                       │
│ Quick Stats Grid (4 columns):                        │
│  ├─ My Identities    ├─ Credentials                 │
│  └─ Access Policies  └─ Status                       │
│                                                       │
│ Main Content (2-column grid):                        │
│ ├─ Recent Credentials (card list)                    │
│ └─ Quick Actions (button grid)                       │
│                                                       │
│ CTA Card: "Get Started" (if no identity)            │
└───────────────────────────────────────────────────────┘
```

**Components:**
- StatCard (4x): Displays metrics with icons
- CredentialCard: Shows recent credentials
- QuickActionButton: Navigation shortcuts
- CTACard: Promotional banner for first-time users

**Color Scheme:** Blue accent with muted backgrounds

#### 2. My Identity (`/owner/identity`)

**Purpose**: View and manage personal DID

**Sections:**
- DID display card (with copy button)
- DID Document JSON viewer (collapsible)
- Public key viewer (hex format)
- Export/backup options
- Revocation option

#### 3. My Credentials (`/owner/credentials`)

**Purpose**: View received credentials

**Layout:**
- Filter/search bar (by issuer, type, status)
- Credential list with:
  - Credential type
  - Issuer name
  - Issue/expiration dates
  - Status badge (valid/expired/revoked)
  - Share/present button

#### 4. Verification Requests (`/owner/verify-requests`)

**Purpose**: Respond to verification requests from verifiers

**Elements:**
- Request cards showing:
  - Verifier organization
  - Required credential types
  - Request status
  - Accept/decline buttons
  - Present credentials flow

#### 5. Access Policies (`/owner/policies`)

**Purpose**: Control access to identity and credentials

**Components:**
- PolicyEditor component for creating/editing
- Policy list with status indicators
- Rule builder interface:
  - Subject selector (DID/organization)
  - Action selector (read, share, verify)
  - Resource selector (credential/data/service)
  - Condition builder (time-based, credential requirements)
  - Expiration setting

#### 6. Trusted Issuers (`/owner/trusted-issuers`)

**Purpose**: Manage list of trusted organizations

**Features:**
- Add issuer by DID or address
- List with verification status
- Trust level indicator
- Remove from trusted list

---

### Issuer Pages

#### 1. Issuer Dashboard (`/issuer/dashboard`)

**Purpose**: Organization credentials overview

**Stats:**
- Total issued
- Active credentials
- Expired credentials
- Issued this month

**Quick Actions:**
- Issue new credential button
- View templates button

**Recent Activity:**
- Timeline of recent issuances

#### 2. Organization Identity (`/issuer/organization`)

**Purpose**: Manage organization DID

**Sections:**
- Organization DID display
- Organization metadata (name, description)
- Issuer settings:
  - Credential retention policies
  - Revocation settings
  - Audit logging settings
- Verification status badge

#### 3. Credential Templates (`/issuer/templates`)

**Purpose:** Create and manage credential templates

**List View:**
- Template name and description
- Credential type
- Usage count
- Last updated date
- Edit/delete buttons

**Create/Edit Form:**
- Template name and description
- Credential type (e.g., education, employment, identity)
- Schema editor (JSON)
- Default expiration period
- Required fields
- Optional fields

#### 4. Issue Credentials (`/issuer/issue`)

**Purpose:** Issue credentials to recipients

**Form Layout:**
1. Template selection (dropdown)
2. Recipient DID (paste or search)
3. Credential data form (dynamic based on template)
4. Issue date (auto-filled)
5. Expiration date (with presets: 1yr, 2yr, custom)
6. Preview (JSON)
7. Issue button

**Confirmation:**
- Success toast notification
- Credential ID display
- Block explorer link (transaction hash)

#### 5. Credential History (`/issuer/history`)

**Purpose:** View all issued credentials

**Features:**
- Table view with columns:
  - Credential ID
  - Type
  - Recipient (partial/masked)
  - Issue date
  - Expiration date
  - Status (active/revoked/expired)
- Filters: type, status, date range
- Export to CSV button

#### 6. Revoke Credentials (`/issuer/revoke`)

**Purpose:** Revoke issued credentials

**Options:**
- Revoke individual credential
- Bulk revocation by filter
- Revocation reason dropdown
- Confirmation dialog
- Revocation log

#### 7. Audit Logs (`/issuer/audit`)

**Purpose:** Compliance and audit trail

**Features:**
- Chronological log entries
- Log types: issuance, revocation, template changes
- User/system actor
- Timestamp
- Details (collapsible)
- Export for compliance

---

### Verifier Pages

#### 1. Verifier Dashboard (`/verifier/dashboard`)

**Purpose:** Verification metrics overview

**Stats:**
- Total verifications
- Success rate (%)
- Verifications this month
- Active policies

**Charts:**
- Verification trends (last 7 days)
- Credential type distribution

#### 2. Organization Identity (`/verifier/organization`)

**Purpose:** Manage verifier organization

**Sections:**
- Organization DID
- Organization metadata
- Verification settings:
  - Acceptable issuers list
  - Credential type requirements
  - Expiration constraints
- Trust status badge

#### 3. Verification Requests (`/verifier/requests`)

**Purpose:** Create and manage verification requests

**Create Request Form:**
1. Request name
2. Credential types (multi-select)
3. Issuer constraints (optional)
4. Data fields to verify (optional)
5. Expiration (how long request valid)
6. Preview
7. Send/create button

**Request List:**
- Status (pending, responded, accepted, rejected)
- Recipient count
- Created date
- Responses received
- View/resend options

#### 4. Verify Credentials (`/verifier/verify`)

**Purpose:** Verify credentials presented by owners

**Workflow:**
1. Presentation received display
2. Credential details (read-only)
3. Verification checks:
   - Signature valid ✓
   - Not revoked ✓
   - Issuer trusted ✓
   - Not expired ✓
4. Additional ZK proof verification (optional)
5. Accept/reject buttons
6. Verification notes/comments textarea

#### 5. Verification History (`/verifier/history`)

**Purpose:** Audit trail of verifications

**Table:**
- Credential ID
- Credential type
- Owner (anonymized/hashed)
- Verifier actor
- Timestamp
- Result (passed/failed)
- Notes

**Features:**
- Search and filters
- Export for compliance

#### 6. Verification Policies (`/verifier/policies`)

**Purpose:** Define verification standards

**Policy Settings:**
- Policy name
- Acceptable issuers (whitelist)
- Required credential types
- Expiration age limit
- Custom validation rules
- Active/inactive toggle

#### 7. Analytics (`/verifier/analytics`)

**Purpose:** Insights and trends

**Dashboards:**
- Total verifications over time
- Success rate trends
- Top credential types
- Issuer distribution
- Verification latency metrics

---

## Role Switcher Component

### Visual Design

```
┌─ Identity Owner ─────────────────────┐
│  👤 Identity Owner (Active)           │
│  ─────────────────────────────────    │
│  🏢 Credential Issuer                │
│     Issue verifiable credentials      │
│  ─────────────────────────────────    │
│  ✓ Credential Verifier               │
│     Verify credentials from owners    │
└──────────────────────────────────────┘
```

**Interaction:**
- Click to open dropdown
- Select role to switch
- Sidebar updates instantly
- Page redirects to role's dashboard
- State saved to localStorage

---

## Navigation Components

### Sidebar Navigation Item

**Active State:**
- Background color matches role (blue/green/purple)
- Left border accent
- Icon highlighted
- Text bold

**Hover State:**
- Subtle background highlight
- Slight elevation/shadow

**Structure:**
```
[Icon] Label
        Description (on hover/mobile show)
```

---

## Card Components

### StatCard
- Icon (role-colored)
- Title
- Value (large font)
- Subtitle (description)
- Optional trend indicator (↑↓)

### CredentialCard
- Credential type badge
- Issuer info
- Dates (issued/expires)
- Status badge
- Action buttons
- Expandable details

### PolicyCard
- Policy ID/name
- Resource type
- Rules count
- Status toggle
- Edit/delete buttons

---

## Forms and Input Patterns

### Credential Data Form
- Dynamic fields based on template
- Required fields marked with *
- Type-aware inputs (text, date, select, checkbox)
- Validation on blur
- Clear error messages

### Policy Builder
- Multi-step or inline form
- Condition builder (visual rule builder)
- Add/remove rule buttons
- Preview of policy effect
- Save/cancel buttons

---

## Responsive Design

### Breakpoints
- **Mobile (< 640px)**: Single column, collapsed sidebar
- **Tablet (640px - 1024px)**: 2 columns, sidebar collapsible
- **Desktop (> 1024px)**: Full layout, persistent sidebar

### Mobile Adjustments
- Hamburger menu for sidebar
- Stack cards vertically
- Simplified tables (show key columns)
- Bottom action sheets for complex interactions
- Swipe gestures for navigation

---

## Accessibility Features

### WCAG 2.1 AA Compliance

1. **Color Contrast**
   - All text meets 4.5:1 contrast ratio
   - Status indicators have text labels, not just color

2. **Keyboard Navigation**
   - All interactive elements focusable (Tab order)
   - Escape key closes modals
   - Enter key submits forms

3. **Screen Reader Support**
   - Semantic HTML (header, nav, main, section)
   - ARIA labels for icons
   - Form labels properly associated
   - Skip navigation link

4. **Mobile Accessibility**
   - Touch targets minimum 44x44 pixels
   - No reliance on hover for essential info
   - Readable font sizes (minimum 16px)

---

## States and Feedback

### Loading States
- Skeleton screens for data loading
- Spinner overlay for actions
- Disabled buttons during submission

### Empty States
- Descriptive message ("No credentials yet")
- Helpful next steps ("Create your first credential")
- Icon illustration
- Optional CTA button

### Error States
- Error card with icon
- Clear error message
- Suggested actions
- Retry button if applicable

### Success States
- Toast notification
- Green checkmark
- Transient (auto-dismiss after 3 seconds)
- Can be dismissed manually

---

## Animation and Transitions

### Principles
- Purposeful: Animations support user goals
- Subtle: 200-300ms duration for most transitions
- Consistent: Same animations across similar interactions

### Examples
- Sidebar collapse: 300ms slide transition
- Tab switch: 150ms fade transition
- Modal appear: 200ms scale + fade
- Toast dismiss: 200ms slide out

---

## Security Indicators

### Visual Cues
- Green checkmark: Verified/Valid
- Yellow warning: Needs attention
- Red X: Invalid/Revoked
- Gray lock: Private/Encrypted

### Trust Badges
- Issuer verification status (blue badge)
- Credential validity (green check)
- Policy active status (toggle indicator)

---

## Data Visualization

### Charts Used
- Line charts: Trends over time (Recharts)
- Bar charts: Comparisons
- Pie charts: Distributions
- Tables: Detailed lists with sorting/filtering

---

## Component Library

### Custom Components Created
- `RoleSwitcher`: Role selection dropdown
- `RoleNavigation`: Dynamic sidebar navigation
- `AppShell`: Main application wrapper
- `IdentityCard`: Display identity info
- `CredentialCard`: Display credential
- `PolicyEditor`: Create/edit policies

### UI Components Used (shadcn/ui)
- Button, Card, Badge
- Tabs, Dialog, DropdownMenu
- Input, Select, Textarea
- Table, ScrollArea
- Collapsible, Tooltip

---

## User Flows

### First Time User (Getting Started)

```
Landing Page
    ↓
Role Selection Page
    ↓ (select role(s))
Role Switcher
    ↓
Role Dashboard
    ↓
Create Identity (owner)
    ↓
Identity Created
```

### Credential Issuance (Issuer Workflow)

```
Issuer Dashboard
    ↓
Issue Credentials
    ↓ (select template, recipient, data)
Preview
    ↓
Confirm Issue
    ↓
Blockchain Transaction (mock)
    ↓
Success Confirmation
    ↓
Credential History updated
```

### Credential Verification (Verifier Workflow)

```
Verifier Dashboard
    ↓
Create Verification Request
    ↓ (define requirements)
Send Request
    ↓
Owner receives request
    ↓
Owner presents credential
    ↓
Verifier receives presentation
    ↓
Verify Credentials page
    ↓
Check signature, issuer, expiration
    ↓
Accept/Reject
    ↓
Verification logged
```

---

## Conclusion

This unified, role-based design system provides a seamless experience for all three user types within a single application. The consistent design language, combined with role-specific navigation and functionality, ensures that each user type can accomplish their goals efficiently while maintaining security and privacy throughout the platform.
