"use client";

import { Menu, Bell, Sun, Moon, LogOut, User, Shield } from "lucide-react";
import { ConnectButton } from "thirdweb/react";
import { thirdwebClient } from "@/lib/thirdweb";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

interface HeaderProps {
  onMenuClick: () => void;
}

const ROLE_BADGES: Record<string, { label: string; color: string }> = {
  admin:      { label: "Admin",      color: "bg-gray-700 text-white" },
  patient:    { label: "Patient",    color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" },
  doctor:     { label: "Doctor",     color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  insurer:    { label: "Insurer",    color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" },
  paramedic:  { label: "Paramedic",  color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  researcher: { label: "Researcher", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
};

export default function Header({ onMenuClick }: HeaderProps) {
  const [dark, setDark] = useState(false);
  const { user, role, isWorldIDVerified, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setDark(isDark);
  }, []);

  const toggleDark = () => {
    document.documentElement.classList.toggle("dark");
    setDark((d) => !d);
  };

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const badge = ROLE_BADGES[role] ?? ROLE_BADGES.patient;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white/80 px-4 backdrop-blur-md dark:border-border dark:bg-gray-900/80 lg:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 lg:hidden dark:text-gray-400 dark:hover:bg-gray-800"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* User info */}
        {user && (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <User className="h-4 w-4" />
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-gray-900 dark:text-white leading-tight">
                {user.display_name}
              </p>
              <div className="flex items-center gap-1.5">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.color}`}>
                  {badge.label}
                </span>
                {isWorldIDVerified && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                    <Shield className="h-3 w-3" /> Verified
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Dark mode toggle */}
        <button
          onClick={toggleDark}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          aria-label="Toggle dark mode"
        >
          {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        {/* Notifications */}
        <button className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
        </button>

        {/* Wallet connect */}
        <ConnectButton client={thirdwebClient} />

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-900/20 dark:hover:text-red-400"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
