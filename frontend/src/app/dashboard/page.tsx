"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";

type User = {
    id: number;
    name: string;
    email: string;
    created_at: string;
};

type InterviewSession = {
    id: number;
    user_id: number;
    interview_type: string;
    role: string;
    difficulty: string;
    duration: number;
    status: string;
    created_at: string;
};

function StatCard({
    label,
    value,
    accentClass,
}: {
    label: string;
    value: number;
    accentClass: string;
}) {
    return (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                {label}
            </p>
            <p className={`mt-4 text-4xl font-bold ${accentClass}`}>{value}</p>
        </div>
    );
}

export default function DashboardPage() {
    const router = useRouter();
    const { token, logout } = useAuthStore();

    const [user, setUser] = useState<User | null>(null);
    const [sessions, setSessions] = useState<InterviewSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const [statusFilter, setStatusFilter] = useState("all");
    const [searchTerm, setSearchTerm] = useState("");
    const [sortOrder, setSortOrder] = useState("newest");

    useEffect(() => {
        if (!token) {
            router.push("/login");
            return;
        }

        const fetchDashboardData = async () => {
            try {
                const [userRes, sessionsRes] = await Promise.all([
                    api.get("/users/me", {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }),
                    api.get("/interviews/", {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }),
                ]);

                setUser(userRes.data);
                setSessions(sessionsRes.data);
            } catch (error) {
                console.error("Failed to fetch dashboard data:", error);
                logout();
                router.push("/login");
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, [token, router, logout]);

    const handleLogout = () => {
        logout();
        router.push("/login");
    };

    const handleDelete = async (sessionId: number) => {
        if (!token) return;

        const confirmed = window.confirm(
            "Are you sure you want to delete this interview session?"
        );

        if (!confirmed) return;

        setDeletingId(sessionId);

        try {
            await api.delete(`/interviews/${sessionId}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        } catch (error) {
            console.error("Failed to delete session:", error);
            alert("Failed to delete session.");
        } finally {
            setDeletingId(null);
        }
    };

    const handleOpenSession = (session: InterviewSession) => {
        if (session.status === "completed") {
            router.push(`/interview/${session.id}/report`);
        } else {
            router.push(`/interview/${session.id}`);
        }
    };

    const handleRetake = (session: InterviewSession) => {
        const query = new URLSearchParams({
            interview_type: session.interview_type,
            role: session.role,
            difficulty: session.difficulty,
            duration: String(session.duration),
        });

        router.push(`/interview/new?${query.toString()}`);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString([], {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
    };

    const getStatusClasses = (status: string) => {
        if (status === "completed") {
            return "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20";
        }

        if (status === "in_progress") {
            return "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20";
        }

        return "bg-slate-700/30 text-slate-300 border border-slate-700";
    };

    const filteredSessions = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();

        let result = sessions.filter((session) => {
            const matchesStatus =
                statusFilter === "all" || session.status === statusFilter;

            const matchesSearch =
                normalizedSearch === "" ||
                session.role.toLowerCase().includes(normalizedSearch) ||
                session.interview_type.toLowerCase().includes(normalizedSearch) ||
                session.difficulty.toLowerCase().includes(normalizedSearch);

            return matchesStatus && matchesSearch;
        });

        result = [...result].sort((a, b) => {
            const aTime = new Date(a.created_at).getTime();
            const bTime = new Date(b.created_at).getTime();

            return sortOrder === "newest" ? bTime - aTime : aTime - bTime;
        });

        return result;
    }, [sessions, statusFilter, searchTerm, sortOrder]);

    if (!token || loading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
                Loading dashboard...
            </main>
        );
    }

    const totalInterviews = sessions.length;
    const completedInterviews = sessions.filter(
        (s) => s.status === "completed"
    ).length;
    const inProgressInterviews = sessions.filter(
        (s) => s.status === "in_progress"
    ).length;

    return (
        <main className="min-h-screen bg-slate-950 text-white">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute left-[-8%] top-[-4%] h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
                <div className="absolute right-[-10%] top-[18%] h-80 w-80 rounded-full bg-fuchsia-500/10 blur-3xl" />
                <div className="absolute bottom-[-10%] left-[22%] h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
            </div>

            <div className="relative mx-auto max-w-6xl px-6 py-10">
                <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <div className="inline-flex items-center rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-cyan-300">
                            Dashboard
                        </div>

                        <h1 className="mt-4 text-4xl font-bold tracking-tight">
                            Welcome, {user?.name || "User"}
                        </h1>

                        <p className="mt-3 max-w-2xl text-slate-300">
                            Track your mock interviews, continue unfinished sessions, revisit
                            reports, and sharpen your preparation over time.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <Link
                            href="/interview/new"
                            className="rounded-xl bg-cyan-500 px-4 py-2.5 font-semibold text-slate-950 transition hover:bg-cyan-400"
                        >
                            Start Interview
                        </Link>

                        <button
                            onClick={handleLogout}
                            className="rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-2.5 font-medium text-slate-200 transition hover:bg-slate-800"
                        >
                            Logout
                        </button>
                    </div>
                </div>

                <div className="grid gap-6 md:grid-cols-3">
                    <StatCard
                        label="Total Interviews"
                        value={totalInterviews}
                        accentClass="text-cyan-400"
                    />
                    <StatCard
                        label="Completed"
                        value={completedInterviews}
                        accentClass="text-emerald-400"
                    />
                    <StatCard
                        label="In Progress"
                        value={inProgressInterviews}
                        accentClass="text-fuchsia-400"
                    />
                </div>

                <div className="mt-8 grid gap-6 lg:grid-cols-3">
                    <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur lg:col-span-1">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                            Profile
                        </p>

                        <div className="mt-5 space-y-3 text-slate-300">
                            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                                    Name
                                </p>
                                <p className="mt-1 font-medium text-white">{user?.name}</p>
                            </div>

                            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                                    Email
                                </p>
                                <p className="mt-1 break-all font-medium text-white">
                                    {user?.email}
                                </p>
                            </div>

                            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                                    User ID
                                </p>
                                <p className="mt-1 font-medium text-white">{user?.id}</p>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur lg:col-span-2">
                        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <h2 className="text-xl font-semibold">Interview History</h2>
                                <p className="mt-1 text-sm text-slate-400">
                                    Revisit past sessions, continue unfinished interviews, or
                                    retake older setups.
                                </p>
                            </div>

                            <div className="flex flex-col gap-3 sm:flex-row">
                                <input
                                    type="text"
                                    placeholder="Search by role, type, or difficulty"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-500"
                                />

                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none"
                                >
                                    <option value="all">All Sessions</option>
                                    <option value="in_progress">In Progress</option>
                                    <option value="completed">Completed</option>
                                </select>

                                <select
                                    value={sortOrder}
                                    onChange={(e) => setSortOrder(e.target.value)}
                                    className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none"
                                >
                                    <option value="newest">Newest First</option>
                                    <option value="oldest">Oldest First</option>
                                </select>
                            </div>
                        </div>

                        {filteredSessions.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950 p-10 text-center">
                                <p className="text-lg font-semibold text-white">
                                    {statusFilter === "all" && searchTerm.trim() === ""
                                        ? "No interviews yet"
                                        : "No matching sessions found"}
                                </p>

                                <p className="mt-2 text-slate-400">
                                    {statusFilter === "all" && searchTerm.trim() === ""
                                        ? "Start your first mock interview to build your history."
                                        : "Try adjusting your filters, changing the search term, or creating a new interview."}
                                </p>

                                <Link
                                    href="/interview/new"
                                    className="mt-5 inline-block rounded-xl bg-cyan-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-400"
                                >
                                    Start Interview
                                </Link>
                            </div>
                        ) : (
                            <>
                                <p className="mb-4 text-sm text-slate-500">
                                    Showing {filteredSessions.length} of {sessions.length} session
                                    {sessions.length === 1 ? "" : "s"}.
                                </p>

                                <div className="space-y-4">
                                    {filteredSessions.map((session) => (
                                        <div
                                            key={session.id}
                                            className="group rounded-2xl border border-slate-800 bg-slate-950/80 p-5 transition hover:border-slate-700 hover:bg-slate-950"
                                        >
                                            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                                                <div
                                                    className="cursor-pointer"
                                                    onClick={() => handleOpenSession(session)}
                                                >
                                                    <div className="flex flex-wrap items-center gap-3">
                                                        <h3 className="text-xl font-semibold capitalize text-white transition group-hover:text-cyan-300">
                                                            {session.interview_type} interview
                                                        </h3>

                                                        <span
                                                            className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusClasses(
                                                                session.status
                                                            )}`}
                                                        >
                                                            {session.status === "completed"
                                                                ? "Completed"
                                                                : "In Progress"}
                                                        </span>
                                                    </div>

                                                    <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-400">
                                                        <span className="rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1 capitalize">
                                                            {session.role}
                                                        </span>
                                                        <span className="rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1 capitalize">
                                                            {session.difficulty}
                                                        </span>
                                                        <span className="rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1">
                                                            {session.duration} min
                                                        </span>
                                                    </div>

                                                    <div className="mt-4 space-y-1 text-sm text-slate-500">
                                                        <p>Session ID: {session.id}</p>
                                                        <p>Created: {formatDate(session.created_at)}</p>
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap gap-3 xl:justify-end">
                                                    <button
                                                        onClick={() => handleOpenSession(session)}
                                                        className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
                                                    >
                                                        {session.status === "completed"
                                                            ? "View Report"
                                                            : "Continue"}
                                                    </button>

                                                    <button
                                                        onClick={() => handleRetake(session)}
                                                        className="rounded-xl border border-cyan-500/30 px-4 py-2 text-sm font-medium text-cyan-300 transition hover:bg-cyan-500/10"
                                                    >
                                                        Retake
                                                    </button>

                                                    <button
                                                        onClick={() => handleDelete(session.id)}
                                                        disabled={deletingId === session.id}
                                                        className="rounded-xl border border-red-500/30 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/10 disabled:opacity-60"
                                                    >
                                                        {deletingId === session.id ? "Deleting..." : "Delete"}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
}