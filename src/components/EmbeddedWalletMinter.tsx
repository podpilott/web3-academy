"use client";

/**
 * Embedded Wallet Mint Component
 *
 * This component handles minting for Privy embedded Solana wallets.
 * It must be rendered as a child of PrivyProvider and uses the Solana-specific hooks.
 */

import { useState, useCallback } from "react";
import { useWallets, useSignTransaction } from "@privy-io/react-auth/solana";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { mplTokenMetadata, createNft } from "@metaplex-foundation/mpl-token-metadata";
import { generateSigner, publicKey, percentAmount } from "@metaplex-foundation/umi";
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
        message.includes("0x1") // Solana error code for insufficient funds
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

    // Blockhash expired (transaction took too long)
    if (message.includes("blockhash") || message.includes("Blockhash")) {
        return "Transaction expired. Please try again.";
    }

    // Simulation failed (generic)
    if (message.includes("Simulation failed")) {
        if (message.includes("no record of a prior credit")) {
            return "Your wallet doesn't have enough SOL to complete this transaction. Please add SOL to your wallet and try again.";
        }
        return "Transaction simulation failed. Please try again or contact support.";
    }

    // Return original message if no match, but clean it up
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

interface EmbeddedWalletMinterProps {
    walletAddress: string;
    collectionAddress: string;
    onMintStart: () => void;
    onMintComplete: (result: MintResult) => void;
    disabled?: boolean;
    className?: string;
}

export function EmbeddedWalletMinter({
    walletAddress,
    collectionAddress,
    onMintStart,
    onMintComplete,
    disabled = false,
    className = "",
}: EmbeddedWalletMinterProps) {
    const { wallets, ready: walletsReady } = useWallets();
    const { signTransaction } = useSignTransaction();
    const [isMinting, setIsMinting] = useState(false);

    // Find the embedded wallet that matches our address
    const embeddedWallet = wallets.find(
        (w) => w.address.toLowerCase() === walletAddress.toLowerCase()
    );

    const handleMint = useCallback(async () => {
        if (!embeddedWallet) {
            onMintComplete({
                success: false,
                error: "Embedded wallet not found. Please wait for it to load.",
            });
            return;
        }

        setIsMinting(true);
        onMintStart();

        try {
            console.log("Starting embedded wallet mint...");
            console.log("Wallet address:", walletAddress);
            console.log("Collection:", collectionAddress);
            console.log("Connected wallet:", embeddedWallet);

            // Create Umi instance
            const umi = createUmi(config.solana.rpcUrl).use(mplTokenMetadata());

            // Get the embedded wallet public key in Umi format
            const embeddedPublicKey = publicKey(walletAddress);

            // Create a custom Umi signer that uses Privy's signTransaction
            const embeddedWalletSigner = {
                publicKey: embeddedPublicKey,
                signTransaction: async (
                    transaction: Parameters<typeof umi.transactions.serialize>[0]
                ) => {
                    console.log("Calling Privy signTransaction...");
                    const serialized = umi.transactions.serialize(transaction);

                    // Use Privy's signTransaction hook
                    const signed = await signTransaction({
                        transaction: serialized,
                        wallet: embeddedWallet,
                    });

                    console.log("Transaction signed successfully");
                    return umi.transactions.deserialize(signed.signedTransaction);
                },
                signMessage: async (message: Uint8Array): Promise<Uint8Array> => {
                    throw new Error("signMessage not implemented for embedded wallet");
                },
                signAllTransactions: async (
                    transactions: Parameters<typeof umi.transactions.serialize>[0][]
                ) => {
                    const results = [];
                    for (const tx of transactions) {
                        const serialized = umi.transactions.serialize(tx);
                        const signed = await signTransaction({
                            transaction: serialized,
                            wallet: embeddedWallet,
                        });
                        results.push(umi.transactions.deserialize(signed.signedTransaction));
                    }
                    return results;
                },
            };

            // Set the signer as identity and payer
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            umi.identity = embeddedWalletSigner as any;
            umi.payer = embeddedWalletSigner as any;

            // Generate new mint address
            const nftMint = generateSigner(umi);
            console.log("Creating NFT with mint:", nftMint.publicKey.toString());

            // Create and send the NFT
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

            onMintComplete({
                success: true,
                mintAddress: nftMint.publicKey.toString(),
                signature: Buffer.from(result.signature).toString("base64"),
            });
        } catch (err) {
            console.error("Embedded wallet mint error:", err);
            onMintComplete({
                success: false,
                error: getReadableErrorMessage(err),
            });
        } finally {
            setIsMinting(false);
        }
    }, [
        embeddedWallet,
        walletAddress,
        collectionAddress,
        signTransaction,
        onMintStart,
        onMintComplete,
    ]);

    const isLoading = !walletsReady || isMinting;
    const buttonDisabled = disabled || isLoading || !embeddedWallet;

    return (
        <button
            onClick={handleMint}
            disabled={buttonDisabled}
            className={`w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        >
            {!walletsReady ? (
                <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                    Loading Wallet...
                </span>
            ) : isMinting ? (
                <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                    Minting...
                </span>
            ) : !embeddedWallet ? (
                "Wallet Not Ready"
            ) : (
                "Mint Student Pass"
            )}
        </button>
    );
}
