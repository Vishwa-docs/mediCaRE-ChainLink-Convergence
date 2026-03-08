/**
 * Supabase (PostgreSQL) database service.
 * Stores users, sessions, World ID verifications, and role assignments.
 *
 * Cloud-hosted on Supabase — no local file dependencies.
 * Tables are created via Supabase SQL editor (see supabase-schema.sql).
 * Demo users are seeded on first startup if the users table is empty.
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { createLogger } from "../utils/logging";

const log = createLogger("service:database");

/* ─── Supabase Client ─────────────────────────────────────── */

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      throw new Error(
        "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables",
      );
    }
    _supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    log.info("Supabase client initialised", { url: SUPABASE_URL });
  }
  return _supabase;
}

/* ─── Initialise (seed demo users if empty) ───────────────── */

let _initialised = false;

export async function initialiseDatabase(): Promise<void> {
  if (_initialised) return;
  const sb = getSupabase();

  // Check if users exist — seed demo users if table is empty
  const { count, error } = await sb
    .from("users")
    .select("*", { count: "exact", head: true });

  if (error) {
    log.error("Failed to check users table", { error: error.message });
    throw new Error(`Database connection failed: ${error.message}. Make sure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are correct and the tables exist (run supabase-schema.sql first).`);
  }

  if (count === 0 || count === null) {
    await seedDemoUsers();
  }

  _initialised = true;
  log.info("Database initialised", { userCount: count });
}

/* ─── Demo Users ──────────────────────────────────────────── */

async function seedDemoUsers(): Promise<void> {
  const bcrypt = await import("bcryptjs");
  const salt = bcrypt.genSaltSync(10);
  const sb = getSupabase();

  const demoUsers = [
    {
      wallet_address: "0xDemoAdmin000000000000000000000000000000001",
      display_name: "Dr. Daver (Admin)",
      role: "admin",
      email: "admin@medicare-dao.eth",
      password_hash: bcrypt.hashSync("admin123", salt),
    },
    {
      wallet_address: "0xDemoPatient00000000000000000000000000000002",
      display_name: "Alice Johnson (Patient)",
      role: "patient",
      email: "patient@medicare-dao.eth",
      password_hash: bcrypt.hashSync("patient123", salt),
    },
    {
      wallet_address: "0xDemoDoctor000000000000000000000000000000003",
      display_name: "Dr. Sarah Chen",
      role: "doctor",
      email: "doctor@medicare-dao.eth",
      password_hash: bcrypt.hashSync("doctor123", salt),
    },
    {
      wallet_address: "0xDemoInsurer0000000000000000000000000000004",
      display_name: "BlueCross Insurer",
      role: "insurer",
      email: "insurer@medicare-dao.eth",
      password_hash: bcrypt.hashSync("insurer123", salt),
    },
    {
      wallet_address: "0xDemoParamedic000000000000000000000000000005",
      display_name: "Mike Torres (Paramedic)",
      role: "paramedic",
      email: "paramedic@medicare-dao.eth",
      password_hash: bcrypt.hashSync("paramedic123", salt),
    },
    {
      wallet_address: "0xDemoResearcher0000000000000000000000000006",
      display_name: "Prof. Nakamura (Researcher)",
      role: "researcher",
      email: "researcher@medicare-dao.eth",
      password_hash: bcrypt.hashSync("researcher123", salt),
    },
  ];

  const { error } = await sb.from("users").upsert(demoUsers, {
    onConflict: "email",
    ignoreDuplicates: true,
  });

  if (error) {
    log.error("Failed to seed demo users", { error: error.message });
  } else {
    log.info("Seeded demo users", { count: demoUsers.length });
  }
}

/* ─── User Types ──────────────────────────────────────────── */

export interface DbUser {
  id: number;
  wallet_address: string;
  display_name: string;
  role: string;
  password_hash: string | null;
  email: string | null;
  worldid_nullifier: string | null;
  worldid_verified: boolean;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

/* ─── User CRUD ───────────────────────────────────────────── */

export async function findUserByEmail(email: string): Promise<DbUser | undefined> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("users")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    log.error("findUserByEmail failed", { error: error.message });
    return undefined;
  }
  return data ?? undefined;
}

export async function findUserByWallet(address: string): Promise<DbUser | undefined> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("users")
    .select("*")
    .ilike("wallet_address", address)
    .maybeSingle();

  if (error) {
    log.error("findUserByWallet failed", { error: error.message });
    return undefined;
  }
  return data ?? undefined;
}

export async function findUserById(id: number): Promise<DbUser | undefined> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("users")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    log.error("findUserById failed", { error: error.message });
    return undefined;
  }
  return data ?? undefined;
}

export async function findUserByNullifier(nullifier: string): Promise<DbUser | undefined> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("users")
    .select("*")
    .eq("worldid_nullifier", nullifier)
    .maybeSingle();

  if (error) {
    log.error("findUserByNullifier failed", { error: error.message });
    return undefined;
  }
  return data ?? undefined;
}

export async function createUser(data: {
  wallet_address: string;
  display_name: string;
  role: string;
  email?: string;
  password_hash?: string;
}): Promise<DbUser> {
  const sb = getSupabase();
  const { data: user, error } = await sb
    .from("users")
    .insert({
      wallet_address: data.wallet_address,
      display_name: data.display_name,
      role: data.role,
      email: data.email ?? null,
      password_hash: data.password_hash ?? null,
    })
    .select()
    .single();

  if (error) {
    log.error("createUser failed", { error: error.message });
    throw new Error(`Failed to create user: ${error.message}`);
  }
  return user;
}

export async function updateUserWorldID(userId: number, nullifierHash: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb
    .from("users")
    .update({
      worldid_nullifier: nullifierHash,
      worldid_verified: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) {
    log.error("updateUserWorldID failed", { error: error.message });
  }
}

export async function getAllUsers(): Promise<DbUser[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("users")
    .select("*")
    .order("id", { ascending: true });

  if (error) {
    log.error("getAllUsers failed", { error: error.message });
    return [];
  }
  return data ?? [];
}

export async function updateUserRole(userId: number, role: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb
    .from("users")
    .update({ role, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) {
    log.error("updateUserRole failed", { error: error.message });
  }
}

/* ─── Audit ───────────────────────────────────────────────── */

export async function insertAuditEntry(
  userId: number | null,
  action: string,
  details?: string,
  ip?: string,
): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from("audit_log").insert({
    user_id: userId,
    action,
    details: details ?? null,
    ip_address: ip ?? null,
  });

  if (error) {
    log.error("insertAuditEntry failed", { error: error.message });
  }
}

/* ─── WorldID Verifications ───────────────────────────────── */

export async function insertWorldIDVerification(
  userId: number,
  nullifierHash: string,
  action: string,
  verified: boolean,
): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from("worldid_verifications").insert({
    user_id: userId,
    nullifier_hash: nullifierHash,
    action,
    verified,
    verified_at: verified ? new Date().toISOString() : null,
  });

  if (error) {
    log.error("insertWorldIDVerification failed", { error: error.message });
  }
}
