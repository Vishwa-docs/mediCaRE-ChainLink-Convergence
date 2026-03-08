"use client";

import { useState, useEffect, useCallback } from "react";
import { BadgeCheck, Plus, Search, ShieldCheck, ShieldX, Calendar, User, Loader2 } from "lucide-react";
import Badge from "@/components/shared/Badge";
import Button from "@/components/shared/Button";
import Modal from "@/components/shared/Modal";
import StatCard from "@/components/shared/StatCard";
import { CredentialTypeLabels } from "@/types";
import type { Credential, CredentialType } from "@/types";
import { useContract, useWalletAddress } from "@/hooks/useContract";
import { ethers } from "ethers";
import toast from "react-hot-toast";

export default function CredentialsPage() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showIssue, setShowIssue] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
  const [verifyId, setVerifyId] = useState("");
  const [verifyResult, setVerifyResult] = useState<{ valid: boolean; message: string } | null>(null);
  const [formData, setFormData] = useState({ subject: "", credentialType: "0", credentialHash: "", expiryDate: "" });
  const [issuing, setIssuing] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const credContract = useContract("CredentialRegistry");
  const { address, connect } = useWalletAddress();

  const fetchCredentials = useCallback(async () => {
    setLoading(true);
    try {
      const count = await credContract.read<bigint>("totalCredentials");
      const n = Number(count);
      const credPromises = Array.from({ length: n }, (_, i) =>
        credContract.read<any>("getCredential", i).catch(() => null)
      );
      const credResults = await Promise.all(credPromises);
      const items: Credential[] = credResults
        .filter((c): c is NonNullable<typeof c> => c !== null)
        .map((c) => ({
          credentialId: Number(c.credentialId ?? c[0]),
          credentialHash: c.credentialHash ?? c[1],
          issuer: c.issuer ?? c[2],
          subject: c.subject ?? c[3],
          credentialType: Number(c.credentialType ?? c[4]),
          issuanceDate: Number(c.issuanceDate ?? c[5]),
          expiryDate: Number(c.expiryDate ?? c[6]),
          isValid: c.isValid ?? c[7],
        }));
      setCredentials(items);
    } catch {
      setCredentials([]);
    } finally {
      setLoading(false);
    }
  }, [credContract]);

  useEffect(() => {
    connect().then(() => fetchCredentials());
  }, [connect, fetchCredentials]);

  const filtered = credentials.filter(
    (c) =>
      c.subject.toLowerCase().includes(search.toLowerCase()) ||
      c.issuer.toLowerCase().includes(search.toLowerCase()) ||
      CredentialTypeLabels[c.credentialType as CredentialType]?.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = credentials.filter((c) => c.isValid).length;
  const invalidCount = credentials.filter((c) => !c.isValid).length;
  const uniqueIssuers = new Set(credentials.map((c) => c.issuer)).size;

  const handleIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    setIssuing(true);
    try {
      const expiryTimestamp = formData.expiryDate
        ? Math.floor(new Date(formData.expiryDate).getTime() / 1000)
        : 0;
      const credHash = ethers.encodeBytes32String(formData.credentialHash.slice(0, 31));
      const issuanceTimestamp = Math.floor(Date.now() / 1000);
      await credContract.write(
        "issueCredential",
        credHash,
        formData.subject,
        parseInt(formData.credentialType),
        issuanceTimestamp,
        expiryTimestamp,
      );
      toast.success("Credential issued on-chain!");
      setShowIssue(false);
      setFormData({ subject: "", credentialType: "0", credentialHash: "", expiryDate: "" });
      fetchCredentials();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to issue credential");
    } finally {
      setIssuing(false);
    }
  };

  const handleVerify = async () => {
    if (!verifyId) return;
    setVerifying(true);
    try {
      const id = parseInt(verifyId);
      const valid = await credContract.read<boolean>("verifyCredential", id);
      if (valid) {
        const cred = await credContract.read<any>("getCredential", id);
        const issuer = cred.issuer ?? cred[2];
        const issuanceDate = Number(cred.issuanceDate ?? cred[5]);
        setVerifyResult({
          valid: true,
          message: `Credential #${id} is valid. Issued by ${issuer} on ${new Date(issuanceDate * 1000).toLocaleDateString()}.`,
        });
      } else {
        setVerifyResult({ valid: false, message: `Credential #${id} has been revoked or expired.` });
      }
    } catch {
      setVerifyResult({ valid: false, message: `Credential #${verifyId} not found on-chain.` });
    } finally {
      setVerifying(false);
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
        <StatCard title="Total Credentials" value={credentials.length} icon={<BadgeCheck className="h-6 w-6" />} />
        <StatCard title="Active" value={activeCount} icon={<ShieldCheck className="h-6 w-6" />} />
        <StatCard title="Revoked/Expired" value={invalidCount} icon={<ShieldX className="h-6 w-6" />} />
        <StatCard title="Issuers" value={uniqueIssuers} icon={<User className="h-6 w-6" />} />
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by provider, issuer, or type…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-border dark:bg-surface dark:text-white"
        />
      </div>

      {/* Credentials grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-gray-500">Loading credentials from chain...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center dark:border-border dark:bg-surface">
          <BadgeCheck className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
          <p className="mt-4 text-gray-500 dark:text-gray-400">No credentials found</p>
        </div>
      ) : (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((cred) => (
          <div
            key={cred.credentialId}
            className={`rounded-xl border bg-white p-6 shadow-sm dark:bg-surface ${
              cred.isValid ? "border-gray-200 dark:border-border" : "border-red-200 dark:border-red-800"
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
      )}

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
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-border dark:bg-surface dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Credential Type</label>
            <select
              value={formData.credentialType}
              onChange={(e) => setFormData({ ...formData, credentialType: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-primary focus:outline-none dark:border-border dark:bg-surface dark:text-white"
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
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-border dark:bg-surface dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Expiry Date (optional)</label>
            <input
              type="date"
              value={formData.expiryDate}
              onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-primary focus:outline-none dark:border-border dark:bg-surface dark:text-white"
            />
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" type="button" onClick={() => setShowIssue(false)}>Cancel</Button>
            <Button className="flex-1" type="submit" disabled={issuing}>
              {issuing ? <><Loader2 className="h-4 w-4 animate-spin" /> Issuing...</> : "Issue On-Chain"}
            </Button>
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
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-border dark:bg-surface dark:text-white"
            />
          </div>
          <Button className="w-full" onClick={handleVerify} disabled={verifying}>
            {verifying ? <><Loader2 className="h-4 w-4 animate-spin" /> Verifying...</> : "Verify"}
          </Button>

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
