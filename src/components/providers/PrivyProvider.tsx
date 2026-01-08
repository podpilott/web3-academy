"use client";

import { useState, useEffect } from "react";
import { PrivyProvider as Privy } from "@privy-io/react-auth";
import { config } from "@/lib/config";

interface PrivyProviderProps {
  children: React.ReactNode;
}

export function PrivyProvider({ children }: PrivyProviderProps) {
  const [mounted, setMounted] = useState(false);

  // Only render Privy after client-side mount to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // During SSR, render children without Privy wrapper
  if (!mounted) {
    return <>{children}</>;
  }

  // Check for missing Privy App ID and show helpful error
  if (!config.privy.appId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black p-8">
        <div className="max-w-md w-full p-6 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950">
          <h2 className="text-lg font-semibold text-red-700 dark:text-red-400 mb-2">
            Configuration Error
          </h2>
          <p className="text-sm text-red-600 dark:text-red-300 mb-4">
            Missing required environment variable:{" "}
            <code className="font-mono bg-red-100 dark:bg-red-900 px-1 rounded">
              NEXT_PUBLIC_PRIVY_APP_ID
            </code>
          </p>
          <div className="text-xs text-red-500 dark:text-red-400 space-y-2">
            <p>To fix this:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>
                Get your App ID from{" "}
                <a
                  href="https://dashboard.privy.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-red-700"
                >
                  dashboard.privy.io
                </a>
              </li>
              <li>
                Add it to your{" "}
                <code className="font-mono bg-red-100 dark:bg-red-900 px-1 rounded">
                  .env.local
                </code>{" "}
                file
              </li>
              <li>Restart the dev server</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Privy
      appId={config.privy.appId}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#676FFF",
          // Solana-only wallet list - no WalletConnect QR (doesn't work with Solana mobile wallets)
          walletList: ["phantom", "solflare", "backpack"],
        },
        // Login methods available to users
        loginMethods: ["email", "wallet", "google"],
        // Embedded wallet configuration for non-crypto users
        embeddedWallets: {
          solana: {
            createOnLogin: "users-without-wallets",
          },
          showWalletUIs: true,
        },
      }}
    >
      {children}
    </Privy>
  );
}
