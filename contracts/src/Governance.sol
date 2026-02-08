// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Governance
 * @author mediCaRE DAO
 * @notice DAO governance contract for the mediCaRE protocol.  Supports
 *         token-weighted voting, configurable quorum, and a timelock period
 *         before execution.
 *
 * @dev Architecture decisions:
 *      - Voting power is snapshot-free:  a voter's weight equals their
 *        governance-token balance at the time of the `vote()` call.
 *      - A proposal passes if `forVotes > againstVotes` *and* total
 *        participation meets the quorum threshold.
 *      - After the voting window closes, an eligible proposal enters a
 *        mandatory timelock (`executionDelay`) before it may be executed.
 *      - Proposal types are advisory labels; execution logic is intentionally
 *        kept generic (calldata + target) so any on-chain action can be
 *        governed.
 */
contract Governance is AccessControl, ReentrancyGuard {
    // ──────────────────────────────────────────────
    //  Constants & Roles
    // ──────────────────────────────────────────────

    /// @notice Role for platform administrators.
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    /// @notice Role that is allowed to execute proposals after timelock.
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");

    // ──────────────────────────────────────────────
    //  Enums
    // ──────────────────────────────────────────────

    /// @notice Categories of governance proposals.
    enum ProposalType {
        PARAMETER_CHANGE,
        RISK_THRESHOLD,
        DATA_SHARING,
        PROTOCOL_UPGRADE
    }

    /// @notice Lifecycle status of a proposal.
    enum ProposalStatus {
        Active,
        Succeeded,
        Defeated,
        Executed,
        Cancelled
    }

    // ──────────────────────────────────────────────
    //  Data Structures
    // ──────────────────────────────────────────────

    /**
     * @notice On-chain representation of a governance proposal.
     * @param proposalId   Unique auto-incremented identifier.
     * @param proposer     Address that created the proposal.
     * @param description  Short human-readable description.
     * @param forVotes     Total governance tokens cast in favour.
     * @param againstVotes Total governance tokens cast against.
     * @param startTime    Unix timestamp when voting opens.
     * @param endTime      Unix timestamp when voting closes.
     * @param executed     Whether the proposal has been executed.
     * @param cancelled    Whether the proposal has been cancelled.
     * @param proposalType Category label for the proposal.
     * @param target       Contract address to call upon execution (address(0) for signal votes).
     * @param callData     Encoded function call to execute.
     */
    struct Proposal {
        uint256      proposalId;
        address      proposer;
        string       description;
        uint256      forVotes;
        uint256      againstVotes;
        uint256      startTime;
        uint256      endTime;
        bool         executed;
        bool         cancelled;
        ProposalType proposalType;
        address      target;
        bytes        callData;
    }

    // ──────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────

    /// @notice The ERC-20 governance token used for voting weight.
    IERC20 public immutable governanceToken;

    /// @notice Auto-incrementing proposal counter.
    uint256 private _nextProposalId;

    /// @notice proposalId ⇒ Proposal.
    mapping(uint256 => Proposal) private _proposals;

    /// @notice proposalId ⇒ voter ⇒ has voted?
    mapping(uint256 => mapping(address => bool)) private _hasVoted;

    /// @notice proposalId ⇒ voter ⇒ voting weight used.
    mapping(uint256 => mapping(address => uint256)) private _voteWeight;

    // ── Configurable parameters ──

    /// @notice Minimum token balance required to create a proposal.
    uint256 public proposalThreshold;

    /// @notice Quorum: minimum total votes (for + against) for a proposal to be valid.
    uint256 public quorumVotes;

    /// @notice Default voting period in seconds.
    uint256 public votingPeriod;

    /// @notice Delay (seconds) between a proposal succeeding and being executable.
    uint256 public executionDelay;

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        string  description,
        ProposalType proposalType,
        uint256 startTime,
        uint256 endTime,
        address target
    );

    event VoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        bool    support,
        uint256 weight
    );

    event ProposalExecuted(uint256 indexed proposalId, address indexed executor);

    event ProposalCancelled(uint256 indexed proposalId, address indexed cancelledBy);

    event GovernanceParametersUpdated(
        uint256 proposalThreshold,
        uint256 quorumVotes,
        uint256 votingPeriod,
        uint256 executionDelay
    );

    // ──────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────

    error InsufficientTokenBalance(uint256 required, uint256 available);
    error ProposalNotFound(uint256 proposalId);
    error VotingNotActive(uint256 proposalId);
    error AlreadyVoted(address voter, uint256 proposalId);
    error ProposalNotSucceeded(uint256 proposalId);
    error TimelockNotExpired(uint256 proposalId, uint256 readyAt);
    error ProposalAlreadyExecuted(uint256 proposalId);
    error ProposalAlreadyCancelled(uint256 proposalId);
    error ExecutionFailed(uint256 proposalId);
    error NotProposerOrAdmin(address caller, uint256 proposalId);
    error InvalidVotingPeriod();
    error InvalidQuorum();
    error ZeroWeight();
    error DescriptionEmpty();

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────

    /**
     * @notice Deploy the Governance contract.
     * @param admin              Initial administrator address.
     * @param governanceTokenAddr ERC-20 token used for voting.
     * @param _proposalThreshold Minimum token balance to propose.
     * @param _quorumVotes       Minimum total votes for quorum.
     * @param _votingPeriod      Voting window in seconds.
     * @param _executionDelay    Timelock in seconds after vote closes.
     */
    constructor(
        address admin,
        address governanceTokenAddr,
        uint256 _proposalThreshold,
        uint256 _quorumVotes,
        uint256 _votingPeriod,
        uint256 _executionDelay
    ) {
        require(admin != address(0) && governanceTokenAddr != address(0), "Governance: zero address");
        if (_votingPeriod == 0) revert InvalidVotingPeriod();
        if (_quorumVotes == 0) revert InvalidQuorum();

        governanceToken = IERC20(governanceTokenAddr);
        proposalThreshold = _proposalThreshold;
        quorumVotes = _quorumVotes;
        votingPeriod = _votingPeriod;
        executionDelay = _executionDelay;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(EXECUTOR_ROLE, admin);
        _setRoleAdmin(EXECUTOR_ROLE, ADMIN_ROLE);
    }

    // ──────────────────────────────────────────────
    //  Proposal Lifecycle
    // ──────────────────────────────────────────────

    /**
     * @notice Create a new governance proposal.
     * @param description  Human-readable description.
     * @param proposalType Category of the proposal.
     * @param target       Contract to call on execution (address(0) for signal votes).
     * @param callData     Encoded function call (empty for signal votes).
     * @return proposalId  The identifier of the newly created proposal.
     */
    function createProposal(
        string calldata description,
        ProposalType proposalType,
        address target,
        bytes calldata callData
    )
        external
        returns (uint256 proposalId)
    {
        if (bytes(description).length == 0) revert DescriptionEmpty();

        uint256 balance = governanceToken.balanceOf(msg.sender);
        if (balance < proposalThreshold) {
            revert InsufficientTokenBalance(proposalThreshold, balance);
        }

        proposalId = _nextProposalId++;
        uint256 start = block.timestamp;
        uint256 end = start + votingPeriod;

        _proposals[proposalId] = Proposal({
            proposalId: proposalId,
            proposer: msg.sender,
            description: description,
            forVotes: 0,
            againstVotes: 0,
            startTime: start,
            endTime: end,
            executed: false,
            cancelled: false,
            proposalType: proposalType,
            target: target,
            callData: callData
        });

        emit ProposalCreated(proposalId, msg.sender, description, proposalType, start, end, target);
    }

    /**
     * @notice Cast a vote on an active proposal.
     * @dev Weight equals the caller's governance-token balance at call time.
     *      Each address may vote only once per proposal.
     * @param proposalId The proposal to vote on.
     * @param support    `true` for a yes vote, `false` for a no vote.
     */
    function vote(uint256 proposalId, bool support) external {
        Proposal storage p = _proposals[proposalId];
        if (p.startTime == 0) revert ProposalNotFound(proposalId);
        if (p.cancelled) revert ProposalAlreadyCancelled(proposalId);
        if (block.timestamp < p.startTime || block.timestamp > p.endTime) {
            revert VotingNotActive(proposalId);
        }
        if (_hasVoted[proposalId][msg.sender]) {
            revert AlreadyVoted(msg.sender, proposalId);
        }

        uint256 weight = governanceToken.balanceOf(msg.sender);
        if (weight == 0) revert ZeroWeight();

        _hasVoted[proposalId][msg.sender] = true;
        _voteWeight[proposalId][msg.sender] = weight;

        if (support) {
            p.forVotes += weight;
        } else {
            p.againstVotes += weight;
        }

        emit VoteCast(proposalId, msg.sender, support, weight);
    }

    /**
     * @notice Execute a succeeded proposal after the timelock has elapsed.
     * @dev Only addresses with `EXECUTOR_ROLE` may execute. If `target` is
     *      `address(0)` the proposal is treated as a signal vote (no on-chain
     *      call is made).
     * @param proposalId The proposal to execute.
     */
    function executeProposal(uint256 proposalId)
        external
        onlyRole(EXECUTOR_ROLE)
        nonReentrant
    {
        Proposal storage p = _proposals[proposalId];
        if (p.startTime == 0) revert ProposalNotFound(proposalId);
        if (p.executed) revert ProposalAlreadyExecuted(proposalId);
        if (p.cancelled) revert ProposalAlreadyCancelled(proposalId);

        // Voting must have ended.
        if (block.timestamp <= p.endTime) revert VotingNotActive(proposalId);

        // Must have passed (for > against && quorum met).
        ProposalStatus s = _computeStatus(p);
        if (s != ProposalStatus.Succeeded) revert ProposalNotSucceeded(proposalId);

        // Timelock check.
        uint256 readyAt = p.endTime + executionDelay;
        if (block.timestamp < readyAt) revert TimelockNotExpired(proposalId, readyAt);

        p.executed = true;

        // Execute on-chain call if a target is specified.
        if (p.target != address(0)) {
            (bool ok, ) = p.target.call(p.callData);
            if (!ok) revert ExecutionFailed(proposalId);
        }

        emit ProposalExecuted(proposalId, msg.sender);
    }

    /**
     * @notice Cancel a proposal.  Only the proposer or an admin may cancel.
     * @param proposalId The proposal to cancel.
     */
    function cancelProposal(uint256 proposalId) external {
        Proposal storage p = _proposals[proposalId];
        if (p.startTime == 0) revert ProposalNotFound(proposalId);
        if (p.executed) revert ProposalAlreadyExecuted(proposalId);
        if (p.cancelled) revert ProposalAlreadyCancelled(proposalId);

        if (msg.sender != p.proposer && !hasRole(ADMIN_ROLE, msg.sender)) {
            revert NotProposerOrAdmin(msg.sender, proposalId);
        }

        p.cancelled = true;
        emit ProposalCancelled(proposalId, msg.sender);
    }

    // ──────────────────────────────────────────────
    //  Admin Functions
    // ──────────────────────────────────────────────

    /**
     * @notice Update governance parameters.
     * @param _proposalThreshold New proposal threshold.
     * @param _quorumVotes       New quorum requirement.
     * @param _votingPeriod      New voting period (seconds).
     * @param _executionDelay    New timelock duration (seconds).
     */
    function updateParameters(
        uint256 _proposalThreshold,
        uint256 _quorumVotes,
        uint256 _votingPeriod,
        uint256 _executionDelay
    ) external onlyRole(ADMIN_ROLE) {
        if (_votingPeriod == 0) revert InvalidVotingPeriod();
        if (_quorumVotes == 0) revert InvalidQuorum();

        proposalThreshold = _proposalThreshold;
        quorumVotes = _quorumVotes;
        votingPeriod = _votingPeriod;
        executionDelay = _executionDelay;

        emit GovernanceParametersUpdated(_proposalThreshold, _quorumVotes, _votingPeriod, _executionDelay);
    }

    // ──────────────────────────────────────────────
    //  View / Read Functions
    // ──────────────────────────────────────────────

    /**
     * @notice Retrieve the full details of a proposal.
     * @param proposalId The proposal ID.
     * @return proposal The Proposal struct.
     */
    function getProposal(uint256 proposalId)
        external
        view
        returns (Proposal memory proposal)
    {
        if (_proposals[proposalId].startTime == 0) revert ProposalNotFound(proposalId);
        proposal = _proposals[proposalId];
    }

    /**
     * @notice Get the current status of a proposal.
     * @param proposalId The proposal ID.
     * @return status The computed ProposalStatus.
     */
    function getProposalStatus(uint256 proposalId)
        external
        view
        returns (ProposalStatus status)
    {
        Proposal storage p = _proposals[proposalId];
        if (p.startTime == 0) revert ProposalNotFound(proposalId);
        status = _computeStatus(p);
    }

    /**
     * @notice Check whether an address has voted on a proposal.
     * @param proposalId The proposal ID.
     * @param voter      The address to check.
     * @return voted     True if the address has voted.
     * @return weight    The voting weight used (0 if not voted).
     */
    function getVoteInfo(uint256 proposalId, address voter)
        external
        view
        returns (bool voted, uint256 weight)
    {
        voted = _hasVoted[proposalId][voter];
        weight = _voteWeight[proposalId][voter];
    }

    /**
     * @notice Total number of proposals created.
     */
    function totalProposals() external view returns (uint256) {
        return _nextProposalId;
    }

    // ──────────────────────────────────────────────
    //  Internal Helpers
    // ──────────────────────────────────────────────

    /**
     * @notice Compute the current status of a proposal.
     * @param p Storage reference to the proposal.
     * @return status The derived status.
     */
    function _computeStatus(Proposal storage p) internal view returns (ProposalStatus status) {
        if (p.cancelled) return ProposalStatus.Cancelled;
        if (p.executed) return ProposalStatus.Executed;
        if (block.timestamp <= p.endTime) return ProposalStatus.Active;

        uint256 totalVotes = p.forVotes + p.againstVotes;
        if (totalVotes >= quorumVotes && p.forVotes > p.againstVotes) {
            return ProposalStatus.Succeeded;
        }
        return ProposalStatus.Defeated;
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
