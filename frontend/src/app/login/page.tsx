"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, LogIn, UserPlus, Loader2, Shield, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type Tab = "login" | "register";

const DEMO_ACCOUNTS = [
  { label: "Admin (Dr. Daver)",   email: "admin@medicare-dao.eth",     password: "admin123",     role: "admin",      color: "from-gray-700 to-gray-900" },
  { label: "Patient (Alice)",     email: "patient@medicare-dao.eth",   password: "patient123",   role: "patient",    color: "from-emerald-500 to-emerald-700" },
  { label: "Doctor (Dr. Chen)",   email: "doctor@medicare-dao.eth",    password: "doctor123",    role: "doctor",     color: "from-blue-500 to-blue-700" },
  { label: "Insurer (BlueCross)", email: "insurer@medicare-dao.eth",   password: "insurer123",   role: "insurer",    color: "from-purple-500 to-purple-700" },
  { label: "Paramedic (Mike)",    email: "paramedic@medicare-dao.eth", password: "paramedic123", role: "paramedic",  color: "from-red-500 to-red-700" },
  { label: "Researcher (Prof.)",  email: "researcher@medicare-dao.eth",password: "researcher123",role: "researcher", color: "from-amber-500 to-amber-700" },
];

export default function LoginPage() {
  const router = useRouter();
  const { login, register } = useAuth();
  const [tab, setTab] = useState<Tab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState("patient");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err?.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register({ email, password, displayName, role });
      router.push("/dashboard");
    } catch (err: any) {
      setError(err?.response?.data?.error || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = async (acct: typeof DEMO_ACCOUNTS[0]) => {
    setError("");
    setLoading(true);
    try {
      await login(acct.email, acct.password);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err?.response?.data?.error || "Quick login failed");
    } finally {
      setLoading(false);
    }
  };

  const INPUT_CLS =
    "w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4 dark:from-gray-950 dark:to-[#0a0f1e]">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#375BD2] to-[#06b6d4] shadow-lg">
            <Heart className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            medi<span className="text-primary">CaRE</span>
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Decentralized Healthcare Platform
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900">
          {/* Tabs */}
          <div className="mb-5 flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
            {([["login", "Sign In", LogIn], ["register", "Register", UserPlus]] as const).map(([t, label, Icon]) => (
              <button
                key={t}
                onClick={() => { setTab(t as Tab); setError(""); }}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                  tab === t
                    ? "bg-white text-gray-900 shadow dark:bg-gray-700 dark:text-white"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {tab === "login" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Email</label>
                <input type="email" className={INPUT_CLS} placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Password</label>
                <input type="password" className={INPUT_CLS} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary/90 disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                Sign In
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Display Name</label>
                <input type="text" className={INPUT_CLS} placeholder="Jane Doe" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Email</label>
                <input type="email" className={INPUT_CLS} placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Password</label>
                <input type="password" className={INPUT_CLS} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Role</label>
                <select className={INPUT_CLS} value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="patient">Patient</option>
                  <option value="doctor">Doctor</option>
                  <option value="insurer">Insurer</option>
                  <option value="paramedic">Paramedic</option>
                  <option value="researcher">Researcher</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary/90 disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Create Account
              </button>
            </form>
          )}

          {/* Divider */}
          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
            <span className="text-xs text-gray-400">Quick Login (Demo)</span>
            <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
          </div>

          {/* Judge banner */}
          <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 dark:border-blue-800 dark:bg-blue-900/20">
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">
              🏆 For Judges &amp; Reviewers
            </p>
            <p className="mt-0.5 text-[11px] text-blue-600 dark:text-blue-400">
              Click any card below to instantly log in. Each role showcases
              different Chainlink-powered features. All data is on testnet — no real funds.
            </p>
          </div>

          {/* Demo account cards */}
          <div className="grid grid-cols-1 gap-2">
            {DEMO_ACCOUNTS.map((acct) => (
              <button
                key={acct.email}
                onClick={() => quickLogin(acct)}
                disabled={loading}
                className={`group flex items-center gap-3 rounded-lg bg-gradient-to-r ${acct.color} px-3 py-2.5 text-left text-white shadow transition hover:scale-[1.01] hover:shadow-md disabled:opacity-50`}
              >
                <Shield className="h-4 w-4 flex-shrink-0 opacity-70" />
                <div className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold">{acct.label}</span>
                  <span className="block truncate text-[10px] opacity-80">
                    {acct.email} &nbsp;/&nbsp; {acct.password}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 dark:text-gray-500">
          Each role sees different features and data access levels
        </p>
      </div>
    </div>
  );
}
