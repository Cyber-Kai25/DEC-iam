/**
 * Blockchain Integration API Endpoints
 * POST /api/blockchain/issue-credential - Issue credential on-chain
 * POST /api/blockchain/revoke-credential - Revoke credential on-chain
 * GET /api/blockchain/verify-credential - Verify credential on-chain
 * GET /api/blockchain/resolve-did - Resolve DID from blockchain
 * POST /api/blockchain/register-did - Register DID on-chain
 * GET /api/blockchain/transaction-status - Get blockchain transaction status
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/middleware/auth";
import BlockchainService from "@/lib/services/blockchain-service";
import DIDResolutionService from "@/lib/services/did-resolution-service";
import { RBACService } from "@/lib/services/rbac-service";
import { ethers } from "ethers";
import crypto from "crypto";

// ===================== Helper Functions =====================

/**
 * Hash a credential object to create immutable proof
 */
function hashCredential(credential: Record<string, unknown>): string {
  const json = JSON.stringify(credential);
  return ethers.keccak256(ethers.toUtf8Bytes(json));
}

/**
 * Validate blockchain address
 */
function isValidAddress(address: string): boolean {
  try {
    ethers.getAddress(address);
    return true;
  } catch {
    return false;
  }
}

// ===================== API Endpoints =====================

/**
 * GET /api/blockchain/verify-credential
 * Verify if a credential exists and is valid on-chain
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);

    if (!auth.isAuthenticated) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const credentialHash = searchParams.get("hash");
    const action = searchParams.get("action");

    if (!credentialHash) {
      return NextResponse.json(
        { success: false, error: "credentialHash is required" },
        { status: 400 }
      );
    }

    // Check permissions
    const hasPermission = RBACService.getRolePermissions(auth.activeRole).includes(
      "credential:verify"
    );
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: "Forbidden: No permission to verify credentials" },
        { status: 403 }
      );
    }

    // Handle different verification actions
    if (action === "resolve-did") {
      // Resolve DID from blockchain
      const did = searchParams.get("did");
      if (!did) {
        return NextResponse.json(
          { success: false, error: "DID is required for resolve action" },
          { status: 400 }
        );
      }

      const resolution = await DIDResolutionService.resolveDID(did);
      return NextResponse.json({
        success: true,
        data: {
          did: resolution.did,
          document: resolution.didDocument,
          metadata: resolution.didDocumentMetadata,
          resolvedFrom: resolution.resolutionMetadata.location,
          resolutionTime: resolution.resolutionMetadata.duration,
        },
      });
    }

    // Default: Verify credential status
    const verification = await BlockchainService.verifyCredentialAnchored(credentialHash);

    return NextResponse.json({
      success: true,
      data: {
        credentialHash: credentialHash.slice(0, 16) + "...",
        isValid: verification.valid,
        issuer: verification.issuer,
        expiresAt: verification.expiresAt,
        verifiedOn: "Sepolia Testnet",
        timestamp: new Date(),
      },
    });
  } catch (error) {
    console.error("[v0] Blockchain verification error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to verify credential on blockchain" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/blockchain/issue-credential
 * Issue a credential on-chain
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);

    if (!auth.isAuthenticated) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Check permissions
    const hasPermission = RBACService.getRolePermissions(auth.activeRole).includes(
      "credential:issue"
    );
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: "Forbidden: No permission to issue credentials" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { credentialData, subjectAddress, expirationDays, credentialType } = body;

    // Validate input
    if (!credentialData) {
      return NextResponse.json(
        { success: false, error: "credentialData is required" },
        { status: 400 }
      );
    }

    if (!isValidAddress(subjectAddress)) {
      return NextResponse.json(
        { success: false, error: "Invalid subject address" },
        { status: 400 }
      );
    }

    // Step 1: Hash the credential
    const credentialHash = hashCredential(credentialData);
    console.log("[v0] Credential hash:", credentialHash.slice(0, 16));

    // Step 2: Create blockchain transaction for issuance
    const issuerAddress = auth.userId; // In production, would be actual wallet address
    const tx = await BlockchainService.issueCredentialOnChain(
      credentialHash,
      issuerAddress,
      subjectAddress,
      expirationDays || 365
    );

    // Step 3: Save blockchain reference
    const blockchainRef = {
      transactionHash: tx.hash,
      credentialHash,
      chainId: tx.chainId,
      network: "Sepolia",
      status: tx.status,
      timestamp: new Date(),
      type: credentialType || "Credential",
    };

    console.log("[v0] Credential issued on-chain:", {
      hash: credentialHash.slice(0, 16),
      tx: tx.hash.slice(0, 16),
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          credentialHash,
          blockchainTransaction: blockchainRef,
          message: "Credential issued and anchored on Sepolia blockchain",
          explorers: {
            etherscan: BlockchainService.getTransactionURL(tx.hash),
            address: BlockchainService.getAddressURL(issuerAddress),
          },
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[v0] Credential issuance error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to issue credential on blockchain" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/blockchain/revoke-credential
 * Revoke a credential on-chain
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);

    if (!auth.isAuthenticated) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Check permissions
    const hasPermission = RBACService.getRolePermissions(auth.activeRole).includes(
      "credential:revoke"
    );
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: "Forbidden: No permission to revoke credentials" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { credentialHash, reason } = body;

    if (!credentialHash) {
      return NextResponse.json(
        { success: false, error: "credentialHash is required" },
        { status: 400 }
      );
    }

    // Create revocation transaction
    const issuerAddress = auth.userId;
    const tx = await BlockchainService.revokeCredentialOnChain(
      credentialHash,
      issuerAddress
    );

    console.log("[v0] Credential revoked on-chain:", {
      hash: credentialHash.slice(0, 16),
      reason,
    });

    return NextResponse.json({
      success: true,
      data: {
        credentialHash: credentialHash.slice(0, 16) + "...",
        revocationTransaction: {
          hash: tx.hash,
          status: tx.status,
          reason,
        },
        message: "Credential revoked on blockchain",
        explorers: {
          etherscan: BlockchainService.getTransactionURL(tx.hash),
        },
      },
    });
  } catch (error) {
    console.error("[v0] Credential revocation error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to revoke credential on blockchain" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/blockchain/transaction-status
 * Check status of a blockchain transaction
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);

    if (!auth.isAuthenticated) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { transactionHash } = body;

    if (!transactionHash) {
      return NextResponse.json(
        { success: false, error: "transactionHash is required" },
        { status: 400 }
      );
    }

    // Get transaction status
    const tx = await BlockchainService.getTransactionStatus(transactionHash);

    if (!tx) {
      return NextResponse.json(
        { success: false, error: "Transaction not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        hash: tx.hash,
        status: tx.status,
        confirmations: tx.confirmations || 0,
        blockNumber: tx.blockNumber,
        from: tx.from,
        to: tx.to,
        gasLimit: tx.gasLimit,
        gasPrice: BlockchainService.formatGasPrice(tx.gasPrice),
        explorer: BlockchainService.getTransactionURL(tx.hash),
      },
    });
  } catch (error) {
    console.error("[v0] Transaction status error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get transaction status" },
      { status: 500 }
    );
  }
}
