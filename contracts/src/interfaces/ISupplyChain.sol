// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ISupplyChain
 * @author mediCaRE DAO
 * @notice Interface for the pharmaceutical supply-chain tracking contract.
 * @dev Provides the external API surface for CCIP cross-chain receivers,
 *      CRE workflow integrations, and front-end consumers.
 */
interface ISupplyChain {
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

    /// @notice On-chain metadata for a pharmaceutical batch.
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

    /// @notice A snapshot of IoT-captured environmental conditions.
    struct ConditionLog {
        bytes32 temperatureHash;
        bytes32 humidityHash;
        bytes32 gpsHash;
        uint256 timestamp;
        address reporter;
    }

    /// @notice A transfer event within the supply chain.
    struct TransferEvent {
        address from;
        address to;
        uint256 timestamp;
        uint256 quantity;
    }

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
    //  Batch Lifecycle
    // ──────────────────────────────────────────────

    /**
     * @notice Create a new pharmaceutical batch and mint the corresponding tokens.
     * @param lotNumber        Lot/serial number hash.
     * @param manufactureDate  Production timestamp.
     * @param expiryDate       Expiry timestamp.
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
    ) external returns (uint256 batchId);

    /**
     * @notice Transfer custody of (part of) a batch.
     * @param batchId  The batch to transfer.
     * @param to       Recipient address.
     * @param quantity Number of units to transfer.
     */
    function transferBatch(uint256 batchId, address to, uint256 quantity) external;

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
    ) external;

    /**
     * @notice Flag a batch as potentially compromised.
     * @param batchId The batch to flag.
     * @param reason  Human-readable reason for flagging.
     */
    function flagBatch(uint256 batchId, string calldata reason) external;

    /**
     * @notice Recall an entire batch.
     * @param batchId The batch to recall.
     * @param reason  Human-readable reason for the recall.
     */
    function recallBatch(uint256 batchId, string calldata reason) external;

    // ──────────────────────────────────────────────
    //  Admin Functions
    // ──────────────────────────────────────────────

    /**
     * @notice Update the World ID verifier address.
     * @param newVerifier The new verifier contract address.
     */
    function setWorldIdVerifier(address newVerifier) external;

    /**
     * @notice Update the ERC-1155 metadata URI.
     * @param newURI New metadata base URI.
     */
    function setURI(string calldata newURI) external;

    // ──────────────────────────────────────────────
    //  View / Read Functions
    // ──────────────────────────────────────────────

    /**
     * @notice Retrieve full metadata for a batch.
     * @param batchId The batch ID.
     * @return batch The Batch struct.
     */
    function getBatch(uint256 batchId) external view returns (Batch memory batch);

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
        returns (bool valid, BatchStatus status, bool isExpired);

    /**
     * @notice Return the condition logs for a batch.
     * @param batchId The batch ID.
     * @return logs Array of ConditionLog structs.
     */
    function getConditionLogs(uint256 batchId)
        external
        view
        returns (ConditionLog[] memory logs);

    /**
     * @notice Return the custody transfer history for a batch.
     * @param batchId The batch ID.
     * @return history Array of TransferEvent structs.
     */
    function getTransferHistory(uint256 batchId)
        external
        view
        returns (TransferEvent[] memory history);

    /// @notice Total number of batches created.
    function totalBatches() external view returns (uint256);
}
