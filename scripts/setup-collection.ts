  /**
 * Web3 Academy - Collection Setup Script
 *
 * This script creates:
 * 1. A treasury wallet for badge minting
 * 2. A Student Pass collection NFT on Solana devnet
 *
 * Run with: HELIUS_API_KEY=your-key pnpm setup:collection
 *
 * If airdrop fails, the script saves the keypair so you can:
 * 1. Fund it via https://faucet.solana.com (paste the authority address)
 * 2. Re-run this script
 */

import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  createNft,
  mplTokenMetadata,
} from "@metaplex-foundation/mpl-token-metadata";
import {
  generateSigner,
  keypairIdentity,
  percentAmount,
} from "@metaplex-foundation/umi";
import { Keypair, Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// ESM compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HELIUS_API_KEY = process.env.HELIUS_API_KEY || "YOUR_HELIUS_API_KEY";
const RPC_URL = `https://devnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

const KEYPAIR_PATH = path.join(__dirname, "authority-keypair.json");
const TREASURY_PATH = path.join(__dirname, "treasury-keypair.json");
const CONFIG_PATH = path.join(__dirname, "collection-config.txt");

async function main() {
  console.log("\n🎓 Web3 Academy - Collection Setup\n");
  console.log("=".repeat(50));

  // 1. Load or create treasury wallet
  console.log("\n📦 Step 1: Treasury Wallet...");
  let treasuryKeypair: Keypair;
  if (fs.existsSync(TREASURY_PATH)) {
    const secretKey = JSON.parse(fs.readFileSync(TREASURY_PATH, "utf-8"));
    treasuryKeypair = Keypair.fromSecretKey(Uint8Array.from(secretKey));
    console.log(`   ✅ Loaded existing treasury wallet`);
  } else {
    treasuryKeypair = Keypair.generate();
    fs.writeFileSync(
      TREASURY_PATH,
      JSON.stringify(Array.from(treasuryKeypair.secretKey))
    );
    console.log(`   ✅ Created new treasury wallet`);
  }
  console.log(`   📍 Address: ${treasuryKeypair.publicKey.toBase58()}`);

  // 2. Load or create authority keypair
  console.log("\n🔑 Step 2: Authority Wallet...");
  let authorityKeypair: Keypair;
  if (fs.existsSync(KEYPAIR_PATH)) {
    const secretKey = JSON.parse(fs.readFileSync(KEYPAIR_PATH, "utf-8"));
    authorityKeypair = Keypair.fromSecretKey(Uint8Array.from(secretKey));
    console.log(`   ✅ Loaded existing authority wallet`);
  } else {
    authorityKeypair = Keypair.generate();
    fs.writeFileSync(
      KEYPAIR_PATH,
      JSON.stringify(Array.from(authorityKeypair.secretKey))
    );
    console.log(`   ✅ Created new authority wallet`);
  }
  console.log(`   📍 Address: ${authorityKeypair.publicKey.toBase58()}`);

  // 3. Check balance
  console.log("\n💰 Step 3: Checking wallet balance...");
  const connection = new Connection(RPC_URL, "confirmed");
  const balance = await connection.getBalance(authorityKeypair.publicKey);
  const solBalance = balance / LAMPORTS_PER_SOL;
  console.log(`   💎 Balance: ${solBalance} SOL`);

  if (solBalance < 0.1) {
    console.log("\n" + "=".repeat(50));
    console.log("⚠️  INSUFFICIENT FUNDS");
    console.log("=".repeat(50));
    console.log("\nThe authority wallet needs SOL to create the collection.");
    console.log("\n👉 Option 1: Use the Solana Faucet (recommended)");
    console.log(`   1. Go to: https://faucet.solana.com`);
    console.log(`   2. Paste this address: ${authorityKeypair.publicKey.toBase58()}`);
    console.log(`   3. Click "Devnet" and request airdrop`);
    console.log(`   4. Re-run this script`);
    console.log("\n👉 Option 2: Transfer from another devnet wallet");
    console.log(`   solana transfer ${authorityKeypair.publicKey.toBase58()} 1 --url devnet`);
    console.log("\nKeypairs saved - re-run this script after funding.\n");
    process.exit(0);
  }

  // 4. Set up Umi
  console.log("\n⚙️  Step 4: Connecting to Solana devnet...");
  const umi = createUmi(RPC_URL).use(mplTokenMetadata());
  const authoritySecretKey = Uint8Array.from(authorityKeypair.secretKey);
  const umiKeypair = umi.eddsa.createKeypairFromSecretKey(authoritySecretKey);
  umi.use(keypairIdentity(umiKeypair));
  console.log(`   ✅ Connected to devnet`);

  // 5. Create the Collection NFT
  console.log("\n🎨 Step 5: Creating Student Pass Collection NFT...");
  const collectionMint = generateSigner(umi);

  try {
    await createNft(umi, {
      mint: collectionMint,
      name: "Web3 Academy Student Pass",
      symbol: "W3ASP",
      uri: "https://arweave.net/placeholder", // TODO: Upload proper metadata
      sellerFeeBasisPoints: percentAmount(0),
      isCollection: true,
    }).sendAndConfirm(umi);

    console.log(`   ✅ Collection NFT created!`);
    console.log(`   📍 Collection Address: ${collectionMint.publicKey}`);
  } catch (error) {
    console.error(`   ❌ Failed to create collection:`, error);
    process.exit(1);
  }

  // 6. Output results
  const treasuryBase58 = Buffer.from(treasuryKeypair.secretKey).toString("base64");

  console.log("\n" + "=".repeat(50));
  console.log("✅ SETUP COMPLETE!");
  console.log("=".repeat(50));

  const envConfig = `
# Add these to your .env files:

# ==== backend/.env ====
STUDENT_PASS_COLLECTION=${collectionMint.publicKey}
TREASURY_PRIVATE_KEY=${treasuryBase58}

# ==== frontend/.env.local ====
NEXT_PUBLIC_STUDENT_PASS_COLLECTION=${collectionMint.publicKey}
`;

  console.log(envConfig);
  fs.writeFileSync(CONFIG_PATH, envConfig);
  console.log(`📄 Config saved to: ${CONFIG_PATH}`);

  console.log("\n⚠️  IMPORTANT:");
  console.log("   1. Add scripts/ to .gitignore (contains private keys)");
  console.log("   2. Copy the config values to your .env files");
  console.log("   3. Fund treasury wallet with devnet SOL for badge minting\n");
}

main().catch(console.error);
