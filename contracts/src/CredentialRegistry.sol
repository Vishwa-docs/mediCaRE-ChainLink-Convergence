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

    /// @notice Role for authorised research institutions.
    bytes32 public constant RESEARCHER_ROLE = keccak256("RESEARCHER_ROLE");

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

    /**
     * @notice Patient consent for their data to be used in research.
     * @param patient     Address of the consenting patient.
     * @param consentHash Keccak-256 hash of the off-chain consent document.
     * @param isActive    Whether the consent is currently active.
     * @param grantedAt   Block timestamp when consent was granted.
     */
    struct ResearchConsent {
        address patient;
        bytes32 consentHash;
        bool    isActive;
        uint256 grantedAt;
    }

    /**
     * @notice A patient-created offer to monetise anonymised health data.
     * @param patient        Address of the patient offering data.
     * @param dataType       Category identifier (e.g. keccak256("GENOMIC")).
     * @param pricePerAccess Price in wei per access grant.
     * @param isActive       Whether the offer is currently available.
     */
    struct DataMonetizationOffer {
        address patient;
        bytes32 dataType;
        uint256 pricePerAccess;
        bool    isActive;
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

    /// @notice patient ⇒ ResearchConsent.
    mapping(address => ResearchConsent) private _researchConsents;

    /// @notice Auto-incrementing offer counter.
    uint256 private _nextOfferId;

    /// @notice offerId ⇒ DataMonetizationOffer.
    mapping(uint256 => DataMonetizationOffer) private _dataOffers;

    /// @notice patient ⇒ array of offer IDs.
    mapping(address => uint256[]) private _patientOfferIds;

    /// @notice offerId ⇒ purchaser ⇒ has purchased?
    mapping(uint256 => mapping(address => bool)) private _offerPurchases;

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

    /// @notice Emitted when a patient grants research consent.
    event ResearchConsentGranted(
        address indexed patient,
        bytes32 consentHash,
        uint256 timestamp
    );

    /// @notice Emitted when a patient revokes research consent.
    event ResearchConsentRevoked(
        address indexed patient,
        uint256 timestamp
    );

    /// @notice Emitted when a data monetization offer is created.
    event DataOfferCreated(
        uint256 indexed offerId,
        address indexed patient,
        bytes32 dataType,
        uint256 pricePerAccess
    );

    /// @notice Emitted when data access is purchased.
    event DataAccessPurchased(
        uint256 indexed offerId,
        address indexed purchaser,
        address indexed patient,
        uint256 price
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

    /// @notice Thrown when a research consent is not active.
    error ResearchConsentNotActive(address patient);

    /// @notice Thrown when a data offer is not found or not active.
    error DataOfferNotFound(uint256 offerId);

    /// @notice Thrown when insufficient payment is sent for data access.
    error InsufficientPayment(uint256 required, uint256 sent);

    /// @notice Thrown when data access has already been purchased.
    error AlreadyPurchased(uint256 offerId, address purchaser);

    /// @notice Thrown when an invalid price is provided.
    error InvalidPrice();

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
        _setRoleAdmin(RESEARCHER_ROLE, ADMIN_ROLE);

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

        unchecked { credentialId = _nextCredentialId++; }

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
    //  Research Consent
    // ──────────────────────────────────────────────

    /**
     * @notice Grant consent for anonymised data to be used in research.
     * @dev Called directly by the patient. Overwrites any prior consent entry.
     * @param consentHash Keccak-256 hash of the off-chain consent document.
     */
    function addResearchConsent(bytes32 consentHash) external {
        if (consentHash == bytes32(0)) revert InvalidCredentialHash();

        _researchConsents[msg.sender] = ResearchConsent({
            patient: msg.sender,
            consentHash: consentHash,
            isActive: true,
            grantedAt: block.timestamp
        });

        emit ResearchConsentGranted(msg.sender, consentHash, block.timestamp);
    }

    /**
     * @notice Revoke previously granted research consent.
     */
    function revokeResearchConsent() external {
        ResearchConsent storage rc = _researchConsents[msg.sender];
        if (!rc.isActive) revert ResearchConsentNotActive(msg.sender);

        rc.isActive = false;
        emit ResearchConsentRevoked(msg.sender, block.timestamp);
    }

    /**
     * @notice Retrieve a patient's current research consent.
     * @param patient The patient address.
     * @return consent The ResearchConsent struct.
     */
    function getResearchConsent(address patient)
        external
        view
        returns (ResearchConsent memory consent)
    {
        consent = _researchConsents[patient];
    }

    // ──────────────────────────────────────────────
    //  Data Monetization
    // ──────────────────────────────────────────────

    /**
     * @notice Create an offer to sell access to anonymised health data.
     * @dev Called by the patient. Multiple offers per patient are supported.
     * @param dataType       Category identifier for the data being offered.
     * @param pricePerAccess Price in wei that a purchaser must pay per access.
     * @return offerId       The identifier of the newly created offer.
     */
    function createDataOffer(
        bytes32 dataType,
        uint256 pricePerAccess
    ) external returns (uint256 offerId) {
        if (dataType == bytes32(0)) revert InvalidCredentialHash();
        if (pricePerAccess == 0) revert InvalidPrice();

        unchecked { offerId = _nextOfferId++; }

        _dataOffers[offerId] = DataMonetizationOffer({
            patient: msg.sender,
            dataType: dataType,
            pricePerAccess: pricePerAccess,
            isActive: true
        });
        _patientOfferIds[msg.sender].push(offerId);

        emit DataOfferCreated(offerId, msg.sender, dataType, pricePerAccess);
    }

    /**
     * @notice Purchase access to a patient's anonymised data offer.
     * @dev Caller must send at least `pricePerAccess` in native currency.
     *      Funds are forwarded directly to the patient.
     * @param offerId The data offer to purchase.
     */
    function purchaseDataAccess(uint256 offerId) external payable {
        DataMonetizationOffer storage offer = _dataOffers[offerId];
        if (offer.patient == address(0) || !offer.isActive) revert DataOfferNotFound(offerId);
        if (msg.value < offer.pricePerAccess) revert InsufficientPayment(offer.pricePerAccess, msg.value);
        if (_offerPurchases[offerId][msg.sender]) revert AlreadyPurchased(offerId, msg.sender);

        _offerPurchases[offerId][msg.sender] = true;

        // Forward payment to the patient.
        (bool sent, ) = payable(offer.patient).call{value: msg.value}("");
        require(sent, "Payment transfer failed");

        emit DataAccessPurchased(offerId, msg.sender, offer.patient, msg.value);
    }

    /**
     * @notice Deactivate a data monetization offer.
     * @param offerId The offer to deactivate.
     */
    function deactivateDataOffer(uint256 offerId) external {
        DataMonetizationOffer storage offer = _dataOffers[offerId];
        if (offer.patient == address(0)) revert DataOfferNotFound(offerId);
        require(msg.sender == offer.patient || hasRole(ADMIN_ROLE, msg.sender), "Not authorized");

        offer.isActive = false;
    }

    /**
     * @notice Retrieve a data monetization offer.
     * @param offerId The offer ID.
     * @return offer The DataMonetizationOffer struct.
     */
    function getDataOffer(uint256 offerId)
        external
        view
        returns (DataMonetizationOffer memory offer)
    {
        offer = _dataOffers[offerId];
    }

    /**
     * @notice Retrieve all offer IDs for a patient.
     * @param patient The patient address.
     * @return offerIds Array of offer identifiers.
     */
    function getPatientOffers(address patient)
        external
        view
        returns (uint256[] memory offerIds)
    {
        offerIds = _patientOfferIds[patient];
    }

    /**
     * @notice Check if an address has purchased access to an offer.
     * @param offerId   The offer ID.
     * @param purchaser The purchaser address.
     * @return purchased Whether access was purchased.
     */
    function hasAccessToOffer(uint256 offerId, address purchaser)
        external
        view
        returns (bool purchased)
    {
        purchased = _offerPurchases[offerId][purchaser];
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
