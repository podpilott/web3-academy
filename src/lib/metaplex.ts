/**
 * Web3 Academy - Metaplex Umi Minting Utilities
 *
 * This module provides functions for minting Student Pass NFTs
 * using Metaplex Umi SDK with Privy wallet integration.
 */

import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
    createNft,
    mplTokenMetadata,
    fetchDigitalAsset,
} from "@metaplex-foundation/mpl-token-metadata";
import {
    generateSigner,
    publicKey,
    percentAmount,
    type Umi,
    type Signer,
    type PublicKey,
} from "@metaplex-foundation/umi";
import { config } from "./config";

// Student Pass metadata
const STUDENT_PASS_NAME = "Web3 Academy Student Pass";
const STUDENT_PASS_SYMBOL = "W3ASP";
const STUDENT_PASS_URI = "https://arweave.net/placeholder"; // TODO: Upload proper metadata

/**
 * Create a Umi instance configured for the current network
 */
export function createUmiInstance(): Umi {
    return createUmi(config.solana.rpcUrl).use(mplTokenMetadata());
}

/**
 * Get the Student Pass collection public key
 */
export function getStudentPassCollection(): PublicKey {
    const collectionAddress = config.web3Academy.studentPassCollection;
    if (!collectionAddress) {
        throw new Error(
            "Student Pass collection address not configured. Set NEXT_PUBLIC_STUDENT_PASS_COLLECTION in .env.local"
        );
    }
    return publicKey(collectionAddress);
}

/**
 * Mint a Student Pass NFT to the given wallet
 *
 * @param umi - Umi instance with wallet identity set
 * @returns The mint address of the new NFT
 */
export async function mintStudentPass(umi: Umi): Promise<string> {
    const collectionMint = getStudentPassCollection();

    // Generate a new mint address for the NFT
    const nftMint = generateSigner(umi);

    // Create the NFT as part of the collection
    await createNft(umi, {
        mint: nftMint,
        name: STUDENT_PASS_NAME,
        symbol: STUDENT_PASS_SYMBOL,
        uri: STUDENT_PASS_URI,
        sellerFeeBasisPoints: percentAmount(0),
        collection: {
            key: collectionMint,
            verified: false, // Will need to be verified by collection authority
        },
    }).sendAndConfirm(umi);

    return nftMint.publicKey.toString();
}

/**
 * Check if a wallet owns a Student Pass
 *
 * @param umi - Umi instance
 * @param walletAddress - The wallet address to check
 * @returns True if the wallet owns at least one Student Pass
 */
export async function checkStudentPassOwnership(
    umi: Umi,
    walletAddress: string
): Promise<boolean> {
    try {
        const collectionAddress = config.web3Academy.studentPassCollection;
        if (!collectionAddress) return false;

        // For now, we'll check via the backend API which has the full token list
        // This is more reliable than client-side DAS queries
        return false; // Placeholder - will be replaced with API call
    } catch (error) {
        console.error("Error checking Student Pass ownership:", error);
        return false;
    }
}

/**
 * Get Solana Explorer URL for a transaction or account
 */
export function getSolanaExplorerUrl(
    signature: string,
    type: "tx" | "address" = "tx"
): string {
    const network = config.solana.network;
    const cluster = network === "mainnet-beta" ? "" : `?cluster=${network}`;
    return `https://explorer.solana.com/${type}/${signature}${cluster}`;
}
