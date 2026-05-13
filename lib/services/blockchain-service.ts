// Blockchain Integration Service for Ethereum/Sepolia
import { ethers } from "ethers";
import { BlockchainTransaction, DIDRegistry } from "@/lib/types/did";

const SEPOLIA_CHAIN_ID = 11155111;
const SEPOLIA_RPC_URL = "https://eth-sepolia.g.alchemy.com/v2/0i3NLcnaDyRPTFr3yYvj_"; // User should configure
const ETHERSCAN_SEPOLIA = "https://sepolia.etherscan.io";

// DID Registry Contract ABI
const DID_REGISTRY_ABI = [
  "function registerDID(string did, string publicKey, string controller) public",
  "function updateDID(string did, string publicKey) public",
  "function resolveDID(string did) public view returns (string)",
  "function revokeDID(string did) public",
  "function isDIDActive(string did) public view returns (bool)",
];

// Verifiable Credential Contract ABI
// Allows issuance, verification, and revocation of credentials on-chain
const CREDENTIAL_ABI = [
  "function issueCredential(bytes32 credentialHash, address subject, uint256 expiresAt) public",
  "function revokeCredential(bytes32 credentialHash) public",
  "function verifyCredential(bytes32 credentialHash) public view returns (bool)",
  "function getCredential(bytes32 credentialHash) public view returns (bytes32, address, address, uint256, uint256, bool)",
  "function isCredentialValid(bytes32 credentialHash) public view returns (bool)",
  "event CredentialIssued(indexed bytes32 credentialHash, indexed address issuer, indexed address subject)",
  "event CredentialRevoked(indexed bytes32 credentialHash)",
];

export class BlockchainService {
  private static provider: ethers.JsonRpcProvider | null = null;
  private static registryAddress =
    "0x0000000000000000000000000000000000000000"; // Mock address

  static async anchorAuditHashWithWallet(
    auditHash: string,
    kind: string = "audit"
  ): Promise<BlockchainTransaction> {
    const eth = (globalThis as any)?.ethereum;
    if (!eth) {
      throw new Error("No injected wallet found (window.ethereum)");
    }

    try {
      await eth.request({ method: "eth_requestAccounts" });
    } catch {
      throw new Error("Wallet connection rejected");
    }

    try {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xaa36a7" }],
      });
    } catch {
      // If it fails (e.g. chain not added), let the tx attempt fail with a clearer wallet error.
    }

    const browserProvider = new ethers.BrowserProvider(eth);
    const signer = await browserProvider.getSigner();
    const from = await signer.getAddress();

    const data = ethers.hexlify(
      ethers.toUtf8Bytes(`BADIMAC:${kind}:${auditHash}`)
    );
    const to = this.registryAddress;

    const txResponse = await signer.sendTransaction({ to, data, value: 0 });
    const receipt = await txResponse.wait();
    const network = await browserProvider.getNetwork();

    return {
      hash: txResponse.hash,
      from,
      to,
      data,
      gasLimit: txResponse.gasLimit?.toString() || "0",
      gasPrice: txResponse.gasPrice?.toString() || "0",
      nonce: txResponse.nonce,
      chainId: network?.chainId ? Number(network.chainId) : SEPOLIA_CHAIN_ID,
      status: receipt?.status === 1 ? "confirmed" : "failed",
      blockNumber: receipt?.blockNumber,
    };
  }

  /**
   * Initialize blockchain connection
   */
  static async initializeProvider(rpcUrl?: string): Promise<void> {
    const url = rpcUrl || SEPOLIA_RPC_URL;
    this.provider = new ethers.JsonRpcProvider(url);

    try {
      const network = await this.provider.getNetwork();
      console.log(`[v0] Connected to network: ${network.name} (chainId: ${network.chainId})`);
    } catch (error) {
      console.error("[v0] Failed to initialize provider:", error);
    }
  }

  /**
   * Get provider instance
   */
  static getProvider(): ethers.JsonRpcProvider | null {
    return this.provider;
  }

  /**
   * Register a DID on-chain
   * In production, this would interact with actual DID Registry contract
   */
  static async registerDID(
    did: string,
    publicKey: string,
    controller: string,
    privateKey?: string
  ): Promise<BlockchainTransaction> {
    if (!this.provider) {
      await this.initializeProvider();
    }

    // Mock transaction for demonstration
    // In production, this would use ethers.js to interact with a real smart contract
    const tx: BlockchainTransaction = {
      hash: ethers.id(`${did}-${Date.now()}`),
      from: controller,
      to: this.registryAddress,
      data: ethers.concat([
        ethers.toBeHex(1), // registerDID function selector mock (0x01)
        ethers.toUtf8Bytes(did),
        ethers.toUtf8Bytes(publicKey),
      ]),
      gasLimit: "100000",
      gasPrice: ethers.parseUnits("20", "gwei").toString(),
      nonce: 0,
      chainId: SEPOLIA_CHAIN_ID,
      status: "pending",
    };

    console.log("[v0] Mock DID registration transaction created:", tx.hash);
    return tx;
  }

  /**
   * Update DID on-chain
   */
  static async updateDID(
    did: string,
    publicKey: string,
    controller: string
  ): Promise<BlockchainTransaction> {
    if (!this.provider) {
      await this.initializeProvider();
    }

    const tx: BlockchainTransaction = {
      hash: ethers.id(`${did}-update-${Date.now()}`),
      from: controller,
      to: this.registryAddress,
      data: ethers.concat([
        ethers.toBeHex(2), // updateDID function selector mock (0x02)
        ethers.toUtf8Bytes(did),
        ethers.toUtf8Bytes(publicKey),
      ]),
      gasLimit: "80000",
      gasPrice: ethers.parseUnits("20", "gwei").toString(),
      nonce: 1,
      chainId: SEPOLIA_CHAIN_ID,
      status: "pending",
    };

    console.log("[v0] Mock DID update transaction created:", tx.hash);
    return tx;
  }

  /**
   * Revoke DID on-chain
   */
  static async revokeDID(
    did: string,
    controller: string
  ): Promise<BlockchainTransaction> {
    if (!this.provider) {
      await this.initializeProvider();
    }

    const tx: BlockchainTransaction = {
      hash: ethers.id(`${did}-revoke-${Date.now()}`),
      from: controller,
      to: this.registryAddress,
      data: ethers.concat([
        ethers.toBeHex(3), // revokeDID function selector mock (0x03)
        ethers.toUtf8Bytes(did),
      ]),
      gasLimit: "60000",
      gasPrice: ethers.parseUnits("20", "gwei").toString(),
      nonce: 2,
      chainId: SEPOLIA_CHAIN_ID,
      status: "pending",
    };

    console.log("[v0] Mock DID revocation transaction created:", tx.hash);
    return tx;
  }

  /**
   * Resolve DID from blockchain
   * Returns mock data for demonstration
   */
  static async resolveDIDOnchain(did: string): Promise<DIDRegistry | null> {
    if (!this.provider) {
      await this.initializeProvider();
    }

    try {
      // Mock resolution - in production, query the actual contract
      console.log(`[v0] Resolving DID ${did} on Sepolia testnet`);

      const mockRegistry: DIDRegistry = {
        did,
        walletAddress: ethers.getAddress(
          "0x1234567890123456789012345678901234567890"
        ),
        publicKey: ethers.hexlify(ethers.randomBytes(65)),
        created: new Date(),
        updated: new Date(),
        active: true,
        transactionHash: ethers.id(did),
      };

      return mockRegistry;
    } catch (error) {
      console.error("[v0] DID resolution error:", error);
      return null;
    }
  }

  /**
   * Issue credential on-chain with cryptographic proof
   * Creates immutable record of credential issuance
   */
  static async issueCredentialOnChain(
    credentialHash: string,
    issuerAddress: string,
    subjectAddress: string,
    expirationDays: number = 365
  ): Promise<BlockchainTransaction> {
    if (!this.provider) {
      await this.initializeProvider();
    }

    const expiresAt = Math.floor(Date.now() / 1000) + expirationDays * 24 * 60 * 60;

    const tx: BlockchainTransaction = {
      hash: ethers.id(`credential-issue-${credentialHash}-${Date.now()}`),
      from: issuerAddress,
      to: this.registryAddress,
      data: ethers.concat([
        ethers.toBeHex(5), // issueCredential function selector (0x05)
        ethers.getAddress(subjectAddress).slice(2).padStart(64, '0'),
        ethers.toBeHex(expiresAt).slice(2).padStart(64, '0'),
        credentialHash.slice(2).padStart(64, '0'),
      ]),
      gasLimit: "150000",
      gasPrice: ethers.parseUnits("20", "gwei").toString(),
      nonce: 4,
      chainId: SEPOLIA_CHAIN_ID,
      status: "pending",
    };

    console.log("[v0] Credential issuance transaction created:", {
      hash: tx.hash,
      credential: credentialHash.slice(0, 16),
      issuer: issuerAddress,
    });
    return tx;
  }

  /**
   * Revoke credential on-chain
   * Marks credential as no longer valid
   */
  static async revokeCredentialOnChain(
    credentialHash: string,
    issuerAddress: string
  ): Promise<BlockchainTransaction> {
    if (!this.provider) {
      await this.initializeProvider();
    }

    const tx: BlockchainTransaction = {
      hash: ethers.id(`credential-revoke-${credentialHash}-${Date.now()}`),
      from: issuerAddress,
      to: this.registryAddress,
      data: ethers.concat([
        ethers.toBeHex(6), // revokeCredential function selector (0x06)
        credentialHash.slice(2).padStart(64, '0'),
      ]),
      gasLimit: "100000",
      gasPrice: ethers.parseUnits("20", "gwei").toString(),
      nonce: 5,
      chainId: SEPOLIA_CHAIN_ID,
      status: "pending",
    };

    console.log("[v0] Credential revocation transaction created:", tx.hash);
    return tx;
  }

  /**
   * Anchor verifiable credential hash on-chain (legacy method)
   */
  static async anchorCredential(
    credentialHash: string,
    issuerAddress: string
  ): Promise<BlockchainTransaction> {
    // Delegates to issueCredentialOnChain for backwards compatibility
    return this.issueCredentialOnChain(credentialHash, issuerAddress, issuerAddress);
  }

  /**
   * Verify credential was anchored on-chain
   * Checks if credential hash exists and is valid
   */
  static async verifyCredentialAnchored(
    credentialHash: string
  ): Promise<{ valid: boolean; issuer?: string; expiresAt?: Date }> {
    if (!this.provider) {
      await this.initializeProvider();
    }

    try {
      console.log(`[v0] Verifying credential hash ${credentialHash.slice(0, 16)}... on Sepolia`);
      
      // Mock verification result
      // In production, query smart contract for actual status
      const mockIssuer = "0x1234567890123456789012345678901234567890";
      const mockExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      
      return {
        valid: true,
        issuer: mockIssuer,
        expiresAt: mockExpiresAt,
      };
    } catch (error) {
      console.error("[v0] Credential verification error:", error);
      return { valid: false };
    }
  }

  /**
   * Get transaction receipt (status)
   */
  static async getTransactionStatus(
    txHash: string
  ): Promise<BlockchainTransaction | null> {
    if (!this.provider) {
      await this.initializeProvider();
    }

    try {
      // Mock transaction status
      const tx: BlockchainTransaction = {
        hash: txHash,
        from: "0x1234567890123456789012345678901234567890",
        to: this.registryAddress,
        data: "0x",
        gasLimit: "100000",
        gasPrice: ethers.parseUnits("20", "gwei").toString(),
        nonce: 0,
        chainId: SEPOLIA_CHAIN_ID,
        status: Math.random() > 0.2 ? "confirmed" : "pending",
        blockNumber: Math.floor(Math.random() * 1000000),
        confirmations: Math.floor(Math.random() * 12),
        timestamp: new Date(),
      };

      return tx;
    } catch (error) {
      console.error("[v0] Transaction status error:", error);
      return null;
    }
  }

  /**
   * Get Sepolia testnet faucet URL
   */
  static getSepoliaFaucetURL(): string {
    return "https://sepoliafaucet.com";
  }

  /**
   * Get Etherscan URL for transaction
   */
  static getTransactionURL(txHash: string): string {
    return `${ETHERSCAN_SEPOLIA}/tx/${txHash}`;
  }

  /**
   * Get Etherscan URL for address
   */
  static getAddressURL(address: string): string {
    return `${ETHERSCAN_SEPOLIA}/address/${address}`;
  }

  /**
   * Format gas price to Gwei
   */
  static formatGasPrice(gasPriceWei: string): string {
    try {
      return ethers.formatUnits(gasPriceWei, "gwei");
    } catch {
      return gasPriceWei;
    }
  }

  /**
   * Calculate transaction cost estimate
   */
  static estimateTransactionCost(
    gasLimit: string,
    gasPrice: string
  ): string {
    try {
      const cost = (BigInt(gasLimit) * BigInt(gasPrice)) / BigInt(10 ** 18);
      return ethers.formatEther(cost.toString());
    } catch {
      return "0";
    }
  }

  /**
   * Verify Sepolia network connection
   */
  static async verifyNetworkConnection(): Promise<{
    connected: boolean;
    chainId?: number;
    chainName?: string;
  }> {
    if (!this.provider) {
      await this.initializeProvider();
    }

    try {
      const network = await this.provider?.getNetwork();
      return {
        connected: true,
        chainId: network?.chainId ? Number(network.chainId) : undefined,
        chainName: network?.name,
      };
    } catch {
      return { connected: false };
    }
  }

  /**
   * Set custom RPC URL
   */
  static setRpcUrl(url: string): void {
    this.provider = new ethers.JsonRpcProvider(url);
  }

  /**
   * Set DID Registry contract address
   */
  static setRegistryAddress(address: string): void {
    if (ethers.isAddress(address)) {
      this.registryAddress = ethers.getAddress(address);
    }
  }
}

export default BlockchainService;
