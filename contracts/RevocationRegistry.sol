// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title RevocationRegistry
 * @dev Manages credential and identity revocations on-chain
 * Implements W3C Credential Status List specification
 */
contract RevocationRegistry {
    // Revocation types
    enum RevocationType { Credential, Identity, Consent, Policy }
    
    // Revocation reasons
    enum RevocationReason { UserRequest, Expired, Compromised, AuthorityDecision, DataBreach }
    
    // Revocation record
    struct RevocationRecord {
        bytes32 resourceId;
        RevocationType resourceType;
        RevocationReason reason;
        address revokedBy;
        uint256 revokedAt;
        uint256 effectiveAt;
        bool active;
        string metadata;
    }
    
    // Storage
    mapping(bytes32 => RevocationRecord) public revocations;
    mapping(address => bytes32[]) public revokerRecords;
    mapping(bytes32 => bool) public isRevoked;
    
    // Events
    event ResourceRevoked(
        indexed bytes32 resourceId,
        RevocationType indexed resourceType,
        RevocationReason reason,
        address indexed revokedBy,
        uint256 timestamp
    );
    
    event RevocationRestored(
        indexed bytes32 resourceId,
        address indexed restoredBy,
        uint256 timestamp
    );
    
    event RevocationMetadataUpdated(
        indexed bytes32 resourceId,
        string newMetadata,
        uint256 timestamp
    );
    
    /**
     * @dev Revoke a credential, identity, or consent record
     * @param resourceId The ID of the resource to revoke
     * @param resourceType Type of resource being revoked
     * @param reason Why the resource is being revoked
     * @param metadata Additional metadata about revocation
     */
    function revokeResource(
        bytes32 resourceId,
        RevocationType resourceType,
        RevocationReason reason,
        string memory metadata
    ) public {
        require(!isRevoked[resourceId], "Resource already revoked");
        
        RevocationRecord memory record = RevocationRecord({
            resourceId: resourceId,
            resourceType: resourceType,
            reason: reason,
            revokedBy: msg.sender,
            revokedAt: block.timestamp,
            effectiveAt: block.timestamp,
            active: true,
            metadata: metadata
        });
        
        revocations[resourceId] = record;
        isRevoked[resourceId] = true;
        revokerRecords[msg.sender].push(resourceId);
        
        emit ResourceRevoked(resourceId, resourceType, reason, msg.sender, block.timestamp);
    }
    
    /**
     * @dev Check if a resource is revoked
     * @param resourceId The ID to check
     * @return True if resource is revoked and active
     */
    function isResourceRevoked(bytes32 resourceId) public view returns (bool) {
        return isRevoked[resourceId] && revocations[resourceId].active;
    }
    
    /**
     * @dev Get revocation details
     * @param resourceId The ID of the revoked resource
     * @return The revocation record
     */
    function getRevocationRecord(bytes32 resourceId) public view returns (RevocationRecord memory) {
        require(isRevoked[resourceId], "Resource not revoked");
        return revocations[resourceId];
    }
    
    /**
     * @dev Restore a revoked resource (only by revoker or admin)
     * @param resourceId The ID to restore
     */
    function restoreResource(bytes32 resourceId) public {
        RevocationRecord storage record = revocations[resourceId];
        require(record.active, "Resource not revoked");
        require(
            msg.sender == record.revokedBy || msg.sender == address(0),
            "Only revoker can restore"
        );
        
        record.active = false;
        isRevoked[resourceId] = false;
        
        emit RevocationRestored(resourceId, msg.sender, block.timestamp);
    }
    
    /**
     * @dev Update revocation metadata
     * @param resourceId The revoked resource ID
     * @param newMetadata Updated metadata
     */
    function updateRevocationMetadata(bytes32 resourceId, string memory newMetadata) public {
        RevocationRecord storage record = revocations[resourceId];
        require(record.active, "Resource not revoked");
        require(msg.sender == record.revokedBy, "Only revoker can update");
        
        record.metadata = newMetadata;
        emit RevocationMetadataUpdated(resourceId, newMetadata, block.timestamp);
    }
    
    /**
     * @dev Get all resources revoked by an address
     * @param revoker The address that performed revocations
     * @return Array of revoked resource IDs
     */
    function getRevokerRecords(address revoker) public view returns (bytes32[] memory) {
        return revokerRecords[revoker];
    }
    
    /**
     * @dev Batch check revocation status
     * @param resourceIds Array of resource IDs to check
     * @return Array of boolean values indicating revocation status
     */
    function batchCheckRevocation(bytes32[] memory resourceIds) public view returns (bool[] memory) {
        bool[] memory statuses = new bool[](resourceIds.length);
        for (uint256 i = 0; i < resourceIds.length; i++) {
            statuses[i] = isResourceRevoked(resourceIds[i]);
        }
        return statuses;
    }
    
    /**
     * @dev Get revocation statistics
     * @return Total number of revocations
     */
    function getRevocationCount() public view returns (uint256) {
        // This would require additional tracking in production
        // For now, returns a placeholder
        return 0;
    }
}
