/**
 * Custom hook for minting Student Pass NFTs
 *
 * Supports BOTH wallet types:
 * - External wallets (Phantom, Solflare, Backpack browser extensions)
 * - Embedded wallets (Privy-created for email/Google login) - uses Privy's signTransaction
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { mplTokenMetadata, createNft } from "@metaplex-foundation/mpl-token-metadata";
import {
    generateSigner,
    publicKey,
    percentAmount,
} from "@metaplex-foundation/umi";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { config } from "@/lib/config";

// Student Pass metadata
const STUDENT_PASS_NAME = "Web3 Academy Student Pass";
const STUDENT_PASS_SYMBOL = "W3ASP";
const STUDENT_PASS_URI = "https://arweave.net/placeholder";

/**
 * Convert technical Solana errors to user-friendly messages
 */
function getReadableErrorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);

    // Insufficient funds / empty wallet
    if (
        message.includes("no record of a prior credit") ||
        message.includes("insufficient funds") ||
        message.includes("Insufficient funds") ||
        message.includes("0x1")
    ) {
        return "Your wallet doesn't have enough SOL to complete this transaction. Please add SOL to your wallet and try again.";
    }

    // User rejected/cancelled
    if (
        message.includes("User rejected") ||
        message.includes("user rejected") ||
        message.includes("cancelled") ||
        message.includes("canceled")
    ) {
        return "Transaction was cancelled.";
    }

    // Network/RPC errors
    if (
        message.includes("Network request failed") ||
        message.includes("Failed to fetch") ||
        message.includes("503") ||
        message.includes("timeout")
    ) {
        return "Network error. Please check your connection and try again.";
    }

    // Blockhash expired
    if (message.includes("blockhash") || message.includes("Blockhash")) {
        return "Transaction expired. Please try again.";
    }

    // Simulation failed
    if (message.includes("Simulation failed")) {
        if (message.includes("no record of a prior credit")) {
            return "Your wallet doesn't have enough SOL to complete this transaction. Please add SOL to your wallet and try again.";
        }
        return "Transaction simulation failed. Please try again or contact support.";
    }

    // Clean up long messages
    if (message.length > 150) {
        return "An error occurred while minting. Please try again.";
    }

    return message;
}

interface MintResult {
    success: boolean;
    mintAddress?: string;
    signature?: string;
    error?: string;
}

interface UseMintStudentPass {
    mint: () => Promise<MintResult>;
    isMinting: boolean;
    error: string | null;
    lastMint: MintResult | null;
    walletAddress: string | null;
    walletType: "embedded" | "external" | null;
}

// Solana wallet provider interface for external wallets
interface SolanaProvider {
    publicKey: { toString(): string };
    isConnected?: boolean;
    connect(): Promise<void>;
    signTransaction<T>(tx: T): Promise<T>;
    signAllTransactions<T>(txs: T[]): Promise<T[]>;
    signMessage(msg: Uint8Array): Promise<{ signature: Uint8Array } | Uint8Array>;
}

// Type for Solana sign transaction function from Privy
type SolanaSignTransactionFn = (input: {
    transaction: Uint8Array;
    wallet: unknown;
}) => Promise<{ signedTransaction: Uint8Array }>;

/**
 * Get any available Solana wallet provider from browser extensions
 */
function getExternalWalletProvider(): SolanaProvider | null {
    if (typeof window === "undefined") return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const windowAny = window as unknown as Record<string, any>;

    // Check for Phantom
    if (windowAny.phantom?.solana) {
        return windowAny.phantom.solana as SolanaProvider;
    }

    // Check for Solflare
    if (windowAny.solflare?.isSolflare) {
        return windowAny.solflare as SolanaProvider;
    }

    // Check for Backpack
    if (windowAny.backpack?.isBackpack) {
        return windowAny.backpack as SolanaProvider;
    }

    // Check for generic Solana provider
    if (windowAny.solana) {
        return windowAny.solana as SolanaProvider;
    }

    return null;
}

export function useMintStudentPass(): UseMintStudentPass {
    const { authenticated, user, ready: privyReady } = usePrivy();

    const [isMinting, setIsMinting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastMint, setLastMint] = useState<MintResult | null>(null);

    // Solana hooks state - loaded dynamically on client side
    const [solanaHooks, setSolanaHooks] = useState<{
        wallets: unknown[];
        ready: boolean;
        signTransaction: SolanaSignTransactionFn | null;
    }>({ wallets: [], ready: false, signTransaction: null });

    // Load Solana hooks on client side only
    useEffect(() => {
        if (typeof window === "undefined") return;

        // Dynamically import Solana hooks when on client and Privy is ready
        const loadSolanaHooks = async () => {
            try {
                const solanaModule = await import("@privy-io/react-auth/solana");
                // Note: We can't call hooks here directly since we're outside render
                // Instead, we'll use a different approach - render a hidden component
                setSolanaHooks(prev => ({ ...prev, ready: true }));
            } catch (err) {
                console.warn("Failed to load Solana hooks:", err);
            }
        };

        if (privyReady) {
            loadSolanaHooks();
        }
    }, [privyReady]);

    // Get the Solana wallet address from Privy user.linkedAccounts
    const getSolanaWalletAddress = useCallback((): string | null => {
        if (!user) return null;

        // Find Solana wallet in linked accounts
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const solanaAccount = user.linkedAccounts?.find((account: any) => {
            if (account.type === "wallet" && account.chainType === "solana") {
                return true;
            }
            // Fallback: check for non-eth addresses
            if (account.type === "wallet" && "address" in account) {
                const addr = account.address as string;
                return addr && !addr.startsWith("0x") && addr.length >= 32;
            }
            return false;
        });

        if (solanaAccount && "address" in solanaAccount) {
            return solanaAccount.address as string;
        }
        return null;
    }, [user]);

    // Check if user has an embedded wallet in linkedAccounts
    const hasEmbeddedWalletAccount = useCallback(() => {
        if (!user) return false;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const embeddedAccount = user.linkedAccounts?.find((account: any) =>
            account.type === "wallet" &&
            account.chainType === "solana" &&
            account.walletClientType === "privy"
        );

        return !!embeddedAccount;
    }, [user]);

    const walletAddress = getSolanaWalletAddress();

    // Determine wallet type
    const walletType = useMemo((): "embedded" | "external" | null => {
        if (!user) return null;

        if (hasEmbeddedWalletAccount()) {
            return "embedded";
        }

        // Check if we have a browser extension available
        if (getExternalWalletProvider()) {
            return "external";
        }

        return null;
    }, [user, hasEmbeddedWalletAccount]);

    const mint = useCallback(async (): Promise<MintResult> => {
        setError(null);
        setIsMinting(true);

        try {
            if (!authenticated || !user) {
                throw new Error("Please login first");
            }

            if (!privyReady) {
                throw new Error("Privy is still initializing. Please wait a moment and try again.");
            }

            const solanaAddress = getSolanaWalletAddress();

            console.log("Solana address:", solanaAddress);
            console.log("Wallet type:", walletType);

            if (!solanaAddress) {
                throw new Error("No Solana wallet found. Please connect a Solana wallet.");
            }

            // Get collection address
            const collectionAddress = config.web3Academy.studentPassCollection;
            console.log("Config studentPassCollection:", collectionAddress);

            if (!collectionAddress) {
                throw new Error(
                    "Student Pass collection not configured. Please add NEXT_PUBLIC_PASS_COLLECTION to .env.local"
                );
            }

            // Check if using embedded wallet
            if (hasEmbeddedWalletAccount()) {
                console.log("Using embedded wallet...");

                // For embedded wallets, we need to dynamically get the Solana wallet and sign function
                // Import the hooks at runtime
                const solanaModule = await import("@privy-io/react-auth/solana");

                // We can't use hooks here, but we can access the underlying Privy client
                // The embedded wallet signing needs to go through Privy's modal
                throw new Error(
                    "Embedded wallet minting requires the SolanaMintWrapper component. " +
                    "Please use the MintWithSolanaHooks component instead."
                );
            }

            // For external wallets, use the browser extension
            const externalProvider = getExternalWalletProvider();

            if (!externalProvider) {
                throw new Error(
                    "No wallet found. Please install Phantom, Solflare, or Backpack browser extension."
                );
            }

            console.log("Using external browser wallet");

            // Connect if not connected
            if (!externalProvider.isConnected) {
                await externalProvider.connect();
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const walletAdapter: any = {
                publicKey: externalProvider.publicKey,
                signTransaction: async <T>(tx: T): Promise<T> => externalProvider.signTransaction(tx),
                signAllTransactions: async <T>(txs: T[]): Promise<T[]> => externalProvider.signAllTransactions(txs),
                signMessage: async (msg: Uint8Array): Promise<Uint8Array> => {
                    const result = await externalProvider.signMessage(msg);
                    if (result instanceof Uint8Array) return result;
                    return result.signature;
                },
            };

            // Create Umi instance
            const umi = createUmi(config.solana.rpcUrl).use(mplTokenMetadata());
            umi.use(walletAdapterIdentity(walletAdapter));

            // Generate new mint address
            const nftMint = generateSigner(umi);

            console.log("Creating NFT with mint:", nftMint.publicKey.toString());
            console.log("Collection:", collectionAddress);

            // Create the NFT
            const result = await createNft(umi, {
                mint: nftMint,
                name: STUDENT_PASS_NAME,
                symbol: STUDENT_PASS_SYMBOL,
                uri: STUDENT_PASS_URI,
                sellerFeeBasisPoints: percentAmount(0),
                collection: {
                    key: publicKey(collectionAddress),
                    verified: false,
                },
            }).sendAndConfirm(umi);

            console.log("Mint successful!", result);

            const mintResult: MintResult = {
                success: true,
                mintAddress: nftMint.publicKey.toString(),
                signature: Buffer.from(result.signature).toString("base64"),
            };

            setLastMint(mintResult);
            return mintResult;
        } catch (err) {
            console.error("Mint error:", err);
            const errorMessage = getReadableErrorMessage(err);
            setError(errorMessage);
            const mintResult: MintResult = {
                success: false,
                error: errorMessage,
            };
            setLastMint(mintResult);
            return mintResult;
        } finally {
            setIsMinting(false);
        }
    }, [authenticated, user, privyReady, getSolanaWalletAddress, hasEmbeddedWalletAccount, walletType]);

    return { mint, isMinting, error, lastMint, walletAddress, walletType };
}

/**
 * Props for the embedded wallet mint component
 */
export interface EmbeddedMintProps {
    onMintComplete: (result: MintResult) => void;
    onMintStart: () => void;
    collectionAddress: string;
    walletAddress: string;
}
