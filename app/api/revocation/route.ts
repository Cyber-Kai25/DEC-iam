// Revocation Registry API Endpoints
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/middleware/auth';
import { RBACService } from '@/lib/services/rbac-service';
import RevocationService from '@/lib/services/revocation-service';
import SupabaseRepository from '@/lib/services/supabase-repository';
import BlockchainService from '@/lib/services/blockchain-service';

/**
 * GET /api/revocation/check
 * Check if resource is revoked
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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const resourceId = searchParams.get('resourceId');
    const resourceType = searchParams.get('resourceType') || 'credential';

    if (!resourceId) {
      return NextResponse.json(
        { success: false, error: 'Missing resourceId parameter' },
        { status: 400 }
      );
    }

    // Fetch revocation registry from Supabase
    const revocationRegistry = await SupabaseRepository.getRevocationRegistry(auth.userId);

    if (!revocationRegistry) {
      return NextResponse.json({
        success: true,
        data: {
          resourceId,
          isRevoked: false,
          message: 'Resource is not revoked',
        },
      });
    }

    // Check revocation status
    const isRevoked = RevocationService.isResourceRevoked(revocationRegistry, resourceId);
    const details = RevocationService.getRevocationDetails(revocationRegistry, resourceId);

    console.log('[v0] Revocation check:', {
      resourceId: resourceId.slice(0, 16),
      isRevoked,
      resourceType,
    });

    return NextResponse.json({
      success: true,
      data: {
        resourceId,
        isRevoked,
        details: details || null,
      },
    });
  } catch (error) {
    console.error('[v0] Revocation check error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check revocation status' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/revocation
 * Revoke a credential or resource
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
    const hasPermission = RBACService.getRolePermissions(auth.activeRole).includes('credential:revoke');
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: No permission to revoke credentials' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { resourceId, resourceType, reason, metadata } = body;

    if (!resourceId || !resourceType) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: resourceId, resourceType' },
        { status: 400 }
      );
    }

    // Create revocation record
    const revocationRecord = RevocationService.createRevocationRecord(
      resourceId,
      resourceType,
      reason || 'user-request',
      auth.userId,
      metadata
    );

    // For credentials, also revoke on blockchain if issuer
    if (resourceType === 'credential' && auth.activeRole === 'issuer') {
      try {
        const blockchainTx = await BlockchainService.revokeCredentialOnChain(
          resourceId,
          auth.userId
        );
        revocationRecord.blockchainTxHash = blockchainTx.hash;

        console.log('[v0] Credential revoked on blockchain:', {
          resourceId: resourceId.slice(0, 16),
          txHash: blockchainTx.hash.slice(0, 16),
        });
      } catch (blockchainError) {
        console.warn('[v0] Blockchain revocation failed (non-blocking):', blockchainError);
        // Continue even if blockchain revocation fails
      }
    }

    // Save to Supabase
    const savedRevocation = await SupabaseRepository.saveRevocationRecord(revocationRecord) ?? revocationRecord;

    console.log('[v0] Resource revoked:', {
      resourceId: resourceId.slice(0, 16),
      resourceType,
      reason,
    });

    return NextResponse.json(
      {
        success: true,
        data: savedRevocation,
        message: 'Resource revoked successfully',
        blockchain: revocationRecord.blockchainTxHash ? {
          transactionHash: revocationRecord.blockchainTxHash,
          explorer: BlockchainService.getTransactionURL(revocationRecord.blockchainTxHash),
        } : null,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[v0] Revocation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to revoke resource' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/revocation/batch-check
 * Check revocation status for multiple resources
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);

    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { resourceIds } = body;

    if (!Array.isArray(resourceIds) || resourceIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid resourceIds array' },
        { status: 400 }
      );
    }

    // Fetch revocation registry
    const revocationRegistry = await SupabaseRepository.getRevocationRegistry(auth.userId);

    // Check batch revocation status
    const status = revocationRegistry
      ? RevocationService.batchCheckRevocationStatus(revocationRegistry, resourceIds)
      : resourceIds.reduce(
          (acc, id) => {
            acc[id] = false;
            return acc;
          },
          {} as Record<string, boolean>
        );

    console.log('[v0] Batch revocation check:', {
      count: resourceIds.length,
      revokedCount: Object.values(status).filter(Boolean).length,
    });

    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('[v0] Batch revocation check error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check revocation status' },
      { status: 500 }
    );
  }
}
