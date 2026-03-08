"use client";

import Link from "next/link";
import {
  Heart,
  Shield,
  FileText,
  Truck,
  BadgeCheck,
  Vote,
  Brain,
  Globe,
  Lock,
  Zap,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { ConnectButton } from "thirdweb/react";
import { thirdwebClient } from "@/lib/thirdweb";

const FEATURES = [
  {
    icon: FileText,
    title: "EHR Management",
    description: "Store encrypted health records on IPFS with on-chain access control. Patients own their data.",
    color: "bg-primary/15 text-primary dark:bg-primary/25 dark:text-primary-light",
  },
  {
    icon: Brain,
    title: "AI Summarization",
    description: "Chainlink Functions trigger GPT-4 to generate clinical summaries, stored and verified on-chain.",
    color: "bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400",
  },
  {
    icon: Shield,
    title: "Insurance Policies",
    description: "ERC-721 insurance NFTs with automated claims processing and AI-driven risk scoring.",
    color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400",
  },
  {
    icon: Truck,
    title: "Supply Chain",
    description: "ERC-1155 pharmaceutical tracking with IoT monitoring and provenance verification.",
    color: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400",
  },
  {
    icon: BadgeCheck,
    title: "Credential Registry",
    description: "Verifiable credentials for healthcare providers — licenses, certifications, and more.",
    color: "bg-cyan-100 text-cyan-600 dark:bg-cyan-900/40 dark:text-cyan-400",
  },
  {
    icon: Vote,
    title: "DAO Governance",
    description: "Token-weighted voting on protocol parameters, risk thresholds, and upgrades.",
    color: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400",
  },
];

const TECH_STACK = [
  "Chainlink CRE",
  "Chainlink CCIP",
  "Chainlink Functions",
  "Chainlink Data Feeds",
  "Chainlink VRF",
  "Chainlink Automation",
  "World ID",
  "Solidity",
  "Hardhat",
  "Next.js",
  "IPFS",
  "ERC-721",
  "ERC-1155",
  "OpenZeppelin",
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Navigation */}
      <nav className="fixed top-0 z-50 w-full border-b border-gray-200/50 bg-white/80 backdrop-blur-md dark:border-gray-800/50 dark:bg-gray-950/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Heart className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900 dark:text-white">
              medi<span className="text-primary">CaRE</span>
            </span>
          </Link>
          <div className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
              Features
            </a>
            <a href="#tech" className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
              Tech Stack
            </a>
            <a href="#about" className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
              About
            </a>
          </div>
          <div className="flex items-center gap-3">
            <ConnectButton client={thirdwebClient} />
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden pt-16">
        <div className="absolute inset-0 -z-10">
          <div className="absolute left-1/4 top-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute right-1/4 top-64 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
        </div>

        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8 lg:py-40">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm text-primary dark:border-primary/30 dark:bg-primary/20 dark:text-primary-light">
              <Globe className="h-4 w-4" />
              Cross-Chain Healthcare Infrastructure
            </div>

            <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-6xl lg:text-7xl">
              Decentralized
              <span className="bg-gradient-to-r from-primary to-accent/100 bg-clip-text text-transparent">
                {" "}Healthcare{" "}
              </span>
              for Everyone
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600 dark:text-gray-400">
              mediCaRE combines Chainlink&apos;s cross-chain infrastructure with AI-powered clinical
              intelligence to create a trustless, interoperable healthcare platform — from EHR
              management and insurance to pharmaceutical supply chains.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/login"
                className="flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-primary/25 hover:bg-primary"
              >
                Launch App <ChevronRight className="h-4 w-4" />
              </Link>
              <a
                href="https://github.com/Vishwa-docs/mediCaRE-ChainLink-Convergence"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl border border-gray-300 px-8 py-3.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-border dark:text-gray-300 dark:hover:bg-gray-800"
              >
                View on GitHub <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Stats bar */}
          <div className="mx-auto mt-20 grid max-w-4xl grid-cols-2 gap-8 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-border dark:bg-gray-900 md:grid-cols-3">
            {[
              { label: "Smart Contracts", value: "6" },
              { label: "CRE Workflows", value: "17" },
              { label: "Open Source", value: "100%" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-gray-200 bg-gray-50 py-24 dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl">
              Complete Healthcare Infrastructure
            </h2>
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              Six integrated modules working together for a comprehensive decentralized healthcare platform.
            </p>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-border dark:bg-surface"
              >
                <div className={`mb-4 inline-flex rounded-lg p-3 ${feature.color}`}>
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security pillars */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-16 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl">
                Security-First Design
              </h2>
              <p className="mt-4 text-gray-600 dark:text-gray-400">
                Built with enterprise-grade security patterns including role-based access control,
                World ID verification, and Chainlink&apos;s decentralized oracle network.
              </p>
              <div className="mt-8 space-y-4">
                {[
                  { icon: Lock, text: "Patient-controlled data sovereignty with granular access permissions" },
                  { icon: Zap, text: "Chainlink CCIP for secure cross-chain messaging and token transfers" },
                  { icon: Shield, text: "OpenZeppelin contract patterns with ReentrancyGuard and role-based access" },
                  { icon: Globe, text: "World ID integration for Sybil-resistant identity verification" },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-light">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-primary/10 to-accent/10 p-8 dark:border-border dark:from-primary/20 dark:to-accent/20">
              <div className="space-y-4 font-mono text-sm">
                <div className="text-gray-500 dark:text-gray-400">{"// Patient grants provider access"}</div>
                <div className="text-primary dark:text-primary-light">{"function grantAccess("}</div>
                <div className="pl-4 text-gray-700 dark:text-gray-300">{"address provider"}</div>
                <div className="text-primary dark:text-primary-light">{") external {"}</div>
                <div className="pl-4 text-gray-600 dark:text-gray-400">{"require(msg.sender == patient);"}</div>
                <div className="pl-4 text-emerald-600 dark:text-emerald-400">{"_accessPermissions[msg.sender]"}</div>
                <div className="pl-8 text-emerald-600 dark:text-emerald-400">{"[provider] = true;"}</div>
                <div className="pl-4 text-gray-600 dark:text-gray-400">{"emit AccessGranted("}</div>
                <div className="pl-8 text-gray-600 dark:text-gray-400">{"msg.sender, provider);"}</div>
                <div className="text-primary dark:text-primary-light">{"}"}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tech stack */}
      <section id="tech" className="border-t border-gray-200 bg-gray-50 py-24 dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl">
              Powered by Chainlink
            </h2>
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              Built on Chainlink&apos;s comprehensive oracle infrastructure and modern web3 tooling.
            </p>
          </div>
          <div className="mx-auto mt-12 flex max-w-3xl flex-wrap justify-center gap-3">
            {TECH_STACK.map((tech) => (
              <span
                key={tech}
                className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 dark:border-border dark:bg-surface dark:text-gray-300"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="about" className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl bg-gradient-to-r from-primary to-accent/100 px-8 py-16 text-center shadow-xl sm:px-16">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">
              Ready to Transform Healthcare?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-white/80">
              Connect your wallet and explore the future of decentralized healthcare infrastructure.
            </p>
            <div className="mt-8 flex justify-center">
              <Link
                href="/login"
                className="rounded-xl bg-white px-8 py-3.5 text-sm font-semibold text-primary shadow-lg hover:bg-gray-100"
              >
                Enter Dashboard
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-12 dark:border-gray-800 dark:bg-gray-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-red-500" />
              <span className="font-bold text-gray-900 dark:text-white">
                medi<span className="text-primary">CaRE</span>
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {new Date().getFullYear()} mediCaRE DAO
              </span>
            </div>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Built with Chainlink &middot; Convergence Hackathon 2026
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
