import { NextRequest, NextResponse } from 'next/server';
import { RBACService } from '@/lib/services/rbac-service';
import VerificationService from '@/lib/services/verification-service';
import SupabaseRepository from '@/lib/services/supabase-repository';
import BlockchainService from '@/lib/services/blockchain-service';
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrganizationIdentity } from '@/lib/services/organization-service';
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
    const hasPermission =
      activeRole === 'verifier'
        ? RBACService.getRolePermissions(activeRole).includes('credential:read:any')
        : RBACService.getRolePermissions(activeRole).includes('credential:read:own');
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: No permission to read credentials' },
        { status: 403 }
      );
    }

    // Fetch credentials from Supabase (role-specific)
    const credentials = await SupabaseRepository.getCredentials(user.id, activeRole);

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

    // === DUAL-WRITE PATTERN ===
    // 1. Hash credential for blockchain anchoring
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
          credential_json: credential as any,
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

    // 4. Return with both references
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
