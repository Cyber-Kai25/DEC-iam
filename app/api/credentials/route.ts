import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/middleware/auth';
import { RBACService } from '@/lib/services/rbac-service';
import VerificationService from '@/lib/services/verification-service';
import SupabaseRepository from '@/lib/services/supabase-repository';
import BlockchainService from '@/lib/services/blockchain-service';
import { ethers } from 'ethers';

/**
 * GET /api/credentials
 * List credentials from Supabase (varies by role)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);

    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check permission
    const hasPermission = RBACService.getRolePermissions(auth.activeRole).includes('credential:read');
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: No permission to read credentials' },
        { status: 403 }
      );
    }

    // Fetch credentials from Supabase (role-specific)
    const credentials = await SupabaseRepository.getCredentials(auth.userId, auth.activeRole);

    console.log('[v0] Fetched credentials for user:', { userId: auth.userId, role: auth.activeRole, count: credentials.length });

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
    const auth = await getAuthContext(request);

    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check issuer role
    if (auth.activeRole !== 'issuer') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Only issuers can issue credentials' },
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

    // Create verifiable credential
    const issuanceDate = new Date();
    const expirationDate = new Date(issuanceDate.getTime() + (expirationDays || 365) * 24 * 60 * 60 * 1000);
    
    const credential = {
      "@context": ["https://www.w3.org/2018/credentials/v1"],
      id: `cred_${Date.now()}`,
      type: Array.isArray(credentialType)
        ? credentialType
        : ["VerifiableCredential", credentialType],
      issuer: `did:ethr:11155111:${auth.userId}`,
      issuanceDate: issuanceDate.toISOString(),
      expirationDate: expirationDate.toISOString(),
      credentialSubject: {
        id: subjectDid,
        ...claims,
      },
      proof: {
        type: 'Ed25519Signature2018',
        created: issuanceDate.toISOString(),
        verificationMethod: `did:ethr:11155111:${auth.userId}#key-1`,
      },
    };

    // === DUAL-WRITE PATTERN ===
    // 1. Hash credential for blockchain anchoring
    const credentialHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(credential)));
    console.log('[v0] Credential hash created:', credentialHash.slice(0, 16));

    // 2. Save to Supabase (fast, queryable)
    const savedCredential = await SupabaseRepository.saveCredential(credential, auth.userId);
    
    if (!savedCredential) {
      return NextResponse.json(
        { success: false, error: 'Failed to persist credential to database' },
        { status: 500 }
      );
    }

    console.log('[v0] Credential saved to Supabase:', { credentialId: savedCredential.id, type: credentialType });

    // 3. Anchor to blockchain (immutable, verifiable)
    let blockchainTx = null;
    try {
      blockchainTx = await BlockchainService.issueCredentialOnChain(
        credentialHash,
        auth.userId,
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
