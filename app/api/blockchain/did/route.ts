/**
 * DID Resolution API Endpoints
 * GET /api/blockchain/did?did=did:ethr:... - Resolve a DID
 * POST /api/blockchain/did - Register a new DID
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/middleware/auth";
import DIDResolutionService from "@/lib/services/did-resolution-service";
import BlockchainService from "@/lib/services/blockchain-service";
import DIDService from "@/lib/services/did-service";
import { RBACService } from "@/lib/services/rbac-service";

/**
 * GET /api/blockchain/did
 * Resolve a DID to its DID Document
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);

    if (!auth.isAuthenticated) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const did = searchParams.get("did");

    if (!did) {
      return NextResponse.json(
        { success: false, error: "did parameter is required" },
        { status: 400 }
      );
    }

    // Resolve DID
    const resolution = await DIDResolutionService.resolveDID(did);

    return NextResponse.json({
      success: true,
      data: {
        did: resolution.did,
        didDocument: resolution.didDocument,
        metadata: {
          created: resolution.didDocumentMetadata.created,
          updated: resolution.didDocumentMetadata.updated,
          active: resolution.didDocumentMetadata.active,
          revoked: resolution.didDocumentMetadata.revoked,
        },
        resolution: {
          location: resolution.resolutionMetadata.location,
          resolutionTime: `${resolution.resolutionMetadata.duration}ms`,
          retrieved: resolution.resolutionMetadata.retrieved,
        },
      },
    });
  } catch (error) {
    console.error("[v0] DID resolution error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to resolve DID",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/blockchain/did
 * Register a new DID on-chain
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);

    if (!auth.isAuthenticated) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Check permissions
    const hasPermission = RBACService.getRolePermissions(auth.activeRole).includes(
      "identity:create"
    );
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: "Forbidden: No permission to register DIDs" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, publicKey, metadata } = body;

    if (!publicKey) {
      return NextResponse.json(
        { success: false, error: "publicKey is required" },
        { status: 400 }
      );
    }

    // Create DID using DID Service
    const identity = DIDService.createIdentity(name);

    // Register on blockchain
    const txn = await BlockchainService.registerDID(
      identity.did,
      identity.publicKeyHex,
      auth.userId
    );

    console.log("[v0] DID registered on-chain:", {
      did: identity.did,
      tx: txn.hash.slice(0, 16),
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          did: identity.did,
          walletAddress: identity.walletAddress,
          didDocument: identity.didDocument,
          blockchainTransaction: {
            hash: txn.hash,
            status: txn.status,
            chainId: txn.chainId,
            network: "Sepolia",
          },
          explorer: BlockchainService.getTransactionURL(txn.hash),
          message: "DID registered on Sepolia blockchain",
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[v0] DID registration error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to register DID",
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/blockchain/did
 * Update a DID's public key
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);

    if (!auth.isAuthenticated) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { did, newPublicKey } = body;

    if (!did || !newPublicKey) {
      return NextResponse.json(
        { success: false, error: "did and newPublicKey are required" },
        { status: 400 }
      );
    }

    // Update on blockchain
    const txn = await BlockchainService.updateDID(did, newPublicKey, auth.userId);

    console.log("[v0] DID updated on-chain:", {
      did: did.slice(0, 20),
      tx: txn.hash.slice(0, 16),
    });

    return NextResponse.json({
      success: true,
      data: {
        did,
        blockchainTransaction: {
          hash: txn.hash,
          status: txn.status,
          message: "DID public key updated on blockchain",
        },
        explorer: BlockchainService.getTransactionURL(txn.hash),
      },
    });
  } catch (error) {
    console.error("[v0] DID update error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update DID",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/blockchain/did
 * Revoke a DID
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);

    if (!auth.isAuthenticated) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { did, reason } = body;

    if (!did) {
      return NextResponse.json(
        { success: false, error: "did is required" },
        { status: 400 }
      );
    }

    // Revoke on blockchain
    const txn = await BlockchainService.revokeDID(did, auth.userId);

    console.log("[v0] DID revoked on-chain:", {
      did: did.slice(0, 20),
      reason,
    });

    return NextResponse.json({
      success: true,
      data: {
        did: did.slice(0, 20) + "...",
        blockchainTransaction: {
          hash: txn.hash,
          status: txn.status,
          reason: reason || "No reason provided",
          message: "DID revoked on blockchain",
        },
        explorer: BlockchainService.getTransactionURL(txn.hash),
      },
    });
  } catch (error) {
    console.error("[v0] DID revocation error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to revoke DID",
      },
      { status: 500 }
    );
  }
}
