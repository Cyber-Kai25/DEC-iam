import { NextResponse } from "next/server";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/organizations/directory
 * Public directory of verifier-enabled organizations with DIDs.
 */
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    const { data, error } = await admin
      .from("organizations")
      .select("did,name,description,verified_at")
      .eq("verifier_enabled", true)
      .not("did", "is", null)
      .order("name", { ascending: true })
      .limit(200);

    if (error) {
      console.error("[org-dir] Organization directory fetch failed:", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch organization directory" },
        { status: 500 }
      );
    }

    const results = (data || []).map((row: any) => ({
      did: row.did as string,
      name: String(row.name || row.did),
      description: row.description || undefined,
      verified: !!row.verified_at,
    }));

    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    console.error("[org-dir] Organization directory error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch organization directory" },
      { status: 500 }
    );
  }
}
