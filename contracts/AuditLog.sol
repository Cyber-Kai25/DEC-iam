// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title AuditLog
 * @dev Immutable on-chain audit log for BADIMAC system
 * Records all critical operations: credential issuance, revocation, consent changes, policy updates
 */
contract AuditLog {
    // Event types
    enum EventType {
        CredentialIssued,
        CredentialRevoked,
        CredentialVerified,
        IdentityCreated,
        IdentityUpdated,
        IdentityRevoked,
        ConsentGiven,
        ConsentRevoked,
        ConsentDenied,
        PolicyCreated,
        PolicyUpdated,
        PolicyRevoked,
        DataAccessed,
        DataShared,
        DataDeleted,
        KeyRotated,
        BackupCreated,
        SystemEvent
    }

    // Audit entry structure
    struct AuditEntry {
        uint256 id;
        EventType eventType;
        address actor;
        bytes32 resourceId;
        bytes32 dataHash;
        uint256 timestamp;
        string reason;
        bytes metadata;
    }

    // State variables
    AuditEntry[] public auditLog;
    mapping(bytes32 => uint256[]) public resourceAuditIndex; // resourceId => entryIds
    mapping(address => uint256[]) public actorAuditIndex; // actor => entryIds
    mapping(uint256 => bool) public isValidEntry; // entry id => validity

    uint256 public entryCount;
    address public owner;
    bool public locked = false; // Can be locked for immutability

    // Events
    event AuditEntryCreated(
        uint256 indexed entryId,
        EventType indexed eventType,
        address indexed actor,
        bytes32 resourceId,
        uint256 timestamp
    );

    event AuditLogLocked(uint256 timestamp);

    event EntryRevoked(uint256 indexed entryId, string reason);

    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }

    modifier notLocked() {
        require(!locked, "Audit log is locked and immutable");
        _;
    }

    constructor() {
        owner = msg.sender;
        entryCount = 0;
    }

    /**
     * @dev Record audit event to blockchain
     */
    function recordAudit(
        EventType _eventType,
        bytes32 _resourceId,
        bytes32 _dataHash,
        string memory _reason,
        bytes memory _metadata
    ) public notLocked {
        uint256 entryId = entryCount++;

        AuditEntry memory entry = AuditEntry({
            id: entryId,
            eventType: _eventType,
            actor: msg.sender,
            resourceId: _resourceId,
            dataHash: _dataHash,
            timestamp: block.timestamp,
            reason: _reason,
            metadata: _metadata
        });

        auditLog.push(entry);
        isValidEntry[entryId] = true;

        // Index for quick lookup
        resourceAuditIndex[_resourceId].push(entryId);
        actorAuditIndex[msg.sender].push(entryId);

        emit AuditEntryCreated(entryId, _eventType, msg.sender, _resourceId, block.timestamp);
    }

    /**
     * @dev Get total number of audit entries
     */
    function getEntryCount() public view returns (uint256) {
        return entryCount;
    }

    /**
     * @dev Get specific audit entry
     */
    function getEntry(uint256 _entryId) public view returns (AuditEntry memory) {
        require(_entryId < entryCount, "Invalid entry ID");
        return auditLog[_entryId];
    }

    /**
     * @dev Get audit entries for a resource
     */
    function getResourceAudit(bytes32 _resourceId) public view returns (uint256[] memory) {
        return resourceAuditIndex[_resourceId];
    }

    /**
     * @dev Get audit entries for an actor
     */
    function getActorAudit(address _actor) public view returns (uint256[] memory) {
        return actorAuditIndex[_actor];
    }

    /**
     * @dev Revoke an audit entry (marks as invalid but keeps immutable record)
     * @notice This records that an entry was revoked, maintains chain of custody
     */
    function revokeEntry(uint256 _entryId, string memory _reason) public onlyOwner notLocked {
        require(_entryId < entryCount, "Invalid entry ID");
        require(isValidEntry[_entryId], "Entry already revoked");

        isValidEntry[_entryId] = false;
        emit EntryRevoked(_entryId, _reason);
    }

    /**
     * @dev Check if entry is valid (not revoked)
     */
    function isEntryValid(uint256 _entryId) public view returns (bool) {
        require(_entryId < entryCount, "Invalid entry ID");
        return isValidEntry[_entryId];
    }

    /**
     * @dev Get entries in range (for pagination)
     */
    function getEntriesRange(uint256 _start, uint256 _end) public view returns (AuditEntry[] memory) {
        require(_start < _end && _end <= entryCount, "Invalid range");

        AuditEntry[] memory entries = new AuditEntry[](_end - _start);
        for (uint256 i = _start; i < _end; i++) {
            entries[i - _start] = auditLog[i];
        }
        return entries;
    }

    /**
     * @dev Lock audit log - prevents further entries and revocations
     * @notice Critical operation: once locked, log becomes immutable
     */
    function lockAuditLog() public onlyOwner {
        locked = true;
        emit AuditLogLocked(block.timestamp);
    }

    /**
     * @dev Verify entry authenticity using recorded data hash
     */
    function verifyEntry(
        uint256 _entryId,
        bytes memory _data,
        bytes32 _expectedHash
    ) public view returns (bool) {
        require(_entryId < entryCount, "Invalid entry ID");

        AuditEntry memory entry = auditLog[_entryId];
        bytes32 computedHash = keccak256(_data);
        
        return computedHash == entry.dataHash && entry.dataHash == _expectedHash;
    }

    /**
     * @dev Get audit log statistics
     */
    function getStatistics()
        public
        view
        returns (
            uint256 totalEntries,
            uint256 validEntries,
            uint256 revokedEntries,
            bool isLocked
        )
    {
        uint256 validCount = 0;
        for (uint256 i = 0; i < entryCount; i++) {
            if (isValidEntry[i]) {
                validCount++;
            }
        }

        return (entryCount, validCount, entryCount - validCount, locked);
    }

    /**
     * @dev Emergency function: revoke all entries by an actor (for compromised accounts)
     */
    function revokeActorEntries(address _actor, string memory _reason) public onlyOwner notLocked {
        uint256[] memory actorEntries = actorAuditIndex[_actor];
        for (uint256 i = 0; i < actorEntries.length; i++) {
            uint256 entryId = actorEntries[i];
            if (isValidEntry[entryId]) {
                isValidEntry[entryId] = false;
            }
        }
        emit AuditEntryCreated(
            entryCount++,
            EventType.SystemEvent,
            msg.sender,
            0,
            block.timestamp
        );
    }
}
