// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./utils/AccessManager.sol";

/**
 * @title InsurancePolicy
 * @author mediCaRE DAO
 * @notice Insurance policies represented as ERC-721 NFTs with an integrated
 *         claims lifecycle.  Premiums and payouts are settled in a configurable
 *         ERC-20 stablecoin (e.g. USDC).
 *
 * @dev Key design choices:
 *      - Each minted NFT corresponds to exactly one policy.  The `tokenId` and
 *        `policyId` are identical.
 *      - Risk scores (0–10 000 basis points) drive dynamic premium adjustments.
 *        An off-chain CRE / AI pipeline can call {adjustPremium} to reflect
 *        updated actuarial data.
 *      - Claims follow a linear state machine:
 *            Pending → Approved → Paid
 *                   ↘ Rejected
 *      - All payment-related functions use OpenZeppelin's {SafeERC20} wrapper and
 *        {ReentrancyGuard} to mitigate re-entrancy risk.
 */
contract InsurancePolicy is ERC721, AccessControl, ReentrancyGuard, AccessManager {
    using SafeERC20 for IERC20;

    // ──────────────────────────────────────────────
    //  Constants & Roles
    // ──────────────────────────────────────────────

    /// @notice Role for platform administrators.
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    /// @notice Role for claims adjusters / processors.
    bytes32 public constant CLAIMS_PROCESSOR_ROLE = keccak256("CLAIMS_PROCESSOR_ROLE");

    /// @notice Role for the CRE (Chainlink Runtime Environment) automation agent.
    bytes32 public constant CRE_ROLE = keccak256("CRE_ROLE");

    /// @notice Maximum risk score in basis points (100 %).
    uint256 public constant MAX_RISK_SCORE = 10_000;

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

    /**
     * @notice On-chain representation of an insurance policy.
     * @param policyId       Unique identifier (== NFT `tokenId`).
     * @param holder         Policyholder address.
     * @param coverageAmount Maximum payout denominated in the stablecoin.
     * @param premiumAmount  Current periodic premium.
     * @param expiryDate     Unix timestamp when the policy lapses.
     * @param isActive       Whether the policy is currently in force.
     * @param riskScore      Risk score in basis points (0–10 000).
     */
    struct Policy {
        uint256 policyId;
        address holder;
        uint256 coverageAmount;
        uint256 premiumAmount;
        uint256 expiryDate;
        bool    isActive;
        uint256 riskScore;
    }

    /**
     * @notice On-chain representation of an insurance claim.
     * @param claimId         Unique claim identifier.
     * @param policyId        The policy under which the claim is filed.
     * @param claimant        Address that submitted the claim.
     * @param amount          Requested payout amount.
     * @param descriptionHash Keccak-256 hash of the off-chain description document.
     * @param status          Current claim lifecycle status.
     * @param timestamp       Block timestamp when the claim was submitted.
     */
    struct Claim {
        uint256     claimId;
        uint256     policyId;
        address     claimant;
        uint256     amount;
        bytes32     descriptionHash;
        bytes32     explanationHash;
        ClaimStatus status;
        uint256     timestamp;
    }

    /**
     * @notice Result from a single AI agent during claim adjudication.
     * @param agentName       Human-readable name of the AI agent (e.g. "TriageBot").
     * @param score           Confidence score (0–10 000 basis points).
     * @param recommendation  Encoded recommendation: 0 = Approve, 1 = Reject, 2 = Review.
     * @param reasonHash      Keccak-256 hash of the detailed reasoning document.
     */
    struct AIAgentResult {
        string  agentName;
        uint256 score;
        uint8   recommendation;
        bytes32 reasonHash;
    }

    /**
     * @notice Aggregated AI adjudication result for a claim.
     * @param claimId            The claim being adjudicated.
     * @param triageResult       AI triage agent’s result.
     * @param codingResult       AI medical-coding agent’s result.
     * @param fraudResult        AI fraud-detection agent’s result.
     * @param consensusScore     Weighted consensus score (0–10 000 bps).
     * @param adjudicatedAt      Block timestamp of adjudication.
     * @param isConsensusReached Whether the agents reached agreement.
     */
    struct ClaimAdjudication {
        uint256       claimId;
        AIAgentResult triageResult;
        AIAgentResult codingResult;
        AIAgentResult fraudResult;
        uint256       consensusScore;
        uint256       adjudicatedAt;
        bool          isConsensusReached;
    }

    /**
     * @notice A fraud detection flag raised against a claim.
     * @param claimId    The claim flagged.
     * @param flagType   Category of fraud indicator (e.g. keccak256("DUPLICATE")).
     * @param severity   Severity level (1 = low, 5 = critical).
     * @param detectedAt Block timestamp of detection.
     */
    struct FraudFlag {
        uint256 claimId;
        bytes32 flagType;
        uint8   severity;
        uint256 detectedAt;
    }

    // ──────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────

    /// @notice The ERC-20 stablecoin used for premiums and payouts.
    IERC20 public immutable stablecoin;

    /// @notice Whether payouts are currently paused (fraud/treasury safety).
    bool public payoutsPaused;

    /// @notice Auto-incrementing policy (== token) counter.
    uint256 private _nextPolicyId;

    /// @notice Auto-incrementing claim counter.
    uint256 private _nextClaimId;

    /// @notice policyId ⇒ Policy details.
    mapping(uint256 => Policy) private _policies;

    /// @notice claimId  ⇒ Claim details.
    mapping(uint256 => Claim) private _claims;

    /// @notice policyId ⇒ array of claim IDs filed against it.
    mapping(uint256 => uint256[]) private _policyClaimIds;

    /// @notice holder address ⇒ array of policy IDs held.
    mapping(address => uint256[]) private _holderPolicyIds;

    /// @notice claimId ⇒ AI adjudication result.
    mapping(uint256 => ClaimAdjudication) private _claimAdjudications;

    /// @notice claimId ⇒ array of fraud flags raised.
    mapping(uint256 => FraudFlag[]) private _fraudFlags;

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

    /// @notice Emitted when an AI adjudication is submitted for a claim.
    event AIAdjudicationSubmitted(
        uint256 indexed claimId,
        uint256 consensusScore,
        bool    isConsensusReached,
        uint256 timestamp
    );

    /// @notice Emitted when a fraud anomaly is detected on a claim.
    event AnomalyDetected(
        uint256 indexed claimId,
        bytes32 indexed flagType,
        uint8   severity,
        uint256 timestamp
    );

    /// @notice Emitted when a claim is flagged for fraud or anomaly.
    event ClaimFlagged(
        uint256 indexed claimId,
        bytes32 indexed flagType,
        string  reason,
        uint256 timestamp
    );

    /// @notice Emitted when payouts are paused by CRE risk monitor.
    event PayoutsPaused(address indexed pausedBy, string reason, uint256 timestamp);

    /// @notice Emitted when payouts are resumed.
    event PayoutsResumed(address indexed resumedBy, uint256 timestamp);

    /// @notice Emitted when a cross-chain payout is initiated via CCIP.
    event CrossChainPayoutInitiated(
        uint256 indexed claimId,
        uint256 indexed policyId,
        uint64  destinationChainSelector,
        address recipient,
        uint256 amount,
        bytes32 ccipMessageId,
        uint256 timestamp
    );

    /// @notice Emitted when an AI explanation hash is attached to a claim.
    event ExplanationHashSet(
        uint256 indexed claimId,
        bytes32 explanationHash,
        uint256 timestamp
    );

    /// @notice Emitted when a CRE cron job adjusts a premium.
    event CronPremiumAdjusted(
        uint256 indexed policyId,
        uint256 oldPremium,
        uint256 newPremium,
        uint256 newRiskScore,
        uint256 timestamp
    );

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

    /// @notice Thrown when AI adjudication has already been submitted for a claim.
    error AdjudicationAlreadyExists(uint256 claimId);

    /// @notice Thrown when an invalid consensus score is provided.
    error InvalidConsensusScore(uint256 score);

    /// @notice Thrown when payouts are paused.
    error PayoutsArePaused();

    /// @notice Thrown when payouts are not paused.
    error PayoutsNotPaused();

    /// @notice Thrown when payouts are already in the requested state.
    error PayoutsAlreadyInState(bool currentState);

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────

    /**
     * @notice Deploy the InsurancePolicy contract.
     * @param admin           Initial administrator address.
     * @param stablecoinAddr  ERC-20 stablecoin used for financial operations.
     * @param worldIdVerifier Address of the World ID verifier (or `address(0)`).
     */
    constructor(
        address admin,
        address stablecoinAddr,
        address worldIdVerifier
    ) ERC721("mediCaRE Insurance Policy", "mINS") {
        if (admin == address(0) || stablecoinAddr == address(0)) revert InvalidAddress();

        stablecoin = IERC20(stablecoinAddr);

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _setRoleAdmin(CLAIMS_PROCESSOR_ROLE, ADMIN_ROLE);
        _setRoleAdmin(CRE_ROLE, ADMIN_ROLE);

        _setWorldIdVerifier(worldIdVerifier);
    }

    // ──────────────────────────────────────────────
    //  Policy Lifecycle
    // ──────────────────────────────────────────────

    /**
     * @notice Mint a new insurance policy NFT.
     * @dev The caller (admin) specifies all policy parameters. The first premium
     *      is collected from the holder at creation time.
     * @param holder         Policyholder address (receives the NFT).
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
    )
        external
        onlyRole(ADMIN_ROLE)
        nonReentrant
        returns (uint256 policyId)
    {
        if (holder == address(0)) revert InvalidAddress();
        if (coverageAmount == 0 || premiumAmount == 0) revert InvalidAmount();
        if (riskScore > MAX_RISK_SCORE) revert InvalidRiskScore(riskScore);

        unchecked { policyId = _nextPolicyId++; }
        uint256 expiry = block.timestamp + (durationDays * 1 days);

        _policies[policyId] = Policy({
            policyId: policyId,
            holder: holder,
            coverageAmount: coverageAmount,
            premiumAmount: premiumAmount,
            expiryDate: expiry,
            isActive: true,
            riskScore: riskScore
        });
        _holderPolicyIds[holder].push(policyId);

        // Mint the NFT to the holder.
        _mint(holder, policyId);

        // Collect the initial premium from the holder.
        stablecoin.safeTransferFrom(holder, address(this), premiumAmount);

        emit PolicyCreated(policyId, holder, coverageAmount, premiumAmount, expiry, riskScore);
    }

    /**
     * @notice Renew an existing policy by paying the current premium and
     *         extending the expiry date.
     * @param policyId     The policy to renew.
     * @param durationDays Additional days to add.
     */
    function renewPolicy(uint256 policyId, uint256 durationDays)
        external
        nonReentrant
    {
        Policy storage p = _policies[policyId];
        if (p.holder == address(0)) revert PolicyNotFound(policyId);
        if (msg.sender != p.holder) revert NotPolicyholder(msg.sender, policyId);

        uint256 newExpiry = (block.timestamp > p.expiryDate ? block.timestamp : p.expiryDate)
            + (durationDays * 1 days);
        p.expiryDate = newExpiry;
        p.isActive = true;

        // Collect renewal premium.
        stablecoin.safeTransferFrom(msg.sender, address(this), p.premiumAmount);

        emit PolicyRenewed(policyId, newExpiry, p.premiumAmount);
    }

    /**
     * @notice Deactivate a policy (e.g. upon cancellation).
     * @param policyId The policy to deactivate.
     */
    function deactivatePolicy(uint256 policyId) external onlyRole(ADMIN_ROLE) {
        Policy storage p = _policies[policyId];
        if (p.holder == address(0)) revert PolicyNotFound(policyId);
        p.isActive = false;
        emit PolicyDeactivated(policyId, block.timestamp);
    }

    /**
     * @notice Dynamically adjust a policy's premium and risk score.
     * @dev Intended to be called by an off-chain CRE / AI risk pipeline.
     * @param policyId     The policy to adjust.
     * @param newPremium   New premium amount in stablecoin units.
     * @param newRiskScore Updated risk score (0–10 000 bps).
     */
    function adjustPremium(
        uint256 policyId,
        uint256 newPremium,
        uint256 newRiskScore
    ) external onlyRole(ADMIN_ROLE) {
        if (newPremium == 0) revert InvalidAmount();
        if (newRiskScore > MAX_RISK_SCORE) revert InvalidRiskScore(newRiskScore);

        Policy storage p = _policies[policyId];
        if (p.holder == address(0)) revert PolicyNotFound(policyId);

        uint256 oldPremium = p.premiumAmount;
        p.premiumAmount = newPremium;
        p.riskScore = newRiskScore;

        emit PremiumAdjusted(policyId, oldPremium, newPremium, newRiskScore);
    }

    // ──────────────────────────────────────────────
    //  Claims Lifecycle
    // ──────────────────────────────────────────────

    /**
     * @notice Submit a new claim against an active policy.
     * @param policyId        The policy under which the claim is filed.
     * @param amount          Requested payout amount.
     * @param descriptionHash Keccak-256 hash of the off-chain claim description.
     * @return claimId        The identifier of the newly created claim.
     */
    function submitClaim(
        uint256 policyId,
        uint256 amount,
        bytes32 descriptionHash
    )
        external
        returns (uint256 claimId)
    {
        Policy storage p = _policies[policyId];
        if (p.holder == address(0)) revert PolicyNotFound(policyId);
        if (!p.isActive) revert PolicyNotActive(policyId);
        if (block.timestamp > p.expiryDate) revert PolicyExpired(policyId);
        if (msg.sender != p.holder) revert NotPolicyholder(msg.sender, policyId);
        if (amount == 0) revert InvalidAmount();
        if (amount > p.coverageAmount) revert ClaimExceedsCoverage(amount, p.coverageAmount);

        unchecked { claimId = _nextClaimId++; }
        _claims[claimId] = Claim({
            claimId: claimId,
            policyId: policyId,
            claimant: msg.sender,
            amount: amount,
            descriptionHash: descriptionHash,
            explanationHash: bytes32(0),
            status: ClaimStatus.Pending,
            timestamp: block.timestamp
        });
        _policyClaimIds[policyId].push(claimId);

        emit ClaimSubmitted(claimId, policyId, msg.sender, amount, descriptionHash);
    }

    /**
     * @notice Approve or reject a pending claim.
     * @param claimId   The claim to process.
     * @param approved  `true` to approve, `false` to reject.
     */
    function processClaim(uint256 claimId, bool approved)
        external
        onlyRole(CLAIMS_PROCESSOR_ROLE)
    {
        Claim storage c = _claims[claimId];
        if (c.timestamp == 0) revert ClaimNotFound(claimId);
        if (c.status != ClaimStatus.Pending) {
            revert InvalidClaimStatus(claimId, c.status, ClaimStatus.Pending);
        }

        c.status = approved ? ClaimStatus.Approved : ClaimStatus.Rejected;
        emit ClaimProcessed(claimId, c.status, msg.sender);
    }

    /**
     * @notice Pay out an approved claim to the policyholder.
     * @param claimId The claim to pay.
     */
    function payoutClaim(uint256 claimId)
        external
        onlyRole(CLAIMS_PROCESSOR_ROLE)
        nonReentrant
    {
        if (payoutsPaused) revert PayoutsArePaused();
        Claim storage c = _claims[claimId];
        if (c.timestamp == 0) revert ClaimNotFound(claimId);
        if (c.status != ClaimStatus.Approved) {
            revert InvalidClaimStatus(claimId, c.status, ClaimStatus.Approved);
        }

        uint256 balance = stablecoin.balanceOf(address(this));
        if (balance < c.amount) {
            revert InsufficientContractBalance(c.amount, balance);
        }

        c.status = ClaimStatus.Paid;
        stablecoin.safeTransfer(c.claimant, c.amount);

        emit ClaimPaid(claimId, c.policyId, c.claimant, c.amount);
    }

    // ──────────────────────────────────────────────
    //  AI Adjudication & Fraud Detection
    // ──────────────────────────────────────────────

    /**
     * @notice Submit an aggregated AI adjudication result for a pending claim.
     * @dev Only callable by addresses with `CRE_ROLE`. If any fraud flags are
     *      included, {AnomalyDetected} events are emitted for each flag.
     * @param claimId        The claim being adjudicated.
     * @param triageResult   AI triage agent output.
     * @param codingResult   AI medical-coding agent output.
     * @param fraudResult    AI fraud-detection agent output.
     * @param consensusScore Weighted consensus score (0–10 000 bps).
     * @param fraudFlags     Optional array of fraud flags to record.
     */
    function submitAIAdjudication(
        uint256 claimId,
        AIAgentResult calldata triageResult,
        AIAgentResult calldata codingResult,
        AIAgentResult calldata fraudResult,
        uint256 consensusScore,
        FraudFlag[] calldata fraudFlags
    ) external onlyRole(CRE_ROLE) {
        Claim storage c = _claims[claimId];
        if (c.timestamp == 0) revert ClaimNotFound(claimId);
        if (c.status != ClaimStatus.Pending) {
            revert InvalidClaimStatus(claimId, c.status, ClaimStatus.Pending);
        }
        if (_claimAdjudications[claimId].adjudicatedAt != 0) {
            revert AdjudicationAlreadyExists(claimId);
        }
        if (consensusScore > MAX_RISK_SCORE) revert InvalidConsensusScore(consensusScore);

        // Determine consensus: all three agents must share the same recommendation.
        bool consensus = (
            triageResult.recommendation == codingResult.recommendation &&
            codingResult.recommendation == fraudResult.recommendation
        );

        _claimAdjudications[claimId] = ClaimAdjudication({
            claimId: claimId,
            triageResult: triageResult,
            codingResult: codingResult,
            fraudResult: fraudResult,
            consensusScore: consensusScore,
            adjudicatedAt: block.timestamp,
            isConsensusReached: consensus
        });

        // Record fraud flags.
        for (uint256 i; i < fraudFlags.length; ) {
            _fraudFlags[claimId].push(fraudFlags[i]);
            emit AnomalyDetected(claimId, fraudFlags[i].flagType, fraudFlags[i].severity, block.timestamp);
            unchecked { ++i; }
        }

        emit AIAdjudicationSubmitted(claimId, consensusScore, consensus, block.timestamp);
    }

    /**
     * @notice CRE cron-triggered premium adjustment based on risk reassessment.
     * @dev Only callable by addresses with `CRE_ROLE`. Intended to be invoked
     *      periodically by a Chainlink CRE cron workflow.
     * @param policyId     The policy to adjust.
     * @param newPremium   Updated premium amount.
     * @param newRiskScore Updated risk score (0–10 000 bps).
     */
    function adjustPremiumByCron(
        uint256 policyId,
        uint256 newPremium,
        uint256 newRiskScore
    ) external onlyRole(CRE_ROLE) {
        if (newPremium == 0) revert InvalidAmount();
        if (newRiskScore > MAX_RISK_SCORE) revert InvalidRiskScore(newRiskScore);

        Policy storage p = _policies[policyId];
        if (p.holder == address(0)) revert PolicyNotFound(policyId);

        uint256 oldPremium = p.premiumAmount;
        p.premiumAmount = newPremium;
        p.riskScore = newRiskScore;

        emit CronPremiumAdjusted(policyId, oldPremium, newPremium, newRiskScore, block.timestamp);
    }

    /**
     * @notice Retrieve the AI adjudication result for a claim.
     * @param claimId The claim ID.
     * @return adjudication The ClaimAdjudication struct.
     */
    function getClaimAdjudication(uint256 claimId)
        external
        view
        returns (ClaimAdjudication memory adjudication)
    {
        adjudication = _claimAdjudications[claimId];
    }

    /**
     * @notice Retrieve all fraud flags for a claim.
     * @param claimId The claim ID.
     * @return flags Array of FraudFlag structs.
     */
    function getClaimFraudFlags(uint256 claimId)
        external
        view
        returns (FraudFlag[] memory flags)
    {
        flags = _fraudFlags[claimId];
    }

    // ──────────────────────────────────────────────
    //  Admin Helpers
    // ──────────────────────────────────────────────

    /**
     * @notice Attach an AI explanation hash to a processed claim.
     * @param claimId         The claim to annotate.
     * @param _explanationHash Keccak-256 hash of the structured AI reasoning document.
     */
    function setExplanationHash(
        uint256 claimId,
        bytes32 _explanationHash
    ) external onlyRole(CRE_ROLE) {
        Claim storage c = _claims[claimId];
        if (c.timestamp == 0) revert ClaimNotFound(claimId);
        c.explanationHash = _explanationHash;
        emit ExplanationHashSet(claimId, _explanationHash, block.timestamp);
    }

    /**
     * @notice Flag a claim for fraud or anomaly detection.
     * @param claimId  The claim to flag.
     * @param flagType Category of the flag (e.g. keccak256("BILLING_SPIKE")).
     * @param reason   Human-readable reason for the flag.
     */
    function flagClaim(
        uint256 claimId,
        bytes32 flagType,
        string calldata reason
    ) external onlyRole(CRE_ROLE) {
        Claim storage c = _claims[claimId];
        if (c.timestamp == 0) revert ClaimNotFound(claimId);
        _fraudFlags[claimId].push(FraudFlag({
            claimId: claimId,
            flagType: flagType,
            severity: 3,
            detectedAt: block.timestamp
        }));
        emit ClaimFlagged(claimId, flagType, reason, block.timestamp);
    }

    /**
     * @notice Pause all payouts (triggered by CRE risk monitor on anomaly detection).
     * @param reason Human-readable reason for pausing.
     */
    function pausePayouts(string calldata reason) external onlyRole(CRE_ROLE) {
        if (payoutsPaused) revert PayoutsAlreadyInState(true);
        payoutsPaused = true;
        emit PayoutsPaused(msg.sender, reason, block.timestamp);
    }

    /**
     * @notice Resume payouts after risk review.
     */
    function resumePayouts() external onlyRole(ADMIN_ROLE) {
        if (!payoutsPaused) revert PayoutsAlreadyInState(false);
        payoutsPaused = false;
        emit PayoutsResumed(msg.sender, block.timestamp);
    }

    /**
     * @notice Record a cross-chain payout initiation via CCIP.
     * @param claimId                   The claim being paid.
     * @param destinationChainSelector  CCIP destination chain selector.
     * @param recipient                 Recipient address on the destination chain.
     * @param amount                    Amount being transferred.
     * @param ccipMessageId             The CCIP message ID for tracking.
     */
    function recordCrossChainPayout(
        uint256 claimId,
        uint64  destinationChainSelector,
        address recipient,
        uint256 amount,
        bytes32 ccipMessageId
    ) external onlyRole(CRE_ROLE) {
        Claim storage c = _claims[claimId];
        if (c.timestamp == 0) revert ClaimNotFound(claimId);
        emit CrossChainPayoutInitiated(
            claimId, c.policyId, destinationChainSelector,
            recipient, amount, ccipMessageId, block.timestamp
        );
    }

    /**
     * @notice Update the World ID verifier address.
     * @param newVerifier The new verifier contract address.
     */
    function setWorldIdVerifier(address newVerifier) external onlyRole(ADMIN_ROLE) {
        _setWorldIdVerifier(newVerifier);
    }

    /**
     * @notice Withdraw accumulated premiums to a treasury address.
     * @param to     Recipient address.
     * @param amount Amount of stablecoin to transfer.
     */
    function withdrawFunds(address to, uint256 amount)
        external
        onlyRole(ADMIN_ROLE)
        nonReentrant
    {
        if (to == address(0)) revert InvalidAddress();
        stablecoin.safeTransfer(to, amount);
    }

    // ──────────────────────────────────────────────
    //  View / Read Functions
    // ──────────────────────────────────────────────

    /**
     * @notice Retrieve the full details of a policy.
     * @param policyId The policy ID.
     * @return policy The Policy struct.
     */
    function getPolicy(uint256 policyId) external view returns (Policy memory policy) {
        if (_policies[policyId].holder == address(0)) revert PolicyNotFound(policyId);
        policy = _policies[policyId];
    }

    /**
     * @notice Retrieve the full details of a claim.
     * @param claimId The claim ID.
     * @return claim The Claim struct.
     */
    function getClaim(uint256 claimId) external view returns (Claim memory claim) {
        if (_claims[claimId].timestamp == 0) revert ClaimNotFound(claimId);
        claim = _claims[claimId];
    }

    /**
     * @notice Retrieve all claim IDs for a given policy.
     * @param policyId The policy ID.
     * @return claimIds Array of claim identifiers.
     */
    function getPolicyClaims(uint256 policyId) external view returns (uint256[] memory claimIds) {
        claimIds = _policyClaimIds[policyId];
    }

    /**
     * @notice Retrieve all policy IDs held by an address.
     * @param holder The holder address.
     * @return policyIds Array of policy identifiers.
     */
    function getHolderPolicies(address holder) external view returns (uint256[] memory policyIds) {
        policyIds = _holderPolicyIds[holder];
    }

    /**
     * @notice Total number of policies created.
     */
    function totalPolicies() external view returns (uint256) {
        return _nextPolicyId;
    }

    /**
     * @notice Total number of claims created.
     */
    function totalClaims() external view returns (uint256) {
        return _nextClaimId;
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
