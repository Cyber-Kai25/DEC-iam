import { NextRequest, NextResponse } from "next/server";
import { RBACService } from "@/lib/services/rbac-service";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getOrCreateOrganization,
  findUserOrganization,
  buildOrganizationPayload,
} from "@/lib/services/organization-service";

type OrgRole = "issuer" | "verifier";

function getActiveRole(request: NextRequest): OrgRole | null {
  const activeRole = (request.headers.get("x-active-role") as OrgRole) || null;
  if (activeRole !== "issuer" && activeRole !== "verifier") return null;
  return activeRole;
}

/**
 * GET /api/organizations
 * Get (or auto-create) the user's single organization.
 * The x-active-role header enables the corresponding capability flag.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const activeRole = getActiveRole(request);
    if (!activeRole) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Only issuers and verifiers can have organizations" },
        { status: 403 }
      );
    }

    const hasPermission = RBACService.getRolePermissions(activeRole).includes("organization:read:own");
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: "Forbidden: No permission to read organization" },
        { status: 403 }
      );
    }

    const admin = createAdminClient();
    const org = await getOrCreateOrganization(admin, user.id, activeRole);

    if (!org) {
      return NextResponse.json({ success: false, error: "Failed to fetch organization" }, { status: 500 });
    }

    // Fetch DID document
    let didDocument = null as any;
    if (org.did) {
      const { data: identityRow } = await admin
        .from("identities")
        .select("did_document")
        .eq("did", org.did)
        .maybeSingle();
      if (identityRow) {
        didDocument = (identityRow as any).did_document;
      }
    }

    const payload = buildOrganizationPayload(org, didDocument);
    console.log("[org] Retrieved organization:", { orgId: payload.id, issuer: payload.issuerEnabled, verifier: payload.verifierEnabled });

    return NextResponse.json({ success: true, data: payload });
  } catch (error) {
    console.error("[org] Get organization error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch organization" }, { status: 500 });
  }
}

/**
 * PUT /api/organizations
 * Update the user's organization name/description. Single source of truth.
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const activeRole = getActiveRole(request);
    if (!activeRole) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const hasPermission = RBACService.getRolePermissions(activeRole).includes("organization:update:own");
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: "Forbidden: No permission to update organization" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, description } = body;

    const admin = createAdminClient();

    // Find the user's single organization
    const existing = await findUserOrganization(admin, user.id);
    if (!existing) {
      return NextResponse.json({ success: false, error: "Organization not found" }, { status: 404 });
    }

    // Update organization row
    const { data: updatedOrg, error: updateError } = await admin
      .from("organizations")
      .update({
        name: name || existing.name,
        description: description !== undefined ? description : existing.description,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (updateError || !updatedOrg) {
      console.error("[org] Update organization error:", updateError);
      return NextResponse.json({ success: false, error: "Failed to update organization" }, { status: 500 });
    }

    // Also update the linked identity profile so DID metadata stays aligned
    const orgDid = (updatedOrg as any).did as string | null;
    if (orgDid) {
      await admin
        .from("identities")
        .update({
          name: name || existing.name,
          description: description !== undefined ? description : existing.description,
          updated_at: new Date().toISOString(),
        })
        .eq("did", orgDid);
    }

    // Fetch DID document for response
    let didDocument = null as any;
    if (orgDid) {
      const { data: identityRow } = await admin
        .from("identities")
        .select("did_document")
        .eq("did", orgDid)
        .maybeSingle();
      if (identityRow) {
        didDocument = (identityRow as any).did_document;
      }
    }

    const payload = buildOrganizationPayload(updatedOrg as any, didDocument);
    console.log("[org] Updated organization:", { orgId: payload.id });

    return NextResponse.json({ success: true, data: payload });
  } catch (error) {
    console.error("[org] Update organization error:", error);
    return NextResponse.json({ success: false, error: "Failed to update organization" }, { status: 500 });
  }
}
