import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { EHRStorage } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("EHRStorage", function () {
  // ─── Fixture ───────────────────────────────────────────────
  async function deployEHRStorageFixture() {
    const [admin, provider1, provider2, patient1, patient2, stranger] =
      await ethers.getSigners();

    const EHRStorageFactory = await ethers.getContractFactory("EHRStorage");
    const ehrStorage = await EHRStorageFactory.deploy(
      admin.address,
      ethers.ZeroAddress // no World ID verifier
    );
    await ehrStorage.waitForDeployment();

    // Register provider1 as a PROVIDER
    await ehrStorage.connect(admin).registerProvider(provider1.address);

    const ADMIN_ROLE = await ehrStorage.ADMIN_ROLE();
    const PROVIDER_ROLE = await ehrStorage.PROVIDER_ROLE();

    const sampleCidHash = ethers.keccak256(ethers.toUtf8Bytes("QmSampleCID123"));
    const sampleAiHash = ethers.keccak256(ethers.toUtf8Bytes("AISummary123"));
    const sampleRecordType = "LAB";

    return {
      ehrStorage,
      admin,
      provider1,
      provider2,
      patient1,
      patient2,
      stranger,
      ADMIN_ROLE,
      PROVIDER_ROLE,
      sampleCidHash,
      sampleAiHash,
      sampleRecordType,
    };
  }

  // Helper: grant access from patient to provider, then add a record
  async function fixtureWithRecord() {
    const fixture = await loadFixture(deployEHRStorageFixture);
    const { ehrStorage, provider1, patient1, sampleCidHash, sampleAiHash, sampleRecordType } = fixture;

    // Patient grants provider access
    await ehrStorage.connect(patient1).grantAccess(provider1.address);

    // Provider adds record
    const tx = await ehrStorage
      .connect(provider1)
      .addRecord(patient1.address, sampleCidHash, sampleAiHash, sampleRecordType);
    const receipt = await tx.wait();

    return { ...fixture, recordId: 0n };
  }

  // ─── Deployment ────────────────────────────────────────────
  describe("Deployment", function () {
    it("should set admin roles correctly", async function () {
      const { ehrStorage, admin, ADMIN_ROLE } = await loadFixture(deployEHRStorageFixture);
      expect(await ehrStorage.hasRole(ADMIN_ROLE, admin.address)).to.be.true;
    });

    it("should set DEFAULT_ADMIN_ROLE to admin", async function () {
      const { ehrStorage, admin } = await loadFixture(deployEHRStorageFixture);
      const DEFAULT_ADMIN = await ehrStorage.DEFAULT_ADMIN_ROLE();
      expect(await ehrStorage.hasRole(DEFAULT_ADMIN, admin.address)).to.be.true;
    });

    it("should revert if admin is zero address", async function () {
      const EHRStorageFactory = await ethers.getContractFactory("EHRStorage");
      await expect(
        EHRStorageFactory.deploy(ethers.ZeroAddress, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError({ interface: EHRStorageFactory.interface }, "InvalidAddress");
    });

    it("should start with zero records", async function () {
      const { ehrStorage } = await loadFixture(deployEHRStorageFixture);
      expect(await ehrStorage.totalRecords()).to.equal(0n);
    });
  });

  // ─── Provider Registration ────────────────────────────────
  describe("Provider Registration", function () {
    it("admin can register a provider", async function () {
      const { ehrStorage, admin, provider2, PROVIDER_ROLE } = await loadFixture(deployEHRStorageFixture);
      await ehrStorage.connect(admin).registerProvider(provider2.address);
      expect(await ehrStorage.hasRole(PROVIDER_ROLE, provider2.address)).to.be.true;
    });

    it("admin can remove a provider", async function () {
      const { ehrStorage, admin, provider1, PROVIDER_ROLE } = await loadFixture(deployEHRStorageFixture);
      await ehrStorage.connect(admin).removeProvider(provider1.address);
      expect(await ehrStorage.hasRole(PROVIDER_ROLE, provider1.address)).to.be.false;
    });

    it("non-admin cannot register a provider", async function () {
      const { ehrStorage, stranger, provider2 } = await loadFixture(deployEHRStorageFixture);
      await expect(
        ehrStorage.connect(stranger).registerProvider(provider2.address)
      ).to.be.reverted;
    });

    it("reverts when registering zero address", async function () {
      const { ehrStorage, admin } = await loadFixture(deployEHRStorageFixture);
      await expect(
        ehrStorage.connect(admin).registerProvider(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(ehrStorage, "InvalidAddress");
    });
  });

  // ─── Access Grants ────────────────────────────────────────
  describe("Access Grants", function () {
    it("patient can grant access to a provider", async function () {
      const { ehrStorage, patient1, provider1 } = await loadFixture(deployEHRStorageFixture);
      await expect(ehrStorage.connect(patient1).grantAccess(provider1.address))
        .to.emit(ehrStorage, "AccessGranted")
        .withArgs(patient1.address, provider1.address, () => true);
      expect(await ehrStorage.checkAccess(patient1.address, provider1.address)).to.be.true;
    });

    it("patient can revoke access", async function () {
      const { ehrStorage, patient1, provider1 } = await loadFixture(deployEHRStorageFixture);
      await ehrStorage.connect(patient1).grantAccess(provider1.address);
      await expect(ehrStorage.connect(patient1).revokeAccess(provider1.address))
        .to.emit(ehrStorage, "AccessRevoked");
      expect(await ehrStorage.checkAccess(patient1.address, provider1.address)).to.be.false;
    });

    it("reverts granting access to zero address", async function () {
      const { ehrStorage, patient1 } = await loadFixture(deployEHRStorageFixture);
      await expect(
        ehrStorage.connect(patient1).grantAccess(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(ehrStorage, "InvalidAddress");
    });

    it("reverts revoking access to zero address", async function () {
      const { ehrStorage, patient1 } = await loadFixture(deployEHRStorageFixture);
      await expect(
        ehrStorage.connect(patient1).revokeAccess(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(ehrStorage, "InvalidAddress");
    });
  });

  // ─── Adding Records ──────────────────────────────────────
  describe("addRecord", function () {
    it("provider with access can add a record", async function () {
      const { ehrStorage, provider1, patient1, sampleCidHash, sampleAiHash, sampleRecordType } =
        await loadFixture(deployEHRStorageFixture);

      await ehrStorage.connect(patient1).grantAccess(provider1.address);

      await expect(
        ehrStorage.connect(provider1).addRecord(patient1.address, sampleCidHash, sampleAiHash, sampleRecordType)
      )
        .to.emit(ehrStorage, "RecordCreated")
        .withArgs(0n, patient1.address, sampleCidHash, sampleRecordType, () => true);

      expect(await ehrStorage.totalRecords()).to.equal(1n);
    });

    it("increments record IDs correctly", async function () {
      const { ehrStorage, provider1, patient1, sampleCidHash, sampleAiHash, sampleRecordType } =
        await loadFixture(deployEHRStorageFixture);

      await ehrStorage.connect(patient1).grantAccess(provider1.address);

      await ehrStorage.connect(provider1).addRecord(patient1.address, sampleCidHash, sampleAiHash, sampleRecordType);
      const cidHash2 = ethers.keccak256(ethers.toUtf8Bytes("CID2"));
      await ehrStorage.connect(provider1).addRecord(patient1.address, cidHash2, sampleAiHash, "IMAGING");

      expect(await ehrStorage.totalRecords()).to.equal(2n);
    });

    it("reverts if caller lacks PROVIDER_ROLE", async function () {
      const { ehrStorage, stranger, patient1, sampleCidHash, sampleAiHash, sampleRecordType } =
        await loadFixture(deployEHRStorageFixture);

      await expect(
        ehrStorage.connect(stranger).addRecord(patient1.address, sampleCidHash, sampleAiHash, sampleRecordType)
      ).to.be.reverted;
    });

    it("reverts if provider has no patient access", async function () {
      const { ehrStorage, provider1, patient1, sampleCidHash, sampleAiHash, sampleRecordType } =
        await loadFixture(deployEHRStorageFixture);

      await expect(
        ehrStorage.connect(provider1).addRecord(patient1.address, sampleCidHash, sampleAiHash, sampleRecordType)
      ).to.be.revertedWithCustomError(ehrStorage, "Unauthorized");
    });

    it("reverts if patient is zero address", async function () {
      const { ehrStorage, provider1, sampleCidHash, sampleAiHash, sampleRecordType } =
        await loadFixture(deployEHRStorageFixture);

      await expect(
        ehrStorage.connect(provider1).addRecord(ethers.ZeroAddress, sampleCidHash, sampleAiHash, sampleRecordType)
      ).to.be.revertedWithCustomError(ehrStorage, "InvalidAddress");
    });

    it("reverts if CID hash is zero", async function () {
      const { ehrStorage, provider1, patient1, sampleAiHash, sampleRecordType } =
        await loadFixture(deployEHRStorageFixture);

      await ehrStorage.connect(patient1).grantAccess(provider1.address);
      await expect(
        ehrStorage.connect(provider1).addRecord(patient1.address, ethers.ZeroHash, sampleAiHash, sampleRecordType)
      ).to.be.revertedWithCustomError(ehrStorage, "InvalidCidHash");
    });

    it("allows AI summary hash to be zero", async function () {
      const { ehrStorage, provider1, patient1, sampleCidHash, sampleRecordType } =
        await loadFixture(deployEHRStorageFixture);

      await ehrStorage.connect(patient1).grantAccess(provider1.address);
      await expect(
        ehrStorage.connect(provider1).addRecord(patient1.address, sampleCidHash, ethers.ZeroHash, sampleRecordType)
      ).to.not.be.reverted;
    });
  });

  // ─── Reading Records ─────────────────────────────────────
  describe("getRecord & getPatientRecords", function () {
    it("patient can read their own record", async function () {
      const fixture = await fixtureWithRecord();
      const { ehrStorage, patient1, sampleCidHash, sampleAiHash, sampleRecordType, recordId } = fixture;

      const record = await ehrStorage.connect(patient1).getRecord(recordId);
      expect(record.patient).to.equal(patient1.address);
      expect(record.ipfsCidHash).to.equal(sampleCidHash);
      expect(record.aiSummaryHash).to.equal(sampleAiHash);
      expect(record.recordType).to.equal(sampleRecordType);
      expect(record.isActive).to.be.true;
    });

    it("authorized provider can read the record", async function () {
      const fixture = await fixtureWithRecord();
      const { ehrStorage, provider1, recordId } = fixture;
      const record = await ehrStorage.connect(provider1).getRecord(recordId);
      expect(record.recordId).to.equal(recordId);
    });

    it("unauthorized user cannot read the record", async function () {
      const fixture = await fixtureWithRecord();
      const { ehrStorage, stranger, recordId } = fixture;
      await expect(
        ehrStorage.connect(stranger).getRecord(recordId)
      ).to.be.revertedWithCustomError(ehrStorage, "Unauthorized");
    });

    it("reverts for non-existent record", async function () {
      const { ehrStorage, patient1 } = await loadFixture(deployEHRStorageFixture);
      await expect(
        ehrStorage.connect(patient1).getRecord(999n)
      ).to.be.revertedWithCustomError(ehrStorage, "RecordNotFound");
    });

    it("patient can get their record IDs", async function () {
      const fixture = await fixtureWithRecord();
      const { ehrStorage, patient1 } = fixture;
      const recordIds = await ehrStorage.connect(patient1).getPatientRecords(patient1.address);
      expect(recordIds.length).to.equal(1);
      expect(recordIds[0]).to.equal(0n);
    });

    it("admin can see patient record IDs", async function () {
      const fixture = await fixtureWithRecord();
      const { ehrStorage, admin, patient1 } = fixture;
      const recordIds = await ehrStorage.connect(admin).getPatientRecords(patient1.address);
      expect(recordIds.length).to.equal(1);
    });

    it("unauthorized user cannot get patient records", async function () {
      const fixture = await fixtureWithRecord();
      const { ehrStorage, stranger, patient1 } = fixture;
      await expect(
        ehrStorage.connect(stranger).getPatientRecords(patient1.address)
      ).to.be.revertedWithCustomError(ehrStorage, "Unauthorized");
    });
  });

  // ─── Updating Records ────────────────────────────────────
  describe("updateRecord", function () {
    it("patient can update their own record", async function () {
      const fixture = await fixtureWithRecord();
      const { ehrStorage, patient1, sampleCidHash, recordId } = fixture;

      const newCidHash = ethers.keccak256(ethers.toUtf8Bytes("NewCID"));
      const newAiHash = ethers.keccak256(ethers.toUtf8Bytes("NewAI"));

      await expect(ehrStorage.connect(patient1).updateRecord(recordId, newCidHash, newAiHash))
        .to.emit(ehrStorage, "RecordUpdated")
        .withArgs(recordId, sampleCidHash, newCidHash, newAiHash, () => true);
    });

    it("authorized provider can update the record", async function () {
      const fixture = await fixtureWithRecord();
      const { ehrStorage, provider1, recordId } = fixture;

      const newCidHash = ethers.keccak256(ethers.toUtf8Bytes("UpdatedCID"));
      await expect(
        ehrStorage.connect(provider1).updateRecord(recordId, newCidHash, ethers.ZeroHash)
      ).to.not.be.reverted;
    });

    it("reverts if new CID hash is zero", async function () {
      const fixture = await fixtureWithRecord();
      const { ehrStorage, patient1, recordId } = fixture;

      await expect(
        ehrStorage.connect(patient1).updateRecord(recordId, ethers.ZeroHash, ethers.ZeroHash)
      ).to.be.revertedWithCustomError(ehrStorage, "InvalidCidHash");
    });

    it("unauthorized user cannot update", async function () {
      const fixture = await fixtureWithRecord();
      const { ehrStorage, stranger, recordId } = fixture;

      const newCidHash = ethers.keccak256(ethers.toUtf8Bytes("Hack"));
      await expect(
        ehrStorage.connect(stranger).updateRecord(recordId, newCidHash, ethers.ZeroHash)
      ).to.be.revertedWithCustomError(ehrStorage, "Unauthorized");
    });
  });

  // ─── Deactivating Records ────────────────────────────────
  describe("deactivateRecord", function () {
    it("patient can deactivate their record", async function () {
      const fixture = await fixtureWithRecord();
      const { ehrStorage, patient1, recordId } = fixture;

      await expect(ehrStorage.connect(patient1).deactivateRecord(recordId))
        .to.emit(ehrStorage, "RecordDeactivated")
        .withArgs(recordId, () => true);

      const record = await ehrStorage.connect(patient1).getRecord(recordId);
      expect(record.isActive).to.be.false;
    });

    it("admin can deactivate any record", async function () {
      const fixture = await fixtureWithRecord();
      const { ehrStorage, admin, patient1, recordId } = fixture;

      // Admin should also be able to read it via getRecord through ADMIN_ROLE bypass
      // But getRecord uses onlyAuthorized which checks patient or _accessPermissions
      // Admin needs to use deactivateRecord directly
      await expect(ehrStorage.connect(admin).deactivateRecord(recordId)).to.not.be.reverted;
    });

    it("unauthorized user cannot deactivate", async function () {
      const fixture = await fixtureWithRecord();
      const { ehrStorage, stranger, recordId } = fixture;

      await expect(
        ehrStorage.connect(stranger).deactivateRecord(recordId)
      ).to.be.revertedWithCustomError(ehrStorage, "Unauthorized");
    });

    it("reverts for non-existent record", async function () {
      const { ehrStorage, admin } = await loadFixture(deployEHRStorageFixture);
      await expect(
        ehrStorage.connect(admin).deactivateRecord(999n)
      ).to.be.revertedWithCustomError(ehrStorage, "RecordNotFound");
    });
  });

  // ─── World-ID Verifier ───────────────────────────────────
  describe("setWorldIdVerifier", function () {
    it("admin can update the verifier", async function () {
      const { ehrStorage, admin, stranger } = await loadFixture(deployEHRStorageFixture);
      await expect(ehrStorage.connect(admin).setWorldIdVerifier(stranger.address))
        .to.emit(ehrStorage, "WorldIdVerifierUpdated");
    });

    it("non-admin cannot update the verifier", async function () {
      const { ehrStorage, stranger } = await loadFixture(deployEHRStorageFixture);
      await expect(
        ehrStorage.connect(stranger).setWorldIdVerifier(stranger.address)
      ).to.be.reverted;
    });
  });

  // ─── Edge Cases ───────────────────────────────────────────
  describe("Edge Cases", function () {
    it("access revocation prevents record creation", async function () {
      const { ehrStorage, provider1, patient1, sampleCidHash, sampleAiHash, sampleRecordType } =
        await loadFixture(deployEHRStorageFixture);

      await ehrStorage.connect(patient1).grantAccess(provider1.address);
      await ehrStorage.connect(patient1).revokeAccess(provider1.address);

      await expect(
        ehrStorage.connect(provider1).addRecord(patient1.address, sampleCidHash, sampleAiHash, sampleRecordType)
      ).to.be.revertedWithCustomError(ehrStorage, "Unauthorized");
    });

    it("access revocation prevents record updates", async function () {
      const fixture = await fixtureWithRecord();
      const { ehrStorage, provider1, patient1, recordId } = fixture;

      await ehrStorage.connect(patient1).revokeAccess(provider1.address);

      const newCidHash = ethers.keccak256(ethers.toUtf8Bytes("RevokedUpdate"));
      await expect(
        ehrStorage.connect(provider1).updateRecord(recordId, newCidHash, ethers.ZeroHash)
      ).to.be.revertedWithCustomError(ehrStorage, "Unauthorized");
    });

    it("multiple patients have independent records", async function () {
      const { ehrStorage, admin, provider1, patient1, patient2, sampleCidHash, sampleAiHash, sampleRecordType } =
        await loadFixture(deployEHRStorageFixture);

      await ehrStorage.connect(patient1).grantAccess(provider1.address);
      await ehrStorage.connect(patient2).grantAccess(provider1.address);

      await ehrStorage.connect(provider1).addRecord(patient1.address, sampleCidHash, sampleAiHash, "LAB");
      await ehrStorage.connect(provider1).addRecord(patient2.address, sampleCidHash, sampleAiHash, "IMAGING");

      const ids1 = await ehrStorage.connect(patient1).getPatientRecords(patient1.address);
      const ids2 = await ehrStorage.connect(patient2).getPatientRecords(patient2.address);
      expect(ids1.length).to.equal(1);
      expect(ids2.length).to.equal(1);
      expect(ids1[0]).to.not.equal(ids2[0]);
    });
  });
});

// Helper to get the latest block timestamp (approximate, for event checks)
async function getBlockTimestamp(): Promise<bigint> {
  const block = await ethers.provider.getBlock("latest");
  return BigInt(block!.timestamp);
}
