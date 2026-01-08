/**
 * Custom hook for minting Student Pass NFTs
 *
 * Supports BOTH wallet types:
 * - External wallets (Phantom, Solflare, Backpack browser extensions)
 * - Embedded wallets (Privy-created for email/Google login) - uses Privy's signTransaction
 */

import { useState, useCallback, useMemo } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useSignTransaction, useWallets } from "@privy-io/react-auth/solana";
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
    const { wallets, ready: walletsReady } = useWallets();
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

    // Get embedded wallet from useWallets hook (returns ConnectedStandardSolanaWallet)
    const getConnectedEmbeddedWallet = useCallback(() => {
        // wallets from useWallets() are ConnectedStandardSolanaWallet objects
        // The underlying standardWallet for Privy embedded wallets has isPrivyWallet = true
        const embeddedWallet = wallets.find((w) => {
            // Check if the underlying standard wallet is a Privy wallet
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const standardWallet = w.standardWallet as any;
            return standardWallet?.isPrivyWallet === true;
        });
        return embeddedWallet || null;
    }, [wallets]);

    // Check if user has an embedded wallet in linkedAccounts (for wallet type detection)
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

            const solanaAddress = getSolanaWalletAddress();
            // Get the ConnectedStandardSolanaWallet from useWallets hook
            const connectedWallet = getConnectedEmbeddedWallet();

            console.log("Solana address:", solanaAddress);
            console.log("Wallet type:", walletType);
            console.log("Connected embedded wallet:", connectedWallet);
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
            if (hasEmbeddedWalletAccount()) {
                console.log("Using embedded wallet, will use Privy signTransaction...");

                if (!walletsReady) {
                    throw new Error(
                        "Wallets are still loading. Please wait a moment and try again."
                    );
                }

                if (!connectedWallet) {
                    throw new Error(
                        "Embedded wallet not ready. Please wait a moment and try again."
                    );
                }

                // For embedded wallets, we need to create the transaction with Umi,
                // then serialize it and sign with Privy's signTransaction
                const umi = createUmi(config.solana.rpcUrl).use(mplTokenMetadata());

                // Get the embedded wallet public key in Umi format
                const embeddedPublicKey = publicKey(connectedWallet.address);

                // Create a custom Umi signer for the embedded wallet
                // This signer will call Privy's signTransaction when Umi needs to sign
                const embeddedWalletSigner = {
                    publicKey: embeddedPublicKey,
                    signTransaction: async (transaction: Parameters<typeof umi.transactions.serialize>[0]) => {
                        console.log("Embedded wallet signTransaction called...");
                        const serialized = umi.transactions.serialize(transaction);
                        const signed = await privySignTransaction({
                            transaction: serialized,
                            wallet: connectedWallet,
                        });
                        return umi.transactions.deserialize(signed.signedTransaction);
                    },
                    signMessage: async (message: Uint8Array): Promise<Uint8Array> => {
                        throw new Error("signMessage not supported for embedded wallets");
                    },
                    signAllTransactions: async (transactions: Parameters<typeof umi.transactions.serialize>[0][]) => {
                        const results = [];
                        for (const tx of transactions) {
                            const serialized = umi.transactions.serialize(tx);
                            const signed = await privySignTransaction({
                                transaction: serialized,
                                wallet: connectedWallet,
                            });
                            results.push(umi.transactions.deserialize(signed.signedTransaction));
                        }
                        return results;
                    },
                };

                // Set the embedded wallet as the identity/payer using signerIdentity
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                umi.identity = embeddedWalletSigner as any;
                umi.payer = embeddedWalletSigner as any;

                // Generate new mint address
                const nftMint = generateSigner(umi);

                console.log("Creating NFT transaction with mint:", nftMint.publicKey.toString());

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

                const mintResult: MintResult = {
                    success: true,
                    mintAddress: nftMint.publicKey.toString(),
                    signature: Buffer.from(result.signature).toString("base64"),
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
    }, [authenticated, user, getSolanaWalletAddress, getConnectedEmbeddedWallet, hasEmbeddedWalletAccount, walletType, wallets, walletsReady, privySignTransaction]);

    return { mint, isMinting, error, lastMint, walletAddress, walletType };
}
