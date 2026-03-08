"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Play,
  X,
  ChevronRight,
  ChevronLeft,
  SkipForward,
  MapPin,
  Sparkles,
  Shield,
  FileText,
  Stethoscope,
  Truck,
  BadgeCheck,
  Vote,
  ScrollText,
  HeartPulse,
  Brain,
  FlaskConical,
  Wallet,
  AlertTriangle,
  BarChart3,
} from "lucide-react";

/* ─── Tour Step Definitions ─────────────────────────────────── */

interface TourStep {
  title: string;
  description: string;
  page: string;
  icon: React.ElementType;
  highlight?: string; // optional CSS selector to spotlight
  chainlinkFeature?: string; // which Chainlink tech powers this
}

const TOUR_STEPS: TourStep[] = [
  {
    title: "Welcome to mediCaRE",
    description:
      "This guided tour walks you through the entire platform. Each page showcases a different module — all powered by Chainlink CRE workflows, CCIP, and on-chain smart contracts on Tenderly Virtual TestNet. You can cancel anytime and explore freely.",
    page: "/dashboard",
    icon: Sparkles,
  },
  {
    title: "Dashboard — Real-Time Overview",
    description:
      "The dashboard pulls live KPI data directly from 5 deployed smart contracts: total EHR records, active insurance policies, supply chain batches, verified credentials, and governance proposals. Nothing is mocked — every number comes from the blockchain.",
    page: "/dashboard",
    icon: BarChart3,
    chainlinkFeature: "CRE Workflows orchestrate all data flows",
  },
  {
    title: "Health Records (EHR)",
    description:
      "Patient health records are encrypted with AES-256-GCM, stored on IPFS via Pinata, and anchored on-chain as CID hashes in the EHRStorage smart contract. Patients control consent — only authorized providers can decrypt and view records.",
    page: "/records",
    icon: FileText,
    chainlinkFeature: "CRE record-upload workflow + Confidential HTTP for FHIR data",
  },
  {
    title: "Visit Summary — AI-Powered",
    description:
      "AI generates pre-visit preparation summaries and post-visit documentation using Azure OpenAI GPT-4o via Chainlink CRE. The AI call runs through Confidential Compute (TEE) so API keys and patient data never leave the trusted execution environment.",
    page: "/visit-summary",
    icon: Stethoscope,
    chainlinkFeature: "CRE medical-historian workflow + Confidential Compute",
  },
  {
    title: "Insurance — Multi-Agent AI Adjudication",
    description:
      "Insurance policies are ERC-721 NFTs. When a claim is submitted, a CRE workflow launches a 3-agent BFT swarm (TriageBot, CodingBot, FraudDetectorBot) that reaches consensus on approval/denial. The adjudication explanation is hashed and stored on-chain for full transparency.",
    page: "/insurance",
    icon: Shield,
    chainlinkFeature: "CRE claim-adjudicator (BFT swarm) + CCIP cross-chain payouts",
  },
  {
    title: "Supply Chain — Pharmaceutical Tracking",
    description:
      "Each pharmaceutical batch is tokenized as an ERC-1155 token. IoT checkpoints (temperature, humidity, location) are recorded on-chain. The fraud-monitor CRE workflow runs graph-based anomaly detection every 6 hours to flag suspicious activity.",
    page: "/supply-chain",
    icon: Truck,
    chainlinkFeature: "CRE supply-chain + fraud-monitor workflows",
  },
  {
    title: "Provider Credentials",
    description:
      "Healthcare providers register verifiable credentials on the CredentialRegistry smart contract. World ID zero-knowledge proofs verify each provider is a unique human — preventing Sybil attacks and fake credential registrations.",
    page: "/credentials",
    icon: BadgeCheck,
    chainlinkFeature: "CRE worldid workflow + World ID ZKP verification",
  },
  {
    title: "DAO Governance",
    description:
      "Token-weighted governance for healthcare decisions: research proposals, IRB compliance scoring, patient data consent management. Each vote is recorded on the Governance smart contract with full audit trail.",
    page: "/governance",
    icon: Vote,
    chainlinkFeature: "CRE irb-agent workflow for compliance scoring",
  },
  {
    title: "Emergency Glass-Break Access",
    description:
      "In life-threatening emergencies, paramedics can bypass normal consent controls to access critical patient data. This 'glass-break' access runs through a CRE workflow that verifies the paramedic's role, grants a 15-minute access window, and creates an immutable audit trail.",
    page: "/emergency",
    icon: AlertTriangle,
    chainlinkFeature: "CRE emergency-access workflow + TEE-protected data fetch",
  },
  {
    title: "Research Portal — ZK Trial Matching",
    description:
      "Researchers can find eligible clinical trial participants using privacy-preserving matching. The trial-matcher CRE workflow uses Confidential Compute so only a boolean eligibility result is revealed — never the patient's actual medical data.",
    page: "/research",
    icon: FlaskConical,
    chainlinkFeature: "CRE trial-matcher workflow + ZK boolean matching",
  },
  {
    title: "Treasury Dashboard",
    description:
      "Monitor insurance reserve health, payout velocity, and anomaly alerts. The fraud-monitor CRE workflow can auto-pause payouts if reserve levels drop dangerously or suspicious claim patterns are detected.",
    page: "/treasury",
    icon: Wallet,
    chainlinkFeature: "CRE fraud-monitor + premium-adjuster workflows",
  },
  {
    title: "AI Models",
    description:
      "View the AI models powering mediCaRE: GPT-4o for clinical summarization, logistic regression for risk scoring, Z-score anomaly detection for fraud monitoring. All models run through Chainlink CRE with Confidential Compute for privacy.",
    page: "/ai-models",
    icon: Brain,
    chainlinkFeature: "CRE Confidential Compute for all AI inference",
  },
  {
    title: "Contract Health & Audit Log",
    description:
      "Contract Health shows live deployment status, bytecode sizes, and entity counts for all 6 smart contracts. The Audit Log displays real-time on-chain events across all contracts — providing complete transparency.",
    page: "/contract-health",
    icon: HeartPulse,
    chainlinkFeature: "17 CRE workflows + 5 smart contracts + CCIP",
  },
  {
    title: "Audit Log — On-Chain Events",
    description:
      "Every significant action — record uploads, insurance claims, supply chain checkpoints, credential verifications, governance votes — is logged on-chain. This page aggregates events from all 5 deployed contracts in real time.",
    page: "/audit-log",
    icon: ScrollText,
    chainlinkFeature: "All events sourced directly from on-chain logs",
  },
  {
    title: "Tour Complete!",
    description:
      "You've seen all the major features of mediCaRE. Feel free to explore on your own — try submitting a claim, uploading a record, or running an emergency glass-break access. Every action is real, on-chain, and orchestrated by Chainlink CRE. Thank you for reviewing!",
    page: "/dashboard",
    icon: Sparkles,
  },
];

/* ─── DemoTour Component ──────────────────────────────────── */

export default function DemoTour() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasSeenTour, setHasSeenTour] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Show tour prompt on first visit to dashboard
  useEffect(() => {
    if (pathname === "/dashboard" && !hasSeenTour) {
      const seen = localStorage.getItem("mediCaRE_tour_seen");
      if (!seen) {
        // Small delay so dashboard renders first
        const timer = setTimeout(() => setIsOpen(true), 1500);
        return () => clearTimeout(timer);
      }
      setHasSeenTour(true);
    }
  }, [pathname, hasSeenTour]);

  const step = TOUR_STEPS[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === TOUR_STEPS.length - 1;

  const goToStep = useCallback(
    (idx: number) => {
      setCurrentStep(idx);
      const target = TOUR_STEPS[idx];
      if (target.page !== pathname) {
        router.push(target.page);
      }
    },
    [pathname, router],
  );

  const next = () => {
    if (isLast) {
      closeTour();
    } else {
      goToStep(currentStep + 1);
    }
  };

  const prev = () => {
    if (!isFirst) {
      goToStep(currentStep - 1);
    }
  };

  const closeTour = () => {
    setIsOpen(false);
    setCurrentStep(0);
    setHasSeenTour(true);
    localStorage.setItem("mediCaRE_tour_seen", "true");
  };

  const startTour = () => {
    setCurrentStep(0);
    setIsOpen(true);
    const target = TOUR_STEPS[0];
    if (target.page !== pathname) {
      router.push(target.page);
    }
  };

  if (!isOpen) {
    // Floating "Start Tour" button
    return (
      <button
        onClick={startTour}
        className="fixed bottom-6 right-6 z-[9999] flex items-center gap-2 rounded-full bg-gradient-to-r from-[#375BD2] to-[#06b6d4] px-5 py-3 text-sm font-semibold text-white shadow-xl transition-all hover:scale-105 hover:shadow-2xl"
        title="Start Guided Demo Tour"
      >
        <Play className="h-4 w-4" />
        Guided Tour
      </button>
    );
  }

  const Icon = step.icon;
  const progress = ((currentStep + 1) / TOUR_STEPS.length) * 100;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[9998] bg-black/30 backdrop-blur-[2px]" onClick={closeTour} />

      {/* Tour Card */}
      <div className="fixed bottom-6 right-6 z-[9999] w-[420px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
        {/* Progress bar */}
        <div className="h-1 bg-gray-100 dark:bg-gray-800">
          <div
            className="h-full bg-gradient-to-r from-[#375BD2] to-[#06b6d4] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Header */}
        <div className="flex items-start gap-3 px-5 pt-4">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#375BD2]/10 to-[#06b6d4]/10">
            <Icon className="h-5 w-5 text-[#375BD2]" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">{step.title}</h3>
              <button
                onClick={closeTour}
                className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <span className="text-xs text-gray-400">
              Step {currentStep + 1} of {TOUR_STEPS.length}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-3">
          <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">{step.description}</p>

          {step.chainlinkFeature && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-2 dark:border-blue-900/50 dark:bg-blue-950/30">
              <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[#375BD2]" />
              <span className="text-xs text-[#375BD2] dark:text-blue-400">
                <strong>Chainlink:</strong> {step.chainlinkFeature}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3 dark:border-gray-800">
          <div className="flex gap-1">
            {!isFirst && (
              <button
                onClick={prev}
                className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Back
              </button>
            )}
            <button
              onClick={closeTour}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-400 transition hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <SkipForward className="h-3.5 w-3.5" />
              Skip Tour
            </button>
          </div>
          <button
            onClick={next}
            className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-[#375BD2] to-[#06b6d4] px-4 py-1.5 text-xs font-semibold text-white shadow transition hover:shadow-md"
          >
            {isLast ? "Finish" : "Next"}
            {!isLast && <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </>
  );
}
