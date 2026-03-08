"use client";

import { Wallet } from "lucide-react";
import { ConnectButton } from "thirdweb/react";
import { createThirdwebClient } from "thirdweb";

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID ?? "",
});

interface ConnectPromptProps {
  title?: string;
  description?: string;
  className?: string;
}

/**
 * A full-width card prompting the user to connect their wallet.
 * Shown on pages that require an authenticated wallet session.
 */
export default function ConnectPrompt({
  title = "Connect Your Wallet",
  description = "Link your wallet to access the mediCaRE platform — manage records, file claims, track supply-chain batches, and participate in governance.",
  className = "",
}: ConnectPromptProps) {
  return (
    <div
      className={`mx-auto flex max-w-lg flex-col items-center rounded-2xl border border-gray-200 bg-white px-8 py-12 text-center shadow-sm dark:border-border dark:bg-surface ${className}`}
    >
      {/* Icon */}
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-light">
        <Wallet className="h-8 w-8" />
      </div>

      {/* Heading */}
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>

      {/* Description */}
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-gray-500 dark:text-gray-400">
        {description}
      </p>

      {/* Connect button */}
      <div className="mt-8">
        <ConnectButton client={client} />
      </div>

      {/* Footer hint */}
      <p className="mt-6 text-xs text-gray-400 dark:text-gray-500">
        Supports MetaMask, Coinbase Wallet, WalletConnect &amp; more.
      </p>
    </div>
  );
}
