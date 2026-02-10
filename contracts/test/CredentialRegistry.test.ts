import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { CredentialRegistry } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("CredentialRegistry", function () {
  // ─── Fixture ───────────────────────────────────────────────
  async function deployCredentialRegistryFixture() {
    const [admin, issuer1, issuer2, provider1, provider2, stranger] =
      await ethers.getSigners();

    const Factory = await ethers.getContractFactory("CredentialRegistry");
    const registry = await Factory.deploy(admin.address, ethers.ZeroAddress);
    await registry.waitForDeployment();

    // Register issuer1
    await registry.connect(admin).registerIssuer(issuer1.address);

    const ADMIN_ROLE = await registry.ADMIN_ROLE();
    const ISSUER_ROLE = await registry.ISSUER_ROLE();

    const credentialHash = ethers.keccak256(ethers.toUtf8Bytes("MedLicense-2026-001"));
    const now = Math.floor(Date.now() / 1000);
    const issuanceDate = BigInt(now);
    const expiryDate = BigInt(now + 365 * 24 * 60 * 60);

    // CredentialType enum: LICENSE=0, BOARD_CERT=1, etc.
    const LICENSE = 0;
    const BOARD_CERT = 1;
    const SPECIALTY = 2;

    return {
      registry,
      admin,
      issuer1,
      issuer2,
      provider1,
      provider2,
      stranger,
      ADMIN_ROLE,
      ISSUER_ROLE,
      credentialHash,
      issuanceDate,
      expiryDate,
      LICENSE,
      BOARD_CERT,
      SPECIALTY,
    };
  }

  // Helper: issue one credential
  async function fixtureWithCredential() {
    const fixture = await loadFixture(deployCredentialRegistryFixture);
    const { registry, issuer1, provider1, credentialHash, issuanceDate, expiryDate, LICENSE } = fixture;

    await registry
      .connect(issuer1)
      .issueCredential(credentialHash, provider1.address, LICENSE, issuanceDate, expiryDate);

    return { ...fixture, credentialId: 0n };
  }

  // ─── Deployment ────────────────────────────────────────────
  describe("Deployment", function () {
    it("should set admin roles", async function () {
      const { registry, admin, ADMIN_ROLE } = await loadFixture(deployCredentialRegistryFixture);
      expect(await registry.hasRole(ADMIN_ROLE, admin.address)).to.be.true;
    });

    it("should revert if admin is zero address", async function () {
      const Factory = await ethers.getContractFactory("CredentialRegistry");
      await expect(
        Factory.deploy(ethers.ZeroAddress, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(Factory, "InvalidAddress");
    });

    it("should start with zero credentials", async function () {
      const { registry } = await loadFixture(deployCredentialRegistryFixture);
      expect(await registry.totalCredentials()).to.equal(0n);
    });
  });

  // ─── Issuer Registration ──────────────────────────────────
  describe("Issuer Registration", function () {
    it("admin can register an issuer", async function () {
      const { registry, admin, issuer2, ISSUER_ROLE } = await loadFixture(deployCredentialRegistryFixture);
      await registry.connect(admin).registerIssuer(issuer2.address);
      expect(await registry.hasRole(ISSUER_ROLE, issuer2.address)).to.be.true;
    });

    it("admin can remove an issuer", async function () {
      const { registry, admin, issuer1, ISSUER_ROLE } = await loadFixture(deployCredentialRegistryFixture);
      await registry.connect(admin).removeIssuer(issuer1.address);
      expect(await registry.hasRole(ISSUER_ROLE, issuer1.address)).to.be.false;
    });

    it("non-admin cannot register an issuer", async function () {
      const { registry, stranger, issuer2 } = await loadFixture(deployCredentialRegistryFixture);
      await expect(
        registry.connect(stranger).registerIssuer(issuer2.address)
      ).to.be.reverted;
    });

    it("reverts on zero address", async function () {
      const { registry, admin } = await loadFixture(deployCredentialRegistryFixture);
      await expect(
        registry.connect(admin).registerIssuer(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(registry, "InvalidAddress");
    });
  });

  // ─── Issuing Credentials ──────────────────────────────────
  describe("issueCredential", function () {
    it("issuer can issue a credential", async function () {
      const { registry, issuer1, provider1, credentialHash, issuanceDate, expiryDate, LICENSE } =
        await loadFixture(deployCredentialRegistryFixture);

      await expect(
        registry.connect(issuer1).issueCredential(credentialHash, provider1.address, LICENSE, issuanceDate, expiryDate)
      )
        .to.emit(registry, "CredentialIssued")
        .withArgs(0n, credentialHash, issuer1.address, provider1.address, LICENSE, issuanceDate, expiryDate);

      expect(await registry.totalCredentials()).to.equal(1n);
    });

    it("stores credential data correctly", async function () {
      const fixture = await fixtureWithCredential();
      const { registry, issuer1, provider1, credentialHash, credentialId, LICENSE } = fixture;

      const cred = await registry.getCredential(credentialId);
      expect(cred.credentialHash).to.equal(credentialHash);
      expect(cred.issuer).to.equal(issuer1.address);
      expect(cred.subject).to.equal(provider1.address);
      expect(cred.credentialType).to.equal(LICENSE);
      expect(cred.isValid).to.be.true;
    });

    it("reverts if caller is not an issuer", async function () {
      const { registry, stranger, provider1, credentialHash, issuanceDate, expiryDate, LICENSE } =
        await loadFixture(deployCredentialRegistryFixture);

      await expect(
        registry.connect(stranger).issueCredential(credentialHash, provider1.address, LICENSE, issuanceDate, expiryDate)
      ).to.be.reverted;
    });

    it("reverts for zero subject address", async function () {
      const { registry, issuer1, credentialHash, issuanceDate, expiryDate, LICENSE } =
        await loadFixture(deployCredentialRegistryFixture);

      await expect(
        registry.connect(issuer1).issueCredential(credentialHash, ethers.ZeroAddress, LICENSE, issuanceDate, expiryDate)
      ).to.be.revertedWithCustomError(registry, "InvalidAddress");
    });

    it("reverts for zero credential hash", async function () {
      const { registry, issuer1, provider1, issuanceDate, expiryDate, LICENSE } =
        await loadFixture(deployCredentialRegistryFixture);

      await expect(
        registry.connect(issuer1).issueCredential(ethers.ZeroHash, provider1.address, LICENSE, issuanceDate, expiryDate)
      ).to.be.revertedWithCustomError(registry, "InvalidCredentialHash");
    });

    it("reverts if expiryDate != 0 and <= issuanceDate", async function () {
      const { registry, issuer1, provider1, credentialHash, issuanceDate, LICENSE } =
        await loadFixture(deployCredentialRegistryFixture);

      await expect(
        registry.connect(issuer1).issueCredential(credentialHash, provider1.address, LICENSE, issuanceDate, issuanceDate)
      ).to.be.revertedWithCustomError(registry, "InvalidDates");
    });

    it("allows zero expiry (permanent credential)", async function () {
      const { registry, issuer1, provider1, credentialHash, issuanceDate, LICENSE } =
        await loadFixture(deployCredentialRegistryFixture);

      await expect(
        registry.connect(issuer1).issueCredential(credentialHash, provider1.address, LICENSE, issuanceDate, 0n)
      ).to.not.be.reverted;
    });

    it("reverts on duplicate credential hash", async function () {
      const fixture = await fixtureWithCredential();
      const { registry, issuer1, provider2, credentialHash, issuanceDate, expiryDate, LICENSE } = fixture;

      await expect(
        registry.connect(issuer1).issueCredential(credentialHash, provider2.address, LICENSE, issuanceDate, expiryDate)
      ).to.be.revertedWithCustomError(registry, "CredentialAlreadyExists");
    });
  });

  // ─── Revoking Credentials ─────────────────────────────────
  describe("revokeCredential", function () {
    it("issuer can revoke their credential", async function () {
      const fixture = await fixtureWithCredential();
      const { registry, issuer1, credentialId } = fixture;

      await expect(registry.connect(issuer1).revokeCredential(credentialId))
        .to.emit(registry, "CredentialRevoked")
        .withArgs(credentialId, issuer1.address, () => true);
    });

    it("admin can revoke any credential", async function () {
      const fixture = await fixtureWithCredential();
      const { registry, admin, credentialId } = fixture;

      await expect(registry.connect(admin).revokeCredential(credentialId))
        .to.emit(registry, "CredentialRevoked");
    });

    it("stranger cannot revoke", async function () {
      const fixture = await fixtureWithCredential();
      const { registry, stranger, credentialId } = fixture;

      await expect(
        registry.connect(stranger).revokeCredential(credentialId)
      ).to.be.revertedWithCustomError(registry, "NotIssuerOrAdmin");
    });

    it("reverts for non-existent credential", async function () {
      const { registry, admin } = await loadFixture(deployCredentialRegistryFixture);
      await expect(
        registry.connect(admin).revokeCredential(999n)
      ).to.be.revertedWithCustomError(registry, "CredentialNotFound");
    });

    it("reverts if already revoked", async function () {
      const fixture = await fixtureWithCredential();
      const { registry, issuer1, credentialId } = fixture;

      await registry.connect(issuer1).revokeCredential(credentialId);

      await expect(
        registry.connect(issuer1).revokeCredential(credentialId)
      ).to.be.revertedWithCustomError(registry, "CredentialAlreadyRevoked");
    });
  });

  // ─── Renewing Credentials ─────────────────────────────────
  describe("renewCredential", function () {
    it("issuer can renew their credential", async function () {
      const fixture = await fixtureWithCredential();
      const { registry, issuer1, credentialId, expiryDate } = fixture;

      const newExpiry = expiryDate + BigInt(365 * 24 * 60 * 60);

      await expect(registry.connect(issuer1).renewCredential(credentialId, newExpiry))
        .to.emit(registry, "CredentialRenewed")
        .withArgs(credentialId, expiryDate, newExpiry);
    });

    it("different issuer with ISSUER_ROLE cannot renew another's credential", async function () {
      const fixture = await fixtureWithCredential();
      const { registry, admin, issuer2, credentialId, expiryDate } = fixture;

      // Register issuer2
      await registry.connect(admin).registerIssuer(issuer2.address);

      const newExpiry = expiryDate + BigInt(365 * 24 * 60 * 60);
      await expect(
        registry.connect(issuer2).renewCredential(credentialId, newExpiry)
      ).to.be.revertedWithCustomError(registry, "NotIssuerOrAdmin");
    });

    it("reverts if newExpiryDate is in the past", async function () {
      const fixture = await fixtureWithCredential();
      const { registry, issuer1, credentialId } = fixture;

      await expect(
        registry.connect(issuer1).renewCredential(credentialId, 1n) // timestamp 1 is in the past
      ).to.be.revertedWithCustomError(registry, "InvalidDates");
    });

    it("reverts for non-existent credential", async function () {
      const { registry, issuer1 } = await loadFixture(deployCredentialRegistryFixture);
      const futureTime = BigInt(Math.floor(Date.now() / 1000) + 999999);
      await expect(
        registry.connect(issuer1).renewCredential(999n, futureTime)
      ).to.be.revertedWithCustomError(registry, "CredentialNotFound");
    });

    it("re-activates a revoked credential on renewal", async function () {
      const fixture = await fixtureWithCredential();
      const { registry, issuer1, credentialId, expiryDate } = fixture;

      await registry.connect(issuer1).revokeCredential(credentialId);
      const newExpiry = expiryDate + BigInt(365 * 24 * 60 * 60);
      await registry.connect(issuer1).renewCredential(credentialId, newExpiry);

      const cred = await registry.getCredential(credentialId);
      expect(cred.isValid).to.be.true;
      expect(cred.expiryDate).to.equal(newExpiry);
    });
  });

  // ─── Verify Credential ───────────────────────────────────
  describe("verifyCredential", function () {
    it("returns valid for a non-expired, non-revoked credential", async function () {
      const fixture = await fixtureWithCredential();
      const { registry, credentialId } = fixture;

      const [isValid, isExpired, cred] = await registry.verifyCredential(credentialId);
      expect(isValid).to.be.true;
      expect(isExpired).to.be.false;
    });

    it("returns invalid for a revoked credential", async function () {
      const fixture = await fixtureWithCredential();
      const { registry, issuer1, credentialId } = fixture;

      await registry.connect(issuer1).revokeCredential(credentialId);

      const [isValid, , ] = await registry.verifyCredential(credentialId);
      expect(isValid).to.be.false;
    });

    it("returns expired when past expiry date", async function () {
      const fixture = await fixtureWithCredential();
      const { registry, credentialId } = fixture;

      // Fast forward past expiry
      await time.increase(366 * 24 * 60 * 60);

      const [isValid, isExpired, ] = await registry.verifyCredential(credentialId);
      expect(isExpired).to.be.true;
      expect(isValid).to.be.false; // isValid = c.isValid && !isExpired
    });

    it("reverts for non-existent credential", async function () {
      const { registry } = await loadFixture(deployCredentialRegistryFixture);
      await expect(
        registry.verifyCredential(999n)
      ).to.be.revertedWithCustomError(registry, "CredentialNotFound");
    });
  });

  // ─── View Functions ───────────────────────────────────────
  describe("View Functions", function () {
    it("getProviderCredentials returns correct IDs", async function () {
      const fixture = await fixtureWithCredential();
      const { registry, provider1 } = fixture;

      const ids = await registry.getProviderCredentials(provider1.address);
      expect(ids.length).to.equal(1);
      expect(ids[0]).to.equal(0n);
    });

    it("getIssuerCredentials returns correct IDs", async function () {
      const fixture = await fixtureWithCredential();
      const { registry, issuer1 } = fixture;

      const ids = await registry.getIssuerCredentials(issuer1.address);
      expect(ids.length).to.equal(1);
      expect(ids[0]).to.equal(0n);
    });

    it("getCredentialByHash finds existing credential", async function () {
      const fixture = await fixtureWithCredential();
      const { registry, credentialHash } = fixture;

      const [found, id] = await registry.getCredentialByHash(credentialHash);
      expect(found).to.be.true;
      expect(id).to.equal(0n);
    });

    it("getCredentialByHash returns false for unknown hash", async function () {
      const { registry } = await loadFixture(deployCredentialRegistryFixture);
      const unknownHash = ethers.keccak256(ethers.toUtf8Bytes("unknown"));
      const [found, ] = await registry.getCredentialByHash(unknownHash);
      expect(found).to.be.false;
    });

    it("getCredential reverts for non-existent", async function () {
      const { registry } = await loadFixture(deployCredentialRegistryFixture);
      await expect(
        registry.getCredential(999n)
      ).to.be.revertedWithCustomError(registry, "CredentialNotFound");
    });
  });

  // ─── World-ID Verifier ───────────────────────────────────
  describe("setWorldIdVerifier", function () {
    it("admin can update the verifier", async function () {
      const { registry, admin, stranger } = await loadFixture(deployCredentialRegistryFixture);
      await expect(registry.connect(admin).setWorldIdVerifier(stranger.address))
        .to.emit(registry, "WorldIdVerifierUpdated");
    });

    it("non-admin cannot update", async function () {
      const { registry, stranger } = await loadFixture(deployCredentialRegistryFixture);
      await expect(
        registry.connect(stranger).setWorldIdVerifier(stranger.address)
      ).to.be.reverted;
    });
  });

  // ─── Edge Cases ───────────────────────────────────────────
  describe("Edge Cases", function () {
    it("multiple credentials for the same provider", async function () {
      const { registry, admin, issuer1, provider1, issuanceDate, expiryDate, LICENSE, BOARD_CERT } =
        await loadFixture(deployCredentialRegistryFixture);

      const hash1 = ethers.keccak256(ethers.toUtf8Bytes("cred1"));
      const hash2 = ethers.keccak256(ethers.toUtf8Bytes("cred2"));

      await registry.connect(issuer1).issueCredential(hash1, provider1.address, LICENSE, issuanceDate, expiryDate);
      await registry.connect(issuer1).issueCredential(hash2, provider1.address, BOARD_CERT, issuanceDate, expiryDate);

      const ids = await registry.getProviderCredentials(provider1.address);
      expect(ids.length).to.equal(2);
    });

    it("different issuers can issue to the same provider", async function () {
      const { registry, admin, issuer1, issuer2, provider1, issuanceDate, expiryDate, LICENSE, SPECIALTY } =
        await loadFixture(deployCredentialRegistryFixture);

      await registry.connect(admin).registerIssuer(issuer2.address);

      const hash1 = ethers.keccak256(ethers.toUtf8Bytes("issuer1-cred"));
      const hash2 = ethers.keccak256(ethers.toUtf8Bytes("issuer2-cred"));

      await registry.connect(issuer1).issueCredential(hash1, provider1.address, LICENSE, issuanceDate, expiryDate);
      await registry.connect(issuer2).issueCredential(hash2, provider1.address, SPECIALTY, issuanceDate, expiryDate);

      const ids = await registry.getProviderCredentials(provider1.address);
      expect(ids.length).to.equal(2);
    });
  });
});
