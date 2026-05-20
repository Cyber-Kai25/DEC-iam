import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrganizationDid } from "@/lib/services/organization-service";

/**
 * GET /api/audit-logs
 * Fetch real audit logs from the audit_logs table for the user's organization DID.
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

    const activeRole = request.headers.get("x-active-role") || "issuer";
    if (!["issuer", "verifier"].includes(activeRole)) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Only issuers and verifiers can access audit logs" },
        { status: 403 }
      );
    }

    const admin = createAdminClient();
    const orgDid = await getOrganizationDid(admin, user.id);

    if (!orgDid) {
      return NextResponse.json({ success: true, data: [] });
    }

    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get("limit") || "200"), 500);

    const { data, error } = await admin
      .from("audit_logs")
      .select("*")
      .eq("actor_did", orgDid)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[audit] Failed to fetch audit logs:", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch audit logs" },
        { status: 500 }
      );
    }

    const logs = (data || []).map((row: any) => ({
      id: row.id,
      action: row.action,
      actorDid: row.actor_did,
      resourceId: row.resource_id,
      resourceType: row.resource_type,
      status: row.status,
      details: row.details,
      timestamp: row.created_at,
    }));

    return NextResponse.json({ success: true, data: logs });
  } catch (error) {
    console.error("[audit] Get audit logs error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch audit logs" },
      { status: 500 }
    );
  }
}
