"use client";

import { Heart } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white px-6 py-4 dark:border-border dark:bg-gray-900">
      <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Heart className="h-4 w-4 text-red-500" />
          <span>mediCaRE DAO {new Date().getFullYear()}</span>
        </div>
        <div className="flex gap-4 text-xs text-gray-400 dark:text-gray-500">
          <span>Built with Chainlink CRE</span>
        </div>
      </div>
    </footer>
  );
}
