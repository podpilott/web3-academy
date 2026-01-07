import { Connection, clusterApiUrl } from "@solana/web3.js";
import { config } from "./config";

/**
 * Get a Solana connection instance configured for the current environment.
 */
export const getSolanaConnection = (): Connection => {
  return new Connection(config.solana.rpcUrl, "confirmed");
};

/**
 * Current Solana network from configuration.
 */
export const SOLANA_NETWORK = config.solana.network;

/**
 * Get the cluster API URL for the current network.
 * Useful for wallet adapters that need the standard cluster URL.
 */
export const getClusterUrl = (): string => {
  if (config.solana.rpcUrl) {
    return config.solana.rpcUrl;
  }
  return clusterApiUrl(config.solana.network);
};
