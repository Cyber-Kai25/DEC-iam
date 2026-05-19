-- ==========================================================================
-- MIGRATION: Dual-row organizations → Single-row + memberships
-- Run this in Supabase SQL Editor BEFORE using the updated code.
-- ==========================================================================

-- Step 1: Create organization_memberships table
CREATE TABLE IF NOT EXISTS organization_memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'issuer_operator', 'verifier_operator')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, organization_id, role)
);

CREATE INDEX IF NOT EXISTS idx_org_memberships_user ON organization_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_org ON organization_memberships(organization_id);

-- Step 2: Add capability columns to organizations (if not present)
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS issuer_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS verifier_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;

-- Step 3: Migrate existing data
-- For each owner_id that has at least one org row, pick the issuer row (or verifier if no issuer)
-- as the "primary" organization and merge capabilities.
DO $$
DECLARE
  r RECORD;
  primary_org_id UUID;
  has_issuer BOOLEAN;
  has_verifier BOOLEAN;
  v_did TEXT;
  v_public_key TEXT;
BEGIN
  FOR r IN (
    SELECT DISTINCT owner_id FROM organizations
  ) LOOP
    -- Check what types exist for this owner
    SELECT
      bool_or(type = 'issuer'),
      bool_or(type = 'verifier')
    INTO has_issuer, has_verifier
    FROM organizations
    WHERE owner_id = r.owner_id;

    -- Pick the primary org row (prefer the one with a DID, then issuer, then any)
    SELECT id INTO primary_org_id
    FROM organizations
    WHERE owner_id = r.owner_id
    ORDER BY
      CASE WHEN did IS NOT NULL THEN 0 ELSE 1 END,
      CASE WHEN type = 'issuer' THEN 0 ELSE 1 END
    LIMIT 1;

    -- Get the DID from any row that has one
    SELECT did, public_key INTO v_did, v_public_key
    FROM organizations
    WHERE owner_id = r.owner_id AND did IS NOT NULL
    LIMIT 1;

    -- Update the primary org with merged capabilities and DID
    UPDATE organizations SET
      issuer_enabled = COALESCE(has_issuer, FALSE),
      verifier_enabled = COALESCE(has_verifier, FALSE),
      did = COALESCE(v_did, did),
      public_key = COALESCE(v_public_key, public_key)
    WHERE id = primary_org_id;

    -- Create admin membership for this user
    INSERT INTO organization_memberships (user_id, organization_id, role)
    VALUES (r.owner_id, primary_org_id, 'admin')
    ON CONFLICT (user_id, organization_id, role) DO NOTHING;

    -- Delete the non-primary org rows for this owner
    DELETE FROM organizations
    WHERE owner_id = r.owner_id AND id != primary_org_id;
  END LOOP;
END $$;

-- Step 4: Drop old columns and constraints that are no longer needed
-- Remove the type column and owner_id column (now handled via memberships)
-- First drop the unique constraint on (owner_id, type)
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_owner_id_type_key;

-- Drop indexes on the old columns
DROP INDEX IF EXISTS idx_organizations_owner_type;

-- Now drop the columns
ALTER TABLE organizations DROP COLUMN IF EXISTS type;
ALTER TABLE organizations DROP COLUMN IF EXISTS owner_id;

-- Step 5: Add index for verifier directory lookups
CREATE INDEX IF NOT EXISTS idx_organizations_verifier ON organizations(verifier_enabled) WHERE verifier_enabled = TRUE;

-- Done! The organizations table now has single rows with capability flags.
-- User-org relationships are managed via organization_memberships.
