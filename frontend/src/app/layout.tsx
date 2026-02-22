"use client";

import { Geist, Geist_Mono } from "next/font/google";
import { ThirdwebProvider } from "thirdweb/react";
import { Toaster } from "react-hot-toast";
import { usePathname } from "next/navigation";
import { useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const APP_ROUTES = ["/dashboard", "/records", "/insurance", "/supply-chain", "/credentials", "/governance", "/settings"];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isAppRoute = APP_ROUTES.some((r) => pathname.startsWith(r));
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>mediCaRE — Decentralized Healthcare</title>
        <meta name="description" content="Cross-chain healthcare DApp powered by Chainlink" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThirdwebProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              className: "!bg-white !text-gray-900 dark:!bg-gray-800 dark:!text-white !shadow-lg",
              duration: 4000,
            }}
          />
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
            </div>
          ) : (
            children
          )}
        </ThirdwebProvider>
      </body>
    </html>
  );
}
