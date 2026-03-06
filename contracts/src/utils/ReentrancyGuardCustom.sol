// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ReentrancyGuardCustom
 * @author mediCaRE DAO
 * @notice Custom reentrancy guard that extends the standard mutex pattern with
 *         event logging for observability.  When a reentrant call is blocked,
 *         an {ReentrancyBlocked} event is emitted *before* the revert so that
 *         off-chain monitoring systems (Tenderly, Forta, OpenZeppelin Defender)
 *         can detect and alert on attack attempts.
 *
 * @dev The implementation mirrors OpenZeppelin's {ReentrancyGuard} but adds:
 *
 *      1. An event-before-revert pattern:  `emit` → `revert` ensures the
 *         event is included in the *trace* of the failing transaction, which
 *         many monitoring tools index even for reverted txns.
 *
 *      2. An optional `guardId` label passed to the modifier so that
 *         contracts with multiple guarded entry-points can distinguish
 *         which function was targeted.
 *
 *      3. A public `reentrancyStatus()` view for integration tests and
 *         off-chain assertions.
 *
 *      Storage Layout
 *      ──────────────
 *      Uses a single `uint256` status slot (`_status`).  The values are:
 *        - 1 → NOT_ENTERED
 *        - 2 → ENTERED
 *
 *      This two-value scheme avoids a zero → non-zero SSTORE (20 000 gas)
 *      by keeping the slot always non-zero.
 */
abstract contract ReentrancyGuardCustom {
    // ──────────────────────────────────────────────
    //  Constants
    // ──────────────────────────────────────────────

    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;

    // ──────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────

    /// @dev Current reentrancy status.
    uint256 private _status;

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    /**
     * @notice Emitted when a reentrant call is detected and blocked.
     * @param caller  The `msg.sender` of the reentrant call.
     * @param guardId A label identifying which guarded function was targeted
     *                (empty string if the label-free modifier was used).
     */
    event ReentrancyBlocked(address indexed caller, string guardId);

    // ──────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────

    /// @notice Thrown when a reentrant call is detected.
    error ReentrantCall(address caller);

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────

    constructor() {
        _status = _NOT_ENTERED;
    }

    // ──────────────────────────────────────────────
    //  Modifiers
    // ──────────────────────────────────────────────

    /**
     * @notice Prevent reentrant calls (label-free variant).
     * @dev Drop-in replacement for OpenZeppelin's `nonReentrant`.
     */
    modifier nonReentrantCustom() {
        _enterGuard("");
        _;
        _exitGuard();
    }

    /**
     * @notice Prevent reentrant calls with a label for monitoring.
     * @param guardId An identifier so off-chain tools can distinguish
     *                which function was targeted.
     */
    modifier nonReentrantLabeled(string memory guardId) {
        _enterGuard(guardId);
        _;
        _exitGuard();
    }

    // ──────────────────────────────────────────────
    //  View
    // ──────────────────────────────────────────────

    /**
     * @notice Returns `true` if the contract is currently inside a guarded
     *         function (i.e. the mutex is held).
     * @dev Useful in tests and monitoring scripts.
     */
    function reentrancyStatus() public view returns (bool entered) {
        entered = (_status == _ENTERED);
    }

    // ──────────────────────────────────────────────
    //  Internal Helpers
    // ──────────────────────────────────────────────

    /**
     * @dev Acquire the mutex.  If it is already held, emit an event and
     *      revert.
     * @param guardId Label forwarded to the event (may be empty).
     */
    function _enterGuard(string memory guardId) private {
        if (_status == _ENTERED) {
            emit ReentrancyBlocked(msg.sender, guardId);
            revert ReentrantCall(msg.sender);
        }
        _status = _ENTERED;
    }

    /**
     * @dev Release the mutex.
     */
    function _exitGuard() private {
        _status = _NOT_ENTERED;
    }
}
