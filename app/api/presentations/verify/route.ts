import { NextRequest, NextResponse } from "next/server";
import { RBACService } from "@/lib/services/rbac-service";
import VerificationService from "@/lib/services/verification-service";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrganizationDid } from "@/lib/services/organization-service";

function extractHolderAddressFromDid(holderDid: string): string {
  const parts = holderDid.split(":");
  return parts[parts.length - 1] || holderDid;
}

function mapVerificationResultToEventResult(res: { valid: boolean; error?: string }) {
  if (res.valid) return "valid" as const;
  const err = String(res.error || "").toLowerCase();
  if (err.includes("expire")) return "expired" as const;
  return "invalid" as const;
}

/**
 * POST /api/presentations/verify
 * Verifier-only: verify a presentation message, mark it accepted/rejected, and write verification_events.
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

    const activeRole = request.headers.get("x-active-role") || "verifier";
    if (activeRole !== "verifier") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const hasPermission = RBACService.getRolePermissions("verifier").includes("credential:verify");
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: "Forbidden: No permission to verify presentations" },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => null);
    const messageId = body?.messageId as string | undefined;

    if (!messageId) {
      return NextResponse.json(
        { success: false, error: "Validation error: messageId is required" },
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

    const { data: messageRow, error: msgErr } = await admin
      .from("data_exchange_messages")
      .select("message_id, from_did, to_did, encrypted_data, status")
      .eq("message_id", messageId)
      .single();

    if (msgErr || !messageRow) {
      return NextResponse.json(
        { success: false, error: "Presentation message not found" },
        { status: 404 }
      );
    }

    let parsed: any = null;
    try {
      parsed = JSON.parse((messageRow as any).encrypted_data);
    } catch {
      parsed = null;
    }

    const presentation = parsed?.presentation;
    if (!presentation) {
      return NextResponse.json(
        { success: false, error: "Message does not contain a presentation payload" },
        { status: 400 }
      );
    }

    const holderDid = String(presentation?.holder || "");
    const holderAddress = extractHolderAddressFromDid(holderDid);

    const verification = VerificationService.verifyPresentation(presentation, holderAddress);
    const eventResult = mapVerificationResultToEventResult(verification);

    const nextStatus = verification.valid ? "accepted" : "rejected";

    const { data: updatedRow, error: updateErr } = await admin
      .from("data_exchange_messages")
      .update({
        status: nextStatus,
        read_at: new Date().toISOString(),
      })
      .eq("message_id", messageId)
      .select("message_id, status")
      .single();

    if (updateErr || !updatedRow) {
      return NextResponse.json(
        { success: false, error: "Failed to update presentation status" },
        { status: 500 }
      );
    }

    const vcs = Array.isArray(presentation?.verifiableCredential) ? presentation.verifiableCredential : [];

    if (vcs.length > 0) {
      const inserts = vcs.map((vc: any) => {
        const types = Array.isArray(vc?.type) ? vc.type : [];
        const credentialType = types.find((t: string) => t !== "VerifiableCredential") || types[0] || null;
        const issuerDid = typeof vc?.issuer === "string" ? vc.issuer : null;
        const issuerName = typeof vc?._issuerName === "string" ? vc._issuerName : null;
        const subjectDid = typeof vc?.credentialSubject?.id === "string" ? vc.credentialSubject.id : null;
        const credentialId = typeof vc?.id === "string" ? vc.id : null;

        return {
          verifier_org_did: verifierOrgDid,
          subject_did: subjectDid,
          issuer_did: issuerDid,
          credential_id: credentialId,
          credential_type: credentialType,
          presentation_id: messageId,
          result: eventResult,
          verified_at: new Date().toISOString(),
          details: {
            messageId,
            presentationFromDid: (messageRow as any).from_did,
            issuerName: issuerName,
            error: verification.valid ? null : verification.error || null,
          },
        };
      });

      const { error: insertErr } = await admin.from("verification_events").insert(inserts as any);
      if (insertErr) {
        console.error("[presentations/verify] Failed to write verification events:", insertErr);
      }
    } else {
      // Still log an event, even if the presentation had no embedded VCs
      const { error: insertErr } = await admin.from("verification_events").insert({
        verifier_org_did: verifierOrgDid,
        subject_did: holderDid || null,
        issuer_did: null,
        credential_id: null,
        credential_type: null,
        presentation_id: messageId,
        result: eventResult,
        verified_at: new Date().toISOString(),
        details: {
          messageId,
          presentationFromDid: (messageRow as any).from_did,
          error: verification.valid ? null : verification.error || null,
          note: "presentation_without_vcs",
        },
      } as any);
      if (insertErr) {
        console.error("[presentations/verify] Failed to write verification event:", insertErr);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        messageId,
        status: (updatedRow as any).status,
        verification,
      },
    });
  } catch (error) {
    console.error("[presentations/verify] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to verify presentation" },
      { status: 500 }
    );
  }
}
