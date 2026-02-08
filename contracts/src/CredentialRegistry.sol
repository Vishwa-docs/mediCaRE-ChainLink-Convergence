// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./utils/AccessManager.sol";

/**
 * @title CredentialRegistry
 * @author mediCaRE DAO
 * @notice On-chain registry for healthcare provider verifiable credentials.
 *         Stores hashes of off-chain credential documents and provides query
 *         and revocation capabilities.
 *
 * @dev Credentials are indexed by a unique `credentialId` (auto-incrementing)
 *      and can be looked up per subject (provider address).  Only authorised
 *      issuers may issue credentials, and only the issuer or an admin may
 *      revoke them.
 *
 *      Supported credential types are enumerated in {CredentialType} but
 *      the set is extensible through governance proposals.
 */
contract CredentialRegistry is AccessControl, AccessManager {
    // ──────────────────────────────────────────────
    //  Constants & Roles
    // ──────────────────────────────────────────────

    /// @notice Role for platform administrators.
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    /// @notice Role for authorised credential issuers (e.g. medical boards).
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    // ──────────────────────────────────────────────
    //  Enums
    // ──────────────────────────────────────────────

    /**
     * @notice The type of healthcare credential.
     * @dev Add new types via governance — values should remain append-only to
     *      avoid breaking existing credential references.
     */
    enum CredentialType {
        LICENSE,        // Medical license
        BOARD_CERT,     // Board certification
        SPECIALTY,      // Specialty certification
        DEA,            // DEA registration
        NPI,            // National Provider Identifier
        CME,            // Continuing Medical Education
        FELLOWSHIP,     // Fellowship completion
        OTHER           // Catch-all for future types
    }

    // ──────────────────────────────────────────────
    //  Data Structures
    // ──────────────────────────────────────────────

    /**
     * @notice On-chain representation of a verifiable credential pointer.
     * @param credentialId    Unique auto-incremented identifier.
     * @param credentialHash  Keccak-256 hash of the off-chain credential document.
     * @param issuer          Address of the institution that issued the credential.
     * @param subject         Address of the provider who holds the credential.
     * @param credentialType  Category of the credential.
     * @param issuanceDate    Unix timestamp when the credential was issued.
     * @param expiryDate      Unix timestamp when the credential expires (0 = no expiry).
     * @param isValid         Whether the credential has been revoked.
     */
    struct Credential {
        uint256        credentialId;
        bytes32        credentialHash;
        address        issuer;
        address        subject;
        CredentialType credentialType;
        uint256        issuanceDate;
        uint256        expiryDate;
        bool           isValid;
    }

    // ──────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────

    /// @notice Auto-incrementing credential counter.
    uint256 private _nextCredentialId;

    /// @notice credentialId ⇒ Credential metadata.
    mapping(uint256 => Credential) private _credentials;

    /// @notice subject address ⇒ array of credential IDs held.
    mapping(address => uint256[]) private _providerCredentialIds;

    /// @notice issuer address ⇒ array of credential IDs issued.
    mapping(address => uint256[]) private _issuerCredentialIds;

    /// @notice credentialHash ⇒ credentialId (reverse lookup / duplicate prevention).
    mapping(bytes32 => uint256) private _hashToId;

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    event CredentialIssued(
        uint256 indexed credentialId,
        bytes32 credentialHash,
        address indexed issuer,
        address indexed subject,
        CredentialType credentialType,
        uint256 issuanceDate,
        uint256 expiryDate
    );

    event CredentialRevoked(
        uint256 indexed credentialId,
        address indexed revokedBy,
        uint256 timestamp
    );

    event CredentialRenewed(
        uint256 indexed credentialId,
        uint256 oldExpiryDate,
        uint256 newExpiryDate
    );

    // ──────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────

    error InvalidAddress();
    error InvalidCredentialHash();
    error CredentialNotFound(uint256 credentialId);
    error CredentialAlreadyRevoked(uint256 credentialId);
    error CredentialAlreadyExists(bytes32 credentialHash);
    error NotIssuerOrAdmin(address caller, uint256 credentialId);
    error InvalidDates();

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────

    /**
     * @notice Deploy the CredentialRegistry contract.
     * @param admin           Initial platform administrator.
     * @param worldIdVerifier Address of the World ID verifier (or `address(0)`).
     */
    constructor(address admin, address worldIdVerifier) {
        if (admin == address(0)) revert InvalidAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _setRoleAdmin(ISSUER_ROLE, ADMIN_ROLE);

        _setWorldIdVerifier(worldIdVerifier);
    }

    // ──────────────────────────────────────────────
    //  Write Functions
    // ──────────────────────────────────────────────

    /**
     * @notice Issue a new verifiable credential to a healthcare provider.
     * @param credentialHash Keccak-256 hash of the off-chain credential document.
     * @param subject        Address of the provider receiving the credential.
     * @param credentialType Category of the credential.
     * @param issuanceDate   Unix timestamp of issuance.
     * @param expiryDate     Unix timestamp of expiry (0 for permanent credentials).
     * @return credentialId  The identifier of the newly issued credential.
     */
    function issueCredential(
        bytes32 credentialHash,
        address subject,
        CredentialType credentialType,
        uint256 issuanceDate,
        uint256 expiryDate
    )
        external
        onlyRole(ISSUER_ROLE)
        returns (uint256 credentialId)
    {
        if (subject == address(0)) revert InvalidAddress();
        if (credentialHash == bytes32(0)) revert InvalidCredentialHash();
        if (expiryDate != 0 && expiryDate <= issuanceDate) revert InvalidDates();
        if (_hashToId[credentialHash] != 0) revert CredentialAlreadyExists(credentialHash);

        credentialId = _nextCredentialId++;

        // Reserving ID 0 for the null mapping sentinel.
        // Since _nextCredentialId starts at 0, the first real credential gets ID 0.
        // We offset by 1 in the hash→id mapping to distinguish "no entry" (0) from ID 0.
        _hashToId[credentialHash] = credentialId + 1;

        _credentials[credentialId] = Credential({
            credentialId: credentialId,
            credentialHash: credentialHash,
            issuer: msg.sender,
            subject: subject,
            credentialType: credentialType,
            issuanceDate: issuanceDate,
            expiryDate: expiryDate,
            isValid: true
        });
        _providerCredentialIds[subject].push(credentialId);
        _issuerCredentialIds[msg.sender].push(credentialId);

        emit CredentialIssued(
            credentialId,
            credentialHash,
            msg.sender,
            subject,
            credentialType,
            issuanceDate,
            expiryDate
        );
    }

    /**
     * @notice Revoke a previously issued credential.
     * @dev Only the original issuer or an admin may revoke.
     * @param credentialId The credential to revoke.
     */
    function revokeCredential(uint256 credentialId) external {
        Credential storage c = _credentials[credentialId];
        if (c.issuer == address(0)) revert CredentialNotFound(credentialId);
        if (!c.isValid) revert CredentialAlreadyRevoked(credentialId);

        if (msg.sender != c.issuer && !hasRole(ADMIN_ROLE, msg.sender)) {
            revert NotIssuerOrAdmin(msg.sender, credentialId);
        }

        c.isValid = false;
        emit CredentialRevoked(credentialId, msg.sender, block.timestamp);
    }

    /**
     * @notice Renew a credential by extending its expiry date.
     * @dev Only the original issuer may renew.
     * @param credentialId The credential to renew.
     * @param newExpiryDate New expiry timestamp (must be in the future).
     */
    function renewCredential(uint256 credentialId, uint256 newExpiryDate)
        external
        onlyRole(ISSUER_ROLE)
    {
        Credential storage c = _credentials[credentialId];
        if (c.issuer == address(0)) revert CredentialNotFound(credentialId);
        if (msg.sender != c.issuer) revert NotIssuerOrAdmin(msg.sender, credentialId);
        if (newExpiryDate <= block.timestamp) revert InvalidDates();

        uint256 oldExpiry = c.expiryDate;
        c.expiryDate = newExpiryDate;
        c.isValid = true; // re-activate if previously expired

        emit CredentialRenewed(credentialId, oldExpiry, newExpiryDate);
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
     * @notice Register a new credential issuer.
     * @param issuer The address to authorise as an issuer.
     */
    function registerIssuer(address issuer) external onlyRole(ADMIN_ROLE) {
        if (issuer == address(0)) revert InvalidAddress();
        _grantRole(ISSUER_ROLE, issuer);
    }

    /**
     * @notice Remove a credential issuer.
     * @param issuer The address to remove.
     */
    function removeIssuer(address issuer) external onlyRole(ADMIN_ROLE) {
        _revokeRole(ISSUER_ROLE, issuer);
    }

    // ──────────────────────────────────────────────
    //  View / Read Functions
    // ──────────────────────────────────────────────

    /**
     * @notice Verify a credential's validity.
     * @param credentialId The credential ID.
     * @return isValid   Whether the credential has not been revoked.
     * @return isExpired Whether the credential has passed its expiry date.
     * @return credential The full Credential struct.
     */
    function verifyCredential(uint256 credentialId)
        external
        view
        returns (bool isValid, bool isExpired, Credential memory credential)
    {
        Credential storage c = _credentials[credentialId];
        if (c.issuer == address(0)) revert CredentialNotFound(credentialId);

        isExpired = (c.expiryDate != 0 && block.timestamp > c.expiryDate);
        isValid = c.isValid && !isExpired;
        credential = c;
    }

    /**
     * @notice Retrieve all credential IDs for a given provider.
     * @param provider The provider (subject) address.
     * @return credentialIds Array of credential identifiers.
     */
    function getProviderCredentials(address provider)
        external
        view
        returns (uint256[] memory credentialIds)
    {
        credentialIds = _providerCredentialIds[provider];
    }

    /**
     * @notice Retrieve all credential IDs issued by a given issuer.
     * @param issuer The issuer address.
     * @return credentialIds Array of credential identifiers.
     */
    function getIssuerCredentials(address issuer)
        external
        view
        returns (uint256[] memory credentialIds)
    {
        credentialIds = _issuerCredentialIds[issuer];
    }

    /**
     * @notice Look up a credential by its document hash.
     * @param credentialHash The hash to look up.
     * @return found        Whether a credential with this hash exists.
     * @return credentialId The credential ID (only valid if `found` is true).
     */
    function getCredentialByHash(bytes32 credentialHash)
        external
        view
        returns (bool found, uint256 credentialId)
    {
        uint256 storedId = _hashToId[credentialHash];
        if (storedId == 0) {
            return (false, 0);
        }
        return (true, storedId - 1); // undo the +1 offset
    }

    /**
     * @notice Retrieve a single credential by ID.
     * @param credentialId The credential ID.
     * @return credential The Credential struct.
     */
    function getCredential(uint256 credentialId)
        external
        view
        returns (Credential memory credential)
    {
        if (_credentials[credentialId].issuer == address(0)) {
            revert CredentialNotFound(credentialId);
        }
        credential = _credentials[credentialId];
    }

    /**
     * @notice Total number of credentials issued.
     */
    function totalCredentials() external view returns (uint256) {
        return _nextCredentialId;
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
