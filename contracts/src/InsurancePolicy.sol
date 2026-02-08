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
        ClaimStatus status;
        uint256     timestamp;
    }

    // ──────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────

    /// @notice The ERC-20 stablecoin used for premiums and payouts.
    IERC20 public immutable stablecoin;

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

        policyId = _nextPolicyId++;
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

        claimId = _nextClaimId++;
        _claims[claimId] = Claim({
            claimId: claimId,
            policyId: policyId,
            claimant: msg.sender,
            amount: amount,
            descriptionHash: descriptionHash,
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
    //  Admin Helpers
    // ──────────────────────────────────────────────

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
