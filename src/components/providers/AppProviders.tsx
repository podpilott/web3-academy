"use client";

import dynamic from "next/dynamic";
import { PassProvider } from "@/contexts/PassContext";

// Dynamic import with SSR disabled to prevent hydration mismatch
// Privy's modal components have invalid HTML structure (div inside p)
const PrivyProvider = dynamic(
  () => import("./PrivyProvider").then((mod) => mod.PrivyProvider),
  { ssr: false }
);

interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <PrivyProvider>
      <PassProvider>{children}</PassProvider>
    </PrivyProvider>
  );
}
