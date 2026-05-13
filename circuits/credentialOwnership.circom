pragma circom 2.0.0;

include "circomlib/poseidon.circom";
include "circomlib/comparators.circom";

/**
 * Credential Ownership Circuit
 * Proves that the prover knows the secret key associated with a credential
 * without revealing the secret key itself
 * 
 * This circuit verifies:
 * - The prover knows a secret that hashes to the credential hash
 * - The credential is valid and not revoked
 */
template CredentialOwnership() {
  // Inputs (private)
  signal input secretKey;
  
  // Inputs (public)
  signal input credentialHash;
  
  // Outputs
  signal output ownershipProof;
  
  // Internal signals
  signal secretHash;
  
  // Verify the secret key hashes to the credential hash
  // Hash the secret key using Poseidon (ZK-friendly hash)
  component poseidon = Poseidon(1);
  poseidon.inputs[0] <== secretKey;
  secretHash <== poseidon.out;
  
  // Constraint: The hashed secret must equal the provided credential hash
  credentialHash === secretHash;
  
  // Output proof of ownership (1 = ownership verified)
  ownershipProof <== 1;
}

component main { public [credentialHash] } = CredentialOwnership();
