/**
 * Custom hook for minting Student Pass NFTs
 *
 * Integrates Metaplex Umi with any Solana wallet (Phantom, Solflare, Backpack, embedded)
 */

import { useState, useCallback } from "react";
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
}

// Solana wallet provider interface
interface SolanaProvider {
    publicKey: { toString(): string };
    isConnected?: boolean;
    connect(): Promise<void>;
    signTransaction<T>(tx: T): Promise<T>;
    signAllTransactions<T>(txs: T[]): Promise<T[]>;
    signMessage(msg: Uint8Array): Promise<{ signature: Uint8Array } | Uint8Array>;
}

/**
 * Get any available Solana wallet provider (Phantom, Solflare, Backpack)
 */
function getSolanaProvider(): SolanaProvider | null {
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
    const [isMinting, setIsMinting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastMint, setLastMint] = useState<MintResult | null>(null);

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

    const mint = useCallback(async (): Promise<MintResult> => {
        setError(null);
        setIsMinting(true);

        try {
            if (!authenticated || !user) {
                throw new Error("Please login first");
            }

            const solanaAddress = getSolanaWalletAddress();
            console.log("Solana address:", solanaAddress);

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

            // Get any available Solana wallet provider
            const provider = getSolanaProvider();

            if (!provider) {
                throw new Error(
                    "No Solana wallet extension found. Please install Phantom, Solflare, or Backpack."
                );
            }

            // Connect if not connected
            if (!provider.isConnected) {
                await provider.connect();
            }

            console.log("Using wallet provider:", provider.publicKey.toString());

            // Create Umi instance
            const umi = createUmi(config.solana.rpcUrl).use(mplTokenMetadata());

            // Create a wallet adapter compatible with Umi
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const walletAdapter: any = {
                publicKey: provider.publicKey,
                signTransaction: async <T>(tx: T): Promise<T> => provider.signTransaction(tx),
                signAllTransactions: async <T>(txs: T[]): Promise<T[]> => provider.signAllTransactions(txs),
                signMessage: async (msg: Uint8Array): Promise<Uint8Array> => {
                    const result = await provider.signMessage(msg);
                    // Handle both signature formats
                    if (result instanceof Uint8Array) {
                        return result;
                    }
                    return result.signature;
                },
            };

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
    }, [authenticated, user, getSolanaWalletAddress]);

    return { mint, isMinting, error, lastMint, walletAddress };
}
