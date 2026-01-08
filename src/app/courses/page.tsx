"use client";

import { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useAuth } from "@/hooks/useAuth";
import { usePassStatus } from "@/contexts/PassContext";
import { config } from "@/lib/config";
import { CoursesLoadingSkeleton } from "@/components/ui/CoursesLoadingSkeleton";
import Link from "next/link";

interface Course {
    id: string;
    title: string;
    description?: string;
    thumbnail_url?: string;
    duration_minutes?: number;
    difficulty?: string;
    is_gated: boolean;
    has_access: boolean;
}

interface CoursesResponse {
    courses: Course[];
    count: number;
    has_access: boolean;
}

export default function CoursesPage() {
    const { login, authenticated, ready, getAccessToken } = usePrivy();
    const { user: backendUser } = useAuth();
    const { hasPass } = usePassStatus();
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchCourses() {
            try {
                setLoading(true);

                const headers: Record<string, string> = {
                    "Content-Type": "application/json",
                };

                // Add auth token if available
                if (authenticated) {
                    try {
                        const token = await getAccessToken();
                        if (token) {
                            headers["Authorization"] = `Bearer ${token}`;
                        }
                    } catch (e) {
                        console.log("No token available");
                    }
                }

                const response = await fetch(`${config.api.baseUrl}/api/v1/public/courses`, {
                    headers,
                });

                if (!response.ok) {
                    console.error("Failed to fetch courses:", response.status);
                    // Don't throw - gracefully handle as empty list
                    setCourses([]);
                    setLoading(false);
                    return;
                }

                const data: CoursesResponse = await response.json();
                setCourses(data.courses || []);
                // PassContext is now the single source of truth for hasPass
            } catch (err) {
                console.error("Error fetching courses:", err);
                setError(err instanceof Error ? err.message : "Unknown error");
            } finally {
                setLoading(false);
            }
        }

        if (ready) {
            fetchCourses();
        }
    }, [ready, authenticated, getAccessToken, backendUser]);

    if (!ready || loading) {
        return <CoursesLoadingSkeleton count={9} />;
    }

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-black">
            {/* Header */}
            <div className="border-b border-zinc-200 dark:border-zinc-800">
                <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
                    <Link href="/" className="text-xl font-bold text-black dark:text-white">
                        🎓 Web3 Academy
                    </Link>
                    <div className="flex items-center gap-4">
                        {authenticated ? (
                            <>
                                {hasPass ? (
                                    <span className="text-sm text-green-600 dark:text-green-400">
                                        ✓ Student Pass Active
                                    </span>
                                ) : (
                                    <Link
                                        href="/mint"
                                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                                    >
                                        Get Student Pass
                                    </Link>
                                )}
                            </>
                        ) : (
                            <button
                                onClick={login}
                                className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-lg text-sm font-medium hover:opacity-80"
                            >
                                Login
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-6xl mx-auto px-6 py-8">
                <h1 className="text-3xl font-bold text-black dark:text-white mb-2">
                    Courses
                </h1>
                <p className="text-zinc-500 mb-8">
                    Learn Web3 development from beginner to advanced
                </p>

                {/* Info banner for unauthenticated users */}
                {!authenticated && courses.length > 0 && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
                        <div className="flex items-start gap-3">
                            <span className="text-xl">ℹ️</span>
                            <div>
                                <p className="text-blue-900 dark:text-blue-100 font-medium">
                                    Sign in to access courses
                                </p>
                                <p className="text-blue-700 dark:text-blue-300 text-sm mt-1">
                                    Browse our course catalog below. Click any course to learn more, or{" "}
                                    <button
                                        onClick={login}
                                        className="underline font-medium hover:text-blue-900 dark:hover:text-blue-100"
                                    >
                                        sign in
                                    </button>
                                    {" "}to get started.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
                        <p className="text-red-600 dark:text-red-400">{error}</p>
                    </div>
                )}

                {/* Course Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {courses.map((course) => {
                        const handleClick = (e: React.MouseEvent) => {
                            // If course is gated and user doesn't have access, redirect to login
                            if (course.is_gated && !course.has_access && !authenticated) {
                                e.preventDefault();
                                login();
                            }
                            // Otherwise, let the Link navigate normally
                        };

                        return (
                        <Link
                            key={course.id}
                            href={`/courses/${course.id}`}
                            onClick={handleClick}
                            className="group block bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                        >
                            {/* Thumbnail */}
                            <div className="aspect-video bg-zinc-100 dark:bg-zinc-800 relative">
                                {course.thumbnail_url ? (
                                    <img
                                        src={course.thumbnail_url}
                                        alt={course.title}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-4xl">
                                        📚
                                    </div>
                                )}

                                {/* Gated badge */}
                                {course.is_gated && !course.has_access && (
                                    <div className="absolute top-3 right-3 bg-black/70 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                                        🔒 Pass Required
                                    </div>
                                )}
                                {course.is_gated && course.has_access && (
                                    <div className="absolute top-3 right-3 bg-green-600/90 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                                        ✓ Unlocked
                                    </div>
                                )}
                            </div>

                            {/* Content */}
                            <div className="p-4">
                                <h2 className="font-semibold text-black dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                    {course.title}
                                </h2>
                                {course.description && (
                                    <p className="text-sm text-zinc-500 mt-1 line-clamp-2">
                                        {course.description}
                                    </p>
                                )}

                                {/* Meta */}
                                <div className="flex items-center gap-3 mt-3 text-xs text-zinc-400">
                                    {course.duration_minutes && (
                                        <span>⏱ {course.duration_minutes} min</span>
                                    )}
                                    {course.difficulty && (
                                        <span className="capitalize">📊 {course.difficulty}</span>
                                    )}
                                </div>
                            </div>
                        </Link>
                        );
                    })}
                </div>

                {courses.length === 0 && !loading && (
                    <div className="text-center py-12 text-zinc-500">
                        No courses available yet.
                    </div>
                )}
            </div>
        </div>
    );
}
