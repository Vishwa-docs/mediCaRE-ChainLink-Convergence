"use client";

import { useState } from "react";
import Button from "@/components/shared/Button";
import Badge from "@/components/shared/Badge";
import Card from "@/components/shared/Card";
import toast from "react-hot-toast";

interface ParsedConsent {
  provider?: string;
  dataCategories: string[];
  purposes: string[];
  durationDays?: number;
  scope: string;
  restrictions: string[];
}

interface ConsentNlpInputProps {
  onParsed?: (consent: ParsedConsent) => void;
  onSubmit?: (consent: ParsedConsent) => Promise<void>;
  className?: string;
}

const EXAMPLES = [
  "Let Dr. Smith access my cardiology records for treatment for 30 days",
  "Share my lab results with City Hospital for a second opinion, but not my mental health records",
  "Allow Dr. Patel to view my full medical history for surgery planning for 2 weeks",
  "Give the research team access to my anonymized vitals data for clinical trial NCT-2024-001",
];

export default function ConsentNlpInput({
  onParsed,
  onSubmit,
  className = "",
}: ConsentNlpInputProps) {
  const [input, setInput] = useState("");
  const [parsed, setParsed] = useState<ParsedConsent | null>(null);
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleParse = async () => {
    if (!input.trim()) return toast.error("Please describe your consent in plain English");

    setParsing(true);
    try {
      // Simulate NLP parsing (in production, calls backend /api/ai/consent-parse)
      await new Promise((r) => setTimeout(r, 1200));

      const mockParsed: ParsedConsent = {
        provider: extractProvider(input),
        dataCategories: extractCategories(input),
        purposes: extractPurposes(input),
        durationDays: extractDuration(input),
        scope: input.toLowerCase().includes("full") ? "full" : "partial",
        restrictions: extractRestrictions(input),
      };

      setParsed(mockParsed);
      onParsed?.(mockParsed);
      toast.success("Consent parsed successfully");
    } catch (err) {
      toast.error("Failed to parse consent");
    } finally {
      setParsing(false);
    }
  };

  const handleSubmit = async () => {
    if (!parsed) return;
    setSubmitting(true);
    try {
      await onSubmit?.(parsed);
      toast.success("Consent recorded on-chain");
      setInput("");
      setParsed(null);
    } catch {
      toast.error("Failed to submit consent");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className={className}>
      <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
        Smart Consent — Plain English
      </h3>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Describe your consent in plain English... e.g. 'Let Dr. Smith access my cardiology records for treatment for 30 days'"
        rows={3}
        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
      />

      {/* Example chips */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {EXAMPLES.map((ex, i) => (
          <button
            key={i}
            onClick={() => setInput(ex)}
            className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            {ex.slice(0, 40)}...
          </button>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <Button onClick={handleParse} disabled={parsing || !input.trim()}>
          {parsing ? "Parsing..." : "Parse Consent"}
        </Button>
      </div>

      {/* Parsed preview */}
      {parsed && (
        <div className="mt-4 space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4 dark:border-primary/30 dark:bg-primary/10">
          <h4 className="text-sm font-semibold text-gray-800 dark:text-white">
            Parsed Consent Preview
          </h4>

          <div className="grid grid-cols-2 gap-3 text-sm">
            {parsed.provider && (
              <div>
                <p className="text-xs text-gray-500">Provider</p>
                <p className="font-medium text-gray-800 dark:text-gray-200">{parsed.provider}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-500">Duration</p>
              <p className="font-medium text-gray-800 dark:text-gray-200">
                {parsed.durationDays ? `${parsed.durationDays} days` : "Until revoked"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Scope</p>
              <Badge variant={parsed.scope === "full" ? "warning" : "info"}>
                {parsed.scope}
              </Badge>
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-500">Data Categories</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {parsed.dataCategories.map((cat) => (
                <Badge key={cat} variant="info">{cat}</Badge>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-500">Purposes</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {parsed.purposes.map((p) => (
                <Badge key={p} variant="success">{p}</Badge>
              ))}
            </div>
          </div>

          {parsed.restrictions.length > 0 && (
            <div>
              <p className="text-xs text-gray-500">Restrictions</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {parsed.restrictions.map((r) => (
                  <Badge key={r} variant="danger">{r}</Badge>
                ))}
              </div>
            </div>
          )}

          <Button onClick={handleSubmit} disabled={submitting} className="w-full mt-2">
            {submitting ? "Recording on-chain..." : "Confirm & Record Consent"}
          </Button>
        </div>
      )}
    </Card>
  );
}

// ── Simple mock NLP extractors (frontend-only demo) ──────────

function extractProvider(text: string): string | undefined {
  const match = text.match(/(?:Dr\.?\s+|Doctor\s+)(\w+)/i);
  return match ? `Dr. ${match[1]}` : undefined;
}

function extractCategories(text: string): string[] {
  const cats: string[] = [];
  if (/cardio/i.test(text)) cats.push("Cardiology");
  if (/lab|blood|test/i.test(text)) cats.push("Lab Results");
  if (/vital/i.test(text)) cats.push("Vitals");
  if (/mental|psych/i.test(text)) cats.push("Mental Health");
  if (/medic(al|ation)|prescrip/i.test(text)) cats.push("Medications");
  if (/full|all|entire|complete/i.test(text)) cats.push("Full Records");
  if (/surg/i.test(text)) cats.push("Surgical");
  if (cats.length === 0) cats.push("General");
  return cats;
}

function extractPurposes(text: string): string[] {
  const purposes: string[] = [];
  if (/treatment|care|therap/i.test(text)) purposes.push("Treatment");
  if (/second opinion/i.test(text)) purposes.push("Second Opinion");
  if (/research|trial|study/i.test(text)) purposes.push("Research");
  if (/surgery|operat/i.test(text)) purposes.push("Surgery Planning");
  if (/insurance|claim/i.test(text)) purposes.push("Insurance");
  if (purposes.length === 0) purposes.push("General Care");
  return purposes;
}

function extractDuration(text: string): number | undefined {
  const match = text.match(/(\d+)\s*(?:day|week|month)/i);
  if (!match) return undefined;
  const n = parseInt(match[1]);
  if (/week/i.test(match[0])) return n * 7;
  if (/month/i.test(match[0])) return n * 30;
  return n;
}

function extractRestrictions(text: string): string[] {
  const restrictions: string[] = [];
  const butMatch = text.match(/(?:but not|except|excluding)\s+(.+?)(?:\.|$)/i);
  if (butMatch) restrictions.push(butMatch[1].trim());
  return restrictions;
}
