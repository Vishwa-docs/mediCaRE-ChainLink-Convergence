// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./utils/AccessManager.sol";

/**
 * @title ICCIPReceiver
 * @notice Minimal interface for Chainlink CCIP cross-chain message reception.
 * @dev Implement this interface to receive arbitrary cross-chain messages via
 *      CCIP.  The concrete CCIP Router will call {ccipReceive} upon delivery.
 *      Replace with the Chainlink CCIP CCIPReceiver.sol when the
 *      dependency is added to the project.
 */
interface ICCIPReceiver {
    /// @notice Struct representing a cross-chain message from CCIP.
    struct Any2EVMMessage {
        bytes32 messageId;
        uint64  sourceChainSelector;
        bytes   sender;
        bytes   data;
    }

    /// @notice Called by the CCIP Router when a cross-chain message arrives.
    function ccipReceive(Any2EVMMessage calldata message) external;
}

/**
 * @title HealthPassport
 * @author mediCaRE DAO
 * @notice Cross-chain emergency health passport represented as an ERC-721 NFT.
 *         Each passport stores hashed, encrypted references to a patient's
 *         critical health data (blood type, allergies, medications, emergency
 *         contacts) for rapid access during emergencies.
 *
 * @dev Architecture decisions:
 *      - All sensitive data fields are stored as `bytes32` keccak-256 hashes of
 *        the encrypted off-chain payloads.  The decryption key is shared only
 *        with authorised parties via the mediCaRE key-management layer.
 *      - A "glass-break" pattern allows paramedics (PARAMEDIC_ROLE) to obtain
 *        time-locked emergency access.  Every glass-break event is logged
 *        immutably on-chain for post-hoc audit.
 *      - Cross-chain synchronisation is achieved via Chainlink CCIP.  The
 *        contract implements {ICCIPReceiver} to accept passport state updates
 *        from other chains.
 *      - Only one passport per patient address is allowed (tokenId == uint256
 *        of the patient address).
 */
contract HealthPassport is ERC721, AccessControl, ReentrancyGuard, AccessManager, ICCIPReceiver {
    // ──────────────────────────────────────────────
    //  Constants & Roles
    // ──────────────────────────────────────────────

    /// @notice Role for platform administrators.
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    /// @notice Role for paramedics / first-responders with glass-break access.
    bytes32 public constant PARAMEDIC_ROLE = keccak256("PARAMEDIC_ROLE");

    /// @notice Duration (seconds) for which emergency access remains valid.
    uint256 public constant EMERGENCY_ACCESS_DURATION = 1 hours;

    // ──────────────────────────────────────────────
    //  Data Structures
    // ──────────────────────────────────────────────

    /**
     * @notice Core health data stored per passport.
     * @param bloodType            Keccak-256 hash of the encrypted blood-type string.
     * @param allergiesHash        Keccak-256 hash of the encrypted allergies list.
     * @param emergencyContactHash Keccak-256 hash of the encrypted emergency contact info.
     * @param medicationsHash      Keccak-256 hash of the encrypted current medications list.
     * @param lastUpdated          Block timestamp of the most recent data update.
     */
    struct HealthData {
        bytes32 bloodType;
        bytes32 allergiesHash;
        bytes32 emergencyContactHash;
        bytes32 medicationsHash;
        uint256 lastUpdated;
    }

    /**
     * @notice Record of a time-locked emergency glass-break access grant.
     * @param paramedic Address of the paramedic who invoked glass-break.
     * @param patient   Address of the patient whose passport was accessed.
     * @param reason    Mandatory free-text justification.
     * @param grantedAt Block timestamp when access was granted.
     * @param expiresAt Block timestamp when time-locked access expires.
     */
    struct EmergencyAccess {
        address paramedic;
        address patient;
        string  reason;
        uint256 grantedAt;
        uint256 expiresAt;
    }

    // ──────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────

    /// @notice Authorised Chainlink CCIP Router address.
    address public ccipRouter;

    /// @notice patient address ⇒ HealthData.
    mapping(address => HealthData) private _healthData;

    /// @notice patient address ⇒ paramedic ⇒ EmergencyAccess grant.
    mapping(address => mapping(address => EmergencyAccess)) private _emergencyAccess;

    /// @notice Sequential log of all emergency access events.
    EmergencyAccess[] private _emergencyLog;

    /// @notice Allowed source chain selectors for CCIP sync (chain selector ⇒ allowed).
    mapping(uint64 => bool) public allowedSourceChains;

    /// @notice Allowed sender addresses per source chain (chain selector ⇒ sender hash ⇒ allowed).
    mapping(uint64 => mapping(bytes32 => bool)) public allowedSenders;

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    /// @notice Emitted when a new health passport is minted.
    event PassportCreated(
        uint256 indexed tokenId,
        address indexed patient,
        uint256 timestamp
    );

    /// @notice Emitted when passport health data is updated.
    event PassportUpdated(
        address indexed patient,
        bytes32 bloodType,
        bytes32 allergiesHash,
        bytes32 emergencyContactHash,
        bytes32 medicationsHash,
        uint256 timestamp
    );

    /// @notice Emitted when emergency glass-break access is granted.
    event EmergencyAccessGranted(
        address indexed paramedic,
        address indexed patient,
        string  reason,
        uint256 grantedAt,
        uint256 expiresAt
    );

    /// @notice Emitted when passport data is synced from another chain via CCIP.
    event PassportSynced(
        address indexed patient,
        uint64  indexed sourceChainSelector,
        bytes32 messageId,
        uint256 timestamp
    );

    // ──────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────

    /// @notice Thrown when the zero address is supplied.
    error InvalidAddress();

    /// @notice Thrown when a passport already exists for the patient.
    error PassportAlreadyExists(address patient);

    /// @notice Thrown when no passport exists for the patient.
    error PassportNotFound(address patient);

    /// @notice Thrown when an empty reason is provided for glass-break.
    error EmptyReason();

    /// @notice Thrown when the caller is not the CCIP Router.
    error InvalidRouter(address caller);

    /// @notice Thrown when the source chain is not in the allow-list.
    error SourceChainNotAllowed(uint64 chainSelector);

    /// @notice Thrown when the cross-chain sender is not authorised.
    error SenderNotAllowed(uint64 chainSelector, bytes sender);

    /// @notice Thrown when the caller is not the patient or admin.
    error NotPatientOrAdmin(address caller, address patient);

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────

    /**
     * @notice Deploy the HealthPassport contract.
     * @param admin           Initial administrator address.
     * @param _ccipRouter     Address of the Chainlink CCIP Router on this chain.
     * @param worldIdVerifier Address of the World ID verifier (or `address(0)`).
     */
    constructor(
        address admin,
        address _ccipRouter,
        address worldIdVerifier
    ) ERC721("mediCaRE Health Passport", "mHP") {
        if (admin == address(0)) revert InvalidAddress();

        ccipRouter = _ccipRouter;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _setRoleAdmin(PARAMEDIC_ROLE, ADMIN_ROLE);

        _setWorldIdVerifier(worldIdVerifier);
    }

    // ──────────────────────────────────────────────
    //  Modifiers
    // ──────────────────────────────────────────────

    /// @dev Only the CCIP Router may call functions guarded by this modifier.
    modifier onlyRouter() {
        if (msg.sender != ccipRouter) revert InvalidRouter(msg.sender);
        _;
    }

    // ──────────────────────────────────────────────
    //  Passport Lifecycle
    // ──────────────────────────────────────────────

    /**
     * @notice Mint a new health passport NFT for a patient.
     * @dev The token ID is deterministically derived from the patient address
     *      (`uint256(uint160(patient))`), ensuring one passport per address.
     * @param patient              The patient receiving the passport NFT.
     * @param bloodType            Encrypted blood type hash.
     * @param allergiesHash        Encrypted allergies list hash.
     * @param emergencyContactHash Encrypted emergency contact hash.
     * @param medicationsHash      Encrypted medications list hash.
     * @return tokenId             The minted token ID.
     */
    function createPassport(
        address patient,
        bytes32 bloodType,
        bytes32 allergiesHash,
        bytes32 emergencyContactHash,
        bytes32 medicationsHash
    )
        external
        onlyRole(ADMIN_ROLE)
        returns (uint256 tokenId)
    {
        if (patient == address(0)) revert InvalidAddress();

        tokenId = uint256(uint160(patient));

        // _mint reverts if token already exists (ERC-721 standard).
        _mint(patient, tokenId);

        _healthData[patient] = HealthData({
            bloodType: bloodType,
            allergiesHash: allergiesHash,
            emergencyContactHash: emergencyContactHash,
            medicationsHash: medicationsHash,
            lastUpdated: block.timestamp
        });

        emit PassportCreated(tokenId, patient, block.timestamp);
        emit PassportUpdated(patient, bloodType, allergiesHash, emergencyContactHash, medicationsHash, block.timestamp);
    }

    /**
     * @notice Update the health data on an existing passport.
     * @dev Callable by the patient themselves or an admin.
     * @param patient              The patient whose passport is being updated.
     * @param bloodType            Updated encrypted blood type hash.
     * @param allergiesHash        Updated encrypted allergies list hash.
     * @param emergencyContactHash Updated encrypted emergency contact hash.
     * @param medicationsHash      Updated encrypted medications list hash.
     */
    function updatePassport(
        address patient,
        bytes32 bloodType,
        bytes32 allergiesHash,
        bytes32 emergencyContactHash,
        bytes32 medicationsHash
    ) external {
        if (msg.sender != patient && !hasRole(ADMIN_ROLE, msg.sender)) {
            revert NotPatientOrAdmin(msg.sender, patient);
        }

        // Verify passport exists.
        uint256 tokenId = uint256(uint160(patient));
        if (_ownerOf(tokenId) == address(0)) revert PassportNotFound(patient);

        _healthData[patient] = HealthData({
            bloodType: bloodType,
            allergiesHash: allergiesHash,
            emergencyContactHash: emergencyContactHash,
            medicationsHash: medicationsHash,
            lastUpdated: block.timestamp
        });

        emit PassportUpdated(patient, bloodType, allergiesHash, emergencyContactHash, medicationsHash, block.timestamp);
    }

    // ──────────────────────────────────────────────
    //  Emergency Glass-Break Access
    // ──────────────────────────────────────────────

    /**
     * @notice Perform a glass-break emergency access to a patient's passport.
     * @dev Only addresses with `PARAMEDIC_ROLE` may call this. Access is
     *      time-locked to `EMERGENCY_ACCESS_DURATION` (default 1 hour).
     *      Every invocation is logged immutably for post-hoc compliance audit.
     * @param patient The patient whose passport is being accessed.
     * @param reason  A mandatory human-readable justification.
     */
    function glassBreakAccess(
        address patient,
        string calldata reason
    ) external onlyRole(PARAMEDIC_ROLE) {
        if (patient == address(0)) revert InvalidAddress();
        if (bytes(reason).length == 0) revert EmptyReason();

        uint256 tokenId = uint256(uint160(patient));
        if (_ownerOf(tokenId) == address(0)) revert PassportNotFound(patient);

        uint256 expiresAt = block.timestamp + EMERGENCY_ACCESS_DURATION;

        EmergencyAccess memory ea = EmergencyAccess({
            paramedic: msg.sender,
            patient: patient,
            reason: reason,
            grantedAt: block.timestamp,
            expiresAt: expiresAt
        });

        _emergencyAccess[patient][msg.sender] = ea;
        _emergencyLog.push(ea);

        emit EmergencyAccessGranted(msg.sender, patient, reason, block.timestamp, expiresAt);
    }

    /**
     * @notice Check whether a paramedic currently has active emergency access.
     * @param patient   The patient address.
     * @param paramedic The paramedic address.
     * @return active   `true` if the time-locked access has not yet expired.
     */
    function hasActiveEmergencyAccess(
        address patient,
        address paramedic
    ) external view returns (bool active) {
        EmergencyAccess storage ea = _emergencyAccess[patient][paramedic];
        active = (ea.grantedAt != 0 && block.timestamp <= ea.expiresAt);
    }

    // ──────────────────────────────────────────────
    //  CCIP Cross-Chain Sync
    // ──────────────────────────────────────────────

    /**
     * @notice Receive a cross-chain passport sync message from CCIP.
     * @dev Called exclusively by the CCIP Router. Decodes the patient address
     *      and updated health data hashes from `message.data` and applies
     *      them to the local passport state. The passport must already exist
     *      on this chain (mint it first via {createPassport}).
     * @param message The CCIP cross-chain message payload.
     */
    function ccipReceive(
        Any2EVMMessage calldata message
    ) external override onlyRouter {
        // Validate source chain.
        if (!allowedSourceChains[message.sourceChainSelector]) {
            revert SourceChainNotAllowed(message.sourceChainSelector);
        }

        // Validate sender.
        bytes32 senderHash = keccak256(message.sender);
        if (!allowedSenders[message.sourceChainSelector][senderHash]) {
            revert SenderNotAllowed(message.sourceChainSelector, message.sender);
        }

        // Decode payload: (address patient, bytes32[4] healthHashes)
        (
            address patient,
            bytes32 bloodType,
            bytes32 allergiesHash,
            bytes32 emergencyContactHash,
            bytes32 medicationsHash
        ) = abi.decode(message.data, (address, bytes32, bytes32, bytes32, bytes32));

        // Update local state (passport must already exist).
        uint256 tokenId = uint256(uint160(patient));
        if (_ownerOf(tokenId) == address(0)) revert PassportNotFound(patient);

        _healthData[patient] = HealthData({
            bloodType: bloodType,
            allergiesHash: allergiesHash,
            emergencyContactHash: emergencyContactHash,
            medicationsHash: medicationsHash,
            lastUpdated: block.timestamp
        });

        emit PassportSynced(patient, message.sourceChainSelector, message.messageId, block.timestamp);
        emit PassportUpdated(patient, bloodType, allergiesHash, emergencyContactHash, medicationsHash, block.timestamp);
    }

    // ──────────────────────────────────────────────
    //  Admin Functions
    // ──────────────────────────────────────────────

    /**
     * @notice Update the CCIP Router address.
     * @param newRouter The new router address.
     */
    function setCCIPRouter(address newRouter) external onlyRole(ADMIN_ROLE) {
        ccipRouter = newRouter;
    }

    /**
     * @notice Add or remove a source chain from the CCIP allow-list.
     * @param chainSelector The CCIP chain selector.
     * @param allowed       Whether the chain is allowed.
     */
    function setAllowedSourceChain(
        uint64 chainSelector,
        bool allowed
    ) external onlyRole(ADMIN_ROLE) {
        allowedSourceChains[chainSelector] = allowed;
    }

    /**
     * @notice Add or remove a sender from the CCIP allow-list for a given chain.
     * @param chainSelector The CCIP chain selector.
     * @param sender        The abi-encoded sender address on the source chain.
     * @param allowed       Whether the sender is allowed.
     */
    function setAllowedSender(
        uint64 chainSelector,
        bytes calldata sender,
        bool allowed
    ) external onlyRole(ADMIN_ROLE) {
        allowedSenders[chainSelector][keccak256(sender)] = allowed;
    }

    /**
     * @notice Register a new paramedic (grant PARAMEDIC_ROLE).
     * @param paramedic The address to register.
     */
    function registerParamedic(address paramedic) external onlyRole(ADMIN_ROLE) {
        if (paramedic == address(0)) revert InvalidAddress();
        _grantRole(PARAMEDIC_ROLE, paramedic);
    }

    /**
     * @notice Remove a paramedic (revoke PARAMEDIC_ROLE).
     * @param paramedic The address to remove.
     */
    function removeParamedic(address paramedic) external onlyRole(ADMIN_ROLE) {
        _revokeRole(PARAMEDIC_ROLE, paramedic);
    }

    /**
     * @notice Update the World ID verifier address.
     * @param newVerifier The new verifier contract address.
     */
    function setWorldIdVerifier(address newVerifier) external onlyRole(ADMIN_ROLE) {
        _setWorldIdVerifier(newVerifier);
    }

    // ──────────────────────────────────────────────
    //  View / Read Functions
    // ──────────────────────────────────────────────

    /**
     * @notice Retrieve the health data for a patient's passport.
     * @dev Access is allowed for the patient, admins, or paramedics with
     *      active emergency access.
     * @param patient The patient address.
     * @return data The HealthData struct.
     */
    function getHealthData(address patient)
        external
        view
        returns (HealthData memory data)
    {
        uint256 tokenId = uint256(uint160(patient));
        if (_ownerOf(tokenId) == address(0)) revert PassportNotFound(patient);

        // Access control: patient, admin, or active emergency access.
        if (
            msg.sender != patient &&
            !hasRole(ADMIN_ROLE, msg.sender) &&
            !(
                _emergencyAccess[patient][msg.sender].grantedAt != 0 &&
                block.timestamp <= _emergencyAccess[patient][msg.sender].expiresAt
            )
        ) {
            revert NotPatientOrAdmin(msg.sender, patient);
        }

        data = _healthData[patient];
    }

    /**
     * @notice Retrieve the total number of emergency access events logged.
     * @return count The number of glass-break events.
     */
    function emergencyAccessCount() external view returns (uint256 count) {
        count = _emergencyLog.length;
    }

    /**
     * @notice Retrieve an emergency access log entry by index.
     * @param index The zero-based index.
     * @return entry The EmergencyAccess struct.
     */
    function getEmergencyAccessLog(uint256 index)
        external
        view
        returns (EmergencyAccess memory entry)
    {
        entry = _emergencyLog[index];
    }

    /**
     * @notice Check whether a passport exists for a patient.
     * @param patient The patient address.
     * @return exists `true` if a passport NFT has been minted.
     */
    function passportExists(address patient) external view returns (bool exists) {
        uint256 tokenId = uint256(uint160(patient));
        exists = _ownerOf(tokenId) != address(0);
    }

    // ──────────────────────────────────────────────
    //  ERC-165 Override
    // ──────────────────────────────────────────────

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
