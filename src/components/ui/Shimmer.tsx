/**
 * Reusable shimmer loading effect component
 */
export function Shimmer({ className = "" }: { className?: string }) {
  return (
    <div
      className={`bg-gradient-to-r from-zinc-100 via-zinc-200 to-zinc-100 dark:from-zinc-800 dark:via-zinc-700 dark:to-zinc-800 ${className}`}
      style={{
        animation: 'shimmer 2s infinite linear',
        backgroundSize: '1000px 100%',
      }}
    />
  );
}
