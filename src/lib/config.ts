/**
 * Centralized configuration with validation.
 *
 * IMPORTANT: Next.js requires NEXT_PUBLIC_* variables to be accessed
 * directly (e.g., process.env.NEXT_PUBLIC_FOO) for static replacement
 * at build time. Dynamic key access (process.env[key]) does NOT work.
 */

/**
 * Application configuration
 *
 * All NEXT_PUBLIC_* variables must be accessed directly for Next.js
 * static replacement to work correctly.
 */
export const config = {
  /**
   * Privy authentication configuration
   */
  privy: {
    /** Privy App ID from dashboard.privy.io */
    appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID || "",
  },

  /**
   * Solana network configuration
   */
  solana: {
    /** Network to connect to: 'devnet' | 'mainnet-beta' */
    network: (process.env.NEXT_PUBLIC_SOLANA_NETWORK || "devnet") as
      | "devnet"
      | "mainnet-beta",
    /** RPC endpoint URL */
    rpcUrl:
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
      "https://api.devnet.solana.com",
  },

  /**
   * Backend API configuration
   */
  api: {
    /** Base URL for the backend API */
    baseUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080",
  },

  /**
   * Web3 Academy configuration
   */
  web3Academy: {
    /** Student Pass collection address */
    studentPassCollection:
      process.env.NEXT_PUBLIC_PASS_COLLECTION || "",
  },
} as const;

/**
 * Type for the configuration object
 */
export type Config = typeof config;

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === "development";
}

/**
 * Check if running in production mode
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Validate that all required configuration is present.
 * Returns an array of missing config keys.
 */
export function validateConfig(): string[] {
  const missing: string[] = [];

  if (!config.privy.appId) {
    missing.push("NEXT_PUBLIC_PRIVY_APP_ID");
  }

  return missing;
}
