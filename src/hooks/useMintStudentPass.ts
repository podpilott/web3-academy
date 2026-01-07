/**
 * Custom hook for minting Student Pass NFTs
 *
 * Integrates Metaplex Umi with Privy/Phantom wallet for signing transactions
 */

import { useState, useCallback } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { mplTokenMetadata, createNft } from "@metaplex-foundation/mpl-token-metadata";
import {
    generateSigner,
    publicKey,
    percentAmount,
    signerIdentity,
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

export function useMintStudentPass(): UseMintStudentPass {
    const { authenticated, user } = usePrivy();
    const { wallets } = useWallets();
    const [isMinting, setIsMinting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastMint, setLastMint] = useState<MintResult | null>(null);

    // Get the Solana wallet address from Privy user.linkedAccounts
    const getSolanaWalletAddress = useCallback((): string | null => {
        if (!user) return null;

        // Find Solana wallet in linked accounts
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
            console.log("Full config:", config);

            if (!collectionAddress) {
                throw new Error(
                    "Student Pass collection not configured. Please add NEXT_PUBLIC_PASS_COLLECTION to .env.local"
                );
            }

            // For Phantom connected via Privy, get the Solana provider
            // Phantom injects window.phantom.solana
            const phantom = (window as any).phantom?.solana;
            if (!phantom) {
                throw new Error("Phantom wallet not found. Please install Phantom extension.");
            }

            // Connect to Phantom if not connected
            if (!phantom.isConnected) {
                await phantom.connect();
            }

            // Create Umi instance
            const umi = createUmi(config.solana.rpcUrl).use(mplTokenMetadata());

            // Use Phantom as the wallet adapter
            // walletAdapterIdentity expects a wallet adapter interface
            const phantomAdapter = {
                publicKey: phantom.publicKey,
                signTransaction: async (tx: any) => phantom.signTransaction(tx),
                signAllTransactions: async (txs: any[]) => phantom.signAllTransactions(txs),
                signMessage: async (msg: Uint8Array) => phantom.signMessage(msg),
            };

            umi.use(walletAdapterIdentity(phantomAdapter));

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
