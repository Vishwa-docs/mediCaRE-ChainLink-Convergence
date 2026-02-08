// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IWorldIDVerifier
 * @author mediCaRE DAO
 * @notice Interface for World ID identity verification integration.
 * @dev Implement this interface in a concrete verifier contract that bridges
 *      to WorldCoin's on-chain verification system. The mediCaRE contracts
 *      reference this interface to gate sensitive operations behind proof-of-
 *      personhood checks.
 */
interface IWorldIDVerifier {
    /**
     * @notice Check whether a given address has completed World ID verification.
     * @param account The address to query.
     * @return verified `true` if the account has been verified, `false` otherwise.
     */
    function isVerified(address account) external view returns (bool verified);

    /**
     * @notice Submit a World ID proof for on-chain verification.
     * @param account  The address being verified.
     * @param root     The Merkle root of the World ID identity set.
     * @param nullifierHash  A unique hash preventing double-signalling.
     * @param proof    The zero-knowledge proof bytes.
     * @return success `true` if the proof was accepted and the account is now verified.
     */
    function verify(
        address account,
        uint256 root,
        uint256 nullifierHash,
        bytes calldata proof
    ) external returns (bool success);
}

/**
 * @title AccessManager
 * @author mediCaRE DAO
 * @notice Shared access-control utilities for World ID gated operations.
 * @dev Inherit this contract to enforce proof-of-personhood on any function.
 *      The World ID verifier address can be updated by the inheriting contract's
 *      admin through {_setWorldIdVerifier}.
 *
 *      Usage:
 *      ```
 *      contract MyContract is AccessManager {
 *          constructor(address verifier) {
 *              _setWorldIdVerifier(verifier);
 *          }
 *
 *          function sensitiveAction() external onlyVerifiedIdentity { ... }
 *      }
 *      ```
 */
abstract contract AccessManager {
    // ──────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────

    /// @notice The World ID verifier contract used for identity checks.
    IWorldIDVerifier public worldIdVerifier;

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    /// @notice Emitted when the World ID verifier address is updated.
    /// @param oldVerifier The previous verifier address.
    /// @param newVerifier The new verifier address.
    event WorldIdVerifierUpdated(address indexed oldVerifier, address indexed newVerifier);

    // ──────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────

    /// @notice Thrown when the caller has not completed World ID verification.
    error IdentityNotVerified(address account);

    /// @notice Thrown when the zero address is supplied for the verifier.
    error InvalidVerifierAddress();

    /// @notice Thrown when no World ID verifier has been configured.
    error VerifierNotSet();

    // ──────────────────────────────────────────────
    //  Modifiers
    // ──────────────────────────────────────────────

    /**
     * @notice Require that the caller has a verified World ID identity.
     * @dev Reverts with {IdentityNotVerified} if the check fails.
     *      If no verifier is set the modifier passes (fail-open during
     *      development / testnets). Override {_requireVerifiedIdentity} if
     *      you need fail-closed behaviour.
     */
    modifier onlyVerifiedIdentity() {
        _requireVerifiedIdentity(msg.sender);
        _;
    }

    // ──────────────────────────────────────────────
    //  Internal helpers
    // ──────────────────────────────────────────────

    /**
     * @notice Set or update the World ID verifier contract address.
     * @param verifier The new verifier address. Use `address(0)` to disable.
     */
    function _setWorldIdVerifier(address verifier) internal {
        address old = address(worldIdVerifier);
        worldIdVerifier = IWorldIDVerifier(verifier);
        emit WorldIdVerifierUpdated(old, verifier);
    }

    /**
     * @notice Internal check that reverts if `account` is not World-ID-verified.
     * @dev When the verifier is the zero address the check is skipped (fail-open).
     * @param account The address to verify.
     */
    function _requireVerifiedIdentity(address account) internal view {
        if (address(worldIdVerifier) == address(0)) {
            // No verifier configured — fail-open (testnet / dev mode).
            return;
        }
        if (!worldIdVerifier.isVerified(account)) {
            revert IdentityNotVerified(account);
        }
    }

    /**
     * @notice Query whether an account has been verified via World ID.
     * @param account The address to check.
     * @return True if verified or if no verifier is configured, false otherwise.
     */
    function isWorldIdVerified(address account) public view returns (bool) {
        if (address(worldIdVerifier) == address(0)) {
            return true; // fail-open when no verifier set
        }
        return worldIdVerifier.isVerified(account);
    }
}
