// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./utils/AccessManager.sol";

/**
 * @title EHRStorage
 * @author mediCaRE DAO
 * @notice Electronic Health Record (EHR) storage contract that keeps hashed
 *         pointers (IPFS CIDs) for patient records on-chain while the actual
 *         data lives off-chain. Patients retain full sovereignty over who may
 *         access their records.
 *
 * @dev Architecture decisions:
 *      - Record content is never stored on-chain; only IPFS CID hashes and
 *        optional AI-summary hashes are persisted.
 *      - Access control is two-tiered:
 *          1. Role-based (OpenZeppelin `AccessControl`): ADMIN and PROVIDER roles
 *             gate administrative and clinical write operations.
 *          2. Patient-level: patients explicitly grant / revoke access per provider.
 *      - World ID verification can be enforced for sensitive write paths via the
 *        inherited {AccessManager}.
 */
contract EHRStorage is AccessControl, AccessManager {
    // ──────────────────────────────────────────────
    //  Constants & Roles
    // ──────────────────────────────────────────────

    /// @notice Role identifier for platform administrators.
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    /// @notice Role identifier for healthcare providers.
    bytes32 public constant PROVIDER_ROLE = keccak256("PROVIDER_ROLE");

    // ──────────────────────────────────────────────
    //  Data Structures
    // ──────────────────────────────────────────────

    /**
     * @notice Represents a single health record pointer.
     * @param recordId         Unique numeric identifier for the record.
     * @param patient          Address of the patient who owns the record.
     * @param ipfsCidHash      Keccak-256 hash of the IPFS CID where the encrypted
     *                         record payload is stored.
     * @param aiSummaryHash    Keccak-256 hash of the AI-generated clinical summary
     *                         (can be `bytes32(0)` if not yet generated).
     * @param recordType       Arbitrary label (e.g. "LAB", "IMAGING", "PRESCRIPTION").
     * @param createdAt        Block timestamp when the record was first added.
     * @param updatedAt        Block timestamp of the most recent update.
     * @param isActive         Soft-delete flag (inactive records are archived).
     */
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
    //  State
    // ──────────────────────────────────────────────

    /// @notice Auto-incrementing record identifier.
    uint256 private _nextRecordId;

    /// @notice recordId ⇒ Record.
    mapping(uint256 => Record) private _records;

    /// @notice patient address ⇒ array of record IDs owned by that patient.
    mapping(address => uint256[]) private _patientRecordIds;

    /// @notice patient ⇒ provider ⇒ access granted?
    mapping(address => mapping(address => bool)) private _accessPermissions;

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

    /// @notice Thrown when a caller attempts to access a record they are not authorized for.
    error Unauthorized(address caller, uint256 recordId);

    /// @notice Thrown when referencing a record that does not exist.
    error RecordNotFound(uint256 recordId);

    /// @notice Thrown when an invalid (zero-hash) IPFS CID is supplied.
    error InvalidCidHash();

    /// @notice Thrown when an invalid address is supplied (e.g. zero address).
    error InvalidAddress();

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────

    /**
     * @notice Deploy the EHRStorage contract.
     * @param admin            The initial platform administrator address.
     * @param worldIdVerifier  Address of the World ID verifier contract (can be
     *                         `address(0)` to disable identity checks initially).
     */
    constructor(address admin, address worldIdVerifier) {
        if (admin == address(0)) revert InvalidAddress();

        // Set up role hierarchy — admins can manage providers.
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _setRoleAdmin(PROVIDER_ROLE, ADMIN_ROLE);

        // World ID integration
        _setWorldIdVerifier(worldIdVerifier);
    }

    // ──────────────────────────────────────────────
    //  Modifiers
    // ──────────────────────────────────────────────

    /// @dev Ensure the caller is either the patient who owns the record or
    ///      a provider that has been granted access by the patient.
    modifier onlyAuthorized(uint256 recordId) {
        Record storage r = _records[recordId];
        if (r.createdAt == 0) revert RecordNotFound(recordId);
        if (
            msg.sender != r.patient &&
            !_accessPermissions[r.patient][msg.sender]
        ) {
            revert Unauthorized(msg.sender, recordId);
        }
        _;
    }

    // ──────────────────────────────────────────────
    //  Write Functions
    // ──────────────────────────────────────────────

    /**
     * @notice Store a new health record pointer for a patient.
     * @dev Only addresses with `PROVIDER_ROLE` may call this. The patient
     *      must have previously granted the provider access, OR the provider
     *      is acting on behalf of the patient (patient == msg.sender).
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
    )
        external
        onlyRole(PROVIDER_ROLE)
        returns (uint256 recordId)
    {
        if (patient == address(0)) revert InvalidAddress();
        if (ipfsCidHash == bytes32(0)) revert InvalidCidHash();

        // Provider must have patient's consent (or be the patient themselves).
        if (msg.sender != patient && !_accessPermissions[patient][msg.sender]) {
            revert Unauthorized(msg.sender, 0);
        }

        recordId = _nextRecordId++;
        _records[recordId] = Record({
            recordId: recordId,
            patient: patient,
            ipfsCidHash: ipfsCidHash,
            aiSummaryHash: aiSummaryHash,
            recordType: recordType,
            createdAt: block.timestamp,
            updatedAt: block.timestamp,
            isActive: true
        });
        _patientRecordIds[patient].push(recordId);

        emit RecordCreated(recordId, patient, ipfsCidHash, recordType, block.timestamp);
    }

    /**
     * @notice Update an existing record's IPFS CID and/or AI summary hashes.
     * @dev Caller must be authorized (patient or granted provider).
     * @param recordId      The record to update.
     * @param newIpfsCidHash New IPFS CID hash (must not be zero).
     * @param newAiSummaryHash New AI summary hash (use `bytes32(0)` to clear).
     */
    function updateRecord(
        uint256 recordId,
        bytes32 newIpfsCidHash,
        bytes32 newAiSummaryHash
    )
        external
        onlyAuthorized(recordId)
    {
        if (newIpfsCidHash == bytes32(0)) revert InvalidCidHash();

        Record storage r = _records[recordId];
        bytes32 oldHash = r.ipfsCidHash;

        r.ipfsCidHash = newIpfsCidHash;
        r.aiSummaryHash = newAiSummaryHash;
        r.updatedAt = block.timestamp;

        emit RecordUpdated(recordId, oldHash, newIpfsCidHash, newAiSummaryHash, block.timestamp);
    }

    /**
     * @notice Patient grants a provider access to their records.
     * @param provider The provider address being granted access.
     */
    function grantAccess(address provider) external {
        if (provider == address(0)) revert InvalidAddress();
        _accessPermissions[msg.sender][provider] = true;
        emit AccessGranted(msg.sender, provider, block.timestamp);
    }

    /**
     * @notice Patient revokes a provider's access to their records.
     * @param provider The provider address whose access is being revoked.
     */
    function revokeAccess(address provider) external {
        if (provider == address(0)) revert InvalidAddress();
        _accessPermissions[msg.sender][provider] = false;
        emit AccessRevoked(msg.sender, provider, block.timestamp);
    }

    /**
     * @notice Deactivate (soft-delete) a record. Only the patient or an admin may do this.
     * @param recordId The record to deactivate.
     */
    function deactivateRecord(uint256 recordId) external {
        Record storage r = _records[recordId];
        if (r.createdAt == 0) revert RecordNotFound(recordId);
        if (msg.sender != r.patient && !hasRole(ADMIN_ROLE, msg.sender)) {
            revert Unauthorized(msg.sender, recordId);
        }
        r.isActive = false;
        emit RecordDeactivated(recordId, block.timestamp);
    }

    // ──────────────────────────────────────────────
    //  Admin Functions
    // ──────────────────────────────────────────────

    /**
     * @notice Update the World ID verifier address.
     * @param newVerifier The new verifier contract address.
     */
    function setWorldIdVerifier(address newVerifier) external onlyRole(ADMIN_ROLE) {
        _setWorldIdVerifier(newVerifier);
    }

    /**
     * @notice Register a new healthcare provider (grant PROVIDER_ROLE).
     * @param provider The address to register.
     */
    function registerProvider(address provider) external onlyRole(ADMIN_ROLE) {
        if (provider == address(0)) revert InvalidAddress();
        _grantRole(PROVIDER_ROLE, provider);
    }

    /**
     * @notice Remove a healthcare provider (revoke PROVIDER_ROLE).
     * @param provider The address to remove.
     */
    function removeProvider(address provider) external onlyRole(ADMIN_ROLE) {
        _revokeRole(PROVIDER_ROLE, provider);
    }

    // ──────────────────────────────────────────────
    //  View / Read Functions
    // ──────────────────────────────────────────────

    /**
     * @notice Retrieve a single record by its identifier.
     * @dev Caller must be authorized to view the record.
     * @param recordId The record ID to look up.
     * @return record The full Record struct.
     */
    function getRecord(uint256 recordId)
        external
        view
        onlyAuthorized(recordId)
        returns (Record memory record)
    {
        record = _records[recordId];
    }

    /**
     * @notice Retrieve all record IDs belonging to a patient.
     * @dev Caller must be the patient or a provider with access.
     * @param patient The patient address.
     * @return recordIds Array of record IDs.
     */
    function getPatientRecords(address patient)
        external
        view
        returns (uint256[] memory recordIds)
    {
        if (
            msg.sender != patient &&
            !_accessPermissions[patient][msg.sender] &&
            !hasRole(ADMIN_ROLE, msg.sender)
        ) {
            revert Unauthorized(msg.sender, 0);
        }
        recordIds = _patientRecordIds[patient];
    }

    /**
     * @notice Check whether a provider currently has access to a patient's records.
     * @param patient  The patient address.
     * @param provider The provider address.
     * @return hasAccess True if access is granted.
     */
    function checkAccess(address patient, address provider)
        external
        view
        returns (bool hasAccess)
    {
        hasAccess = _accessPermissions[patient][provider];
    }

    /**
     * @notice Return the total number of records created so far.
     * @return count The current record count.
     */
    function totalRecords() external view returns (uint256 count) {
        count = _nextRecordId;
    }

    // ──────────────────────────────────────────────
    //  ERC-165 Support
    // ──────────────────────────────────────────────

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
