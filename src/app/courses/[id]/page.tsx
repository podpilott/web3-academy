"use client";

import { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useAuth } from "@/hooks/useAuth";
import { usePassStatus } from "@/contexts/PassContext";
import { config } from "@/lib/config";
import Link from "next/link";
import { useParams } from "next/navigation";

interface Course {
    id: string;
    title: string;
    description?: string;
    thumbnail_url?: string;
    duration_minutes?: number;
    difficulty?: string;
    is_gated: boolean;
    has_access: boolean;
    content_body?: string;
    video_url?: string;
}

export default function CourseDetailPage() {
    const { login, authenticated, ready, getAccessToken } = usePrivy();
    const { user: backendUser } = useAuth();
    const { hasPass: globalHasPass } = usePassStatus();
    const params = useParams();
    const courseId = params.id as string;

    const [course, setCourse] = useState<Course | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchCourse() {
            if (!courseId) return;

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

                const response = await fetch(
                    `${config.api.baseUrl}/api/v1/courses/${courseId}`,
                    { headers }
                );

                if (!response.ok) {
                    if (response.status === 404) {
                        throw new Error("Course not found");
                    }
                    throw new Error("Failed to fetch course");
                }

                const data: Course = await response.json();
                setCourse(data);
            } catch (err) {
                console.error("Error fetching course:", err);
                setError(err instanceof Error ? err.message : "Unknown error");
            } finally {
                setLoading(false);
            }
        }

        if (ready) {
            fetchCourse();
        }
    }, [ready, authenticated, getAccessToken, courseId, backendUser]);

    if (!ready || loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
                <div className="text-zinc-500">Loading course...</div>
            </div>
        );
    }

    if (error || !course) {
        return (
            <div className="min-h-screen bg-zinc-50 dark:bg-black">
                <div className="max-w-4xl mx-auto px-6 py-8">
                    <Link
                        href="/courses"
                        className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 mb-8 inline-block"
                    >
                        ← Back to Courses
                    </Link>
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
                        <p className="text-red-600 dark:text-red-400">
                            {error || "Course not found"}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-black">
            {/* Header */}
            <div className="border-b border-zinc-200 dark:border-zinc-800">
                <div className="max-w-4xl mx-auto px-6 py-4">
                    <Link
                        href="/courses"
                        className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                    >
                        ← Back to Courses
                    </Link>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-4xl mx-auto px-6 py-8">
                {/* Course Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-2 mb-2">
                        {course.is_gated && (
                            <span
                                className={`text-xs px-2 py-1 rounded ${course.has_access
                                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                                    }`}
                            >
                                {course.has_access ? "✓ Unlocked" : "🔒 Pass Required"}
                            </span>
                        )}
                        {course.difficulty && (
                            <span className="text-xs px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 capitalize">
                                {course.difficulty}
                            </span>
                        )}
                        {course.duration_minutes && (
                            <span className="text-xs text-zinc-500">
                                ⏱ {course.duration_minutes} min
                            </span>
                        )}
                    </div>

                    <h1 className="text-3xl font-bold text-black dark:text-white mb-4">
                        {course.title}
                    </h1>

                    {course.description && (
                        <p className="text-lg text-zinc-600 dark:text-zinc-400">
                            {course.description}
                        </p>
                    )}
                </div>

                {/* Gated Content - No Access */}
                {course.is_gated && !course.has_access && !globalHasPass && (
                    <div className="bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 text-center">
                        <div className="text-5xl mb-4">🔒</div>
                        <h2 className="text-xl font-semibold text-black dark:text-white mb-2">
                            This course requires a Student Pass
                        </h2>
                        <p className="text-zinc-500 mb-6">
                            Mint a Student Pass to unlock all gated courses on Web3 Academy
                        </p>

                        {authenticated ? (
                            <Link
                                href="/mint"
                                className="inline-block px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
                            >
                                Get Student Pass
                            </Link>
                        ) : (
                            <button
                                onClick={login}
                                className="px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-xl font-medium hover:opacity-80"
                            >
                                Login to Get Access
                            </button>
                        )}
                    </div>
                )}

                {/* Video */}
                {course.has_access && course.video_url && (
                    <div className="mb-8">
                        <div className="aspect-video bg-zinc-900 rounded-xl overflow-hidden">
                            {course.video_url.includes("youtube.com") ? (
                                <iframe
                                    className="w-full h-full"
                                    src={course.video_url.replace("watch?v=", "embed/")}
                                    title={course.title}
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                />
                            ) : (
                                <video
                                    className="w-full h-full"
                                    src={course.video_url}
                                    controls
                                />
                            )}
                        </div>
                    </div>
                )}

                {/* Content Body */}
                {course.has_access && course.content_body && (
                    <div className="prose prose-zinc dark:prose-invert max-w-none">
                        <div
                            className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6"
                            dangerouslySetInnerHTML={{
                                __html: course.content_body
                                    .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-8 mb-4">$1</h1>')
                                    .replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold mt-6 mb-3">$1</h2>')
                                    .replace(/^### (.*$)/gim, '<h3 class="text-lg font-medium mt-4 mb-2">$1</h3>')
                                    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
                                    .replace(/\n/gim, '<br/>')
                            }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
