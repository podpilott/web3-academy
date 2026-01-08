/**
 * Custom hook for minting Student Pass NFTs
 *
 * Supports BOTH wallet types:
 * - External wallets (Phantom, Solflare, Backpack browser extensions)
 * - Embedded wallets (Privy-created for email/Google login)
 */

import { useState, useCallback, useMemo } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
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
    const { authenticated, user } = usePrivy();
    const { wallets } = useWallets();
    const [isMinting, setIsMinting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastMint, setLastMint] = useState<MintResult | null>(null);

    // Filter for Solana wallets from Privy
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const solanaWallets = useMemo(() =>
        wallets.filter((w: any) => w.chainType === "solana"),
        [wallets]
    );

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

    const walletAddress = getSolanaWalletAddress();

    // Determine wallet type
    const walletType = useMemo((): "embedded" | "external" | null => {
        if (!user) return null;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const walletAccount = user.linkedAccounts?.find((a: any) =>
            a.type === "wallet" && a.chainType === "solana"
        ) as { walletClientType?: string } | undefined;

        if (walletAccount?.walletClientType === "privy") {
            return "embedded";
        }

        // Check if we have a browser extension available
        if (getExternalWalletProvider()) {
            return "external";
        }

        return null;
    }, [user]);

    const mint = useCallback(async (): Promise<MintResult> => {
        setError(null);
        setIsMinting(true);

        try {
            if (!authenticated || !user) {
                throw new Error("Please login first");
            }

            const solanaAddress = getSolanaWalletAddress();
            console.log("Solana address:", solanaAddress);
            console.log("Wallet type:", walletType);
            console.log("Available Privy Solana wallets:", solanaWallets);

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

            // Try to get wallet signer based on wallet type
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let walletAdapter: any = null;

            // First, try Privy's Solana wallets (works for both embedded and connected external)
            const privyWallet = solanaWallets.find(w => w.address === solanaAddress);

            if (privyWallet) {
                console.log("Using Privy Solana wallet:", privyWallet.walletClientType);

                // Get the provider from Privy wallet - this works for embedded wallets too!
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const provider = await (privyWallet as any).getProvider();

                walletAdapter = {
                    publicKey: provider.publicKey,
                    signTransaction: async <T>(tx: T): Promise<T> => provider.signTransaction(tx),
                    signAllTransactions: async <T>(txs: T[]): Promise<T[]> => provider.signAllTransactions(txs),
                    signMessage: async (msg: Uint8Array): Promise<Uint8Array> => {
                        const result = await provider.signMessage(msg);
                        if (result instanceof Uint8Array) return result;
                        return result.signature;
                    },
                };
            } else {
                // Fallback: try browser extension directly
                const externalProvider = getExternalWalletProvider();

                if (externalProvider) {
                    console.log("Using external browser wallet");

                    // Connect if not connected
                    if (!externalProvider.isConnected) {
                        await externalProvider.connect();
                    }

                    walletAdapter = {
                        publicKey: externalProvider.publicKey,
                        signTransaction: async <T>(tx: T): Promise<T> => externalProvider.signTransaction(tx),
                        signAllTransactions: async <T>(txs: T[]): Promise<T[]> => externalProvider.signAllTransactions(txs),
                        signMessage: async (msg: Uint8Array): Promise<Uint8Array> => {
                            const result = await externalProvider.signMessage(msg);
                            if (result instanceof Uint8Array) return result;
                            return result.signature;
                        },
                    };
                }
            }

            if (!walletAdapter) {
                throw new Error(
                    "Could not get wallet signer. Please try reconnecting your wallet."
                );
            }

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
            const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
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
    }, [authenticated, user, getSolanaWalletAddress, walletType, solanaWallets]);

    return { mint, isMinting, error, lastMint, walletAddress, walletType };
}
