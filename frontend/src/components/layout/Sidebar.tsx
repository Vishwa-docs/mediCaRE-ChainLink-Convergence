"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Shield,
  Truck,
  BadgeCheck,
  Vote,
  Settings,
  Heart,
  X,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/records", label: "Health Records", icon: FileText },
  { href: "/insurance", label: "Insurance", icon: Shield },
  { href: "/supply-chain", label: "Supply Chain", icon: Truck },
  { href: "/credentials", label: "Credentials", icon: BadgeCheck },
  { href: "/governance", label: "Governance", icon: Vote },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onClose} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-50 flex h-full w-64 flex-col border-r border-gray-200 bg-white transition-transform dark:border-gray-700 dark:bg-gray-900
          lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-gray-200 px-6 dark:border-gray-700">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <Heart className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900 dark:text-white">
              medi<span className="text-blue-600">CaRE</span>
            </span>
          </Link>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:text-gray-600 lg:hidden dark:hover:text-gray-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors
                  ${
                    active
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                      : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                  }`}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="border-t border-gray-200 p-4 dark:border-gray-700">
          <div className="rounded-lg bg-gradient-to-r from-blue-600 to-emerald-500 p-4">
            <p className="text-xs font-medium text-white/80">Powered by</p>
            <p className="text-sm font-bold text-white">Chainlink &amp; CRE</p>
            <p className="mt-1 text-xs text-white/70">Cross-chain healthcare</p>
          </div>
        </div>
      </aside>
    </>
  );
}
