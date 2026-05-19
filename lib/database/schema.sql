-- Decentralized Identity Management System Database Schema
-- For PostgreSQL with Supabase (or Neon)
-- This schema provides persistent storage for the DID system

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================================================
-- PROFILES TABLE (Supabase auth integration)
-- ==========================================================================
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

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Authenticated users can insert their own profile" ON public.profiles;
CREATE POLICY "Authenticated users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  roles_arr TEXT[];
BEGIN
  roles_arr := ARRAY['owner'];

  IF new.raw_user_meta_data ? 'roles' THEN
    IF jsonb_typeof(new.raw_user_meta_data->'roles') = 'array' THEN
      SELECT array_agg(value) INTO roles_arr
      FROM jsonb_array_elements_text(new.raw_user_meta_data->'roles');
    ELSIF jsonb_typeof(new.raw_user_meta_data->'roles') = 'string' THEN
      roles_arr := ARRAY[new.raw_user_meta_data->>'roles'];
    END IF;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, roles)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(roles_arr, ARRAY['owner'])
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    roles = COALESCE(EXCLUDED.roles, public.profiles.roles);

  RETURN new;
EXCEPTION
  WHEN undefined_table THEN
    -- If profiles table wasn't created yet, never block signup.
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- IDENTITIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS identities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  did TEXT UNIQUE NOT NULL,
  wallet_address TEXT UNIQUE NOT NULL,
  public_key_hex TEXT NOT NULL,
  private_key_hex TEXT NOT NULL, -- Encrypted in production
  name TEXT,
  description TEXT,
  did_document JSONB NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_identities_did ON identities(did);
CREATE INDEX idx_identities_wallet ON identities(wallet_address);

-- ============================================================================
-- ORGANIZATIONS TABLE (single row per organization)
-- ============================================================================
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  did TEXT UNIQUE,
  public_key TEXT,
  issuer_enabled BOOLEAN DEFAULT FALSE,
  verifier_enabled BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_organizations_did ON organizations(did);
CREATE INDEX idx_organizations_verifier ON organizations(verifier_enabled) WHERE verifier_enabled = TRUE;

-- ============================================================================
-- ORGANIZATION MEMBERSHIPS TABLE (user ↔ org with roles)
-- ============================================================================
CREATE TABLE IF NOT EXISTS organization_memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'issuer_operator', 'verifier_operator')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, organization_id, role)
);

CREATE INDEX idx_org_memberships_user ON organization_memberships(user_id);
CREATE INDEX idx_org_memberships_org ON organization_memberships(organization_id);

-- ============================================================================
-- VERIFIABLE CREDENTIALS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS verifiable_credentials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  credential_id TEXT UNIQUE NOT NULL,
  issuer_did TEXT NOT NULL,
  subject_did TEXT NOT NULL,
  credential_type TEXT NOT NULL,
  issuance_date TIMESTAMP WITH TIME ZONE NOT NULL,
  expiration_date TIMESTAMP WITH TIME ZONE,
  credential_subject JSONB NOT NULL,
  proof JSONB NOT NULL,
  credential_json JSONB NOT NULL, -- Full credential document
  status VARCHAR(20) DEFAULT 'active', -- active, revoked, expired
  blockchain_hash TEXT, -- Hash anchored on blockchain
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_issuer FOREIGN KEY (issuer_did) REFERENCES identities(did) ON DELETE CASCADE
);

CREATE INDEX idx_credentials_issuer ON verifiable_credentials(issuer_did);
CREATE INDEX idx_credentials_subject ON verifiable_credentials(subject_did);
CREATE INDEX idx_credentials_type ON verifiable_credentials(credential_type);
CREATE INDEX idx_credentials_status ON verifiable_credentials(status);
CREATE INDEX idx_credentials_expiration ON verifiable_credentials(expiration_date);

-- ============================================================================
-- ACCESS CONTROL POLICIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS access_control_policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resource_id TEXT NOT NULL,
  resource_type VARCHAR(50) NOT NULL, -- credential, data, service
  owner_did TEXT NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  policy_json JSONB NOT NULL, -- Full policy document
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_owner FOREIGN KEY (owner_did) REFERENCES identities(did) ON DELETE CASCADE,
  UNIQUE(resource_id, resource_type)
);

CREATE INDEX idx_policies_owner ON access_control_policies(owner_did);
CREATE INDEX idx_policies_resource ON access_control_policies(resource_id, resource_type);
CREATE INDEX idx_policies_active ON access_control_policies(active);

-- ============================================================================
-- ACCESS RULES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS access_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  policy_id UUID NOT NULL,
  subject_did TEXT NOT NULL,
  action VARCHAR(20) NOT NULL, -- read, write, execute, share, revoke, *
  effect VARCHAR(10) NOT NULL, -- allow, deny
  conditions JSONB,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_policy FOREIGN KEY (policy_id) REFERENCES access_control_policies(id) ON DELETE CASCADE
);

CREATE INDEX idx_rules_policy ON access_rules(policy_id);
CREATE INDEX idx_rules_subject ON access_rules(subject_did);
CREATE INDEX idx_rules_action ON access_rules(action);
CREATE INDEX idx_rules_effect ON access_rules(effect);

-- ============================================================================
-- DATA EXCHANGE MESSAGES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS data_exchange_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id TEXT UNIQUE NOT NULL,
  from_did TEXT NOT NULL,
  to_did TEXT NOT NULL,
  data_hash TEXT NOT NULL,
  encrypted_data TEXT NOT NULL,
  encryption_algorithm VARCHAR(50) NOT NULL,
  nonce TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, rejected, revoked
  credential_request JSONB,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT fk_from FOREIGN KEY (from_did) REFERENCES identities(did) ON DELETE CASCADE,
  CONSTRAINT fk_to FOREIGN KEY (to_did) REFERENCES identities(did) ON DELETE CASCADE
);

CREATE INDEX idx_messages_from ON data_exchange_messages(from_did);
CREATE INDEX idx_messages_to ON data_exchange_messages(to_did);
CREATE INDEX idx_messages_status ON data_exchange_messages(status);
CREATE INDEX idx_messages_created ON data_exchange_messages(created_at);
CREATE INDEX idx_messages_expires ON data_exchange_messages(expires_at);

-- ============================================================================
-- VERIFICATION EVENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS verification_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  verifier_org_did TEXT NOT NULL,
  subject_did TEXT,
  issuer_did TEXT,
  credential_id TEXT,
  credential_type TEXT,
  presentation_id TEXT,
  result VARCHAR(20) NOT NULL CHECK (result IN ('valid', 'invalid', 'expired')),
  verified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_verifier_org_did FOREIGN KEY (verifier_org_did) REFERENCES identities(did) ON DELETE CASCADE
);

CREATE INDEX idx_verification_events_verifier_org ON verification_events(verifier_org_did);
CREATE INDEX idx_verification_events_verified_at ON verification_events(verified_at);
CREATE INDEX idx_verification_events_result ON verification_events(result);
CREATE INDEX idx_verification_events_issuer ON verification_events(issuer_did);
CREATE INDEX idx_verification_events_subject ON verification_events(subject_did);

-- ============================================================================
-- AUDIT LOG TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_did TEXT NOT NULL,
  action VARCHAR(100) NOT NULL,
  resource_id TEXT,
  resource_type VARCHAR(50),
  status VARCHAR(20) NOT NULL, -- success, failure
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_actor FOREIGN KEY (actor_did) REFERENCES identities(did) ON DELETE CASCADE
);

CREATE INDEX idx_audit_actor ON audit_logs(actor_did);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_resource ON audit_logs(resource_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at);
CREATE INDEX idx_audit_status ON audit_logs(status);

-- ============================================================================
-- BLOCKCHAIN TRANSACTIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS blockchain_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tx_hash TEXT UNIQUE NOT NULL,
  from_address TEXT NOT NULL,
  to_address TEXT,
  chain_id INTEGER NOT NULL DEFAULT 11155111, -- Sepolia
  status VARCHAR(20) NOT NULL, -- pending, confirmed, failed
  block_number BIGINT,
  confirmations INTEGER DEFAULT 0,
  gas_limit TEXT,
  gas_price TEXT,
  nonce INTEGER,
  data TEXT,
  did TEXT, -- Associated DID if applicable
  transaction_type VARCHAR(50), -- registerDID, updateDID, revokeDID, anchorCredential
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT fk_did FOREIGN KEY (did) REFERENCES identities(did) ON DELETE SET NULL
);

CREATE INDEX idx_transactions_hash ON blockchain_transactions(tx_hash);
CREATE INDEX idx_transactions_from ON blockchain_transactions(from_address);
CREATE INDEX idx_transactions_status ON blockchain_transactions(status);
CREATE INDEX idx_transactions_did ON blockchain_transactions(did);
CREATE INDEX idx_transactions_created ON blockchain_transactions(created_at);

-- ============================================================================
-- DID REGISTRY TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS did_registry (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  did TEXT UNIQUE NOT NULL,
  wallet_address TEXT NOT NULL,
  public_key TEXT NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  blockchain_tx_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_verified_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT fk_did FOREIGN KEY (did) REFERENCES identities(did) ON DELETE CASCADE
);

CREATE INDEX idx_registry_did ON did_registry(did);
CREATE INDEX idx_registry_wallet ON did_registry(wallet_address);
CREATE INDEX idx_registry_active ON did_registry(active);

-- ============================================================================
-- CREDENTIAL REVOCATION TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS credential_revocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  credential_id TEXT NOT NULL,
  credential_hash TEXT,
  revoker_did TEXT NOT NULL,
  reason TEXT,
  revocation_date TIMESTAMP WITH TIME ZONE NOT NULL,
  blockchain_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_credential FOREIGN KEY (credential_id) REFERENCES verifiable_credentials(credential_id) ON DELETE CASCADE,
  CONSTRAINT fk_revoker FOREIGN KEY (revoker_did) REFERENCES identities(did) ON DELETE CASCADE
);

CREATE INDEX idx_revocations_credential ON credential_revocations(credential_id);
CREATE INDEX idx_revocations_revoker ON credential_revocations(revoker_did);
CREATE INDEX idx_revocations_date ON credential_revocations(revocation_date);

-- ============================================================================
-- ZK PROOFS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS zero_knowledge_proofs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proof_id TEXT UNIQUE NOT NULL,
  proof_type VARCHAR(100) NOT NULL,
  prover_did TEXT NOT NULL,
  verifier_did TEXT,
  proof_data JSONB NOT NULL,
  public_inputs JSONB NOT NULL,
  verification_key TEXT,
  verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_prover FOREIGN KEY (prover_did) REFERENCES identities(did) ON DELETE CASCADE,
  CONSTRAINT fk_verifier FOREIGN KEY (verifier_did) REFERENCES identities(did) ON DELETE SET NULL
);

CREATE INDEX idx_zkp_prover ON zero_knowledge_proofs(prover_did);
CREATE INDEX idx_zkp_verifier ON zero_knowledge_proofs(verifier_did);
CREATE INDEX idx_zkp_verified ON zero_knowledge_proofs(verified);
CREATE INDEX idx_zkp_type ON zero_knowledge_proofs(proof_type);

-- ============================================================================
-- DATA SHARING AGREEMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS data_sharing_agreements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agreement_id TEXT UNIQUE NOT NULL,
  data_owner_did TEXT NOT NULL,
  data_consumer_did TEXT NOT NULL,
  data_description TEXT,
  usage_restrictions TEXT[],
  terms JSONB,
  agreement_hash TEXT,
  status VARCHAR(20) DEFAULT 'active', -- active, revoked, expired
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT fk_owner FOREIGN KEY (data_owner_did) REFERENCES identities(did) ON DELETE CASCADE,
  CONSTRAINT fk_consumer FOREIGN KEY (data_consumer_did) REFERENCES identities(did) ON DELETE CASCADE
);

CREATE INDEX idx_agreements_owner ON data_sharing_agreements(data_owner_did);
CREATE INDEX idx_agreements_consumer ON data_sharing_agreements(data_consumer_did);
CREATE INDEX idx_agreements_status ON data_sharing_agreements(status);
CREATE INDEX idx_agreements_expires ON data_sharing_agreements(expires_at);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE verifiable_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_control_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_exchange_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE blockchain_transactions ENABLE ROW LEVEL SECURITY;

-- Identities: Users can only see their own identity
CREATE POLICY identities_own_policy ON identities
  FOR SELECT USING (TRUE); -- Allow viewing in demo, restrict in production

-- Credentials: Users can see credentials they issued or received
CREATE POLICY credentials_visibility_policy ON verifiable_credentials
  FOR SELECT USING (TRUE); -- Allow viewing in demo

-- Access Control Policies: Users can see policies they own
CREATE POLICY policies_visibility_policy ON access_control_policies
  FOR SELECT USING (TRUE); -- Allow viewing in demo

-- Data Exchange Messages: Users can only see their own messages
CREATE POLICY messages_visibility_policy ON data_exchange_messages
  FOR SELECT USING (TRUE); -- Allow viewing in demo

-- Audit Logs: Users can see logs for their own actions
CREATE POLICY audit_visibility_policy ON audit_logs
  FOR SELECT USING (TRUE); -- Allow viewing in demo

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_identities_updated_at BEFORE UPDATE ON identities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_credentials_updated_at BEFORE UPDATE ON verifiable_credentials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_policies_updated_at BEFORE UPDATE ON access_control_policies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_registry_updated_at BEFORE UPDATE ON did_registry
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Active credentials view
CREATE VIEW active_credentials AS
SELECT *
FROM verifiable_credentials
WHERE status = 'active'
  AND (expiration_date IS NULL OR expiration_date > CURRENT_TIMESTAMP);

-- Active policies view
CREATE VIEW active_policies AS
SELECT *
FROM access_control_policies
WHERE active = TRUE;

-- Recent audit logs view (last 30 days)
CREATE VIEW recent_audit_logs AS
SELECT *
FROM audit_logs
WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
ORDER BY created_at DESC;

-- Pending blockchain transactions view
CREATE VIEW pending_transactions AS
SELECT *
FROM blockchain_transactions
WHERE status = 'pending'
ORDER BY created_at DESC;

-- ============================================================================
-- INITIAL SETUP COMPLETE
-- ============================================================================
-- Run the following for full Supabase integration:
-- 1. Enable Row Level Security (RLS) in Supabase dashboard
-- 2. Create service role key for backend operations
-- 3. Set up environment variables with Supabase URL and keys
-- 4. Update identity-context.tsx to use Supabase client
