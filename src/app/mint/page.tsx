"use client";

import { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useAuth } from "@/hooks/useAuth";
import { useMintStudentPass } from "@/hooks/useMintStudentPass";
import { usePassStatus } from "@/contexts/PassContext";
import { config } from "@/lib/config";
import Link from "next/link";

/**
 * Get Solana Explorer URL for a transaction or address
 */
function getSolanaExplorerUrl(
    value: string,
    type: "tx" | "address" = "tx"
): string {
    const network = config.solana.network;
    const cluster = network === "mainnet-beta" ? "" : `?cluster=${network}`;
    return `https://explorer.solana.com/${type}/${value}${cluster}`;
}

export default function MintPage() {
    const { login, authenticated, user, ready } = usePrivy();
    const { user: backendUser, isLoading: isSyncing } = useAuth();
    const { mint, isMinting, error: mintError, lastMint } = useMintStudentPass();
    const { hasPass, isChecking: checkingPass, setHasPass, invalidateAndRefetch } = usePassStatus();

    // Handle successful mint
    useEffect(() => {
        if (lastMint?.success) {
            setHasPass(true); // Optimistic update
            invalidateAndRefetch(); // Confirm with backend
        }
    }, [lastMint, setHasPass, invalidateAndRefetch]);

    const handleMint = async () => {
        await mint();
    };

    const walletAddress = user?.wallet?.address;

    // Loading state
    if (!ready) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
                <div className="text-zinc-500">Loading...</div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
            <div className="w-full max-w-md px-6">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-black dark:text-white mb-2">
                        🎓 Student Pass
                    </h1>
                    <p className="text-zinc-500">
                        Mint your pass to access Web3 Academy courses
                    </p>
                </div>

                {/* Main Card */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-lg">
                    {!authenticated ? (
                        // Not logged in
                        <div className="text-center">
                            <p className="text-zinc-500 mb-4">
                                Connect your wallet to mint a Student Pass
                            </p>
                            <button
                                onClick={login}
                                className="w-full px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-xl font-medium hover:opacity-80 transition-opacity"
                            >
                                Connect Wallet
                            </button>
                        </div>
                    ) : isSyncing ? (
                        // Syncing with backend
                        <div className="text-center py-8">
                            <div className="animate-spin h-8 w-8 border-2 border-zinc-300 border-t-zinc-900 rounded-full mx-auto mb-4" />
                            <p className="text-zinc-500">Syncing wallet...</p>
                        </div>
                    ) : hasPass ? (
                        // Already has pass
                        <div className="text-center">
                            <div className="text-5xl mb-4">✅</div>
                            <h2 className="text-xl font-semibold text-black dark:text-white mb-2">
                                You have a Student Pass!
                            </h2>
                            <p className="text-zinc-500 mb-6">
                                You're ready to access all courses on Web3 Academy
                            </p>
                            <Link
                                href="/courses"
                                className="inline-block w-full px-6 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors text-center"
                            >
                                Browse Courses
                            </Link>
                        </div>
                    ) : lastMint?.success ? (
                        // Just minted successfully
                        <div className="text-center">
                            <div className="text-5xl mb-4">🎉</div>
                            <h2 className="text-xl font-semibold text-black dark:text-white mb-2">
                                Student Pass Minted!
                            </h2>
                            <p className="text-zinc-500 mb-4">
                                Your pass has been added to your wallet
                            </p>

                            {/* Explorer links */}
                            <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4 mb-6 text-left">
                                <p className="text-xs text-zinc-400 mb-2">NFT Address</p>
                                <a
                                    href={getSolanaExplorerUrl(lastMint.mintAddress!, "address")}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-blue-500 hover:text-blue-600 font-mono break-all"
                                >
                                    {lastMint.mintAddress}
                                </a>
                            </div>

                            <Link
                                href="/courses"
                                className="inline-block w-full px-6 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors text-center"
                            >
                                Browse Courses
                            </Link>
                        </div>
                    ) : (
                        // Ready to mint
                        <div>
                            {/* Wallet info */}
                            <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4 mb-6">
                                <p className="text-xs text-zinc-400 mb-1">Connected Wallet</p>
                                <p className="text-sm font-mono text-black dark:text-white truncate">
                                    {walletAddress}
                                </p>
                            </div>

                            {/* Pass preview */}
                            <div className="border border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl p-6 mb-6 text-center">
                                <div className="text-4xl mb-2">🎓</div>
                                <p className="font-semibold text-black dark:text-white">
                                    Web3 Academy Student Pass
                                </p>
                                <p className="text-sm text-zinc-500">W3ASP</p>
                            </div>

                            {/* Mint info */}
                            <div className="text-sm text-zinc-500 mb-6 space-y-1">
                                <div className="flex justify-between">
                                    <span>Network</span>
                                    <span className="font-medium text-black dark:text-white capitalize">
                                        {config.solana.network}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Price</span>
                                    <span className="font-medium text-black dark:text-white">
                                        ~0.01 SOL (gas only)
                                    </span>
                                </div>
                            </div>

                            {/* Error */}
                            {mintError && (
                                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
                                    <p className="text-sm text-red-600 dark:text-red-400">
                                        {mintError}
                                    </p>
                                </div>
                            )}

                            {/* Mint button */}
                            <button
                                onClick={handleMint}
                                disabled={isMinting}
                                className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isMinting ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                                        Minting...
                                    </span>
                                ) : (
                                    "Mint Student Pass"
                                )}
                            </button>
                        </div>
                    )}
                </div>

                {/* Back link */}
                <div className="text-center mt-6">
                    <Link
                        href="/"
                        className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                    >
                        ← Back to Home
                    </Link>
                </div>
            </div>
        </div>
    );
}
