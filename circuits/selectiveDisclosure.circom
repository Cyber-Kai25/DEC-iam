pragma circom 2.0.0;

include "circomlib/poseidon.circom";
include "circomlib/comparators.circom";

/**
 * Selective Disclosure Circuit
 * Proves that specific attributes of a credential are true
 * without revealing the other attributes
 * 
 * Use case: Prove you have a driver's license with valid address
 * without revealing your license number or full name
 */
template SelectiveDisclosure(numAttributes) {
  // Inputs (private)
  signal input secretKey;
  signal input attributes[numAttributes];
  
  // Inputs (public)
  signal input credentialHash;
  signal input attributeMask[numAttributes]; // 1 if attribute is revealed, 0 if hidden
  
  // Outputs
  signal output revealedAttributes[numAttributes];
  
  // Internal signals
  signal secretHash;
  
  // Verify credential ownership
  component poseidon = Poseidon(1);
  poseidon.inputs[0] <== secretKey;
  secretHash <== poseidon.out;
  
  // Constraint: Secret must hash to credential hash
  credentialHash === secretHash;
  
  // For each attribute, apply mask and output
  for (var i = 0; i < numAttributes; i++) {
    // If mask is 1, reveal the attribute; if 0, output 0
    revealedAttributes[i] <== attributes[i] * attributeMask[i];
  }
}

component main { public [credentialHash, attributeMask] } = SelectiveDisclosure(5);
