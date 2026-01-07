"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useAuth } from "@/hooks/useAuth";
import { usePassStatus } from "@/contexts/PassContext";
import { WalletInfo } from "@/components/wallet/WalletInfo";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const { logout, authenticated, ready } = usePrivy();
  const { user: backendUser, isLoading: isSyncing, error: syncError } = useAuth();
  const { hasPass } = usePassStatus();
  const router = useRouter();

  // Redirect to home if not authenticated
  if (ready && !authenticated) {
    router.push("/");
    return null;
  }

  // Loading state
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
            <Link
              href="/profile"
              className="text-sm text-black dark:text-white font-medium"
            >
              Profile
            </Link>
            <button
              onClick={logout}
              className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Profile Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-black dark:text-white mb-2">
            Profile
          </h1>
          <p className="text-zinc-500">
            Manage your account and wallet settings
          </p>
        </div>

        {/* Student Pass Status */}
        <div className="mb-6">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
            <h2 className="text-lg font-semibold text-black dark:text-white mb-4">
              Student Pass Status
            </h2>
            {hasPass ? (
              <div className="flex items-center gap-3">
                <div className="text-2xl">✅</div>
                <div>
                  <p className="font-medium text-green-600 dark:text-green-400">
                    Active
                  </p>
                  <p className="text-sm text-zinc-500">
                    You have access to all gated courses
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">🔒</div>
                  <div>
                    <p className="font-medium text-zinc-600 dark:text-zinc-400">
                      No Pass
                    </p>
                    <p className="text-sm text-zinc-500">
                      Mint a Student Pass to unlock all courses
                    </p>
                  </div>
                </div>
                <Link
                  href="/mint"
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
                >
                  Get Student Pass
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Wallet Information */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-black dark:text-white mb-4">
            Wallet
          </h2>
          <WalletInfo />
        </div>

        {/* Backend Sync Status */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
          <h2 className="text-lg font-semibold text-black dark:text-white mb-4">
            Account Status
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-500">Backend Sync</span>
              {isSyncing ? (
                <span className="text-sm text-yellow-500 flex items-center gap-2">
                  <div className="animate-spin h-4 w-4 border-2 border-yellow-500 border-t-transparent rounded-full" />
                  Syncing...
                </span>
              ) : syncError ? (
                <span className="text-sm text-red-500">❌ {syncError}</span>
              ) : backendUser ? (
                <span className="text-sm text-green-500">✓ Synced</span>
              ) : (
                <span className="text-sm text-zinc-500">Not synced</span>
              )}
            </div>
            {backendUser && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">User ID</span>
                <span className="text-sm font-mono text-zinc-600 dark:text-zinc-400">
                  {backendUser.id.slice(0, 8)}...
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 flex gap-4">
          <Link
            href="/courses"
            className="px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-xl font-medium hover:opacity-80 transition-opacity"
          >
            Browse Courses
          </Link>
          {!hasPass && (
            <Link
              href="/mint"
              className="px-6 py-3 border border-zinc-300 dark:border-zinc-700 text-black dark:text-white rounded-xl font-medium hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
            >
              Get Student Pass
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
