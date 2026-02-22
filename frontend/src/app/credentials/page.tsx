"use client";

import { useState } from "react";
import { BadgeCheck, Plus, Search, ShieldCheck, ShieldX, Calendar, User } from "lucide-react";
import Badge from "@/components/shared/Badge";
import Button from "@/components/shared/Button";
import Modal from "@/components/shared/Modal";
import StatCard from "@/components/shared/StatCard";
import { CredentialTypeLabels } from "@/types";
import type { Credential, CredentialType } from "@/types";
import toast from "react-hot-toast";

const MOCK_CREDENTIALS: Credential[] = [
  { credentialId: 1, credentialHash: "0xabc…123", issuer: "0xMedBoard…1a2b", subject: "0xDrSmith…3c4d", credentialType: 0, issuanceDate: Date.now() / 1000 - 31536000, expiryDate: Date.now() / 1000 + 31536000, isValid: true },
  { credentialId: 2, credentialHash: "0xdef…456", issuer: "0xABIM…5e6f", subject: "0xDrSmith…3c4d", credentialType: 1, issuanceDate: Date.now() / 1000 - 15768000, expiryDate: Date.now() / 1000 + 47304000, isValid: true },
  { credentialId: 3, credentialHash: "0xghi…789", issuer: "0xDEA…7g8h", subject: "0xDrJones…9i0j", credentialType: 3, issuanceDate: Date.now() / 1000 - 7884000, expiryDate: Date.now() / 1000 + 23652000, isValid: true },
  { credentialId: 4, credentialHash: "0xjkl…012", issuer: "0xNPI…1k2l", subject: "0xDrPatel…3m4n", credentialType: 4, issuanceDate: Date.now() / 1000 - 63072000, expiryDate: 0, isValid: true },
  { credentialId: 5, credentialHash: "0xmno…345", issuer: "0xCME…5o6p", subject: "0xDrSmith…3c4d", credentialType: 5, issuanceDate: Date.now() / 1000 - 2592000, expiryDate: Date.now() / 1000 + 7884000, isValid: true },
  { credentialId: 6, credentialHash: "0xpqr…678", issuer: "0xMedBoard…1a2b", subject: "0xDrLee…7q8r", credentialType: 0, issuanceDate: Date.now() / 1000 - 94608000, expiryDate: Date.now() / 1000 - 604800, isValid: false },
];

export default function CredentialsPage() {
  const [search, setSearch] = useState("");
  const [showIssue, setShowIssue] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
  const [verifyId, setVerifyId] = useState("");
  const [verifyResult, setVerifyResult] = useState<{ valid: boolean; message: string } | null>(null);
  const [formData, setFormData] = useState({ subject: "", credentialType: "0", credentialHash: "", expiryDate: "" });

  const filtered = MOCK_CREDENTIALS.filter(
    (c) =>
      c.subject.toLowerCase().includes(search.toLowerCase()) ||
      c.issuer.toLowerCase().includes(search.toLowerCase()) ||
      CredentialTypeLabels[c.credentialType as CredentialType].toLowerCase().includes(search.toLowerCase())
  );

  const handleIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    await new Promise((r) => setTimeout(r, 1500));
    toast.success("Credential issued on-chain");
    setShowIssue(false);
  };

  const handleVerify = async () => {
    if (!verifyId) return;
    await new Promise((r) => setTimeout(r, 1000));
    const id = parseInt(verifyId);
    const cred = MOCK_CREDENTIALS.find((c) => c.credentialId === id);
    if (cred) {
      setVerifyResult({
        valid: cred.isValid,
        message: cred.isValid
          ? `Credential #${id} is valid. Issued by ${cred.issuer} on ${new Date(cred.issuanceDate * 1000).toLocaleDateString()}.`
          : `Credential #${id} has been revoked or expired.`,
      });
    } else {
      setVerifyResult({ valid: false, message: `Credential #${id} not found.` });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Provider Credentials</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Issue, verify, and manage healthcare provider credentials on-chain
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowVerify(true)}>
            <Search className="h-4 w-4" /> Verify
          </Button>
          <Button onClick={() => setShowIssue(true)}>
            <Plus className="h-4 w-4" /> Issue Credential
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Credentials" value="56" icon={<BadgeCheck className="h-6 w-6" />} trend={{ value: 5.7, positive: true }} />
        <StatCard title="Active" value="49" icon={<ShieldCheck className="h-6 w-6" />} />
        <StatCard title="Revoked/Expired" value="7" icon={<ShieldX className="h-6 w-6" />} />
        <StatCard title="Issuers" value="12" icon={<User className="h-6 w-6" />} />
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by provider, issuer, or type…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        />
      </div>

      {/* Credentials grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((cred) => (
          <div
            key={cred.credentialId}
            className={`rounded-xl border bg-white p-6 shadow-sm dark:bg-gray-800 ${
              cred.isValid ? "border-gray-200 dark:border-gray-700" : "border-red-200 dark:border-red-800"
            }`}
          >
            <div className="mb-3 flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${cred.isValid ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-red-100 dark:bg-red-900/30"}`}>
                  {cred.isValid ? (
                    <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <ShieldX className="h-5 w-5 text-red-600 dark:text-red-400" />
                  )}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {CredentialTypeLabels[cred.credentialType as CredentialType]}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">#{cred.credentialId}</p>
                </div>
              </div>
              <Badge variant={cred.isValid ? "success" : "danger"}>
                {cred.isValid ? "Valid" : "Invalid"}
              </Badge>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">Subject</span>
                <span className="font-mono text-xs text-gray-700 dark:text-gray-300">{cred.subject}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">Issuer</span>
                <span className="font-mono text-xs text-gray-700 dark:text-gray-300">{cred.issuer}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">Issued</span>
                <span className="text-gray-700 dark:text-gray-300">
                  {new Date(cred.issuanceDate * 1000).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">Expires</span>
                <span className="text-gray-700 dark:text-gray-300">
                  {cred.expiryDate === 0 ? "Never" : new Date(cred.expiryDate * 1000).toLocaleDateString()}
                </span>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
              <Calendar className="h-3 w-3" />
              Hash: {cred.credentialHash}
            </div>
          </div>
        ))}
      </div>

      {/* Issue credential modal */}
      <Modal open={showIssue} onClose={() => setShowIssue(false)} title="Issue New Credential">
        <form onSubmit={handleIssue} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Provider Address</label>
            <input
              type="text"
              placeholder="0x…"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              required
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Credential Type</label>
            <select
              value={formData.credentialType}
              onChange={(e) => setFormData({ ...formData, credentialType: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              {Object.entries(CredentialTypeLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Document Hash</label>
            <input
              type="text"
              placeholder="0x…"
              value={formData.credentialHash}
              onChange={(e) => setFormData({ ...formData, credentialHash: e.target.value })}
              required
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Expiry Date (optional)</label>
            <input
              type="date"
              value={formData.expiryDate}
              onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" type="button" onClick={() => setShowIssue(false)}>Cancel</Button>
            <Button className="flex-1" type="submit">Issue On-Chain</Button>
          </div>
        </form>
      </Modal>

      {/* Verify modal */}
      <Modal open={showVerify} onClose={() => { setShowVerify(false); setVerifyResult(null); }} title="Verify Credential">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Credential ID</label>
            <input
              type="number"
              placeholder="Enter credential ID"
              value={verifyId}
              onChange={(e) => { setVerifyId(e.target.value); setVerifyResult(null); }}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <Button className="w-full" onClick={handleVerify}>Verify</Button>

          {verifyResult && (
            <div className={`rounded-lg border p-4 ${verifyResult.valid ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20" : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"}`}>
              <div className="flex items-center gap-2">
                {verifyResult.valid ? (
                  <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <ShieldX className="h-5 w-5 text-red-600 dark:text-red-400" />
                )}
                <p className={`text-sm font-medium ${verifyResult.valid ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}>
                  {verifyResult.valid ? "Valid Credential" : "Invalid Credential"}
                </p>
              </div>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{verifyResult.message}</p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
