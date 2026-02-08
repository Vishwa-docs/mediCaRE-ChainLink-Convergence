// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./utils/AccessManager.sol";

/**
 * @title SupplyChain
 * @author mediCaRE DAO
 * @notice Pharmaceutical supply-chain tracking using ERC-1155 tokens.
 *         Each drug batch is represented by a unique token ID and carries
 *         immutable provenance metadata plus mutable condition logs captured
 *         from IoT devices.
 *
 * @dev Design decisions:
 *      - One ERC-1155 token ID per batch.  The `totalSupply` for a batch
 *        equals the number of individual units in that batch.
 *      - IoT condition updates are stored as indexed hashes (temperature,
 *        humidity, GPS coordinates) rather than raw values to minimise gas.
 *      - A linear status machine governs batch lifecycle:
 *            Created → InTransit → Delivered
 *                   ↘ Flagged ↘ Recalled
 *      - Only addresses with appropriate roles may create, transfer, or flag
 *        batches.
 */
contract SupplyChain is ERC1155, AccessControl, ReentrancyGuard, AccessManager {
    // ──────────────────────────────────────────────
    //  Constants & Roles
    // ──────────────────────────────────────────────

    /// @notice Role for platform administrators.
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    /// @notice Role for drug manufacturers.
    bytes32 public constant MANUFACTURER_ROLE = keccak256("MANUFACTURER_ROLE");

    /// @notice Role for distributors / logistics partners.
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");

    /// @notice Role for pharmacies / end receivers.
    bytes32 public constant PHARMACY_ROLE = keccak256("PHARMACY_ROLE");

    // ──────────────────────────────────────────────
    //  Enums
    // ──────────────────────────────────────────────

    /// @notice Lifecycle status of a pharmaceutical batch.
    enum BatchStatus {
        Created,
        InTransit,
        Delivered,
        Flagged,
        Recalled
    }

    // ──────────────────────────────────────────────
    //  Data Structures
    // ──────────────────────────────────────────────

    /**
     * @notice On-chain metadata for a pharmaceutical batch.
     * @param batchId          Unique batch identifier (== ERC-1155 token ID).
     * @param manufacturer     Address of the originating manufacturer.
     * @param lotNumber        Lot / serial number hash for traceability.
     * @param manufactureDate  Unix timestamp of production.
     * @param expiryDate       Unix timestamp of product expiry.
     * @param quantity         Number of units in the batch.
     * @param status           Current lifecycle status.
     * @param drugNameHash     Keccak-256 hash of the drug name.
     */
    struct Batch {
        uint256     batchId;
        address     manufacturer;
        bytes32     lotNumber;
        uint256     manufactureDate;
        uint256     expiryDate;
        uint256     quantity;
        BatchStatus status;
        bytes32     drugNameHash;
    }

    /**
     * @notice A snapshot of IoT-captured environmental conditions.
     * @param temperatureHash  Hash of the temperature reading.
     * @param humidityHash     Hash of the humidity reading.
     * @param gpsHash          Hash of the GPS coordinates.
     * @param timestamp        Block timestamp when the data was recorded.
     * @param reporter         Address that submitted the reading.
     */
    struct ConditionLog {
        bytes32 temperatureHash;
        bytes32 humidityHash;
        bytes32 gpsHash;
        uint256 timestamp;
        address reporter;
    }

    /**
     * @notice A transfer event within the supply chain.
     * @param from      Sender address.
     * @param to        Receiver address.
     * @param timestamp Block timestamp of the transfer.
     * @param quantity  Number of units transferred.
     */
    struct TransferEvent {
        address from;
        address to;
        uint256 timestamp;
        uint256 quantity;
    }

    // ──────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────

    /// @notice Auto-incrementing batch (token) counter.
    uint256 private _nextBatchId;

    /// @notice batchId ⇒ Batch metadata.
    mapping(uint256 => Batch) private _batches;

    /// @notice batchId ⇒ ordered list of IoT condition logs.
    mapping(uint256 => ConditionLog[]) private _conditionLogs;

    /// @notice batchId ⇒ ordered list of custody transfer events.
    mapping(uint256 => TransferEvent[]) private _transferHistory;

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    event BatchCreated(
        uint256 indexed batchId,
        address indexed manufacturer,
        bytes32 lotNumber,
        uint256 quantity,
        bytes32 drugNameHash,
        uint256 expiryDate
    );

    event BatchTransferred(
        uint256 indexed batchId,
        address indexed from,
        address indexed to,
        uint256 quantity,
        uint256 timestamp
    );

    event ConditionsUpdated(
        uint256 indexed batchId,
        bytes32 temperatureHash,
        bytes32 humidityHash,
        bytes32 gpsHash,
        address reporter,
        uint256 timestamp
    );

    event BatchFlagged(uint256 indexed batchId, address indexed flaggedBy, string reason, uint256 timestamp);

    event BatchRecalled(uint256 indexed batchId, address indexed recalledBy, string reason, uint256 timestamp);

    event BatchStatusChanged(uint256 indexed batchId, BatchStatus oldStatus, BatchStatus newStatus);

    // ──────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────

    error BatchNotFound(uint256 batchId);
    error InvalidQuantity();
    error InvalidDates();
    error InvalidAddress();
    error InvalidBatchStatus(uint256 batchId, BatchStatus current, BatchStatus expected);
    error BatchAlreadyRecalled(uint256 batchId);
    error InsufficientBatchBalance(uint256 batchId, address holder, uint256 required, uint256 available);

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────

    /**
     * @notice Deploy the SupplyChain contract.
     * @param admin           Initial platform administrator.
     * @param metadataURI     Base URI for ERC-1155 metadata (can use `{id}` placeholder).
     * @param worldIdVerifier Address of the World ID verifier (or `address(0)`).
     */
    constructor(
        address admin,
        string memory metadataURI,
        address worldIdVerifier
    ) ERC1155(metadataURI) {
        if (admin == address(0)) revert InvalidAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);

        _setRoleAdmin(MANUFACTURER_ROLE, ADMIN_ROLE);
        _setRoleAdmin(DISTRIBUTOR_ROLE, ADMIN_ROLE);
        _setRoleAdmin(PHARMACY_ROLE, ADMIN_ROLE);

        _setWorldIdVerifier(worldIdVerifier);
    }

    // ──────────────────────────────────────────────
    //  Batch Lifecycle
    // ──────────────────────────────────────────────

    /**
     * @notice Create a new pharmaceutical batch and mint the corresponding tokens.
     * @param lotNumber        Lot/serial number hash.
     * @param manufactureDate  Production timestamp.
     * @param expiryDate       Expiry timestamp (must be > manufactureDate).
     * @param quantity         Number of units to mint.
     * @param drugNameHash     Hash of the drug name.
     * @return batchId         The identifier of the newly created batch.
     */
    function createBatch(
        bytes32 lotNumber,
        uint256 manufactureDate,
        uint256 expiryDate,
        uint256 quantity,
        bytes32 drugNameHash
    )
        external
        onlyRole(MANUFACTURER_ROLE)
        returns (uint256 batchId)
    {
        if (quantity == 0) revert InvalidQuantity();
        if (expiryDate <= manufactureDate) revert InvalidDates();

        batchId = _nextBatchId++;
        _batches[batchId] = Batch({
            batchId: batchId,
            manufacturer: msg.sender,
            lotNumber: lotNumber,
            manufactureDate: manufactureDate,
            expiryDate: expiryDate,
            quantity: quantity,
            status: BatchStatus.Created,
            drugNameHash: drugNameHash
        });

        // Mint all units to the manufacturer.
        _mint(msg.sender, batchId, quantity, "");

        emit BatchCreated(batchId, msg.sender, lotNumber, quantity, drugNameHash, expiryDate);
    }

    /**
     * @notice Transfer custody of (part of) a batch to the next supply-chain actor.
     * @dev The caller must hold sufficient tokens for the given `batchId`.
     *      Only addresses with MANUFACTURER_ROLE, DISTRIBUTOR_ROLE, or
     *      PHARMACY_ROLE may participate.
     * @param batchId  The batch to transfer.
     * @param to       Recipient address.
     * @param quantity Number of units to transfer.
     */
    function transferBatch(
        uint256 batchId,
        address to,
        uint256 quantity
    ) external nonReentrant {
        Batch storage b = _batches[batchId];
        if (b.manufacturer == address(0)) revert BatchNotFound(batchId);
        if (to == address(0)) revert InvalidAddress();
        if (quantity == 0) revert InvalidQuantity();
        if (b.status == BatchStatus.Recalled) revert BatchAlreadyRecalled(batchId);

        uint256 senderBalance = balanceOf(msg.sender, batchId);
        if (senderBalance < quantity) {
            revert InsufficientBatchBalance(batchId, msg.sender, quantity, senderBalance);
        }

        // Only authorised supply-chain actors may participate.
        require(
            hasRole(MANUFACTURER_ROLE, msg.sender) ||
            hasRole(DISTRIBUTOR_ROLE, msg.sender) ||
            hasRole(PHARMACY_ROLE, msg.sender),
            "SupplyChain: caller lacks supply-chain role"
        );

        // Update batch status based on the receiver's role.
        BatchStatus oldStatus = b.status;
        if (hasRole(PHARMACY_ROLE, to)) {
            b.status = BatchStatus.Delivered;
        } else if (hasRole(DISTRIBUTOR_ROLE, to)) {
            if (b.status == BatchStatus.Created) {
                b.status = BatchStatus.InTransit;
            }
        }

        // Perform the ERC-1155 transfer.
        _safeTransferFrom(msg.sender, to, batchId, quantity, "");

        // Record the custody transfer event.
        _transferHistory[batchId].push(TransferEvent({
            from: msg.sender,
            to: to,
            timestamp: block.timestamp,
            quantity: quantity
        }));

        if (oldStatus != b.status) {
            emit BatchStatusChanged(batchId, oldStatus, b.status);
        }
        emit BatchTransferred(batchId, msg.sender, to, quantity, block.timestamp);
    }

    /**
     * @notice Log IoT environmental condition data for a batch.
     * @param batchId          The batch being monitored.
     * @param temperatureHash  Hash of the temperature reading.
     * @param humidityHash     Hash of the humidity reading.
     * @param gpsHash          Hash of the GPS coordinates.
     */
    function updateConditions(
        uint256 batchId,
        bytes32 temperatureHash,
        bytes32 humidityHash,
        bytes32 gpsHash
    ) external {
        if (_batches[batchId].manufacturer == address(0)) revert BatchNotFound(batchId);
        require(
            hasRole(MANUFACTURER_ROLE, msg.sender) ||
            hasRole(DISTRIBUTOR_ROLE, msg.sender) ||
            hasRole(PHARMACY_ROLE, msg.sender),
            "SupplyChain: caller lacks supply-chain role"
        );

        _conditionLogs[batchId].push(ConditionLog({
            temperatureHash: temperatureHash,
            humidityHash: humidityHash,
            gpsHash: gpsHash,
            timestamp: block.timestamp,
            reporter: msg.sender
        }));

        emit ConditionsUpdated(batchId, temperatureHash, humidityHash, gpsHash, msg.sender, block.timestamp);
    }

    /**
     * @notice Flag a batch as potentially counterfeit or compromised.
     * @param batchId The batch to flag.
     * @param reason  Human-readable reason for flagging.
     */
    function flagBatch(uint256 batchId, string calldata reason) external {
        Batch storage b = _batches[batchId];
        if (b.manufacturer == address(0)) revert BatchNotFound(batchId);
        if (b.status == BatchStatus.Recalled) revert BatchAlreadyRecalled(batchId);
        require(
            hasRole(MANUFACTURER_ROLE, msg.sender) ||
            hasRole(DISTRIBUTOR_ROLE, msg.sender) ||
            hasRole(PHARMACY_ROLE, msg.sender) ||
            hasRole(ADMIN_ROLE, msg.sender),
            "SupplyChain: caller lacks authority to flag"
        );

        BatchStatus oldStatus = b.status;
        b.status = BatchStatus.Flagged;

        emit BatchStatusChanged(batchId, oldStatus, BatchStatus.Flagged);
        emit BatchFlagged(batchId, msg.sender, reason, block.timestamp);
    }

    /**
     * @notice Recall an entire batch.  Only admins or the original manufacturer
     *         may recall a batch.
     * @param batchId The batch to recall.
     * @param reason  Human-readable reason for the recall.
     */
    function recallBatch(uint256 batchId, string calldata reason) external {
        Batch storage b = _batches[batchId];
        if (b.manufacturer == address(0)) revert BatchNotFound(batchId);
        if (b.status == BatchStatus.Recalled) revert BatchAlreadyRecalled(batchId);
        require(
            hasRole(ADMIN_ROLE, msg.sender) || msg.sender == b.manufacturer,
            "SupplyChain: only admin or manufacturer can recall"
        );

        BatchStatus oldStatus = b.status;
        b.status = BatchStatus.Recalled;

        emit BatchStatusChanged(batchId, oldStatus, BatchStatus.Recalled);
        emit BatchRecalled(batchId, msg.sender, reason, block.timestamp);
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
     * @notice Update the ERC-1155 metadata URI.
     * @param newURI  New metadata base URI.
     */
    function setURI(string calldata newURI) external onlyRole(ADMIN_ROLE) {
        _setURI(newURI);
    }

    // ──────────────────────────────────────────────
    //  View / Read Functions
    // ──────────────────────────────────────────────

    /**
     * @notice Retrieve full metadata for a batch.
     * @param batchId The batch ID.
     * @return batch The Batch struct.
     */
    function getBatch(uint256 batchId) external view returns (Batch memory batch) {
        if (_batches[batchId].manufacturer == address(0)) revert BatchNotFound(batchId);
        batch = _batches[batchId];
    }

    /**
     * @notice Verify a batch exists, is not recalled, and has not expired.
     * @param batchId The batch to verify.
     * @return valid     True if the batch passes all checks.
     * @return status    Current status of the batch.
     * @return isExpired Whether the batch has passed its expiry date.
     */
    function verifyBatch(uint256 batchId)
        external
        view
        returns (bool valid, BatchStatus status, bool isExpired)
    {
        Batch storage b = _batches[batchId];
        if (b.manufacturer == address(0)) revert BatchNotFound(batchId);

        isExpired = block.timestamp > b.expiryDate;
        status = b.status;
        valid = (status != BatchStatus.Flagged && status != BatchStatus.Recalled && !isExpired);
    }

    /**
     * @notice Return the condition logs for a batch.
     * @param batchId The batch ID.
     * @return logs Array of ConditionLog structs.
     */
    function getConditionLogs(uint256 batchId)
        external
        view
        returns (ConditionLog[] memory logs)
    {
        logs = _conditionLogs[batchId];
    }

    /**
     * @notice Return the custody transfer history for a batch.
     * @param batchId The batch ID.
     * @return history Array of TransferEvent structs.
     */
    function getTransferHistory(uint256 batchId)
        external
        view
        returns (TransferEvent[] memory history)
    {
        history = _transferHistory[batchId];
    }

    /**
     * @notice Total number of batches created.
     */
    function totalBatches() external view returns (uint256) {
        return _nextBatchId;
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
        override(ERC1155, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
