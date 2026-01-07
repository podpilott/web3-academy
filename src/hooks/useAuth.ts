import { useCallback, useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import api from "@/lib/api";

interface User {
  id: string;
  privy_id: string;
  wallet_address: string;
  email: string;
}

interface UseAuthReturn {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  syncUser: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const { authenticated, user: privyUser, getAccessToken } = usePrivy();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const syncUser = useCallback(async () => {
    if (!authenticated || !privyUser) {
      setUser(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get the access token from Privy
      const token = await getAccessToken();
      if (!token) {
        throw new Error("Failed to get access token");
      }

      // Store token for API client
      localStorage.setItem("auth_token", token);

      // Sync user with backend
      const response = await api.post("/api/v1/auth/sync", {
        wallet_address: privyUser.wallet?.address,
        email: privyUser.email?.address,
      });

      setUser(response.data);
    } catch (err) {
      console.error("Failed to sync user:", err);
      setError(err instanceof Error ? err.message : "Failed to sync user");
    } finally {
      setIsLoading(false);
    }
  }, [authenticated, privyUser, getAccessToken]);

  // Sync user when authentication state changes
  useEffect(() => {
    if (authenticated) {
      syncUser();
    } else {
      setUser(null);
      localStorage.removeItem("auth_token");
    }
  }, [authenticated, syncUser]);

  return { user, isLoading, error, syncUser };
}
