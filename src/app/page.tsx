"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useAuth } from "@/hooks/useAuth";
import { usePassStatus } from "@/contexts/PassContext";
import Link from "next/link";

export default function Home() {
  const { login, logout, authenticated, user: privyUser, ready } = usePrivy();
  const { user: backendUser, isLoading: isSyncing, error: syncError } = useAuth();
  const { hasPass } = usePassStatus();

  // Show loading while Privy initializes
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="text-zinc-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      {/* Navigation */}
      <nav className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="text-xl font-bold text-black dark:text-white">
            🎓 Web3 Academy
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/courses"
              className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors"
            >
              Courses
            </Link>
            {authenticated ? (
              <>
                <Link
                  href="/profile"
                  className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors"
                >
                  Profile
                </Link>
                <button
                  onClick={logout}
                  className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <button
                onClick={login}
                className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-lg text-sm font-medium hover:opacity-80 transition-opacity"
              >
                Login
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-4xl mx-auto px-6 py-16 text-center">
        <h1 className="text-5xl font-bold text-black dark:text-white mb-4">
          Web3 Academy
        </h1>
        <p className="text-xl text-zinc-600 dark:text-zinc-400 mb-8">
          Learn Web3 development and earn on-chain credentials
        </p>

        {/* CTA Buttons */}
        <div className="flex justify-center gap-4 mb-12">
          <Link
            href="/courses"
            className="px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-xl font-medium hover:opacity-80 transition-opacity"
          >
            Browse Courses
          </Link>
          {!hasPass ? (
            <Link
              href="/mint"
              className="px-6 py-3 border border-zinc-300 dark:border-zinc-700 text-black dark:text-white rounded-xl font-medium hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
            >
              Get Student Pass
            </Link>
          ) : (
            <div className="px-6 py-3 border border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 rounded-xl font-medium flex items-center gap-2">
              <span>✓</span> Student Pass Active
            </div>
          )}
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          <div className="p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <div className="text-3xl mb-3">🎓</div>
            <h3 className="font-semibold text-black dark:text-white mb-2">
              NFT-Gated Access
            </h3>
            <p className="text-sm text-zinc-500">
              Mint a Student Pass to unlock all premium courses
            </p>
          </div>
          <div className="p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <div className="text-3xl mb-3">📚</div>
            <h3 className="font-semibold text-black dark:text-white mb-2">
              Learn Web3
            </h3>
            <p className="text-sm text-zinc-500">
              From blockchain basics to smart contracts and NFTs
            </p>
          </div>
          <div className="p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <div className="text-3xl mb-3">🏆</div>
            <h3 className="font-semibold text-black dark:text-white mb-2">
              Earn Badges
            </h3>
            <p className="text-sm text-zinc-500">
              Complete courses to earn on-chain credential NFTs
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
