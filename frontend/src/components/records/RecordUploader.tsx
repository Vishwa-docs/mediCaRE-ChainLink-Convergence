"use client";

import { useState, useRef } from "react";
import { Upload, File, X, CheckCircle } from "lucide-react";
import Button from "@/components/shared/Button";
import type { RecordType } from "@/types";
import toast from "react-hot-toast";

const RECORD_TYPES: { value: RecordType; label: string }[] = [
  { value: "LAB", label: "Lab Results" },
  { value: "IMAGING", label: "Imaging" },
  { value: "PRESCRIPTION", label: "Prescription" },
  { value: "CLINICAL_NOTE", label: "Clinical Note" },
  { value: "DISCHARGE", label: "Discharge Summary" },
  { value: "OTHER", label: "Other" },
];

interface RecordUploaderProps {
  onUpload?: (file: File, recordType: RecordType, patientAddress: string) => Promise<void>;
}

export default function RecordUploader({ onUpload }: RecordUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [recordType, setRecordType] = useState<RecordType>("LAB");
  const [patientAddress, setPatientAddress] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  };

  const handleSubmit = async () => {
    if (!file) return toast.error("Please select a file");
    if (!patientAddress) return toast.error("Please enter patient address");

    setUploading(true);
    try {
      if (onUpload) {
        await onUpload(file, recordType, patientAddress);
      } else {
        // Simulated upload
        await new Promise((r) => setTimeout(r, 2000));
      }
      setUploaded(true);
      toast.success("Record uploaded to IPFS and registered on-chain");
      setTimeout(() => {
        setFile(null);
        setUploaded(false);
        setPatientAddress("");
      }, 3000);
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Upload Health Record</h3>

      {/* Patient address */}
      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Patient Wallet Address
        </label>
        <input
          type="text"
          placeholder="0x…"
          value={patientAddress}
          onChange={(e) => setPatientAddress(e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500"
        />
      </div>

      {/* Record type */}
      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Record Type
        </label>
        <select
          value={recordType}
          onChange={(e) => setRecordType(e.target.value as RecordType)}
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        >
          {RECORD_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Drag & drop zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors
          ${
            file
              ? "border-emerald-400 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-900/20"
              : "border-gray-300 hover:border-blue-400 hover:bg-blue-50 dark:border-gray-600 dark:hover:border-blue-500 dark:hover:bg-blue-900/10"
          }`}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".pdf,.json,.txt,.csv,.xml,.hl7"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        {uploaded ? (
          <div className="flex flex-col items-center gap-2">
            <CheckCircle className="h-10 w-10 text-emerald-500" />
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
              Successfully uploaded!
            </p>
          </div>
        ) : file ? (
          <div className="flex flex-col items-center gap-2">
            <File className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
            <p className="text-sm font-medium text-gray-900 dark:text-white">{file.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {(file.size / 1024).toFixed(1)} KB
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setFile(null);
              }}
              className="mt-1 flex items-center gap-1 text-xs text-red-500 hover:text-red-600"
            >
              <X className="h-3 w-3" /> Remove
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-10 w-10 text-gray-400 dark:text-gray-500" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Drop file here or click to browse
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              PDF, JSON, TXT, CSV, XML, HL7
            </p>
          </div>
        )}
      </div>

      <Button className="mt-4 w-full" loading={uploading} onClick={handleSubmit} disabled={!file}>
        Upload to IPFS &amp; Register On-Chain
      </Button>
    </div>
  );
}
