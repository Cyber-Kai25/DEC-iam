# Complete Backend API Documentation

## Overview

The backend is built using Next.js API Routes with role-based access control, authentication via JWT tokens, and comprehensive endpoints for all DID operations. All endpoints return JSON responses with consistent structure.

## Authentication

### JWT Token Format
Tokens are URL-safe base64-encoded JSON with the following structure:
```json
{
  "userId": "user_123",
  "email": "user@example.com",
  "roles": ["owner", "issuer"],
  "activeRole": "owner",
  "exp": 1234567890
}
```

### Token Usage
Include in all authenticated requests:
```
Authorization: Bearer <token>
```

---

## Response Format

All endpoints follow a consistent response format:

**Success (2xx):**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error (4xx/5xx):**
```json
{
  "success": false,
  "error": "Error description"
}
```

---

## Authentication Endpoints

### POST /api/auth/register
Register a new user with specified roles

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "roles": ["owner", "issuer"]
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "userId": "user_123",
    "email": "user@example.com",
    "roles": ["owner", "issuer"],
    "activeRole": "owner",
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**Errors:**
- 400: Validation error (invalid email, weak password)
- 409: Email already registered

---

### POST /api/auth/login
Authenticate and receive JWT token

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "userId": "user_123",
    "email": "user@example.com",
    "roles": ["owner", "issuer"],
    "activeRole": "owner",
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**Errors:**
- 401: Invalid credentials
- 400: Validation error

---

### GET /api/auth/me
Get current authenticated user

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "userId": "user_123",
    "email": "user@example.com",
    "roles": ["owner", "issuer"],
    "activeRole": "owner",
    "isAuthenticated": true
  }
}
```

**Errors:**
- 401: Unauthorized

---

## Identity Endpoints

### GET /api/identities
List user's identities (role-based filtering)

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `role` (optional): Filter by role

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "identity_user123_1",
      "did": "did:ethr:11155111:0x...",
      "walletAddress": "0x...",
      "name": "My Primary Identity",
      "role": "owner",
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ]
}
```

**Errors:**
- 401: Unauthorized
- 403: Insufficient permissions

---

### POST /api/identities
Create new identity

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "name": "My Professional Identity",
  "description": "Used for professional credentials"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "identity_user123_2",
    "did": "did:ethr:11155111:0x...",
    "walletAddress": "0x...",
    "publicKeyHex": "0x...",
    "name": "My Professional Identity",
    "description": "Used for professional credentials",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

**Errors:**
- 400: Validation error
- 401: Unauthorized
- 403: Insufficient permissions

---

## Credential Endpoints

### GET /api/credentials
List credentials (role-specific data)

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `status` (optional): Filter by status (active, expired, revoked)
- `type` (optional): Filter by credential type

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "cred_1",
      "type": "UniversityDegree",
      "subjectDid": "did:ethr:11155111:0x...",
      "issuer": "did:ethr:11155111:0x...",
      "status": "active",
      "issuedAt": "2024-01-15T10:00:00Z",
      "expiresAt": "2025-01-15T10:00:00Z"
    }
  ]
}
```

**Role-Specific Behavior:**
- **Owner**: See credentials issued to them
- **Issuer**: See credentials they issued
- **Verifier**: See credentials they verified

---

### POST /api/credentials
Issue new credential (issuer only)

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "subjectDid": "did:ethr:11155111:0x...",
  "credentialType": "UniversityDegree",
  "claims": {
    "degree": "Bachelor of Science",
    "field": "Computer Science",
    "university": "MIT"
  }
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "cred_12345",
    "type": "UniversityDegree",
    "subjectDid": "did:ethr:11155111:0x...",
    "issuerDid": "did:ethr:11155111:0x...",
    "claims": { ... },
    "signature": "0x...",
    "status": "active",
    "issuedAt": "2024-01-15T10:00:00Z",
    "expiresAt": "2025-01-15T10:00:00Z"
  }
}
```

**Errors:**
- 400: Validation error
- 401: Unauthorized
- 403: Only issuers can issue credentials

---

## Verification Endpoints

### GET /api/verifications
List verification requests (role-based)

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "vreq_1",
      "verifierDid": "did:ethr:11155111:0x...",
      "requestedCredentials": ["UniversityDegree"],
      "status": "pending",
      "createdAt": "2024-01-15T10:00:00Z",
      "expiresAt": "2024-01-22T10:00:00Z"
    }
  ]
}
```

**Role-Specific Behavior:**
- **Owner**: Verification requests they received
- **Verifier**: Verification requests they created

---

### POST /api/verifications
Create verification request or respond to request

**Headers:**
```
Authorization: Bearer <token>
```

**For Verifier - Create Request:**
```json
{
  "action": "create",
  "subjectDid": "did:ethr:11155111:0x...",
  "requestedCredentials": ["UniversityDegree", "ProofOfEmployment"]
}
```

**For Owner - Respond to Request:**
```json
{
  "action": "respond",
  "requestId": "vreq_1",
  "response": "approve",
  "presentedCredentials": ["cred_1", "cred_2"]
}
```

**Response (201):**
```json
{
  "success": true,
  "data": { ... }
}
```

---

## Organization Endpoints

### GET /api/organizations
Get organization (issuer/verifier only)

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "org_user123",
    "name": "My Credential Issuer",
    "type": "issuer",
    "did": "did:ethr:11155111:0x...",
    "email": "org@example.com",
    "createdAt": "2024-01-15T10:00:00Z"
  }
}
```

---

### PUT /api/organizations
Update organization details

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "name": "Updated Organization Name",
  "description": "Updated description",
  "email": "newemail@example.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": { ... }
}
```

---

## Policy Endpoints

### GET /api/policies
List access control policies

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "policy_user123_1",
      "resourceId": "all_credentials",
      "resourceType": "credential",
      "name": "Default Access Policy",
      "rules": [
        {
          "id": "rule_1",
          "subject": "verified-verifier",
          "action": "read",
          "effect": "allow",
          "conditions": [...]
        }
      ],
      "active": true,
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ]
}
```

---

### POST /api/policies
Create new access policy

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "resourceId": "credential_123",
  "resourceType": "credential",
  "name": "Restricted Access Policy",
  "description": "Only verified organizations",
  "rules": [
    {
      "subject": "verified-org",
      "action": "read",
      "effect": "allow",
      "conditions": [
        {
          "type": "credential-requirement",
          "credentialType": "VerifiedOrganization"
        }
      ]
    }
  ]
}
```

**Response (201):**
```json
{
  "success": true,
  "data": { ... }
}
```

---

## Audit Log Endpoints

### GET /api/audit-logs
Get audit logs (issuer/verifier only)

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string
- `action` (optional): Filter by action type

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "log_1",
      "userId": "user_123",
      "action": "credential_issued",
      "resourceType": "credential",
      "resourceId": "cred_123",
      "result": "success",
      "timestamp": "2024-01-15T10:00:00Z"
    }
  ]
}
```

---

## Analytics Endpoints

### GET /api/analytics
Get analytics data (issuer/verifier only)

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**

**For Issuer:**
```json
{
  "success": true,
  "data": {
    "totalIssued": 156,
    "activeCredentials": 142,
    "revokedCredentials": 14,
    "issuanceRate": 12.5,
    "monthlyTrend": [...],
    "credentialTypes": [...]
  }
}
```

**For Verifier:**
```json
{
  "success": true,
  "data": {
    "totalVerifications": 89,
    "successfulVerifications": 78,
    "failedVerifications": 11,
    "successRate": 87.6,
    "verificationTrend": [...],
    "verificationMethods": [...]
  }
}
```

---

## Error Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 400 | Bad Request | Invalid input, validation error |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Insufficient permissions for resource |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource already exists |
| 500 | Server Error | Internal server error |

---

## Security Features

1. **JWT Authentication**: All protected endpoints require valid JWT token
2. **Role-Based Access Control**: Different data based on user role
3. **Input Validation**: All inputs validated with Zod schemas
4. **Permission Checking**: Granular permission verification
5. **Audit Logging**: All operations logged for compliance
6. **Rate Limiting**: (Can be added) Prevent abuse
7. **HTTPS Only**: All production requests over HTTPS
8. **CORS**: Configured for frontend domains

---

## Usage Examples

### Register New User
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "roles": ["owner"]
  }'
```

### Create Identity
```bash
curl -X POST http://localhost:3000/api/identities \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Identity",
    "description": "Primary identity"
  }'
```

### Issue Credential
```bash
curl -X POST http://localhost:3000/api/credentials \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "subjectDid": "did:ethr:11155111:0x...",
    "credentialType": "UniversityDegree",
    "claims": { "degree": "BS" }
  }'
```

---

## Deployment

- **Framework**: Next.js 16+
- **Runtime**: Node.js 18+
- **Database**: Supabase PostgreSQL
- **Environment Variables**: See `.env.local.example`
- **Port**: 3000 (default)

All endpoints are ready for Vercel, AWS, or any Node.js-compatible hosting platform.
