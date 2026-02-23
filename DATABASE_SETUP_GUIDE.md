# Supabase Database Setup & Schema Guide

## Overview

This guide covers creating and configuring your Supabase PostgreSQL database for the decentralized identity application. It includes complete SQL schemas, Row-Level Security (RLS) policies, and integration instructions.

---

## Step 1: Access Supabase Dashboard

1. Go to https://supabase.com/dashboard
2. Select your project
3. Click "SQL Editor" in the left sidebar
4. Create a new query

---

## Step 2: Create Database Tables

### Option A: Run Individual Statements

Copy each SQL block below into Supabase SQL Editor and execute.

### Option B: Create All at Once

Copy the complete schema at the bottom and execute as one query.

---

## Table Schemas

### 1. Profiles Table (User Management)

```sql
-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  roles TEXT[] DEFAULT ARRAY['owner'],
  organization_id UUID,
  phone TEXT,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Authenticated users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Create trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, roles)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data ->> 'full_name', ''),
    COALESCE((new.raw_user_meta_data ->> 'roles')::text[], ARRAY['owner'])
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    roles = COALESCE(EXCLUDED.roles, public.profiles.roles);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### 2. Organizations Table

```sql
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('issuer', 'verifier')),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  did TEXT UNIQUE,
  public_key TEXT,
  website TEXT,
  logo_url TEXT,
  metadata JSONB DEFAULT '{}',
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view verified organizations"
  ON public.organizations FOR SELECT
  USING (is_verified = true OR auth.uid() = owner_id);

CREATE POLICY "Users can create organizations"
  ON public.organizations FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Organization owners can update their organization"
  ON public.organizations FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "Organization owners can delete their organization"
  ON public.organizations FOR DELETE
  USING (auth.uid() = owner_id);

-- Create index for fast lookups
CREATE INDEX idx_organizations_owner_id ON public.organizations(owner_id);
CREATE INDEX idx_organizations_did ON public.organizations(did);
```

### 3. Identities (DIDs) Table

```sql
CREATE TABLE IF NOT EXISTS public.identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  did TEXT UNIQUE NOT NULL,
  public_key TEXT NOT NULL,
  private_key_hash TEXT,
  did_document JSONB,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'suspended')),
  blockchain_tx_hash TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.identities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own identities"
  ON public.identities FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create identities"
  ON public.identities FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their identities"
  ON public.identities FOR UPDATE
  USING (auth.uid() = user_id);

CREATE INDEX idx_identities_user_id ON public.identities(user_id);
CREATE INDEX idx_identities_did ON public.identities(did);
```

### 4. Credentials Table

```sql
CREATE TABLE IF NOT EXISTS public.credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issuer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL,
  type TEXT NOT NULL,
  subject JSONB NOT NULL,
  claims JSONB NOT NULL,
  proof TEXT,
  issuer_did TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  issued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE,
  revoked_at TIMESTAMP WITH TIME ZONE,
  blockchain_tx_hash TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Issuers can view their credentials"
  ON public.credentials FOR SELECT
  USING (auth.uid() = issuer_id);

CREATE POLICY "Subject owners can view credentials about them"
  ON public.credentials FOR SELECT
  USING (subject_id = (SELECT did FROM public.identities WHERE user_id = auth.uid() LIMIT 1));

CREATE POLICY "Issuers can create credentials"
  ON public.credentials FOR INSERT
  WITH CHECK (auth.uid() = issuer_id);

CREATE POLICY "Issuers can update their credentials"
  ON public.credentials FOR UPDATE
  USING (auth.uid() = issuer_id);

CREATE INDEX idx_credentials_issuer_id ON public.credentials(issuer_id);
CREATE INDEX idx_credentials_subject_id ON public.credentials(subject_id);
CREATE INDEX idx_credentials_status ON public.credentials(status);
```

### 5. Verification Requests Table

```sql
CREATE TABLE IF NOT EXISTS public.verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verifier_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL,
  credential_id UUID REFERENCES public.credentials(id),
  challenge TEXT,
  requirements JSONB,
  response JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  verified_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Verifiers can view their requests"
  ON public.verification_requests FOR SELECT
  USING (auth.uid() = verifier_id);

CREATE POLICY "Subject owners can view their verification requests"
  ON public.verification_requests FOR SELECT
  USING (subject_id IN (SELECT did FROM public.identities WHERE user_id = auth.uid()));

CREATE POLICY "Verifiers can create requests"
  ON public.verification_requests FOR INSERT
  WITH CHECK (auth.uid() = verifier_id);

CREATE POLICY "Verifiers can update requests"
  ON public.verification_requests FOR UPDATE
  USING (auth.uid() = verifier_id);

CREATE INDEX idx_verification_requests_verifier_id ON public.verification_requests(verifier_id);
CREATE INDEX idx_verification_requests_subject_id ON public.verification_requests(subject_id);
CREATE INDEX idx_verification_requests_status ON public.verification_requests(status);
```

### 6. Access Policies Table

```sql
CREATE TABLE IF NOT EXISTS public.access_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  rules JSONB NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.access_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own policies"
  ON public.access_policies FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can create policies"
  ON public.access_policies FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their policies"
  ON public.access_policies FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their policies"
  ON public.access_policies FOR DELETE
  USING (auth.uid() = owner_id);

CREATE INDEX idx_access_policies_owner_id ON public.access_policies(owner_id);
```

### 7. Audit Logs Table

```sql
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  changes JSONB,
  ip_address TEXT,
  user_agent TEXT,
  status TEXT DEFAULT 'success' CHECK (status IN ('success', 'failure')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own audit logs"
  ON public.audit_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Audit logs are append-only
CREATE POLICY "Authenticated users can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Prevent updates and deletes
CREATE POLICY "Audit logs cannot be updated"
  ON public.audit_logs FOR UPDATE
  USING (false);

CREATE POLICY "Audit logs cannot be deleted"
  ON public.audit_logs FOR DELETE
  USING (false);

CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource_type ON public.audit_logs(resource_type);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
```

---

## Step 3: Verify Tables Were Created

Run this query to see all your tables:

```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public';
```

You should see:
- profiles
- organizations
- identities
- credentials
- verification_requests
- access_policies
- audit_logs

---

## Step 4: Enable RLS on All Tables

RLS is enabled in each table definition above, but verify it's enabled:

```sql
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND rowsecurity = true;
```

All tables should show `rowsecurity = true`.

---

## Step 5: Test Basic Queries

```sql
-- View your profile (after logging in)
SELECT * FROM public.profiles;

-- View your organizations
SELECT * FROM public.organizations WHERE owner_id = auth.uid();

-- View your identities
SELECT * FROM public.identities WHERE user_id = auth.uid();
```

---

## Data Retention & Cleanup

### Archive Old Credentials
```sql
DELETE FROM public.credentials
WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '1 year'
AND status = 'expired';
```

### Archive Old Audit Logs
```sql
DELETE FROM public.audit_logs
WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '2 years';
```

---

## Backup & Recovery

Supabase automatically backs up your data daily. To restore:

1. Go to Settings → Backups
2. Click "Restore from backup"
3. Select desired backup point
4. Confirm restoration

---

## Performance Optimization

### Add Common Indexes
```sql
-- Already included above, but ensure they exist:
CREATE INDEX IF NOT EXISTS idx_organizations_owner_id ON public.organizations(owner_id);
CREATE INDEX IF NOT EXISTS idx_identities_user_id ON public.identities(user_id);
CREATE INDEX IF NOT EXISTS idx_credentials_issuer_id ON public.credentials(issuer_id);
CREATE INDEX IF NOT EXISTS idx_verification_requests_verifier_id ON public.verification_requests(verifier_id);
CREATE INDEX IF NOT EXISTS idx_access_policies_owner_id ON public.access_policies(owner_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
```

### Connection Pooling
Supabase automatically handles pooling. No additional configuration needed.

---

## Monitoring & Maintenance

### Check Database Size
```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### View Active Connections
Go to Supabase Dashboard → Database → Connections

### Monitor RLS Policies
```sql
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;
```

---

## Integration with API

Your API endpoints can now query these tables:

```typescript
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  
  // Query with RLS automatically applied
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  
  return Response.json({ profile })
}
```

---

## Summary

Your database is now:
- ✅ Fully structured with 7 core tables
- ✅ Protected with Row-Level Security policies
- ✅ Optimized with indexes
- ✅ Ready for production
- ✅ Scalable and maintainable

You're ready to connect your frontend and API to Supabase!
