// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title DataTypes
 * @author mediCaRE DAO
 * @notice Shared data types and enumerations used across multiple mediCaRE
 *         protocol contracts.  Centralising these definitions avoids
 *         duplication, simplifies cross-contract compatibility, and provides
 *         a single source of truth for ABI consumers (front-end, subgraphs).
 *
 * @dev This library is intended for *type definitions* and lightweight pure
 *      helpers only — no state, no external calls.  Contracts should import
 *      individual types or the whole library as needed:
 *
 *          import { DataTypes } from "../libraries/DataTypes.sol";
 *          using DataTypes for DataTypes.RecordStatus;
 */
library DataTypes {
    // ──────────────────────────────────────────────
    //  Enums
    // ──────────────────────────────────────────────

    /// @notice Lifecycle status of a health record stored in EHRStorage.
    enum RecordStatus {
        Active,      // Record is current and accessible
        Archived,    // Soft-deleted / superseded by a newer version
        Suspended,   // Temporarily hidden pending review
        Redacted     // Permanently scrubbed for compliance (e.g. HIPAA request)
    }

    /// @notice Lifecycle status of an insurance claim.
    enum ClaimStatus {
        Pending,     // Submitted, awaiting processor review
        Approved,    // Reviewed and approved for payout
        Rejected,    // Reviewed and denied
        Paid,        // Approved and funds disbursed
        Appealed     // Claimant has appealed a rejection
    }

    /// @notice Lifecycle status of a pharmaceutical supply-chain batch.
    enum BatchStatus {
        Created,     // Manufactured and registered on-chain
        InTransit,   // Handed off to a logistics partner
        Delivered,   // Received at the destination pharmacy
        Flagged,     // Environmental or integrity alert raised
        Recalled     // Regulatory recall issued
    }

    /// @notice Types of healthcare credentials tracked in CredentialRegistry.
    enum CredentialType {
        LICENSE,      // Medical license
        BOARD_CERT,   // Board certification
        SPECIALTY,    // Specialty certification
        DEA,          // DEA registration
        NPI,          // National Provider Identifier
        CME,          // Continuing Medical Education
        FELLOWSHIP,   // Fellowship completion
        OTHER         // Catch-all for governance-added types
    }

    /// @notice Categories of governance proposals.
    enum ProposalType {
        PARAMETER_CHANGE,   // Adjust a protocol parameter
        RISK_THRESHOLD,     // Update risk-scoring thresholds
        DATA_SHARING,       // Modify data-sharing / consent policies
        PROTOCOL_UPGRADE    // Upgrade contract logic via proxy
    }

    // ──────────────────────────────────────────────
    //  Shared Structs
    // ──────────────────────────────────────────────

    /// @notice Timestamp window used for voting periods, policy terms, etc.
    struct TimeWindow {
        uint256 startTime;
        uint256 endTime;
    }

    /// @notice Compact representation of a risk assessment.
    struct RiskScore {
        uint256 score;       // Value in basis points (0 – 10 000)
        uint256 updatedAt;   // Block timestamp of last update
        address assessor;    // Address (or oracle) that provided the score
    }

    // ──────────────────────────────────────────────
    //  Constants
    // ──────────────────────────────────────────────

    /// @notice Maximum risk score in basis points (100 %).
    uint256 internal constant MAX_RISK_SCORE = 10_000;

    /// @notice Minimum voting duration for governance proposals (1 day).
    uint256 internal constant MIN_VOTING_DURATION = 1 days;

    // ──────────────────────────────────────────────
    //  Pure Helpers
    // ──────────────────────────────────────────────

    /**
     * @notice Check whether a ClaimStatus represents a terminal state
     *         (no further transitions allowed).
     * @param status The claim status to evaluate.
     * @return terminal `true` if the claim has reached a final state.
     */
    function isTerminalClaimStatus(ClaimStatus status) internal pure returns (bool terminal) {
        return status == ClaimStatus.Paid || status == ClaimStatus.Rejected;
    }

    /**
     * @notice Check whether a BatchStatus represents an actionable alert.
     * @param status The batch status to evaluate.
     * @return alert `true` if the batch is flagged or recalled.
     */
    function isBatchAlert(BatchStatus status) internal pure returns (bool alert) {
        return status == BatchStatus.Flagged || status == BatchStatus.Recalled;
    }

    /**
     * @notice Validate that a risk score is within the permitted range.
     * @param score Risk score in basis points.
     * @return valid `true` if score ≤ MAX_RISK_SCORE.
     */
    function isValidRiskScore(uint256 score) internal pure returns (bool valid) {
        return score <= MAX_RISK_SCORE;
    }

    /**
     * @notice Validate that a TimeWindow is well-formed (start < end, non-zero).
     * @param window The time window to validate.
     * @return valid `true` if the window is valid.
     */
    function isValidTimeWindow(TimeWindow memory window) internal pure returns (bool valid) {
        return window.startTime > 0 && window.endTime > window.startTime;
    }
}
