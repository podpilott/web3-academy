"use client";

import { useState, useEffect, useMemo } from "react";
import { PrivyProvider as Privy } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";
import { config } from "@/lib/config";

// Solana wallet connectors for browser extension detection
const solanaConnectors = toSolanaWalletConnectors({
  shouldAutoConnect: true,
});

// Get the Solana chain identifier for Privy
function getSolanaChainId(): "solana:mainnet" | "solana:devnet" | "solana:testnet" {
  if (config.solana.network === "mainnet-beta") {
    return "solana:mainnet";
  }
  return "solana:devnet";
}

// Get websocket URL from RPC URL
function getWsUrl(rpcUrl: string): string {
  return rpcUrl.replace("https://", "wss://").replace("http://", "ws://");
}

interface PrivyProviderProps {
  children: React.ReactNode;
}

export function PrivyProvider({ children }: PrivyProviderProps) {
  const [mounted, setMounted] = useState(false);

  // Only render Privy after client-side mount to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Create Solana RPC configuration for Privy embedded wallet transactions
  // Provide configs for both mainnet and devnet since Privy may default to mainnet
  const solanaRpcs = useMemo(() => {
    const rpcUrl = config.solana.rpcUrl;

    // Use the configured RPC for the active network, and derive the other network's RPC
    // For Helius, swap "devnet" <-> "mainnet" in the URL
    const isHelius = rpcUrl.includes("helius-rpc.com");

    let devnetRpc: string;
    let mainnetRpc: string;

    if (isHelius) {
      // Helius URLs: devnet.helius-rpc.com or mainnet.helius-rpc.com
      devnetRpc = rpcUrl.replace("mainnet.helius-rpc.com", "devnet.helius-rpc.com");
      mainnetRpc = rpcUrl.replace("devnet.helius-rpc.com", "mainnet.helius-rpc.com");
    } else {
      // Fallback to public RPCs (may have rate limits)
      devnetRpc = config.solana.network === "devnet" ? rpcUrl : "https://api.devnet.solana.com";
      mainnetRpc = config.solana.network === "mainnet-beta" ? rpcUrl : "https://api.mainnet-beta.solana.com";
    }

    return {
      "solana:devnet": {
        rpc: createSolanaRpc(devnetRpc),
        rpcSubscriptions: createSolanaRpcSubscriptions(getWsUrl(devnetRpc)),
      },
      "solana:mainnet": {
        rpc: createSolanaRpc(mainnetRpc),
        rpcSubscriptions: createSolanaRpcSubscriptions(getWsUrl(mainnetRpc)),
      },
    };
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
          // Solana-only wallet list - excludes wallet_connect to avoid broken QR flow
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
        // External wallet connectors for browser extensions (Phantom, Solflare, Backpack)
        externalWallets: {
          solana: {
            connectors: solanaConnectors,
          },
        },
        // Solana RPC configuration for embedded wallet transactions
        solana: {
          rpcs: solanaRpcs,
        },
      }}
    >
      {children}
    </Privy>
  );
}


