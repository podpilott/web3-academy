import { CourseCardSkeleton } from "./CourseCardSkeleton";

/**
 * Loading skeleton for courses page
 * Shows skeleton cards in responsive grid
 */
export function CoursesLoadingSkeleton({ count = 9 }: { count?: number }) {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      {/* Header - preserves navigation context */}
      <div className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="text-xl font-bold text-black dark:text-white">
            🎓 Web3 Academy
          </div>
          {/* Login/Pass button placeholder */}
          <div className="h-10 w-32 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse" />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Page title and description */}
        <h1 className="text-3xl font-bold text-black dark:text-white mb-2">
          Courses
        </h1>
        <p className="text-zinc-500 mb-8">
          Learn Web3 development from beginner to advanced
        </p>

        {/* Skeleton grid - matches grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: count }).map((_, index) => (
            <CourseCardSkeleton key={index} />
          ))}
        </div>
      </div>
    </div>
  );
}
