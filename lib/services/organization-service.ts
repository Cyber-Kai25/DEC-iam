import DIDService from "@/lib/services/did-service";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export interface OrgRow {
  id: string;
  name: string;
  description: string | null;
  did: string | null;
  public_key: string | null;
  issuer_enabled: boolean;
  verifier_enabled: boolean;
  verified_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface OrgIdentity {
  did: string;
  privateKeyHex: string;
}

/**
 * Find the user's organization via organization_memberships.
 * Returns the raw DB row or null.
 */
export async function findUserOrganization(admin: AdminClient, userId: string): Promise<OrgRow | null> {
  // Look up membership first
  const { data: membership, error: memErr } = await admin
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (memErr) {
    console.error("[org-service] membership lookup failed:", memErr);
    return null;
  }

  if (!membership) return null;

  const orgId = (membership as any).organization_id as string;
  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .select("*")
    .eq("id", orgId)
    .single();

  if (orgErr || !org) {
    console.error("[org-service] org fetch failed:", orgErr);
    return null;
  }

  return org as unknown as OrgRow;
}

/**
 * Get or create the user's organization.
 * If activeRole is provided, the corresponding capability flag is enabled.
 */
export async function getOrCreateOrganization(
  admin: AdminClient,
  userId: string,
  activeRole?: "issuer" | "verifier"
): Promise<OrgRow | null> {
  let org = await findUserOrganization(admin, userId);

  if (!org) {
    // Create organization
    const defaultName = "My Organization";
    const defaultDesc = "Decentralized Identity Organization";

    const { data: newOrg, error: createErr } = await admin
      .from("organizations")
      .insert({
        name: defaultName,
        description: defaultDesc,
        issuer_enabled: activeRole === "issuer",
        verifier_enabled: activeRole === "verifier",
      })
      .select("*")
      .single();

    if (createErr || !newOrg) {
      console.error("[org-service] Failed to create organization:", createErr);
      return null;
    }

    org = newOrg as unknown as OrgRow;

    // Create membership
    const { error: memErr } = await admin
      .from("organization_memberships")
      .insert({
        user_id: userId,
        organization_id: org.id,
        role: "admin",
      });

    if (memErr) {
      console.error("[org-service] Failed to create membership:", memErr);
      // Clean up orphaned org
      await admin.from("organizations").delete().eq("id", org.id);
      return null;
    }
  }

  // Enable capability flag if needed
  if (activeRole) {
    const flag = activeRole === "issuer" ? "issuer_enabled" : "verifier_enabled";
    if (!(org as any)[flag]) {
      await admin
        .from("organizations")
        .update({ [flag]: true, updated_at: new Date().toISOString() })
        .eq("id", org.id);
      (org as any)[flag] = true;
    }
  }

  // Ensure DID identity exists
  if (!org.did) {
    const identity = DIDService.createIdentity(org.name || "Organization");
    const identityMetadata = {
      userId,
      organizationId: org.id,
      createdAt: new Date().toISOString(),
    };

    const { data: savedIdentity, error: identityErr } = await admin
      .from("identities")
      .upsert(
        {
          did: identity.did,
          wallet_address: identity.walletAddress,
          public_key_hex: identity.publicKeyHex,
          private_key_hex: identity.privateKeyHex,
          name: org.name,
          description: org.description,
          did_document: identity.didDocument,
          metadata: identityMetadata,
          active: true,
        },
        { onConflict: "did" }
      )
      .select("did")
      .single();

    if (identityErr || !savedIdentity) {
      console.error("[org-service] Failed to create org identity:", identityErr);
      return org;
    }

    const did = (savedIdentity as any).did as string;
    await admin
      .from("organizations")
      .update({ did, public_key: identity.publicKeyHex, updated_at: new Date().toISOString() })
      .eq("id", org.id);

    org.did = did;
    org.public_key = identity.publicKeyHex;
  }

  return org;
}

/**
 * Get the organization DID for a user (returns null if org or DID doesn't exist).
 */
export async function getOrganizationDid(admin: AdminClient, userId: string): Promise<string | null> {
  const org = await findUserOrganization(admin, userId);
  return org?.did || null;
}

/**
 * Get the organization DID + private key for signing (issuing / verifying).
 */
export async function getOrganizationIdentity(admin: AdminClient, userId: string): Promise<OrgIdentity | null> {
  const did = await getOrganizationDid(admin, userId);
  if (!did) return null;

  const { data: identityRow, error } = await admin
    .from("identities")
    .select("did, private_key_hex")
    .eq("did", did)
    .maybeSingle();

  if (error || !identityRow) return null;

  const privateKeyHex = (identityRow as any).private_key_hex as string | null;
  if (!privateKeyHex) return null;

  return { did, privateKeyHex };
}

/**
 * Build normalized organization payload for API responses.
 */
export function buildOrganizationPayload(org: OrgRow, didDocument?: any) {
  return {
    id: org.id,
    name: org.name,
    description: org.description || undefined,
    issuerEnabled: !!org.issuer_enabled,
    verifierEnabled: !!org.verifier_enabled,
    verifiedAt: org.verified_at || undefined,
    didDocument: didDocument || undefined,
    createdAt: org.created_at,
    updatedAt: org.updated_at,
    metadata: org.metadata || undefined,
  };
}
