import { NextRequest, NextResponse } from 'next/server';
import { RBACService } from '@/lib/services/rbac-service';
import VerificationService from '@/lib/services/verification-service';
import SupabaseRepository from '@/lib/services/supabase-repository';
import BlockchainService from '@/lib/services/blockchain-service';
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrganizationIdentity, getOrganizationDid, findUserOrganization } from '@/lib/services/organization-service';
import { ethers } from 'ethers';

/**
 * GET /api/credentials
 * List credentials from Supabase (varies by role)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const activeRole = (request.headers.get('x-active-role') as any) || 'owner';

    // Check permission
    const perms = RBACService.getRolePermissions(activeRole);
    const hasPermission = perms.includes('credential:read:own') || perms.includes('credential:read:any');
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: No permission to read credentials' },
        { status: 403 }
      );
    }

    // Fetch credentials from Supabase using admin client (role-specific)
    const admin = createAdminClient();

    let query = admin.from('verifiable_credentials').select('*');

    if (activeRole === 'owner') {
      // Owner sees credentials where they are the subject
      const { data: identity } = await admin
        .from('identities')
        .select('did')
        .eq('metadata->>userId', user.id)
        .limit(1)
        .maybeSingle();

      if (identity?.did) {
        query = query.eq('subject_did', identity.did);
      }
      query = query.eq('status', 'active');
    } else if (activeRole === 'issuer') {
      // Issuer sees credentials they issued (via org DID)
      const orgDid = await getOrganizationDid(admin, user.id);
      if (orgDid) {
        query = query.eq('issuer_did', orgDid);
      } else {
        // Fallback to personal DID
        const { data: identity } = await admin
          .from('identities')
          .select('did')
          .eq('metadata->>userId', user.id)
          .limit(1)
          .maybeSingle();
        if (identity?.did) {
          query = query.eq('issuer_did', identity.did);
        }
      }
      // Show all statuses (active + revoked) so issuer can see full history
    }

    query = query.order('created_at', { ascending: false });

    const { data: rows, error: fetchErr } = await query;

    if (fetchErr) {
      console.error('[v0] Error fetching credentials:', fetchErr);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch credentials' },
        { status: 500 }
      );
    }

    const credentials = (rows || []).map((row: any) => {
      const base = row.credential_json || {
        id: row.credential_id,
        type: row.credential_type,
        issuer: row.issuer_did,
        issuanceDate: row.issuance_date,
        expirationDate: row.expiration_date || undefined,
        credentialSubject: row.credential_subject,
        proof: row.proof,
      };
      base._status = row.status || 'active';
      base._credentialId = row.credential_id;
      base._subjectDid = row.subject_did;
      if (!base._issuerName && row.credential_json?._issuerName) {
        base._issuerName = row.credential_json._issuerName;
      }
      return base;
    });

    console.log('[v0] Fetched credentials for user:', { userId: user.id, role: activeRole, count: credentials.length });

    return NextResponse.json({
      success: true,
      data: credentials,
    });
  } catch (error) {
    console.error('[v0] Get credentials error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch credentials' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/credentials
 * Issue a new credential (issuer only)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const activeRole = (request.headers.get('x-active-role') as any) || 'issuer';

    // Check issuer role
    if (activeRole !== 'issuer') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Only issuers can issue credentials' },
        { status: 403 }
      );
    }

    const hasPermission = RBACService.getRolePermissions(activeRole).includes('credential:issue');
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: No permission to issue credentials' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { subjectDid, credentialType, claims, expirationDays } = body;

    if (!subjectDid || !credentialType) {
      return NextResponse.json(
        { success: false, error: 'Validation error: subjectDid and credentialType are required' },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const orgIdentity = await getOrganizationIdentity(admin, user.id);
    if (!orgIdentity?.did || !orgIdentity?.privateKeyHex) {
      return NextResponse.json(
        {
          success: false,
          error:
            'No issuer organization identity found. Visit Issuer > Organization to initialize your organization DID.',
        },
        { status: 400 }
      );
    }

    const issuerDid = orgIdentity.did;
    const issuerPrivateKey = orgIdentity.privateKeyHex;

    // Create verifiable credential (signed)
    const issuanceDate = new Date();

    const credential = VerificationService.createVerifiableCredential(
      issuerDid,
      subjectDid,
      Array.isArray(credentialType) ? String(credentialType[credentialType.length - 1]) : String(credentialType),
      (claims || {}) as Record<string, unknown>,
      issuerPrivateKey,
      expirationDays || 365
    );

    // Look up issuer organization name to embed in credential metadata
    const orgRow = await findUserOrganization(admin, user.id);
    const issuerName = orgRow?.name || null;

    // Attach org name as non-standard metadata (does NOT affect signature)
    const credentialWithMeta = { ...credential, _issuerName: issuerName } as any;

    // === DUAL-WRITE PATTERN ===
    // 1. Hash credential for blockchain anchoring (uses original signed credential)
    const credentialHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(credential)));
    console.log('[v0] Credential hash created:', credentialHash.slice(0, 16));

    // 2. Save to Supabase (fast, queryable)
    const { data: row, error: saveError } = await admin
      .from('verifiable_credentials')
      .upsert(
        {
          credential_id: (credential as any).id,
          issuer_did: (credential as any).issuer,
          subject_did: (credential as any).credentialSubject?.id || '',
          credential_type: (credential as any).type,
          issuance_date: new Date((credential as any).issuanceDate).toISOString(),
          expiration_date: (credential as any).expirationDate
            ? new Date((credential as any).expirationDate).toISOString()
            : null,
          credential_subject: (credential as any).credentialSubject,
          proof: (credential as any).proof,
          credential_json: credentialWithMeta,
          status: 'active',
          blockchain_hash: null,
        },
        { onConflict: 'credential_id' }
      )
      .select()
      .single();

    const savedCredential = !saveError && row ? (SupabaseRepository as any).mapCredentialFromDB(row) : null;
    
    if (!savedCredential) {
      return NextResponse.json(
        { success: false, error: (saveError as any)?.message || 'Failed to persist credential to database' },
        { status: 500 }
      );
    }

    console.log('[v0] Credential saved to Supabase:', { credentialId: savedCredential.id, type: credentialType });

    // 3. Anchor to blockchain (immutable, verifiable)
    let blockchainTx = null;
    try {
      blockchainTx = await BlockchainService.issueCredentialOnChain(
        credentialHash,
        issuerDid,
        subjectDid,
        expirationDays || 365
      );
      
      console.log('[v0] Credential anchored to blockchain:', { 
        hash: credentialHash.slice(0, 16),
        tx: blockchainTx.hash.slice(0, 16),
        network: 'Sepolia'
      });
    } catch (blockchainError) {
      console.warn('[v0] Blockchain anchoring failed (non-blocking):', blockchainError);
      // Don't fail the entire operation if blockchain write fails
      // The credential is still valid in Supabase
    }

    // 4. Write audit log
    await admin.from("audit_logs").insert({
      actor_did: issuerDid,
      action: "credential_issued",
      resource_id: (credential as any).id || savedCredential.id,
      resource_type: "credential",
      status: "success",
      details: {
        credentialType,
        subjectDid,
        blockchainAnchored: !!blockchainTx,
        issuedAt: new Date().toISOString(),
      },
    }).then(({ error: auditErr }) => {
      if (auditErr) console.error("[v0] Failed to write audit log:", auditErr);
    });

    // 5. Return with both references
    return NextResponse.json(
      {
        success: true,
        data: {
          ...savedCredential,
          blockchain: blockchainTx ? {
            transactionHash: blockchainTx.hash,
            credentialHash: credentialHash,
            chainId: blockchainTx.chainId,
            network: 'Sepolia',
            status: blockchainTx.status,
            explorer: BlockchainService.getTransactionURL(blockchainTx.hash),
          } : null,
        },
        message: 'Credential issued and persisted (Supabase + ' + (blockchainTx ? 'Blockchain)' : 'Blockchain pending)'),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[v0] Issue credential error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to issue credential' },
      { status: 500 }
    );
  }
}
