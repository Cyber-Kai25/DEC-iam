import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/middleware/auth';
import { RBACService } from '@/lib/services/rbac-service';
import SupabaseRepository from '@/lib/services/supabase-repository';
import BlockchainService from '@/lib/services/blockchain-service';
import ProofGenerationHelper from '@/lib/services/proof-generation-helper';
import SelectiveDisclosureService, { CredentialAttribute } from '@/lib/services/selective-disclosure-service';
import { ethers } from 'ethers';

/**
 * POST /api/credentials/with-proof
 * Issue a credential with integrated ZK proof support
 * Credential can be verified using zero-knowledge proofs for privacy
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

    // Check permission
    const hasPermission = RBACService.getRolePermissions(auth.activeRole).includes('credential:create');
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: No permission to create credentials' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { 
      subjectDid, 
      credentialType, 
      claims, 
      attributes,
      expirationDays,
      enableZKProof 
    } = body;

    // Validation
    if (!subjectDid || !credentialType) {
      return NextResponse.json(
        { success: false, error: 'subjectDid and credentialType are required' },
        { status: 400 }
      );
    }

    console.log('[v0] Issuing credential with ZKP support:', {
      credentialType,
      enableZKProof,
      attributeCount: attributes?.length || 0,
    });

    // 1. Create base credential
    const issuanceDate = new Date();
    const expirationDate = new Date(issuanceDate.getTime() + (expirationDays || 365) * 24 * 60 * 60 * 1000);

    const credential = {
      "@context": ["https://www.w3.org/2018/credentials/v1"],
      id: `cred_${Date.now()}`,
      type: Array.isArray(credentialType) ? credentialType : ['VerifiableCredential', credentialType],
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

    // 2. Hash credential for blockchain
    const credentialHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(credential)));

    // 3. Save to Supabase
    const savedCredential = await SupabaseRepository.saveCredential(credential, auth.userId);

    if (!savedCredential) {
      return NextResponse.json(
        { success: false, error: 'Failed to persist credential to database' },
        { status: 500 }
      );
    }

    // 4. Anchor to blockchain
    let blockchainTx = null;
    try {
      blockchainTx = await BlockchainService.issueCredentialOnChain(
        credentialHash,
        auth.userId,
        subjectDid,
        expirationDays || 365
      );
    } catch (blockchainError) {
      console.warn('[v0] Blockchain anchoring failed:', blockchainError);
    }

    // 5. If ZKP enabled, prepare proof-enabled attributes
    let zkpMetadata = null;
    if (enableZKProof && attributes && Array.isArray(attributes)) {
      try {
        // Define attribute schema for selective disclosure
        const attributeObjects: CredentialAttribute[] = attributes.map((attr: any) => ({
          name: attr.name || attr,
          value: attr.value || '',
          sensitive: attr.sensitive || false,
          category: attr.category || 'other',
        }));

        const schema = SelectiveDisclosureService.defineAttributeSchema(
          credentialType,
          attributeObjects
        );

        // Create encryption/commitment for attributes
        const attributeCommitment = SelectiveDisclosureService.createAttributeCommitment(
          attributeObjects.reduce((acc, attr) => {
            acc[attr.name] = String(attr.value);
            return acc;
          }, {} as Record<string, string>)
        );

        zkpMetadata = {
          schemaId: ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(schema))),
          attributeCommitment: attributeCommitment.commitment,
          attributeLeaves: attributeCommitment.leaves,
          attributeCount: attributes.length,
          supportedProofTypes: ['ownership', 'selectiveDisclosure', 'ageVerification'],
        };

        console.log('[v0] ZKP metadata prepared:', {
          attributeCount: attributes.length,
          schemaId: attributeCommitment.commitment.slice(0, 16),
        });
      } catch (zkpError) {
        console.warn('[v0] ZKP preparation failed:', zkpError);
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          credential: savedCredential,
          blockchain: blockchainTx ? {
            transactionHash: blockchainTx.hash,
            credentialHash: credentialHash,
            chainId: blockchainTx.chainId,
            network: 'Sepolia',
            status: blockchainTx.status,
            explorer: BlockchainService.getTransactionURL(blockchainTx.hash),
          } : null,
          zkp: zkpMetadata ? {
            enabled: true,
            schemaId: zkpMetadata.schemaId,
            attributeCommitment: zkpMetadata.attributeCommitment,
            supportedProofTypes: zkpMetadata.supportedProofTypes,
            message: 'This credential supports zero-knowledge proofs for privacy-preserving verification',
          } : {
            enabled: false,
            message: 'ZKP not enabled for this credential',
          },
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[v0] Credential issuance with ZKP failed:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to issue credential with ZKP support' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/credentials/with-proof
 * List credentials with ZKP proof information
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
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const credentials = await SupabaseRepository.getCredentials(auth.userId, auth.activeRole);

    // Enhance credentials with ZKP information
    const credentialsWithProofInfo = credentials.map((cred: any) => ({
      ...cred,
      zkpEnabled: !!cred.zkpMetadata,
      supportedProofTypes: cred.zkpMetadata?.supportedProofTypes || [],
      canGenerateOwnershipProof: true,
      canGenerateSelectiveDisclosure: !!cred.attributes && cred.attributes.length > 0,
    }));

    console.log('[v0] Retrieved credentials with ZKP info:', {
      count: credentials.length,
      zkpEnabledCount: credentialsWithProofInfo.filter((c: any) => c.zkpEnabled).length,
    });

    return NextResponse.json({
      success: true,
      data: credentialsWithProofInfo,
    });
  } catch (error) {
    console.error('[v0] Failed to get credentials with proof info:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch credentials' },
      { status: 500 }
    );
  }
}
