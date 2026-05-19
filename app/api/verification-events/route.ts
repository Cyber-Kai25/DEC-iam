import { NextRequest, NextResponse } from "next/server";
import { RBACService } from "@/lib/services/rbac-service";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrganizationDid } from "@/lib/services/organization-service";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const activeRole = request.headers.get("x-active-role") || "verifier";
    if (activeRole !== "verifier") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const hasPermission = RBACService.getRolePermissions("verifier").includes("analytics:read:own");
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: "Forbidden: No permission to read verification events" },
        { status: 403 }
      );
    }

    const admin = createAdminClient();
    const verifierOrgDid = await getOrganizationDid(admin, user.id);
    if (!verifierOrgDid) {
      return NextResponse.json({ success: true, data: [] });
    }

    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get("limit") || "200"), 500);

    const { data, error } = await admin
      .from("verification_events")
      .select("*")
      .eq("verifier_org_did", verifierOrgDid)
      .order("verified_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[v0] Failed to fetch verification events:", error);
      return NextResponse.json({ success: false, error: "Failed to fetch verification events" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error) {
    console.error("[v0] Get verification events error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch verification events" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const activeRole = request.headers.get("x-active-role") || "verifier";
    if (activeRole !== "verifier") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const hasPermission = RBACService.getRolePermissions("verifier").includes("credential:verify");
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: "Forbidden: No permission to create verification events" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      subjectDid,
      issuerDid,
      credentialId,
      credentialType,
      presentationId,
      result,
      details,
    } = body || {};

    if (!result || !["valid", "invalid", "expired"].includes(String(result))) {
      return NextResponse.json(
        { success: false, error: "Validation error: result must be one of valid|invalid|expired" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const verifierOrgDid = await getOrganizationDid(admin, user.id);
    if (!verifierOrgDid) {
      return NextResponse.json(
        {
          success: false,
          error: "No verifier organization DID found. Visit Verifier > Organization to initialize.",
        },
        { status: 400 }
      );
    }

    const { data, error } = await admin
      .from("verification_events")
      .insert({
        verifier_org_did: verifierOrgDid,
        subject_did: typeof subjectDid === "string" ? subjectDid : null,
        issuer_did: typeof issuerDid === "string" ? issuerDid : null,
        credential_id: typeof credentialId === "string" ? credentialId : null,
        credential_type: typeof credentialType === "string" ? credentialType : null,
        presentation_id: typeof presentationId === "string" ? presentationId : null,
        result,
        verified_at: new Date().toISOString(),
        details: details || null,
      })
      .select("*")
      .single();

    if (error || !data) {
      console.error("[v0] Failed to create verification event:", error);
      return NextResponse.json({ success: false, error: "Failed to create verification event" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    console.error("[v0] Create verification event error:", error);
    return NextResponse.json({ success: false, error: "Failed to create verification event" }, { status: 500 });
  }
}
