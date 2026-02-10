import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SupplyChain } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("SupplyChain", function () {
  // ─── Fixture ───────────────────────────────────────────────
  async function deploySupplyChainFixture() {
    const [admin, manufacturer, distributor, pharmacy, stranger] =
      await ethers.getSigners();

    const SupplyChainFactory = await ethers.getContractFactory("SupplyChain");
    const supplyChain = await SupplyChainFactory.deploy(
      admin.address,
      "https://metadata.medicare.dao/{id}.json",
      ethers.ZeroAddress // no World ID verifier
    );
    await supplyChain.waitForDeployment();

    // Grant roles
    await supplyChain.connect(admin).grantRole(await supplyChain.MANUFACTURER_ROLE(), manufacturer.address);
    await supplyChain.connect(admin).grantRole(await supplyChain.DISTRIBUTOR_ROLE(), distributor.address);
    await supplyChain.connect(admin).grantRole(await supplyChain.PHARMACY_ROLE(), pharmacy.address);

    const ADMIN_ROLE = await supplyChain.ADMIN_ROLE();
    const MANUFACTURER_ROLE = await supplyChain.MANUFACTURER_ROLE();
    const DISTRIBUTOR_ROLE = await supplyChain.DISTRIBUTOR_ROLE();
    const PHARMACY_ROLE = await supplyChain.PHARMACY_ROLE();

    const lotNumber = ethers.keccak256(ethers.toUtf8Bytes("LOT-2026-001"));
    const drugNameHash = ethers.keccak256(ethers.toUtf8Bytes("Aspirin100mg"));
    const now = Math.floor(Date.now() / 1000);
    const manufactureDate = BigInt(now);
    const expiryDate = BigInt(now + 365 * 24 * 60 * 60); // 1 year from now
    const quantity = 1000n;

    return {
      supplyChain,
      admin,
      manufacturer,
      distributor,
      pharmacy,
      stranger,
      ADMIN_ROLE,
      MANUFACTURER_ROLE,
      DISTRIBUTOR_ROLE,
      PHARMACY_ROLE,
      lotNumber,
      drugNameHash,
      manufactureDate,
      expiryDate,
      quantity,
    };
  }

  // Helper: create a batch
  async function fixtureWithBatch() {
    const fixture = await loadFixture(deploySupplyChainFixture);
    const { supplyChain, manufacturer, lotNumber, manufactureDate, expiryDate, quantity, drugNameHash } = fixture;

    await supplyChain
      .connect(manufacturer)
      .createBatch(lotNumber, manufactureDate, expiryDate, quantity, drugNameHash);

    return { ...fixture, batchId: 0n };
  }

  // ─── Deployment ────────────────────────────────────────────
  describe("Deployment", function () {
    it("should set admin roles correctly", async function () {
      const { supplyChain, admin, ADMIN_ROLE } = await loadFixture(deploySupplyChainFixture);
      expect(await supplyChain.hasRole(ADMIN_ROLE, admin.address)).to.be.true;
    });

    it("should revert if admin is zero address", async function () {
      const Factory = await ethers.getContractFactory("SupplyChain");
      await expect(
        Factory.deploy(ethers.ZeroAddress, "https://test.com/{id}", ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(Factory, "InvalidAddress");
    });

    it("should start with zero batches", async function () {
      const { supplyChain } = await loadFixture(deploySupplyChainFixture);
      expect(await supplyChain.totalBatches()).to.equal(0n);
    });
  });

  // ─── Batch Creation ───────────────────────────────────────
  describe("createBatch", function () {
    it("manufacturer can create a batch", async function () {
      const { supplyChain, manufacturer, lotNumber, manufactureDate, expiryDate, quantity, drugNameHash } =
        await loadFixture(deploySupplyChainFixture);

      await expect(
        supplyChain.connect(manufacturer).createBatch(lotNumber, manufactureDate, expiryDate, quantity, drugNameHash)
      )
        .to.emit(supplyChain, "BatchCreated")
        .withArgs(0n, manufacturer.address, lotNumber, quantity, drugNameHash, expiryDate);

      expect(await supplyChain.totalBatches()).to.equal(1n);
    });

    it("mints ERC-1155 tokens to manufacturer", async function () {
      const fixture = await fixtureWithBatch();
      const { supplyChain, manufacturer, batchId, quantity } = fixture;

      expect(await supplyChain.balanceOf(manufacturer.address, batchId)).to.equal(quantity);
    });

    it("stores batch metadata correctly", async function () {
      const fixture = await fixtureWithBatch();
      const { supplyChain, manufacturer, batchId, lotNumber, drugNameHash, quantity } = fixture;

      const batch = await supplyChain.getBatch(batchId);
      expect(batch.manufacturer).to.equal(manufacturer.address);
      expect(batch.lotNumber).to.equal(lotNumber);
      expect(batch.drugNameHash).to.equal(drugNameHash);
      expect(batch.quantity).to.equal(quantity);
      expect(batch.status).to.equal(0n); // Created
    });

    it("reverts if caller lacks MANUFACTURER_ROLE", async function () {
      const { supplyChain, stranger, lotNumber, manufactureDate, expiryDate, quantity, drugNameHash } =
        await loadFixture(deploySupplyChainFixture);

      await expect(
        supplyChain.connect(stranger).createBatch(lotNumber, manufactureDate, expiryDate, quantity, drugNameHash)
      ).to.be.reverted;
    });

    it("reverts for zero quantity", async function () {
      const { supplyChain, manufacturer, lotNumber, manufactureDate, expiryDate, drugNameHash } =
        await loadFixture(deploySupplyChainFixture);

      await expect(
        supplyChain.connect(manufacturer).createBatch(lotNumber, manufactureDate, expiryDate, 0n, drugNameHash)
      ).to.be.revertedWithCustomError(supplyChain, "InvalidQuantity");
    });

    it("reverts if expiryDate <= manufactureDate", async function () {
      const { supplyChain, manufacturer, lotNumber, manufactureDate, quantity, drugNameHash } =
        await loadFixture(deploySupplyChainFixture);

      await expect(
        supplyChain.connect(manufacturer).createBatch(lotNumber, manufactureDate, manufactureDate, quantity, drugNameHash)
      ).to.be.revertedWithCustomError(supplyChain, "InvalidDates");
    });
  });

  // ─── Batch Transfer ───────────────────────────────────────
  describe("transferBatch", function () {
    it("manufacturer can transfer to distributor", async function () {
      const fixture = await fixtureWithBatch();
      const { supplyChain, manufacturer, distributor, batchId } = fixture;

      await expect(
        supplyChain.connect(manufacturer).transferBatch(batchId, distributor.address, 500n)
      )
        .to.emit(supplyChain, "BatchTransferred")
        .withArgs(batchId, manufacturer.address, distributor.address, 500n, () => true);

      expect(await supplyChain.balanceOf(distributor.address, batchId)).to.equal(500n);
      expect(await supplyChain.balanceOf(manufacturer.address, batchId)).to.equal(500n);
    });

    it("changes status to InTransit when transferred to distributor", async function () {
      const fixture = await fixtureWithBatch();
      const { supplyChain, manufacturer, distributor, batchId } = fixture;

      await supplyChain.connect(manufacturer).transferBatch(batchId, distributor.address, 100n);
      const batch = await supplyChain.getBatch(batchId);
      expect(batch.status).to.equal(1n); // InTransit
    });

    it("changes status to Delivered when transferred to pharmacy", async function () {
      const fixture = await fixtureWithBatch();
      const { supplyChain, manufacturer, distributor, pharmacy, batchId } = fixture;

      // manufacturer -> distributor -> pharmacy
      await supplyChain.connect(manufacturer).transferBatch(batchId, distributor.address, 100n);
      await supplyChain.connect(distributor).transferBatch(batchId, pharmacy.address, 50n);

      const batch = await supplyChain.getBatch(batchId);
      expect(batch.status).to.equal(2n); // Delivered
    });

    it("emits BatchStatusChanged on status transition", async function () {
      const fixture = await fixtureWithBatch();
      const { supplyChain, manufacturer, distributor, batchId } = fixture;

      await expect(
        supplyChain.connect(manufacturer).transferBatch(batchId, distributor.address, 100n)
      ).to.emit(supplyChain, "BatchStatusChanged");
    });

    it("reverts for non-existent batch", async function () {
      const { supplyChain, manufacturer, distributor } = await loadFixture(deploySupplyChainFixture);
      await expect(
        supplyChain.connect(manufacturer).transferBatch(999n, distributor.address, 100n)
      ).to.be.revertedWithCustomError(supplyChain, "BatchNotFound");
    });

    it("reverts for zero address recipient", async function () {
      const fixture = await fixtureWithBatch();
      const { supplyChain, manufacturer, batchId } = fixture;

      await expect(
        supplyChain.connect(manufacturer).transferBatch(batchId, ethers.ZeroAddress, 100n)
      ).to.be.revertedWithCustomError(supplyChain, "InvalidAddress");
    });

    it("reverts for zero quantity", async function () {
      const fixture = await fixtureWithBatch();
      const { supplyChain, manufacturer, distributor, batchId } = fixture;

      await expect(
        supplyChain.connect(manufacturer).transferBatch(batchId, distributor.address, 0n)
      ).to.be.revertedWithCustomError(supplyChain, "InvalidQuantity");
    });

    it("reverts if recalled", async function () {
      const fixture = await fixtureWithBatch();
      const { supplyChain, admin, manufacturer, distributor, batchId } = fixture;

      await supplyChain.connect(admin).recallBatch(batchId, "Safety concern");

      await expect(
        supplyChain.connect(manufacturer).transferBatch(batchId, distributor.address, 100n)
      ).to.be.revertedWithCustomError(supplyChain, "BatchAlreadyRecalled");
    });

    it("reverts if insufficient balance", async function () {
      const fixture = await fixtureWithBatch();
      const { supplyChain, manufacturer, distributor, batchId, quantity } = fixture;

      await expect(
        supplyChain.connect(manufacturer).transferBatch(batchId, distributor.address, quantity + 1n)
      ).to.be.revertedWithCustomError(supplyChain, "InsufficientBatchBalance");
    });

    it("reverts if caller lacks supply-chain role", async function () {
      const fixture = await fixtureWithBatch();
      const { supplyChain, stranger, distributor, batchId } = fixture;

      await expect(
        supplyChain.connect(stranger).transferBatch(batchId, distributor.address, 100n)
      ).to.be.reverted;
    });

    it("records transfer history", async function () {
      const fixture = await fixtureWithBatch();
      const { supplyChain, manufacturer, distributor, batchId } = fixture;

      await supplyChain.connect(manufacturer).transferBatch(batchId, distributor.address, 100n);

      const history = await supplyChain.getTransferHistory(batchId);
      expect(history.length).to.equal(1);
      expect(history[0].from).to.equal(manufacturer.address);
      expect(history[0].to).to.equal(distributor.address);
      expect(history[0].quantity).to.equal(100n);
    });
  });

  // ─── Condition Updates ────────────────────────────────────
  describe("updateConditions", function () {
    it("supply-chain actor can log conditions", async function () {
      const fixture = await fixtureWithBatch();
      const { supplyChain, manufacturer, batchId } = fixture;

      const tempHash = ethers.keccak256(ethers.toUtf8Bytes("22.5C"));
      const humHash = ethers.keccak256(ethers.toUtf8Bytes("45%"));
      const gpsHash = ethers.keccak256(ethers.toUtf8Bytes("40.7128,-74.0060"));

      await expect(
        supplyChain.connect(manufacturer).updateConditions(batchId, tempHash, humHash, gpsHash)
      )
        .to.emit(supplyChain, "ConditionsUpdated")
        .withArgs(batchId, tempHash, humHash, gpsHash, manufacturer.address, () => true);
    });

    it("condition logs are persisted and retrievable", async function () {
      const fixture = await fixtureWithBatch();
      const { supplyChain, manufacturer, batchId } = fixture;

      const tempHash = ethers.keccak256(ethers.toUtf8Bytes("22.5C"));
      const humHash = ethers.keccak256(ethers.toUtf8Bytes("45%"));
      const gpsHash = ethers.keccak256(ethers.toUtf8Bytes("40.7128,-74.0060"));

      await supplyChain.connect(manufacturer).updateConditions(batchId, tempHash, humHash, gpsHash);

      const logs = await supplyChain.getConditionLogs(batchId);
      expect(logs.length).to.equal(1);
      expect(logs[0].temperatureHash).to.equal(tempHash);
      expect(logs[0].humidityHash).to.equal(humHash);
      expect(logs[0].gpsHash).to.equal(gpsHash);
      expect(logs[0].reporter).to.equal(manufacturer.address);
    });

    it("reverts for non-existent batch", async function () {
      const { supplyChain, manufacturer } = await loadFixture(deploySupplyChainFixture);
      await expect(
        supplyChain.connect(manufacturer).updateConditions(999n, ethers.ZeroHash, ethers.ZeroHash, ethers.ZeroHash)
      ).to.be.revertedWithCustomError(supplyChain, "BatchNotFound");
    });

    it("reverts if caller lacks supply-chain role", async function () {
      const fixture = await fixtureWithBatch();
      const { supplyChain, stranger, batchId } = fixture;

      await expect(
        supplyChain.connect(stranger).updateConditions(batchId, ethers.ZeroHash, ethers.ZeroHash, ethers.ZeroHash)
      ).to.be.reverted;
    });
  });

  // ─── Flagging & Recall ────────────────────────────────────
  describe("flagBatch & recallBatch", function () {
    it("supply-chain actor or admin can flag a batch", async function () {
      const fixture = await fixtureWithBatch();
      const { supplyChain, distributor, batchId } = fixture;

      await expect(
        supplyChain.connect(distributor).flagBatch(batchId, "Broken seal")
      )
        .to.emit(supplyChain, "BatchFlagged")
        .withArgs(batchId, distributor.address, "Broken seal", () => true);

      const batch = await supplyChain.getBatch(batchId);
      expect(batch.status).to.equal(3n); // Flagged
    });

    it("admin can flag a batch", async function () {
      const fixture = await fixtureWithBatch();
      const { supplyChain, admin, batchId } = fixture;

      await expect(
        supplyChain.connect(admin).flagBatch(batchId, "Suspect quality")
      ).to.emit(supplyChain, "BatchFlagged");
    });

    it("stranger cannot flag a batch", async function () {
      const fixture = await fixtureWithBatch();
      const { supplyChain, stranger, batchId } = fixture;

      await expect(
        supplyChain.connect(stranger).flagBatch(batchId, "FakeFlag")
      ).to.be.reverted;
    });

    it("admin can recall a batch", async function () {
      const fixture = await fixtureWithBatch();
      const { supplyChain, admin, batchId } = fixture;

      await expect(
        supplyChain.connect(admin).recallBatch(batchId, "Critical safety issue")
      )
        .to.emit(supplyChain, "BatchRecalled")
        .withArgs(batchId, admin.address, "Critical safety issue", () => true);

      const batch = await supplyChain.getBatch(batchId);
      expect(batch.status).to.equal(4n); // Recalled
    });

    it("manufacturer can recall their own batch", async function () {
      const fixture = await fixtureWithBatch();
      const { supplyChain, manufacturer, batchId } = fixture;

      await expect(
        supplyChain.connect(manufacturer).recallBatch(batchId, "Voluntary recall")
      ).to.emit(supplyChain, "BatchRecalled");
    });

    it("non-admin, non-manufacturer cannot recall", async function () {
      const fixture = await fixtureWithBatch();
      const { supplyChain, distributor, batchId } = fixture;

      await expect(
        supplyChain.connect(distributor).recallBatch(batchId, "Attempt")
      ).to.be.reverted;
    });

    it("cannot flag a recalled batch", async function () {
      const fixture = await fixtureWithBatch();
      const { supplyChain, admin, batchId } = fixture;

      await supplyChain.connect(admin).recallBatch(batchId, "Safety");

      await expect(
        supplyChain.connect(admin).flagBatch(batchId, "Additional flag")
      ).to.be.revertedWithCustomError(supplyChain, "BatchAlreadyRecalled");
    });

    it("cannot recall an already recalled batch", async function () {
      const fixture = await fixtureWithBatch();
      const { supplyChain, admin, batchId } = fixture;

      await supplyChain.connect(admin).recallBatch(batchId, "First recall");

      await expect(
        supplyChain.connect(admin).recallBatch(batchId, "Second recall")
      ).to.be.revertedWithCustomError(supplyChain, "BatchAlreadyRecalled");
    });
  });

  // ─── Verify Batch ─────────────────────────────────────────
  describe("verifyBatch", function () {
    it("returns valid for a healthy batch", async function () {
      const fixture = await fixtureWithBatch();
      const { supplyChain, batchId } = fixture;

      const [valid, status, isExpired] = await supplyChain.verifyBatch(batchId);
      expect(valid).to.be.true;
      expect(status).to.equal(0n); // Created
      expect(isExpired).to.be.false;
    });

    it("returns invalid for a flagged batch", async function () {
      const fixture = await fixtureWithBatch();
      const { supplyChain, admin, batchId } = fixture;

      await supplyChain.connect(admin).flagBatch(batchId, "Issue");

      const [valid, , ] = await supplyChain.verifyBatch(batchId);
      expect(valid).to.be.false;
    });

    it("returns invalid for a recalled batch", async function () {
      const fixture = await fixtureWithBatch();
      const { supplyChain, admin, batchId } = fixture;

      await supplyChain.connect(admin).recallBatch(batchId, "Issue");

      const [valid, , ] = await supplyChain.verifyBatch(batchId);
      expect(valid).to.be.false;
    });

    it("reverts for non-existent batch", async function () {
      const { supplyChain } = await loadFixture(deploySupplyChainFixture);
      await expect(supplyChain.verifyBatch(999n))
        .to.be.revertedWithCustomError(supplyChain, "BatchNotFound");
    });
  });

  // ─── Admin Functions ──────────────────────────────────────
  describe("Admin Functions", function () {
    it("admin can set URI", async function () {
      const { supplyChain, admin } = await loadFixture(deploySupplyChainFixture);
      await expect(
        supplyChain.connect(admin).setURI("https://new.uri/{id}.json")
      ).to.not.be.reverted;
    });

    it("non-admin cannot set URI", async function () {
      const { supplyChain, stranger } = await loadFixture(deploySupplyChainFixture);
      await expect(
        supplyChain.connect(stranger).setURI("https://hack.uri/{id}.json")
      ).to.be.reverted;
    });

    it("admin can update World ID verifier", async function () {
      const { supplyChain, admin, stranger } = await loadFixture(deploySupplyChainFixture);
      await expect(
        supplyChain.connect(admin).setWorldIdVerifier(stranger.address)
      ).to.emit(supplyChain, "WorldIdVerifierUpdated");
    });
  });

  // ─── ERC-165 ──────────────────────────────────────────────
  describe("supportsInterface", function () {
    it("supports ERC-1155 interface", async function () {
      const { supplyChain } = await loadFixture(deploySupplyChainFixture);
      // ERC-1155: 0xd9b67a26
      expect(await supplyChain.supportsInterface("0xd9b67a26")).to.be.true;
    });

    it("supports AccessControl interface", async function () {
      const { supplyChain } = await loadFixture(deploySupplyChainFixture);
      expect(await supplyChain.supportsInterface("0x7965db0b")).to.be.true;
    });
  });
});
