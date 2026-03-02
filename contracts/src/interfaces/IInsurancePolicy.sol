// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IInsurancePolicy
 * @author mediCaRE DAO
 * @notice Interface for the Insurance Policy contract.
 * @dev Defines the external surface area for cross-contract integrations,
 *      CCIP message receivers, and CRE workflow interactions.
 */
interface IInsurancePolicy {
    // ──────────────────────────────────────────────
    //  Enums
    // ──────────────────────────────────────────────

    /// @notice Lifecycle status of a claim.
    enum ClaimStatus {
        Pending,
        Approved,
        Rejected,
        Paid
    }

    // ──────────────────────────────────────────────
    //  Data Structures
    // ──────────────────────────────────────────────

    /// @notice On-chain representation of an insurance policy.
    struct Policy {
        uint256 policyId;
        address holder;
        uint256 coverageAmount;
        uint256 premiumAmount;
        uint256 expiryDate;
        bool    isActive;
        uint256 riskScore;
    }

    /// @notice On-chain representation of an insurance claim.
    struct Claim {
        uint256     claimId;
        uint256     policyId;
        address     claimant;
        uint256     amount;
        bytes32     descriptionHash;
        ClaimStatus status;
        uint256     timestamp;
    }

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    event PolicyCreated(
        uint256 indexed policyId,
        address indexed holder,
        uint256 coverageAmount,
        uint256 premiumAmount,
        uint256 expiryDate,
        uint256 riskScore
    );

    event PolicyRenewed(uint256 indexed policyId, uint256 newExpiryDate, uint256 premiumPaid);
    event PolicyDeactivated(uint256 indexed policyId, uint256 timestamp);

    event PremiumAdjusted(
        uint256 indexed policyId,
        uint256 oldPremium,
        uint256 newPremium,
        uint256 newRiskScore
    );

    event ClaimSubmitted(
        uint256 indexed claimId,
        uint256 indexed policyId,
        address indexed claimant,
        uint256 amount,
        bytes32 descriptionHash
    );

    event ClaimProcessed(uint256 indexed claimId, ClaimStatus newStatus, address processor);
    event ClaimPaid(uint256 indexed claimId, uint256 indexed policyId, address recipient, uint256 amount);

    // ──────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────

    error InvalidAddress();
    error InvalidAmount();
    error InvalidRiskScore(uint256 score);
    error PolicyNotActive(uint256 policyId);
    error PolicyExpired(uint256 policyId);
    error PolicyNotFound(uint256 policyId);
    error ClaimNotFound(uint256 claimId);
    error InvalidClaimStatus(uint256 claimId, ClaimStatus current, ClaimStatus expected);
    error ClaimExceedsCoverage(uint256 requested, uint256 coverage);
    error NotPolicyholder(address caller, uint256 policyId);
    error InsufficientContractBalance(uint256 required, uint256 available);

    // ──────────────────────────────────────────────
    //  Policy Lifecycle
    // ──────────────────────────────────────────────

    /**
     * @notice Mint a new insurance policy NFT.
     * @param holder         Policyholder address.
     * @param coverageAmount Maximum lifetime payout.
     * @param premiumAmount  Initial periodic premium.
     * @param durationDays   Number of days until the policy expires.
     * @param riskScore      Initial risk score (0–10 000 bps).
     * @return policyId      The identifier of the newly created policy.
     */
    function createPolicy(
        address holder,
        uint256 coverageAmount,
        uint256 premiumAmount,
        uint256 durationDays,
        uint256 riskScore
    ) external returns (uint256 policyId);

    /**
     * @notice Renew an existing policy.
     * @param policyId     The policy to renew.
     * @param durationDays Additional days to add.
     */
    function renewPolicy(uint256 policyId, uint256 durationDays) external;

    /**
     * @notice Deactivate a policy.
     * @param policyId The policy to deactivate.
     */
    function deactivatePolicy(uint256 policyId) external;

    /**
     * @notice Dynamically adjust a policy's premium and risk score.
     * @param policyId     The policy to adjust.
     * @param newPremium   New premium amount.
     * @param newRiskScore Updated risk score (0–10 000 bps).
     */
    function adjustPremium(
        uint256 policyId,
        uint256 newPremium,
        uint256 newRiskScore
    ) external;

    // ──────────────────────────────────────────────
    //  Claims Lifecycle
    // ──────────────────────────────────────────────

    /**
     * @notice Submit a new claim against an active policy.
     * @param policyId        The policy under which the claim is filed.
     * @param amount          Requested payout amount.
     * @param descriptionHash Keccak-256 hash of the claim description.
     * @return claimId        The identifier of the newly created claim.
     */
    function submitClaim(
        uint256 policyId,
        uint256 amount,
        bytes32 descriptionHash
    ) external returns (uint256 claimId);

    /**
     * @notice Approve or reject a pending claim.
     * @param claimId  The claim to process.
     * @param approved `true` to approve, `false` to reject.
     */
    function processClaim(uint256 claimId, bool approved) external;

    /**
     * @notice Pay out an approved claim.
     * @param claimId The claim to pay.
     */
    function payoutClaim(uint256 claimId) external;

    // ──────────────────────────────────────────────
    //  Admin
    // ──────────────────────────────────────────────

    /**
     * @notice Update the World ID verifier address.
     * @param newVerifier The new verifier contract address.
     */
    function setWorldIdVerifier(address newVerifier) external;

    /**
     * @notice Withdraw accumulated premiums to a treasury address.
     * @param to     Recipient address.
     * @param amount Amount of stablecoin to transfer.
     */
    function withdrawFunds(address to, uint256 amount) external;

    // ──────────────────────────────────────────────
    //  View / Read Functions
    // ──────────────────────────────────────────────

    /**
     * @notice Retrieve the full details of a policy.
     * @param policyId The policy ID.
     * @return policy The Policy struct.
     */
    function getPolicy(uint256 policyId) external view returns (Policy memory policy);

    /**
     * @notice Retrieve the full details of a claim.
     * @param claimId The claim ID.
     * @return claim The Claim struct.
     */
    function getClaim(uint256 claimId) external view returns (Claim memory claim);

    /**
     * @notice Retrieve all claim IDs for a given policy.
     * @param policyId The policy ID.
     * @return claimIds Array of claim identifiers.
     */
    function getPolicyClaims(uint256 policyId) external view returns (uint256[] memory claimIds);

    /**
     * @notice Retrieve all policy IDs held by an address.
     * @param holder The holder address.
     * @return policyIds Array of policy identifiers.
     */
    function getHolderPolicies(address holder) external view returns (uint256[] memory policyIds);

    /// @notice Total number of policies created.
    function totalPolicies() external view returns (uint256);

    /// @notice Total number of claims created.
    function totalClaims() external view returns (uint256);
}
