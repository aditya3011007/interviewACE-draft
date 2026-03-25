"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";

export default function NewInterviewPage() {
    const router = useRouter();
    const token = useAuthStore((state) => state.token);
    const searchParams = useSearchParams();

    const [form, setForm] = useState({
        interview_type: "technical",
        role: "software engineer",
        difficulty: "medium",
        duration: 30,
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const interview_type = searchParams.get("interview_type");
        const role = searchParams.get("role");
        const difficulty = searchParams.get("difficulty");
        const duration = searchParams.get("duration");

        setForm((prev) => ({
            interview_type: interview_type || prev.interview_type,
            role: role || prev.role,
            difficulty: difficulty || prev.difficulty,
            duration: duration ? Number(duration) : prev.duration,
        }));
    }, [searchParams]);

    const handleChange = (
        e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>
    ) => {
        const { name, value } = e.target;

        setForm((prev) => ({
            ...prev,
            [name]: name === "duration" ? Number(value) : value,
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!token) {
            router.push("/login");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const res = await api.post("/interviews/", form, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            router.push(`/interview/${res.data.id}`);
        } catch (err: any) {
            console.error("Failed to create interview:", err);
            setError(err?.response?.data?.detail || "Failed to create interview.");
        } finally {
            setLoading(false);
        }
    };

    const estimatedQuestions =
        form.duration <= 15 ? 3 : form.duration <= 30 ? 5 : form.duration <= 45 ? 7 : 9;

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
                            New Interview
                        </div>

                        <h1 className="mt-4 text-4xl font-bold tracking-tight">
                            Configure your next mock interview
                        </h1>

                        <p className="mt-3 max-w-2xl text-slate-300">
                            Choose the interview type, role focus, difficulty, and session
                            length. Your AI interviewer will adapt questions and evaluation
                            around this setup.
                        </p>
                    </div>

                    <button
                        onClick={() => router.push("/dashboard")}
                        className="rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-2.5 font-medium text-slate-200 transition hover:bg-slate-800"
                    >
                        Back to Dashboard
                    </button>
                </div>

                <div className="grid gap-6 xl:grid-cols-12">
                    <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur xl:col-span-7">
                        <div className="mb-8">
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                                Interview Setup
                            </p>
                            <h2 className="mt-3 text-2xl font-semibold">
                                Create a session tailored to your practice goal
                            </h2>
                        </div>

                        {error && (
                            <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid gap-6 md:grid-cols-2">
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-300">
                                        Interview Type
                                    </label>
                                    <select
                                        name="interview_type"
                                        value={form.interview_type}
                                        onChange={handleChange}
                                        className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3.5 outline-none transition focus:border-cyan-500"
                                    >
                                        <option value="technical">Technical</option>
                                        <option value="behavioral">Behavioral</option>
                                        <option value="mixed">Mixed</option>
                                    </select>
                                    <p className="mt-2 text-sm text-slate-500">
                                        Pick the style of questioning you want to practice.
                                    </p>
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-300">
                                        Target Role
                                    </label>
                                    <select
                                        name="role"
                                        value={form.role}
                                        onChange={handleChange}
                                        className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3.5 outline-none transition focus:border-cyan-500"
                                    >
                                        <option value="software engineer">Software Engineer</option>
                                        <option value="full stack engineer">Full Stack Engineer</option>
                                        <option value="ml engineer">ML Engineer</option>
                                        <option value="data engineer">Data Engineer</option>
                                    </select>
                                    <p className="mt-2 text-sm text-slate-500">
                                        Questions and evaluation will align with this role.
                                    </p>
                                </div>
                            </div>

                            <div className="grid gap-6 md:grid-cols-2">
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-300">
                                        Difficulty
                                    </label>
                                    <select
                                        name="difficulty"
                                        value={form.difficulty}
                                        onChange={handleChange}
                                        className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3.5 outline-none transition focus:border-cyan-500"
                                    >
                                        <option value="easy">Easy</option>
                                        <option value="medium">Medium</option>
                                        <option value="hard">Hard</option>
                                    </select>
                                    <p className="mt-2 text-sm text-slate-500">
                                        Controls the depth and challenge level of the interview.
                                    </p>
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-300">
                                        Duration (minutes)
                                    </label>
                                    <input
                                        type="number"
                                        name="duration"
                                        min={5}
                                        max={90}
                                        value={form.duration}
                                        onChange={handleChange}
                                        className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3.5 outline-none transition focus:border-cyan-500"
                                    />
                                    <p className="mt-2 text-sm text-slate-500">
                                        Shorter sessions are quicker drills. Longer sessions allow
                                        deeper follow-ups.
                                    </p>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                                    What happens next
                                </p>

                                <div className="mt-4 grid gap-4 md:grid-cols-3">
                                    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                                        <p className="text-sm font-medium text-white">AI interviewer</p>
                                        <p className="mt-2 text-sm text-slate-400">
                                            Generates a role-aware opening question and adaptive follow-ups.
                                        </p>
                                    </div>

                                    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                                        <p className="text-sm font-medium text-white">Live evaluation</p>
                                        <p className="mt-2 text-sm text-slate-400">
                                            Each answer receives structured feedback and score analysis.
                                        </p>
                                    </div>

                                    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                                        <p className="text-sm font-medium text-white">Final report</p>
                                        <p className="mt-2 text-sm text-slate-400">
                                            Get strengths, weak areas, and suggested next-practice topics.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full rounded-2xl bg-cyan-500 px-4 py-3.5 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {loading ? "Creating interview..." : "Create Interview Session"}
                            </button>
                        </form>
                    </div>

                    <div className="space-y-6 xl:col-span-5">
                        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                                Session Preview
                            </p>

                            <h3 className="mt-3 text-2xl font-semibold capitalize">
                                {form.interview_type} interview
                            </h3>

                            <div className="mt-5 flex flex-wrap gap-2">
                                <span className="rounded-full border border-slate-800 bg-slate-950/70 px-3 py-1 text-sm capitalize text-slate-300">
                                    {form.role}
                                </span>
                                <span className="rounded-full border border-slate-800 bg-slate-950/70 px-3 py-1 text-sm capitalize text-slate-300">
                                    {form.difficulty}
                                </span>
                                <span className="rounded-full border border-slate-800 bg-slate-950/70 px-3 py-1 text-sm text-slate-300">
                                    {form.duration} min
                                </span>
                            </div>

                            <div className="mt-6 space-y-4">
                                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-4">
                                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                                        Estimated Questions
                                    </p>
                                    <p className="mt-2 text-3xl font-bold text-cyan-400">
                                        {estimatedQuestions}
                                    </p>
                                </div>

                                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-4">
                                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                                        Evaluation Focus
                                    </p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-sm text-cyan-300">
                                            Communication
                                        </span>
                                        <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-sm text-emerald-300">
                                            Technical Depth
                                        </span>
                                        <span className="rounded-full bg-fuchsia-500/10 px-3 py-1 text-sm text-fuchsia-300">
                                            Structure
                                        </span>
                                        <span className="rounded-full bg-amber-500/10 px-3 py-1 text-sm text-amber-300">
                                            Confidence
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                                Tips
                            </p>

                            <div className="mt-4 space-y-4 text-sm text-slate-300">
                                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                                    Give answers with clear reasoning, not just short final conclusions.
                                </div>
                                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                                    Use project examples, tradeoffs, and outcomes whenever possible.
                                </div>
                                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                                    If you are retaking a session, try improving the weak areas from your last report.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}