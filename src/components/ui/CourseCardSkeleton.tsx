import { Shimmer } from "./Shimmer";

/**
 * Skeleton loader for course cards
 * Matches exact structure of actual CourseCard component
 */
export function CourseCardSkeleton() {
  return (
    <div className="block bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      {/* Thumbnail skeleton - aspect-video matches real cards */}
      <div className="aspect-video bg-zinc-100 dark:bg-zinc-800 relative overflow-hidden">
        <Shimmer className="absolute inset-0" />
      </div>

      {/* Content skeleton */}
      <div className="p-4">
        {/* Title skeleton */}
        <div className="mb-2">
          <Shimmer className="h-6 w-3/4 rounded" />
        </div>

        {/* Description skeleton (2 lines to match line-clamp-2) */}
        <div className="space-y-2 mb-3">
          <Shimmer className="h-4 w-full rounded" />
          <Shimmer className="h-4 w-5/6 rounded" />
        </div>

        {/* Meta information skeleton (duration + difficulty) */}
        <div className="flex items-center gap-3">
          <Shimmer className="h-3 w-16 rounded" />
          <Shimmer className="h-3 w-20 rounded" />
        </div>
      </div>
    </div>
  );
}
