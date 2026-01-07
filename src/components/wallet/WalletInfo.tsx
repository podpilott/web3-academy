"use client";

import { useState, useEffect, useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useAuth } from "@/hooks/useAuth";
import { config } from "@/lib/config";

interface WalletBalance {
  wallet_address: string;
  lamports: number;
  sol: number;
}

export function WalletInfo() {
  const { authenticated, user, getAccessToken } = usePrivy();
  const { user: backendUser, isLoading: isSyncing } = useAuth();
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Get wallet address from Privy user
  const walletAddress = user?.wallet?.address;

  // Check if it's an embedded wallet (Privy creates these for email/social login)
  const isEmbeddedWallet = user?.wallet?.walletClientType === "privy";

  // Fetch balance from backend
  const fetchBalance = useCallback(async () => {
    // Wait for backend sync to complete before fetching balance
    if (!authenticated || !walletAddress || !backendUser || isSyncing) return;

    setIsLoading(true);
    setError(null);

    try {
      // Get fresh token from Privy
      const token = await getAccessToken();
      if (!token) {
        setError("No auth token available");
        return;
      }

      const response = await fetch(
        `${config.api.baseUrl}/api/v1/wallet/balance`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to fetch balance");
      }

      const data = await response.json();
      setBalance(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch balance");
    } finally {
      setIsLoading(false);
    }
  }, [authenticated, walletAddress, backendUser, isSyncing, getAccessToken]);

  // Fetch balance when user is synced
  useEffect(() => {
    if (backendUser && !isSyncing) {
      fetchBalance();
    }
  }, [backendUser, isSyncing, fetchBalance]);

  const copyAddress = async () => {
    if (!walletAddress) return;
    await navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  if (!authenticated || !walletAddress) {
    return null;
  }

  return (
    <div className="w-full p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
      {/* Wallet Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-zinc-500">Solana Wallet</h3>
        <span
          className={`text-xs px-2 py-1 rounded-full ${
            isEmbeddedWallet
              ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
              : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
          }`}
        >
          {isEmbeddedWallet ? "Embedded" : "External"}
        </span>
      </div>

      {/* Wallet Address */}
      <div className="flex items-center gap-2 mb-4">
        <code className="text-sm font-mono text-black dark:text-white">
          {truncateAddress(walletAddress)}
        </code>
        <button
          onClick={copyAddress}
          className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      {/* Balance */}
      <div className="border-t border-zinc-200 dark:border-zinc-700 pt-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-zinc-400">Balance</p>
          <button
            onClick={fetchBalance}
            disabled={isLoading || isSyncing}
            className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors disabled:opacity-50"
          >
            {isLoading ? "..." : "Refresh"}
          </button>
        </div>
        {isSyncing ? (
          <p className="text-sm text-zinc-500">Syncing wallet...</p>
        ) : isLoading ? (
          <p className="text-sm text-zinc-500">Loading...</p>
        ) : error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : balance ? (
          <p className="text-lg font-semibold text-black dark:text-white">
            {balance.sol.toFixed(4)} SOL
          </p>
        ) : (
          <p className="text-sm text-zinc-500">--</p>
        )}
      </div>
    </div>
  );
}
