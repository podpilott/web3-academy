"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useAuth } from "@/hooks/useAuth";
import { config } from "@/lib/config";

interface PassContextValue {
  hasPass: boolean | null;
  isChecking: boolean;
  lastChecked: number | null;
  checkPassStatus: () => Promise<void>;
  invalidateAndRefetch: () => Promise<void>;
  setHasPass: (value: boolean) => void;
}

const PassContext = createContext<PassContextValue | undefined>(undefined);

interface PassProviderProps {
  children: ReactNode;
}

export function PassProvider({ children }: PassProviderProps) {
  const { authenticated, getAccessToken } = usePrivy();
  const { user: backendUser } = useAuth();

  const [hasPass, setHasPassState] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<number | null>(null);

  /**
   * Fetch pass status from backend
   */
  const checkPassStatus = useCallback(async () => {
    if (!authenticated || !backendUser) {
      setHasPassState(false);
      setLastChecked(Date.now());
      return;
    }

    setIsChecking(true);
    try {
      const token = await getAccessToken();
      const response = await fetch(
        `${config.api.baseUrl}/api/v1/pass/status`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setHasPassState(data.has_pass);
        setLastChecked(Date.now());
      }
    } catch (err) {
      console.error("Error checking pass status:", err);
      // Keep previous state on error
    } finally {
      setIsChecking(false);
    }
  }, [authenticated, backendUser, getAccessToken]);

  /**
   * Invalidate cache and refetch
   */
  const invalidateAndRefetch = useCallback(async () => {
    setLastChecked(null);
    await checkPassStatus();
  }, [checkPassStatus]);

  /**
   * Manually set pass status (for optimistic updates)
   */
  const setHasPass = useCallback((value: boolean) => {
    setHasPassState(value);
    setLastChecked(Date.now());
  }, []);

  /**
   * Auto-fetch when authentication state changes
   */
  useEffect(() => {
    if (authenticated && backendUser) {
      checkPassStatus();
    } else {
      setHasPassState(false);
      setLastChecked(null);
    }
  }, [authenticated, backendUser, checkPassStatus]);

  const value: PassContextValue = {
    hasPass,
    isChecking,
    lastChecked,
    checkPassStatus,
    invalidateAndRefetch,
    setHasPass,
  };

  return <PassContext.Provider value={value}>{children}</PassContext.Provider>;
}

/**
 * Hook to access pass status
 */
export function usePassStatus() {
  const context = useContext(PassContext);
  if (context === undefined) {
    throw new Error("usePassStatus must be used within PassProvider");
  }
  return context;
}
