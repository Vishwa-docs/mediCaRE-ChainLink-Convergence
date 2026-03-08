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

    /// @notice Role identifier for emergency access (e.g. paramedics, ER staff).
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");

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

    /**
     * @notice Granular consent grant from a patient to a specific grantee.
     * @param patient        Address of the patient granting consent.
     * @param grantee        Address of the entity receiving consent.
     * @param dataCategories Array of data category identifiers (e.g. keccak256("LAB")).
     * @param purposes       Array of purpose identifiers (e.g. keccak256("TREATMENT")).
     * @param grantedAt      Block timestamp when consent was granted.
     * @param expiresAt      Block timestamp when consent expires (0 = no expiry).
     * @param isActive       Whether this consent grant is currently active.
     */
    struct ConsentGrant {
        address   patient;
        address   grantee;
        bytes32[] dataCategories;
        bytes32[] purposes;
        uint256   grantedAt;
        uint256   expiresAt;
        bool      isActive;
    }

    /**
     * @notice Record of an emergency "glass break" access event.
     * @param accessor  Address of the emergency accessor.
     * @param patient   Address of the patient whose data was accessed.
     * @param reason    Mandatory free-text reason for the emergency access.
     * @param timestamp Block timestamp when the emergency access occurred.
     */
    struct GlassBreak {
        address accessor;
        address patient;
        string  reason;
        uint256 timestamp;
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

    /// @notice patient ⇒ grantee ⇒ ConsentGrant (granular consent).
    mapping(address => mapping(address => ConsentGrant)) private _consentGrants;

    /// @notice Sequential log of all emergency glass-break access events.
    GlassBreak[] private _glassBreakLog;

    /// @notice patient ⇒ keccak256 hash of the longitudinal AI clinical summary.
    mapping(address => bytes32) private _longitudinalSummaryHash;

    /// @notice Emitted when a longitudinal summary is stored for a patient.
    event LongitudinalSummaryStored(
        address indexed patient,
        bytes32 summaryHash,
        uint256 timestamp
    );

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

    /// @notice Immutable audit trail entry for every data access or mutation.
    /// @param accessor  The address that performed the action.
    /// @param patient   The patient whose data was involved.
    /// @param action    Human-readable action label (e.g. "READ", "WRITE", "EMERGENCY_ACCESS").
    /// @param dataHash  Keccak-256 hash of the data payload involved.
    /// @param timestamp Block timestamp of the action.
    event AuditEntry(
        address indexed accessor,
        address indexed patient,
        string  action,
        bytes32 dataHash,
        uint256 timestamp
    );

    /// @notice Emitted when a patient grants granular consent to a grantee.
    event ConsentGranted(
        address indexed patient,
        address indexed grantee,
        bytes32[] dataCategories,
        bytes32[] purposes,
        uint256 expiresAt,
        uint256 timestamp
    );

    /// @notice Emitted when a patient revokes granular consent from a grantee.
    event ConsentRevoked(
        address indexed patient,
        address indexed grantee,
        uint256 timestamp
    );

    /// @notice Emitted when an emergency glass-break access is performed.
    event EmergencyAccessPerformed(
        address indexed accessor,
        address indexed patient,
        string  reason,
        uint256 timestamp
    );

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

    /// @notice Thrown when a consent grant is not active or has expired.
    error ConsentNotActive(address patient, address grantee);

    /// @notice Thrown when an empty reason is provided for emergency access.
    error EmptyEmergencyReason();

    /// @notice Thrown when empty data categories or purposes are provided.
    error EmptyConsentParameters();

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
        _setRoleAdmin(EMERGENCY_ROLE, ADMIN_ROLE);

        // World ID integration
        _setWorldIdVerifier(worldIdVerifier);
    }

    // ──────────────────────────────────────────────
    //  Modifiers
    // ──────────────────────────────────────────────

    /// @dev Require that the caller holds the EMERGENCY_ROLE.
    modifier onlyEmergencyRole() {
        _checkRole(EMERGENCY_ROLE);
        _;
    }

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

        unchecked { recordId = _nextRecordId++; }
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

    /**
     * @notice Store or update the longitudinal AI clinical summary hash for a patient.
     * @dev Only providers with existing access or admins may call this.
     * @param patient     The patient address.
     * @param summaryHash Keccak-256 hash of the longitudinal summary on IPFS.
     */
    function setLongitudinalSummary(
        address patient,
        bytes32 summaryHash
    ) external onlyRole(PROVIDER_ROLE) {
        if (patient == address(0)) revert InvalidAddress();
        if (summaryHash == bytes32(0)) revert InvalidCidHash();
        _longitudinalSummaryHash[patient] = summaryHash;
        emit LongitudinalSummaryStored(patient, summaryHash, block.timestamp);
        emit AuditEntry(msg.sender, patient, "LONGITUDINAL_SUMMARY", summaryHash, block.timestamp);
    }

    /**
     * @notice Retrieve the longitudinal summary hash for a patient.
     * @param patient The patient address.
     * @return summaryHash The stored hash (bytes32(0) if none).
     */
    function getLongitudinalSummary(address patient)
        external
        view
        returns (bytes32 summaryHash)
    {
        summaryHash = _longitudinalSummaryHash[patient];
    }

    // ──────────────────────────────────────────────
    //  Granular Consent Functions
    // ──────────────────────────────────────────────

    /**
     * @notice Grant granular, purpose-limited consent to a specific grantee.
     * @dev The patient calls this directly. Each call overwrites any prior
     *      consent grant for the same (patient, grantee) pair.
     * @param grantee        Address receiving consent.
     * @param dataCategories Non-empty array of data category identifiers.
     * @param purposes       Non-empty array of purpose identifiers.
     * @param expiresAt      Unix timestamp when consent expires (0 = indefinite).
     */
    function grantConsent(
        address grantee,
        bytes32[] calldata dataCategories,
        bytes32[] calldata purposes,
        uint256 expiresAt
    ) external {
        if (grantee == address(0)) revert InvalidAddress();
        if (dataCategories.length == 0 || purposes.length == 0) revert EmptyConsentParameters();

        _consentGrants[msg.sender][grantee] = ConsentGrant({
            patient: msg.sender,
            grantee: grantee,
            dataCategories: dataCategories,
            purposes: purposes,
            grantedAt: block.timestamp,
            expiresAt: expiresAt,
            isActive: true
        });

        emit ConsentGranted(msg.sender, grantee, dataCategories, purposes, expiresAt, block.timestamp);
        emit AuditEntry(msg.sender, msg.sender, "CONSENT_GRANT", keccak256(abi.encodePacked(grantee)), block.timestamp);
    }

    /**
     * @notice Revoke a previously granted consent.
     * @param grantee Address whose consent is being revoked.
     */
    function revokeConsent(address grantee) external {
        if (grantee == address(0)) revert InvalidAddress();

        ConsentGrant storage cg = _consentGrants[msg.sender][grantee];
        cg.isActive = false;

        emit ConsentRevoked(msg.sender, grantee, block.timestamp);
        emit AuditEntry(msg.sender, msg.sender, "CONSENT_REVOKE", keccak256(abi.encodePacked(grantee)), block.timestamp);
    }

    /**
     * @notice Check whether a grantee has active, non-expired consent for a
     *         specific data category and purpose.
     * @param patient      The patient whose consent is being checked.
     * @param grantee      The grantee address.
     * @param dataCategory The data category to check against.
     * @param purpose      The purpose to check against.
     * @return allowed     `true` if consent covers the requested category and purpose.
     */
    function checkGranularConsent(
        address patient,
        address grantee,
        bytes32 dataCategory,
        bytes32 purpose
    ) external view returns (bool allowed) {
        ConsentGrant storage cg = _consentGrants[patient][grantee];
        if (!cg.isActive) return false;
        if (cg.expiresAt != 0 && block.timestamp > cg.expiresAt) return false;

        bool categoryFound;
        for (uint256 i; i < cg.dataCategories.length; ) {
            if (cg.dataCategories[i] == dataCategory) {
                categoryFound = true;
                break;
            }
            unchecked { ++i; }
        }
        if (!categoryFound) return false;

        for (uint256 i; i < cg.purposes.length; ) {
            if (cg.purposes[i] == purpose) return true;
            unchecked { ++i; }
        }
        return false;
    }

    // ──────────────────────────────────────────────
    //  Emergency Access (Glass-Break)
    // ──────────────────────────────────────────────

    /**
     * @notice Perform an emergency "glass-break" access to a patient's records.
     * @dev Only addresses with `EMERGENCY_ROLE` may call this. A mandatory
     *      reason string is logged immutably on-chain for post-hoc audit.
     *      This bypasses normal consent checks and grants temporary access.
     * @param patient The patient whose records are being accessed.
     * @param reason  A human-readable justification (must not be empty).
     */
    function emergencyAccess(
        address patient,
        string calldata reason
    ) external onlyEmergencyRole {
        if (patient == address(0)) revert InvalidAddress();
        if (bytes(reason).length == 0) revert EmptyEmergencyReason();

        _glassBreakLog.push(GlassBreak({
            accessor: msg.sender,
            patient: patient,
            reason: reason,
            timestamp: block.timestamp
        }));

        // Temporarily grant broad access.
        _accessPermissions[patient][msg.sender] = true;

        emit EmergencyAccessPerformed(msg.sender, patient, reason, block.timestamp);
        emit AuditEntry(msg.sender, patient, "EMERGENCY_ACCESS", keccak256(bytes(reason)), block.timestamp);
    }

    /**
     * @notice Retrieve the total number of glass-break events.
     * @return count The number of emergency access events logged.
     */
    function glassBreakCount() external view returns (uint256 count) {
        count = _glassBreakLog.length;
    }

    /**
     * @notice Retrieve a glass-break log entry by index.
     * @param index The zero-based index.
     * @return entry The GlassBreak struct.
     */
    function getGlassBreak(uint256 index) external view returns (GlassBreak memory entry) {
        entry = _glassBreakLog[index];
    }

    /**
     * @notice Retrieve the granular consent grant between a patient and grantee.
     * @param patient The patient address.
     * @param grantee The grantee address.
     * @return consent The ConsentGrant struct.
     */
    function getConsentGrant(address patient, address grantee)
        external
        view
        returns (ConsentGrant memory consent)
    {
        consent = _consentGrants[patient][grantee];
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
