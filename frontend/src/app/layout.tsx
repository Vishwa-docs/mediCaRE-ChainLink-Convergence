"use client";

import { Geist, Geist_Mono } from "next/font/google";
import { ThirdwebProvider } from "thirdweb/react";
import { Toaster } from "react-hot-toast";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import DemoTour from "@/components/shared/DemoTour";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const APP_ROUTES = ["/dashboard", "/records", "/visit-summary", "/insurance", "/supply-chain", "/credentials", "/governance", "/audit-log", "/contract-health", "/analytics", "/ai-models", "/settings", "/mini-app", "/emergency", "/research", "/treasury"];

const PUBLIC_ROUTES = ["/", "/login"];

function AuthGate({ children, isAppRoute }: { children: React.ReactNode; isAppRoute: boolean }) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isPublic = PUBLIC_ROUTES.includes(pathname);

  useEffect(() => {
    if (!loading && !isAuthenticated && isAppRoute && !isPublic) {
      router.replace("/login");
    }
  }, [loading, isAuthenticated, isAppRoute, isPublic, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <span className="text-sm text-gray-500 dark:text-gray-400">Loading...</span>
        </div>
      </div>
    );
  }

  if (isAppRoute && !isAuthenticated && !isPublic) {
    return null; // will redirect
  }

  return <>{children}</>;
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isAppRoute = APP_ROUTES.some((r) => pathname.startsWith(r));
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <title>mediCaRE — Decentralized Healthcare</title>
        <meta name="description" content="Cross-chain healthcare DApp powered by Chainlink" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <ThirdwebProvider>
            <Toaster
              position="top-right"
              toastOptions={{
                className: "!bg-white !text-gray-900 dark:!bg-gray-800 dark:!text-white !shadow-lg",
                duration: 4000,
              }}
            />
            <AuthGate isAppRoute={isAppRoute}>
              {isAppRoute ? (
                <div className="flex h-screen overflow-hidden">
                  <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
                  <div className="flex flex-1 flex-col overflow-hidden lg:ml-64">
                    <Header onMenuClick={() => setSidebarOpen(true)} />
                    <main className="flex-1 overflow-y-auto bg-gray-50 p-4 dark:bg-gray-950 lg:p-6">
                      {children}
                    </main>
                    <Footer />
                  </div>
                  <DemoTour />
                </div>
              ) : (
                children
              )}
            </AuthGate>
          </ThirdwebProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
