/**
 * Auth routes — login (email+password), wallet login, register,
 *   World ID verify, me endpoint, user listing (admin).
 */
import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { authenticate, authorise, signToken } from "../middleware/auth";
import {
  findUserByEmail,
  findUserByWallet,
  findUserById,
  createUser,
  updateUserWorldID,
  getAllUsers,
  updateUserRole,
  insertAuditEntry,
  insertWorldIDVerification,
} from "../services/database";
import { verifyWorldIDProof } from "../services/worldid";
import { createLogger } from "../utils/logging";
import { UserRole } from "../types";

const log = createLogger("routes:auth");
const router = Router();

/* ─── Helpers ─────────────────────────────────────────────── */

function mapRole(role: string): UserRole {
  const ROLE_MAP: Record<string, UserRole> = {
    patient: UserRole.PATIENT,
    doctor: UserRole.PROVIDER,
    insurer: UserRole.INSURER,
    admin: UserRole.ADMIN,
    paramedic: UserRole.PROVIDER,
    researcher: UserRole.PROVIDER,
    manufacturer: UserRole.MANUFACTURER,
    distributor: UserRole.DISTRIBUTOR,
    pharmacy: UserRole.PHARMACY,
  };
  return ROLE_MAP[role.toLowerCase()] ?? UserRole.PATIENT;
}

function sanitiseUser(u: any) {
  const { password_hash, ...safe } = u;
  return safe;
}

/* ─── POST /api/auth/login ────────────────────────────────── */
router.post("/login", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ success: false, error: "Email and password required" });
      return;
    }

    const user = await findUserByEmail(email);
    if (!user || !user.password_hash) {
      res.status(401).json({ success: false, error: "Invalid credentials" });
      return;
    }

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ success: false, error: "Invalid credentials" });
      return;
    }

    const token = signToken({
      sub: String(user.id),
      role: mapRole(user.role),
      address: user.wallet_address,
    });

    await insertAuditEntry(user.id, "LOGIN", `Email login: ${email}`, req.ip);
    log.info("User logged in", { userId: user.id, role: user.role });

    res.json({
      success: true,
      data: {
        token,
        user: sanitiseUser(user),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

/* ─── POST /api/auth/wallet-login ─────────────────────────── */
router.post("/wallet-login", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { address } = req.body;
    if (!address) {
      res.status(400).json({ success: false, error: "Wallet address required" });
      return;
    }

    let user = await findUserByWallet(address);
    if (!user) {
      // Auto-register wallet users as patients
      user = await createUser({
        wallet_address: address,
        display_name: `User ${address.slice(0, 6)}...${address.slice(-4)}`,
        role: "patient",
      });
      log.info("Auto-registered wallet user", { address, userId: user.id });
    }

    const token = signToken({
      sub: String(user.id),
      role: mapRole(user.role),
      address: user.wallet_address,
    });

    await insertAuditEntry(user.id, "WALLET_LOGIN", `Wallet: ${address}`, req.ip);

    res.json({
      success: true,
      data: {
        token,
        user: sanitiseUser(user),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

/* ─── POST /api/auth/register ─────────────────────────────── */
router.post("/register", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, displayName, role, walletAddress } = req.body;
    if (!email || !password || !displayName) {
      res.status(400).json({ success: false, error: "email, password, displayName required" });
      return;
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      res.status(409).json({ success: false, error: "Email already registered" });
      return;
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const user = await createUser({
      wallet_address: walletAddress || `0xAutoGen${Date.now().toString(16).padStart(32, "0")}`,
      display_name: displayName,
      role: role || "patient",
      email,
      password_hash: passwordHash,
    });

    const token = signToken({
      sub: String(user.id),
      role: mapRole(user.role),
      address: user.wallet_address,
    });

    await insertAuditEntry(user.id, "REGISTER", `New account: ${email}`, req.ip);
    log.info("User registered", { userId: user.id, email });

    res.status(201).json({
      success: true,
      data: { token, user: sanitiseUser(user) },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

/* ─── POST /api/auth/worldid/verify ───────────────────────── */
router.post(
  "/worldid/verify",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { merkle_root, nullifier_hash, proof, signal } = req.body;
      if (!merkle_root || !nullifier_hash || !proof) {
        res.status(400).json({ success: false, error: "merkle_root, nullifier_hash, proof required" });
        return;
      }

      const userId = parseInt(req.user!.sub, 10);
      const result = await verifyWorldIDProof({ merkle_root, nullifier_hash, proof, signal });

      await insertWorldIDVerification(userId, nullifier_hash, result.action, result.verified);

      if (result.verified) {
        await updateUserWorldID(userId, nullifier_hash);
        await insertAuditEntry(userId, "WORLDID_VERIFIED", `Nullifier: ${nullifier_hash.slice(0, 16)}…`, req.ip);
      }

      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },
);

/* ─── POST /api/auth/worldid/simulate ─────────────────────── */
router.post(
  "/worldid/simulate",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = parseInt(req.user!.sub, 10);
      const simulatedNullifier = `0xSIM_${Date.now().toString(16)}_${userId}`;

      await updateUserWorldID(userId, simulatedNullifier);
      await insertWorldIDVerification(userId, simulatedNullifier, "verify-human", true);
      await insertAuditEntry(userId, "WORLDID_SIMULATED", `Dev-mode simulated verification`, req.ip);

      log.info("WorldID simulated for dev mode", { userId });

      res.json({
        success: true,
        data: {
          verified: true,
          nullifierHash: simulatedNullifier,
          action: "verify-human",
          verifiedAt: new Date().toISOString(),
          simulated: true,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },
);

/* ─── GET /api/auth/me ────────────────────────────────────── */
router.get("/me", authenticate, async (req: Request, res: Response) => {
  const user = await findUserById(parseInt(req.user!.sub, 10));
  if (!user) {
    res.status(404).json({ success: false, error: "User not found" });
    return;
  }
  res.json({
    success: true,
    data: sanitiseUser(user),
    timestamp: new Date().toISOString(),
  });
});

/* ─── GET /api/auth/users (admin only) ────────────────────── */
router.get(
  "/users",
  authenticate,
  authorise(UserRole.ADMIN),
  async (_req: Request, res: Response) => {
    const users = (await getAllUsers()).map(sanitiseUser);
    res.json({
      success: true,
      data: { users, total: users.length },
      timestamp: new Date().toISOString(),
    });
  },
);

/* ─── PATCH /api/auth/users/:id/role (admin only) ─────────── */
router.patch(
  "/users/:id/role",
  authenticate,
  authorise(UserRole.ADMIN),
  async (req: Request, res: Response) => {
    const userId = parseInt(req.params.id, 10);
    const { role } = req.body;
    if (!role) {
      res.status(400).json({ success: false, error: "role required" });
      return;
    }
    await updateUserRole(userId, role);
    await insertAuditEntry(parseInt(req.user!.sub, 10), "ROLE_CHANGE", `User ${userId} → ${role}`, req.ip);
    const user = await findUserById(userId);
    res.json({
      success: true,
      data: sanitiseUser(user),
      timestamp: new Date().toISOString(),
    });
  },
);

export default router;
