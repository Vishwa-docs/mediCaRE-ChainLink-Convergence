// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IEHRStorage
 * @author mediCaRE DAO
 * @notice Interface for the Electronic Health Record storage contract.
 * @dev Consuming contracts and off-chain integrations should code against
 *      this interface rather than the concrete {EHRStorage} implementation
 *      to facilitate upgrades and cross-chain message handling via CCIP.
 */
interface IEHRStorage {
    // ──────────────────────────────────────────────
    //  Data Structures
    // ──────────────────────────────────────────────

    /// @notice Represents a single health record pointer.
    struct Record {
        uint256 recordId;
        address patient;
        bytes32 ipfsCidHash;
        bytes32 aiSummaryHash;
        string  recordType;
        uint256 createdAt;
        uint256 updatedAt;
        bool    isActive;
    }

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    /// @notice Emitted when a new health record pointer is stored.
    event RecordCreated(
        uint256 indexed recordId,
        address indexed patient,
        bytes32 ipfsCidHash,
        string  recordType,
        uint256 timestamp
    );

    /// @notice Emitted when an existing record's hashes are updated.
    event RecordUpdated(
        uint256 indexed recordId,
        bytes32 oldIpfsCidHash,
        bytes32 newIpfsCidHash,
        bytes32 aiSummaryHash,
        uint256 timestamp
    );

    /// @notice Emitted when a patient grants a provider access.
    event AccessGranted(address indexed patient, address indexed provider, uint256 timestamp);

    /// @notice Emitted when a patient revokes a provider's access.
    event AccessRevoked(address indexed patient, address indexed provider, uint256 timestamp);

    /// @notice Emitted when a record is deactivated (soft-deleted).
    event RecordDeactivated(uint256 indexed recordId, uint256 timestamp);

    // ──────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────

    error Unauthorized(address caller, uint256 recordId);
    error RecordNotFound(uint256 recordId);
    error InvalidCidHash();
    error InvalidAddress();

    // ──────────────────────────────────────────────
    //  Write Functions
    // ──────────────────────────────────────────────

    /**
     * @notice Store a new health record pointer for a patient.
     * @param patient       The patient's Ethereum address.
     * @param ipfsCidHash   Keccak-256 hash of the IPFS CID.
     * @param aiSummaryHash Hash of the AI-generated summary (use `bytes32(0)` if none).
     * @param recordType    Human-readable record category.
     * @return recordId     The newly assigned record identifier.
     */
    function addRecord(
        address patient,
        bytes32 ipfsCidHash,
        bytes32 aiSummaryHash,
        string calldata recordType
    ) external returns (uint256 recordId);

    /**
     * @notice Update an existing record's IPFS CID and/or AI summary hashes.
     * @param recordId         The record to update.
     * @param newIpfsCidHash   New IPFS CID hash (must not be zero).
     * @param newAiSummaryHash New AI summary hash (use `bytes32(0)` to clear).
     */
    function updateRecord(
        uint256 recordId,
        bytes32 newIpfsCidHash,
        bytes32 newAiSummaryHash
    ) external;

    /**
     * @notice Patient grants a provider access to their records.
     * @param provider The provider address being granted access.
     */
    function grantAccess(address provider) external;

    /**
     * @notice Patient revokes a provider's access to their records.
     * @param provider The provider address whose access is being revoked.
     */
    function revokeAccess(address provider) external;

    /**
     * @notice Deactivate (soft-delete) a record.
     * @param recordId The record to deactivate.
     */
    function deactivateRecord(uint256 recordId) external;

    // ──────────────────────────────────────────────
    //  Admin Functions
    // ──────────────────────────────────────────────

    /**
     * @notice Update the World ID verifier address.
     * @param newVerifier The new verifier contract address.
     */
    function setWorldIdVerifier(address newVerifier) external;

    /**
     * @notice Register a new healthcare provider.
     * @param provider The address to register.
     */
    function registerProvider(address provider) external;

    /**
     * @notice Remove a healthcare provider.
     * @param provider The address to remove.
     */
    function removeProvider(address provider) external;

    // ──────────────────────────────────────────────
    //  View / Read Functions
    // ──────────────────────────────────────────────

    /**
     * @notice Retrieve a single record by its identifier.
     * @param recordId The record ID to look up.
     * @return record The full Record struct.
     */
    function getRecord(uint256 recordId) external view returns (Record memory record);

    /**
     * @notice Retrieve all record IDs belonging to a patient.
     * @param patient The patient address.
     * @return recordIds Array of record IDs.
     */
    function getPatientRecords(address patient) external view returns (uint256[] memory recordIds);

    /**
     * @notice Check whether a provider has access to a patient's records.
     * @param patient  The patient address.
     * @param provider The provider address.
     * @return hasAccess True if access is granted.
     */
    function checkAccess(address patient, address provider) external view returns (bool hasAccess);

    /**
     * @notice Return the total number of records created so far.
     * @return count The current record count.
     */
    function totalRecords() external view returns (uint256 count);
}
