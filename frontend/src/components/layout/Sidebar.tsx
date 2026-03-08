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
  Stethoscope,
  ScrollText,
  HeartPulse,
  Brain,
  BarChart3,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/records", label: "Health Records", icon: FileText },
  { href: "/visit-summary", label: "Visit Summary", icon: Stethoscope },
  { href: "/insurance", label: "Insurance", icon: Shield },
  { href: "/supply-chain", label: "Supply Chain", icon: Truck },
  { href: "/credentials", label: "Credentials", icon: BadgeCheck },
  { href: "/governance", label: "Governance", icon: Vote },
  { href: "/ai-models", label: "AI Models", icon: Brain },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/audit-log", label: "Audit Log", icon: ScrollText },
  { href: "/contract-health", label: "Contract Health", icon: HeartPulse },
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
        className={`fixed left-0 top-0 z-50 flex h-full w-64 flex-col border-r border-gray-200 bg-white transition-transform dark:border-border dark:bg-gray-900
          lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-gray-200 px-6 dark:border-border">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#375BD2] to-[#06b6d4]">
              <Heart className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900 dark:text-white">
              medi<span className="text-transparent bg-clip-text bg-gradient-to-r from-[#375BD2] to-[#06b6d4]">CaRE</span>
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
                      ? "bg-[#375BD2]/10 text-[#375BD2] dark:bg-[#375BD2]/20 dark:text-[#5b7ee5] border-l-2 border-[#375BD2]"
                      : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"
                  }`}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>


      </aside>
    </>
  );
}
