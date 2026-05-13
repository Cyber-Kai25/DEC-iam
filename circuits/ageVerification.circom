pragma circom 2.0.0;

include "circomlib/poseidon.circom";
include "circomlib/comparators.circom";
include "circomlib/gates.circom";

/**
 * Age Verification Circuit
 * Proves that the holder of a credential is over a certain age
 * without revealing their exact birth date
 * 
 * Use case: Verify someone is over 18 for age-restricted content
 * without knowing their actual age or DOB
 */
template AgeVerification() {
  // Inputs (private)
  signal input secretKey;
  signal input birthDate; // Unix timestamp
  
  // Inputs (public)
  signal input credentialHash;
  signal input currentTime; // Unix timestamp
  signal input minAgeSeconds; // 18 years in seconds = 568024800
  
  // Outputs
  signal output isOldEnough; // 1 = true, 0 = false
  
  // Internal signals
  signal ageSeconds;
  signal secretHash;
  
  // Verify credential ownership
  component poseidon = Poseidon(1);
  poseidon.inputs[0] <== secretKey;
  secretHash <== poseidon.out;
  
  // Constraint: Secret must hash to credential hash
  credentialHash === secretHash;
  
  // Calculate age in seconds
  ageSeconds <== currentTime - birthDate;
  
  // Check if age is >= minimum age
  // Using LessEqThan: returns 1 if minAgeSeconds <= ageSeconds
  component ageCheck = LessEqThan(32);
  ageCheck.in[0] <== minAgeSeconds;
  ageCheck.in[1] <== ageSeconds;
  
  // Output result
  isOldEnough <== ageCheck.out;
}

component main { public [credentialHash, currentTime, minAgeSeconds] } = AgeVerification();
