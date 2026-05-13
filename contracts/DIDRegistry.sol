// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title DIDRegistry
 * @dev Registry for Decentralized Identifiers (DIDs) on Ethereum
 * @notice Implements ERC-1056 Ethereum DID identity registry
 */

contract DIDRegistry {
    // ===================== State Variables =====================
    
    // DID Document structure
    struct DIDDocument {
        string did;                  // DID string (e.g., "did:ethr:11155111:0x...")
        address controller;          // Controller of the DID
        bytes publicKey;             // Public key in PEM or hex format
        uint256 created;             // Creation timestamp
        uint256 updated;             // Last update timestamp
        bool active;                 // Active/revoked status
        mapping(string => string) attributes;  // Additional attributes
    }

    // Storage
    mapping(string => DIDDocument) public didDocuments;
    mapping(address => string[]) public addressToDIDs;
    mapping(string => bool) public didExists;
    mapping(string => bool) public revokedDIDs;

    // Statistics
    uint256 public totalDIDsCreated;
    
    // ===================== Events =====================
    
    event DIDRegistered(
        indexed string did,
        indexed address controller,
        uint256 timestamp
    );

    event DIDUpdated(
        indexed string did,
        indexed address controller,
        uint256 timestamp
    );

    event DIDRevoked(
        indexed string did,
        indexed address controller,
        uint256 timestamp,
        string reason
    );

    event PublicKeyUpdated(
        indexed string did,
        indexed address controller,
        uint256 timestamp
    );

    // ===================== Modifiers =====================
    
    /**
     * @dev Ensures caller is the DID controller
     */
    modifier onlyDIDController(string memory did) {
        require(didDocuments[did].controller == msg.sender, "Only DID controller can perform this action");
        _;
    }

    /**
     * @dev Ensures DID exists
     */
    modifier didMustExist(string memory did) {
        require(didExists[did], "DID does not exist");
        _;
    }

    /**
     * @dev Ensures DID is active
     */
    modifier didMustBeActive(string memory did) {
        require(didExists[did], "DID does not exist");
        require(didDocuments[did].active, "DID is not active");
        require(!revokedDIDs[did], "DID has been revoked");
        _;
    }

    // ===================== Core Functions =====================
    
    /**
     * @dev Registers a new DID
     * @param did DID string
     * @param publicKey Public key bytes
     * @return success True if registration successful
     */
    function registerDID(
        string memory did,
        bytes memory publicKey
    ) public returns (bool success) {
        require(bytes(did).length > 0, "DID cannot be empty");
        require(publicKey.length > 0, "Public key cannot be empty");
        require(!didExists[did], "DID already exists");

        // Create DID document
        DIDDocument storage newDID = didDocuments[did];
        newDID.did = did;
        newDID.controller = msg.sender;
        newDID.publicKey = publicKey;
        newDID.created = block.timestamp;
        newDID.updated = block.timestamp;
        newDID.active = true;

        // Update mappings
        didExists[did] = true;
        addressToDIDs[msg.sender].push(did);
        totalDIDsCreated++;

        emit DIDRegistered(did, msg.sender, block.timestamp);
        return true;
    }

    /**
     * @dev Updates the public key for a DID
     * @param did DID string
     * @param newPublicKey New public key bytes
     * @return success True if update successful
     */
    function updatePublicKey(
        string memory did,
        bytes memory newPublicKey
    ) public didMustExist(did) onlyDIDController(did) returns (bool success) {
        require(newPublicKey.length > 0, "Public key cannot be empty");

        didDocuments[did].publicKey = newPublicKey;
        didDocuments[did].updated = block.timestamp;

        emit PublicKeyUpdated(did, msg.sender, block.timestamp);
        emit DIDUpdated(did, msg.sender, block.timestamp);
        return true;
    }

    /**
     * @dev Revokes a DID
     * @param did DID string
     * @param reason Reason for revocation
     * @return success True if revocation successful
     */
    function revokeDID(
        string memory did,
        string memory reason
    ) public didMustExist(did) onlyDIDController(did) returns (bool success) {
        require(!revokedDIDs[did], "DID already revoked");

        didDocuments[did].active = false;
        revokedDIDs[did] = true;
        didDocuments[did].updated = block.timestamp;

        emit DIDRevoked(did, msg.sender, block.timestamp, reason);
        return true;
    }

    /**
     * @dev Resolves a DID and returns its document
     * @param did DID string
     * @return did The DID identifier
     * @return controller The controller address
     * @return publicKey The public key
     * @return created Creation timestamp
     * @return updated Last update timestamp
     * @return active Active status
     */
    function resolveDID(string memory did)
        public
        view
        didMustExist(did)
        returns (
            string memory,
            address,
            bytes memory,
            uint256,
            uint256,
            bool
        )
    {
        DIDDocument storage doc = didDocuments[did];
        return (
            doc.did,
            doc.controller,
            doc.publicKey,
            doc.created,
            doc.updated,
            doc.active
        );
    }

    /**
     * @dev Checks if a DID is active
     * @param did DID string
     * @return True if DID is active
     */
    function isDIDActive(string memory did)
        public
        view
        returns (bool)
    {
        return didExists[did] && didDocuments[did].active && !revokedDIDs[did];
    }

    /**
     * @dev Checks if a DID has been revoked
     * @param did DID string
     * @return True if DID is revoked
     */
    function isDIDRevoked(string memory did)
        public
        view
        returns (bool)
    {
        return revokedDIDs[did];
    }

    /**
     * @dev Gets the controller of a DID
     * @param did DID string
     * @return Address of the DID controller
     */
    function getDIDController(string memory did)
        public
        view
        didMustExist(did)
        returns (address)
    {
        return didDocuments[did].controller;
    }

    /**
     * @dev Gets the public key of a DID
     * @param did DID string
     * @return Public key bytes
     */
    function getDIDPublicKey(string memory did)
        public
        view
        didMustExist(did)
        returns (bytes memory)
    {
        return didDocuments[did].publicKey;
    }

    /**
     * @dev Gets creation timestamp of a DID
     * @param did DID string
     * @return Creation timestamp
     */
    function getDIDCreated(string memory did)
        public
        view
        didMustExist(did)
        returns (uint256)
    {
        return didDocuments[did].created;
    }

    /**
     * @dev Gets last update timestamp of a DID
     * @param did DID string
     * @return Last update timestamp
     */
    function getDIDUpdated(string memory did)
        public
        view
        didMustExist(did)
        returns (uint256)
    {
        return didDocuments[did].updated;
    }

    // ===================== Query Functions =====================
    
    /**
     * @dev Gets all DIDs owned by an address
     * @param owner Address to query
     * @return Array of DID strings
     */
    function getAddressDIDs(address owner)
        public
        view
        returns (string[] memory)
    {
        return addressToDIDs[owner];
    }

    /**
     * @dev Gets count of DIDs owned by an address
     * @param owner Address to query
     * @return Number of DIDs
     */
    function getAddressDIDCount(address owner)
        public
        view
        returns (uint256)
    {
        return addressToDIDs[owner].length;
    }

    /**
     * @dev Gets a specific DID for an address by index
     * @param owner Address to query
     * @param index Index in the DID array
     * @return DID string at index
     */
    function getAddressDIDByIndex(address owner, uint256 index)
        public
        view
        returns (string memory)
    {
        require(index < addressToDIDs[owner].length, "Index out of bounds");
        return addressToDIDs[owner][index];
    }

    /**
     * @dev Attribute management - set a custom attribute
     * @param did DID string
     * @param key Attribute key
     * @param value Attribute value
     * @return success True if attribute set successfully
     */
    function setAttribute(
        string memory did,
        string memory key,
        string memory value
    ) public didMustExist(did) onlyDIDController(did) returns (bool success) {
        require(bytes(key).length > 0, "Key cannot be empty");
        require(bytes(value).length > 0, "Value cannot be empty");

        didDocuments[did].attributes[key] = value;
        didDocuments[did].updated = block.timestamp;

        emit DIDUpdated(did, msg.sender, block.timestamp);
        return true;
    }

    /**
     * @dev Gets a custom attribute
     * @param did DID string
     * @param key Attribute key
     * @return Attribute value
     */
    function getAttribute(string memory did, string memory key)
        public
        view
        didMustExist(did)
        returns (string memory)
    {
        return didDocuments[did].attributes[key];
    }

    // ===================== Statistics =====================
    
    /**
     * @dev Gets total number of DIDs created
     * @return Total DIDs
     */
    function getTotalDIDs() public view returns (uint256) {
        return totalDIDsCreated;
    }
}
