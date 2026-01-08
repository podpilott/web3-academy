/**
 * Custom hook for minting Student Pass NFTs
 *
 * Supports BOTH wallet types:
 * - External wallets (Phantom, Solflare, Backpack browser extensions)
 * - Embedded wallets (Privy-created for email/Google login) - uses Privy's signTransaction
 */

import { useState, useCallback, useMemo } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useSignTransaction } from "@privy-io/react-auth/solana";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { mplTokenMetadata, createNft } from "@metaplex-foundation/mpl-token-metadata";
import {
    generateSigner,
    publicKey,
    percentAmount,
    transactionBuilder,
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
    const { signTransaction: privySignTransaction } = useSignTransaction();
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

    // Get embedded wallet info from linked accounts
    const getEmbeddedWallet = useCallback(() => {
        if (!user) return null;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const embeddedWallet = user.linkedAccounts?.find((account: any) =>
            account.type === "wallet" &&
            account.chainType === "solana" &&
            account.walletClientType === "privy"
        );

        return embeddedWallet || null;
    }, [user]);

    const walletAddress = getSolanaWalletAddress();

    // Determine wallet type
    const walletType = useMemo((): "embedded" | "external" | null => {
        if (!user) return null;

        const embeddedWallet = getEmbeddedWallet();
        if (embeddedWallet) {
            return "embedded";
        }

        // Check if we have a browser extension available
        if (getExternalWalletProvider()) {
            return "external";
        }

        return null;
    }, [user, getEmbeddedWallet]);

    const mint = useCallback(async (): Promise<MintResult> => {
        setError(null);
        setIsMinting(true);

        try {
            if (!authenticated || !user) {
                throw new Error("Please login first");
            }

            const solanaAddress = getSolanaWalletAddress();
            const embeddedWallet = getEmbeddedWallet();

            console.log("Solana address:", solanaAddress);
            console.log("Wallet type:", walletType);
            console.log("Embedded wallet:", embeddedWallet);
            console.log("All Privy wallets from useWallets:", wallets);

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
            if (embeddedWallet) {
                console.log("Using embedded wallet, will use Privy signTransaction...");

                // For embedded wallets, we need to create the transaction with Umi,
                // then serialize it and sign with Privy's signTransaction
                const umi = createUmi(config.solana.rpcUrl).use(mplTokenMetadata());

                // Generate new mint address
                const nftMint = generateSigner(umi);

                console.log("Creating NFT transaction with mint:", nftMint.publicKey.toString());

                // Build the transaction without sending
                const builder = createNft(umi, {
                    mint: nftMint,
                    name: STUDENT_PASS_NAME,
                    symbol: STUDENT_PASS_SYMBOL,
                    uri: STUDENT_PASS_URI,
                    sellerFeeBasisPoints: percentAmount(0),
                    collection: {
                        key: publicKey(collectionAddress),
                        verified: false,
                    },
                });

                // Build the transaction
                const transaction = await builder.buildAndSign(umi);

                console.log("Transaction built, serializing...");

                // Serialize to Uint8Array for Privy
                const serializedTx = umi.transactions.serialize(transaction);

                console.log("Signing with Privy embedded wallet...");

                // Sign with Privy's embedded wallet
                // The useSignTransaction hook requires a wallet object
                const signedTx = await privySignTransaction({
                    transaction: serializedTx,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    wallet: embeddedWallet as any,
                });

                console.log("Transaction signed, sending...");

                // Deserialize the signed transaction and send
                const signedTransaction = umi.transactions.deserialize(signedTx.signedTransaction);
                const signature = await umi.rpc.sendTransaction(signedTransaction);

                console.log("Mint successful! Signature:", signature);

                const mintResult: MintResult = {
                    success: true,
                    mintAddress: nftMint.publicKey.toString(),
                    signature: Buffer.from(signature).toString("base64"),
                };

                setLastMint(mintResult);
                return mintResult;
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
    }, [authenticated, user, getSolanaWalletAddress, getEmbeddedWallet, walletType, wallets, privySignTransaction]);

    return { mint, isMinting, error, lastMint, walletAddress, walletType };
}
