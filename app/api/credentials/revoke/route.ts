import { NextRequest, NextResponse } from "next/server";
import { RBACService } from "@/lib/services/rbac-service";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrganizationDid } from "@/lib/services/organization-service";

/**
 * POST /api/credentials/revoke
 * Revoke a credential by its credential_id. Issuer-only.
 * Updates the status to 'revoked' in verifiable_credentials and writes an audit log.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const activeRole = request.headers.get("x-active-role") || "issuer";
    if (activeRole !== "issuer") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const hasPermission = RBACService.getRolePermissions("issuer").includes("credential:revoke");
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: "Forbidden: No permission to revoke credentials" },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => null);
    const credentialId = body?.credentialId as string | undefined;

    if (!credentialId) {
      return NextResponse.json(
        { success: false, error: "Validation error: credentialId is required" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // Verify this credential was issued by this user's organization
    const orgDid = await getOrganizationDid(admin, user.id);

    const { data: credRow, error: fetchErr } = await admin
      .from("verifiable_credentials")
      .select("credential_id, issuer_did, status, credential_type, subject_did")
      .eq("credential_id", credentialId)
      .single();

    if (fetchErr || !credRow) {
      return NextResponse.json(
        { success: false, error: "Credential not found" },
        { status: 404 }
      );
    }

    // Ensure the issuer owns this credential
    const issuerDid = (credRow as any).issuer_did as string;
    if (orgDid && issuerDid !== orgDid) {
      return NextResponse.json(
        { success: false, error: "Forbidden: You can only revoke credentials you issued" },
        { status: 403 }
      );
    }

    if ((credRow as any).status === "revoked") {
      return NextResponse.json(
        { success: false, error: "Credential is already revoked" },
        { status: 400 }
      );
    }

    // Update status to revoked
    const { error: updateErr } = await admin
      .from("verifiable_credentials")
      .update({ status: "revoked" })
      .eq("credential_id", credentialId);

    if (updateErr) {
      console.error("[revoke] Failed to revoke credential:", updateErr);
      return NextResponse.json(
        { success: false, error: "Failed to revoke credential" },
        { status: 500 }
      );
    }

    // Write audit log
    if (orgDid) {
      await admin.from("audit_logs").insert({
        actor_did: orgDid,
        action: "credential_revoked",
        resource_id: credentialId,
        resource_type: "credential",
        status: "success",
        details: {
          credentialType: (credRow as any).credential_type,
          subjectDid: (credRow as any).subject_did,
          revokedAt: new Date().toISOString(),
        },
      }).then(({ error }) => {
        if (error) console.error("[revoke] Failed to write audit log:", error);
      });
    }

    return NextResponse.json({
      success: true,
      data: { credentialId, status: "revoked" },
      message: "Credential revoked successfully",
    });
  } catch (error) {
    console.error("[revoke] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to revoke credential" },
      { status: 500 }
    );
  }
}
