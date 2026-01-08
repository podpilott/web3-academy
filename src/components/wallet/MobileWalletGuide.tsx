"use client";

import { useState, useEffect } from "react";

/**
 * Detects if the user is on a mobile device
 */
function useIsMobile(): boolean {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            const userAgent = navigator.userAgent || navigator.vendor;
            const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
            setIsMobile(mobileRegex.test(userAgent));
        };

        checkMobile();
        window.addEventListener("resize", checkMobile);
        return () => window.removeEventListener("resize", checkMobile);
    }, []);

    return isMobile;
}

/**
 * Detects if a Solana wallet provider is injected (browser extension or in-app browser)
 */
function useHasWalletProvider(): boolean {
    const [hasProvider, setHasProvider] = useState(false);

    useEffect(() => {
        // Check for Phantom, Solflare, Backpack, or generic Solana provider
        const checkProvider = () => {
            const hasPhantom = !!(window as { phantom?: { solana?: unknown } }).phantom?.solana;
            const hasSolflare = !!(window as { solflare?: unknown }).solflare;
            const hasBackpack = !!(window as { backpack?: unknown }).backpack;
            const hasSolana = !!(window as { solana?: unknown }).solana;
            setHasProvider(hasPhantom || hasSolflare || hasBackpack || hasSolana);
        };

        // Check immediately and after a short delay (some wallets inject late)
        checkProvider();
        const timeout = setTimeout(checkProvider, 500);

        return () => clearTimeout(timeout);
    }, []);

    return hasProvider;
}

interface MobileWalletGuideProps {
    /** The dApp URL to show users */
    dappUrl?: string;
    /** Optional className for styling */
    className?: string;
    /** Show even when wallet provider is detected */
    forceShow?: boolean;
}

/**
 * Component that shows mobile users how to connect via wallet's in-app browser.
 * Only displays on mobile devices when no wallet provider is detected.
 */
export function MobileWalletGuide({
    dappUrl = typeof window !== "undefined" ? window.location.origin : "",
    className = "",
    forceShow = false,
}: MobileWalletGuideProps) {
    const isMobile = useIsMobile();
    const hasWalletProvider = useHasWalletProvider();
    const [copied, setCopied] = useState(false);

    // Only show on mobile when no wallet provider is detected (unless forceShow)
    if (!forceShow && (!isMobile || hasWalletProvider)) {
        return null;
    }

    const copyUrl = async () => {
        try {
            await navigator.clipboard.writeText(dappUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback for browsers without clipboard API
            console.log("Copy URL:", dappUrl);
        }
    };

    return (
        <div className={`p-4 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/50 ${className}`}>
            <div className="flex items-start gap-3 mb-3">
                <span className="text-2xl">📱</span>
                <div>
                    <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-1">
                        Connect with Mobile Wallet
                    </h3>
                    <p className="text-sm text-purple-700 dark:text-purple-300">
                        Use your wallet&apos;s built-in browser to connect
                    </p>
                </div>
            </div>

            <div className="space-y-3 ml-9">
                <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-purple-200 dark:bg-purple-800 text-purple-700 dark:text-purple-200 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                    <p className="text-sm text-purple-800 dark:text-purple-200">
                        Open <strong>Phantom</strong>, <strong>Solflare</strong>, or <strong>Backpack</strong> app
                    </p>
                </div>
                <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-purple-200 dark:bg-purple-800 text-purple-700 dark:text-purple-200 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                    <p className="text-sm text-purple-800 dark:text-purple-200">
                        Tap the <strong>Explore</strong> (🔍) icon
                    </p>
                </div>
                <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-purple-200 dark:bg-purple-800 text-purple-700 dark:text-purple-200 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                    <div className="text-sm text-purple-800 dark:text-purple-200">
                        <p className="mb-2">Visit this URL:</p>
                        <button
                            onClick={copyUrl}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-100 dark:bg-purple-900/50 hover:bg-purple-200 dark:hover:bg-purple-800/50 transition-colors w-full text-left"
                        >
                            <code className="text-xs font-mono text-purple-700 dark:text-purple-300 truncate flex-1">
                                {dappUrl}
                            </code>
                            <span className="text-xs text-purple-500 dark:text-purple-400 flex-shrink-0">
                                {copied ? "✓ Copied" : "Copy"}
                            </span>
                        </button>
                    </div>
                </div>
                <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-purple-200 dark:bg-purple-800 text-purple-700 dark:text-purple-200 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
                    <p className="text-sm text-purple-800 dark:text-purple-200">
                        Click <strong>Connect Wallet</strong> - it connects automatically!
                    </p>
                </div>
            </div>

            {/* App store links */}
            <div className="mt-4 pt-3 border-t border-purple-200 dark:border-purple-800 ml-9">
                <p className="text-xs text-purple-600 dark:text-purple-400 mb-2">
                    Don&apos;t have a wallet? Get one:
                </p>
                <div className="flex flex-wrap gap-2">
                    <a
                        href="https://phantom.app/download"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs px-3 py-1.5 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800/50 transition-colors"
                    >
                        👻 Phantom
                    </a>
                    <a
                        href="https://solflare.com/download"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs px-3 py-1.5 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800/50 transition-colors"
                    >
                        🔥 Solflare
                    </a>
                    <a
                        href="https://backpack.app/download"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs px-3 py-1.5 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800/50 transition-colors"
                    >
                        🎒 Backpack
                    </a>
                </div>
            </div>
        </div>
    );
}
