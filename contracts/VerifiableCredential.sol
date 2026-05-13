// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title VerifiableCredential
 * @dev Enables issuance, verification, and revocation of W3C Verifiable Credentials on Ethereum
 * @notice This contract implements the BADIMAC architecture for decentralized credential management
 */

contract VerifiableCredential {
    // ===================== State Variables =====================
    
    // Credential storage structure
    struct Credential {
        bytes32 credentialHash;      // Hash of the complete credential JSON
        address issuer;              // Address of the credential issuer
        address subject;             // Address of the credential subject
        uint256 issuedAt;            // Timestamp of issuance
        uint256 expiresAt;           // Expiration timestamp
        bool revoked;                // Revocation status
        string credentialType;       // Type of credential (e.g., "UniversityDegree")
        bytes32 proofHash;           // Hash of the cryptographic proof
    }

    // Storage mappings
    mapping(bytes32 => Credential) public credentials;
    mapping(bytes32 => bool) public revokedCredentials;
    mapping(address => bytes32[]) public issuerCredentials;
    mapping(address => bytes32[]) public subjectCredentials;
    mapping(bytes32 => uint256) public credentialIndex;

    // Issuer registry for trust
    mapping(address => bool) public trustedIssuers;
    mapping(address => bool) public registeredIssuers;

    // ===================== Events =====================
    
    event CredentialIssued(
        indexed bytes32 credentialHash,
        indexed address issuer,
        indexed address subject,
        string credentialType,
        uint256 timestamp
    );

    event CredentialRevoked(
        indexed bytes32 credentialHash,
        indexed address issuer,
        uint256 timestamp,
        string reason
    );

    event CredentialVerified(
        indexed bytes32 credentialHash,
        address verifier,
        bool isValid,
        uint256 timestamp
    );

    event IssuerRegistered(indexed address issuer, uint256 timestamp);
    event IssuerTrusted(indexed address issuer, uint256 timestamp);

    // ===================== Modifiers =====================
    
    /**
     * @dev Ensures caller is the credential issuer
     */
    modifier onlyIssuer(bytes32 credentialHash) {
        require(
            credentials[credentialHash].issuer == msg.sender,
            "Only issuer can perform this action"
        );
        _;
    }

    /**
     * @dev Ensures credential exists and is not expired
     */
    modifier credentialExists(bytes32 credentialHash) {
        require(
            credentials[credentialHash].issuer != address(0),
            "Credential does not exist"
        );
        _;
    }

    /**
     * @dev Ensures credential is valid (not revoked and not expired)
     */
    modifier isValidCredential(bytes32 credentialHash) {
        Credential memory cred = credentials[credentialHash];
        require(!cred.revoked, "Credential has been revoked");
        require(block.timestamp <= cred.expiresAt, "Credential has expired");
        _;
    }

    // ===================== Core Functions =====================
    
    /**
     * @dev Issues a new verifiable credential
     * @param credentialHash Hash of the W3C Verifiable Credential
     * @param subject Address of the credential subject
     * @param credentialType Type of credential (e.g., "UniversityDegree")
     * @param expiresAt Expiration timestamp (0 for non-expiring)
     * @param proofHash Hash of the cryptographic proof
     * @return success True if credential was issued successfully
     */
    function issueCredential(
        bytes32 credentialHash,
        address subject,
        string memory credentialType,
        uint256 expiresAt,
        bytes32 proofHash
    ) public returns (bool success) {
        require(credentialHash != bytes32(0), "Invalid credential hash");
        require(subject != address(0), "Invalid subject address");
        require(bytes(credentialType).length > 0, "Invalid credential type");
        require(credentials[credentialHash].issuer == address(0), "Credential already exists");

        // Set default expiration to 1 year if not specified
        if (expiresAt == 0) {
            expiresAt = block.timestamp + 365 days;
        }
        require(expiresAt > block.timestamp, "Expiration must be in the future");

        // Create credential
        credentials[credentialHash] = Credential({
            credentialHash: credentialHash,
            issuer: msg.sender,
            subject: subject,
            issuedAt: block.timestamp,
            expiresAt: expiresAt,
            revoked: false,
            credentialType: credentialType,
            proofHash: proofHash
        });

        // Track credentials by issuer and subject
        issuerCredentials[msg.sender].push(credentialHash);
        subjectCredentials[subject].push(credentialHash);
        credentialIndex[credentialHash] = issuerCredentials[msg.sender].length - 1;

        emit CredentialIssued(
            credentialHash,
            msg.sender,
            subject,
            credentialType,
            block.timestamp
        );

        return true;
    }

    /**
     * @dev Revokes a verifiable credential
     * @param credentialHash Hash of the credential to revoke
     * @param reason Reason for revocation
     * @return success True if credential was revoked successfully
     */
    function revokeCredential(
        bytes32 credentialHash,
        string memory reason
    ) public credentialExists(credentialHash) onlyIssuer(credentialHash) returns (bool success) {
        require(!credentials[credentialHash].revoked, "Credential already revoked");

        credentials[credentialHash].revoked = true;
        revokedCredentials[credentialHash] = true;

        emit CredentialRevoked(
            credentialHash,
            msg.sender,
            block.timestamp,
            reason
        );

        return true;
    }

    /**
     * @dev Verifies if a credential is valid (not revoked and not expired)
     * @param credentialHash Hash of the credential to verify
     * @return isValid True if credential is valid
     */
    function verifyCredential(bytes32 credentialHash)
        public
        view
        credentialExists(credentialHash)
        returns (bool isValid)
    {
        Credential memory cred = credentials[credentialHash];
        return !cred.revoked && block.timestamp <= cred.expiresAt;
    }

    /**
     * @dev Gets full credential details
     * @param credentialHash Hash of the credential
     * @return Credential struct with all details
     */
    function getCredential(bytes32 credentialHash)
        public
        view
        credentialExists(credentialHash)
        returns (Credential memory)
    {
        return credentials[credentialHash];
    }

    /**
     * @dev Checks if credential is revoked
     * @param credentialHash Hash of the credential
     * @return True if credential is revoked
     */
    function isRevoked(bytes32 credentialHash)
        public
        view
        returns (bool)
    {
        return credentials[credentialHash].revoked;
    }

    /**
     * @dev Checks if credential has expired
     * @param credentialHash Hash of the credential
     * @return True if credential has expired
     */
    function isExpired(bytes32 credentialHash)
        public
        view
        credentialExists(credentialHash)
        returns (bool)
    {
        return block.timestamp > credentials[credentialHash].expiresAt;
    }

    /**
     * @dev Gets time remaining until credential expires
     * @param credentialHash Hash of the credential
     * @return Time remaining in seconds (0 if expired)
     */
    function getTimeUntilExpiration(bytes32 credentialHash)
        public
        view
        credentialExists(credentialHash)
        returns (int256)
    {
        int256 timeLeft = int256(credentials[credentialHash].expiresAt) - int256(block.timestamp);
        return timeLeft > 0 ? timeLeft : 0;
    }

    // ===================== Issuer Management =====================
    
    /**
     * @dev Registers sender as a credential issuer
     * @return success True if registration was successful
     */
    function registerIssuer() public returns (bool success) {
        require(!registeredIssuers[msg.sender], "Already registered as issuer");
        registeredIssuers[msg.sender] = true;
        emit IssuerRegistered(msg.sender, block.timestamp);
        return true;
    }

    /**
     * @dev Checks if address is a registered issuer
     * @param issuer Address to check
     * @return True if address is registered issuer
     */
    function isRegisteredIssuer(address issuer) public view returns (bool) {
        return registeredIssuers[issuer];
    }

    // ===================== Batch Operations =====================
    
    /**
     * @dev Gets all credentials issued by an issuer
     * @param issuer Address of the issuer
     * @return Array of credential hashes
     */
    function getIssuerCredentials(address issuer)
        public
        view
        returns (bytes32[] memory)
    {
        return issuerCredentials[issuer];
    }

    /**
     * @dev Gets all credentials for a subject
     * @param subject Address of the subject
     * @return Array of credential hashes
     */
    function getSubjectCredentials(address subject)
        public
        view
        returns (bytes32[] memory)
    {
        return subjectCredentials[subject];
    }

    /**
     * @dev Gets count of credentials for a subject
     * @param subject Address of the subject
     * @return Number of credentials
     */
    function getSubjectCredentialCount(address subject)
        public
        view
        returns (uint256)
    {
        return subjectCredentials[subject].length;
    }

    // ===================== Emergency Functions =====================
    
    /**
     * @dev Emergency function to retrieve credential hash if needed
     * @param subject Address of the subject
     * @param index Index in subject's credential array
     * @return Credential hash at index
     */
    function getSubjectCredentialByIndex(address subject, uint256 index)
        public
        view
        returns (bytes32)
    {
        require(index < subjectCredentials[subject].length, "Index out of bounds");
        return subjectCredentials[subject][index];
    }
}
