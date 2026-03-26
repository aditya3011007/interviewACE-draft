"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";

type Feedback = {
    id: number;
    session_id: number;
    overall_score: number;
    communication_score: number;
    technical_score: number;
    problem_solving_score: number;
    confidence_score: number;
    strengths: string;
    improvements: string;
    summary: string;
    resume_jd_alignment_summary: string;
    standout_strengths: string[];
    weak_areas: string[];
    recommended_topics: string[];
    matched_strengths_for_job: string[];
    risky_gaps: string[];
    best_interview_stories: string[];
    next_practice_priorities: string[];
    question_count: number;
    created_at: string;
};

type Session = {
    id: number;
    user_id: number;
    interview_type: string;
    role: string;
    difficulty: string;
    duration: number;
    resume_id?: number | null;
    job_description_id?: number | null;
    resume_title?: string | null;
    job_description_title?: string | null;
    status: string;
    created_at: string;
};

type Evaluation = {
    id: number;
    session_id: number;
    question_index: number;
    question_text: string;
    answer_text: string;
    code_language?: string | null;
    code_submission?: string | null;
    overall_score: number;
    communication_score: number;
    technical_score: number;
    structure_score: number;
    confidence_score: number;
    relevance_score: number;
    code_quality_score?: number | null;
    strengths: string;
    improvements: string;
    missed_opportunities: string;
    ideal_answer: string;
    code_feedback?: string | null;
    critic_summary?: string | null;
    recommended_topics: string[];
    created_at: string;
};

function ScoreCard({
    label,
    value,
    accentClass,
}: {
    label: string;
    value: number;
    accentClass: string;
}) {
    return (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                {label}
            </p>
            <p className={`mt-3 text-3xl font-bold ${accentClass}`}>{value}</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                    className={`h-full rounded-full ${accentClass.replace("text-", "bg-")}`}
                    style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
                />
            </div>
        </div>
    );
}

export default function InterviewReportPage() {
    const params = useParams();
    const router = useRouter();
    const token = useAuthStore((state) => state.token);

    const [feedback, setFeedback] = useState<Feedback | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!token) {
            router.push("/login");
            return;
        }

        const fetchData = async () => {
            try {
                const [feedbackRes, sessionRes, evalRes] = await Promise.all([
                    api.get(`/interviews/${params.id}/feedback`, {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }),
                    api.get(`/interviews/${params.id}`, {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }),
                    api.get(`/interviews/${params.id}/evaluations`, {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }),
                ]);

                setFeedback(feedbackRes.data);
                setSession(sessionRes.data);
                setEvaluations(evalRes.data);
            } catch (error) {
                console.error("Failed to fetch feedback:", error);
                router.push("/dashboard");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [params.id, token, router]);

    const reportDate = useMemo(() => {
        if (!feedback?.created_at) return "";
        return new Date(feedback.created_at).toLocaleString();
    }, [feedback?.created_at]);

    const retakeHref = useMemo(() => {
        if (!session) return "/interview/new";

        const query = new URLSearchParams({
            interview_type: session.interview_type,
            role: session.role,
            difficulty: session.difficulty,
            duration: String(session.duration),
        });

        if (session.resume_id) {
            query.set("resume_id", String(session.resume_id));
        }
        if (session.job_description_id) {
            query.set("job_description_id", String(session.job_description_id));
        }

        return `/interview/new?${query.toString()}`;
    }, [session]);

    if (loading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
                Loading feedback report...
            </main>
        );
    }

    if (!feedback || !session) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
                Feedback not found.
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-950 text-white">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute left-[-10%] top-[-5%] h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
                <div className="absolute right-[-8%] top-[18%] h-80 w-80 rounded-full bg-fuchsia-500/10 blur-3xl" />
                <div className="absolute bottom-[-8%] left-[20%] h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
            </div>

            <div className="relative mx-auto max-w-6xl px-6 py-10">
                <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <div className="inline-flex items-center rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-cyan-300">
                            Interview Report
                        </div>

                        <h1 className="mt-4 text-4xl font-bold tracking-tight">
                            Session #{feedback.session_id}
                        </h1>

                        <p className="mt-3 max-w-2xl text-slate-300">
                            This report combines answer-by-answer scoring, final session
                            synthesis, and targeted next-practice guidance.
                        </p>

                        <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-400">
                            <span className="rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1">
                                {session.interview_type}
                            </span>
                            <span className="rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1 capitalize">
                                {session.role}
                            </span>
                            <span className="rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1 capitalize">
                                {session.difficulty}
                            </span>
                            <span className="rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1">
                                {feedback.question_count} evaluated answers
                            </span>
                            {session.resume_title && (
                                <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-cyan-300">
                                    Resume: {session.resume_title}
                                </span>
                            )}
                            {session.job_description_title && (
                                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-emerald-300">
                                    JD: {session.job_description_title}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <Link
                            href="/dashboard"
                            className="rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-2.5 font-medium text-slate-200 transition hover:bg-slate-800"
                        >
                            Back to Dashboard
                        </Link>

                        <Link
                            href={retakeHref}
                            className="rounded-xl bg-cyan-500 px-4 py-2.5 font-semibold text-slate-950 transition hover:bg-cyan-400"
                        >
                            Retake Interview
                        </Link>
                    </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-12">
                    <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur lg:col-span-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                            Overall Score
                        </p>

                        <div className="mt-5 flex items-end gap-3">
                            <span className="text-7xl font-bold leading-none text-cyan-400">
                                {feedback.overall_score}
                            </span>
                            <span className="pb-2 text-lg text-slate-400">/100</span>
                        </div>

                        <div className="mt-6 h-3 overflow-hidden rounded-full bg-slate-800">
                            <div
                                className="h-full rounded-full bg-cyan-400"
                                style={{
                                    width: `${Math.min(Math.max(feedback.overall_score, 0), 100)}%`,
                                }}
                            />
                        </div>

                        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
                            Report generated: {reportDate || "--"}
                        </div>
                    </div>

                    <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur lg:col-span-8">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                            Executive Summary
                        </p>
                        <h2 className="mt-3 text-2xl font-semibold">What this interview says</h2>
                        <p className="mt-4 text-lg leading-8 text-slate-300">
                            {feedback.summary}
                        </p>

                        <div className="mt-8 rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/12 to-cyan-500/12 p-5">
                            <p className="text-sm uppercase tracking-[0.18em] text-emerald-300">
                                Interview Completed
                            </p>
                            <p className="mt-2 text-slate-200">
                                Your session has been fully evaluated with answer-level review and
                                a final aggregate report.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                    <ScoreCard
                        label="Communication"
                        value={feedback.communication_score}
                        accentClass="text-cyan-400"
                    />
                    <ScoreCard
                        label="Technical"
                        value={feedback.technical_score}
                        accentClass="text-emerald-400"
                    />
                    <ScoreCard
                        label="Problem Solving"
                        value={feedback.problem_solving_score}
                        accentClass="text-fuchsia-400"
                    />
                    <ScoreCard
                        label="Confidence"
                        value={feedback.confidence_score}
                        accentClass="text-amber-400"
                    />
                </div>

                <div className="mt-8 grid gap-6 lg:grid-cols-3">
                    <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
                        <h3 className="text-xl font-semibold text-emerald-300">
                            Standout Strengths
                        </h3>
                        <div className="mt-4 flex flex-wrap gap-2">
                            {feedback.standout_strengths.length > 0 ? (
                                feedback.standout_strengths.map((item) => (
                                    <span
                                        key={item}
                                        className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-300"
                                    >
                                        {item}
                                    </span>
                                ))
                            ) : (
                                <p className="text-slate-400">No standout strengths recorded.</p>
                            )}
                        </div>
                    </div>

                    <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
                        <h3 className="text-xl font-semibold text-amber-300">Weak Areas</h3>
                        <div className="mt-4 flex flex-wrap gap-2">
                            {feedback.weak_areas.length > 0 ? (
                                feedback.weak_areas.map((item) => (
                                    <span
                                        key={item}
                                        className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-sm text-amber-300"
                                    >
                                        {item}
                                    </span>
                                ))
                            ) : (
                                <p className="text-slate-400">No weak areas recorded.</p>
                            )}
                        </div>
                    </div>

                    <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
                        <h3 className="text-xl font-semibold text-cyan-300">
                            Recommended Topics
                        </h3>
                        <div className="mt-4 flex flex-wrap gap-2">
                            {feedback.recommended_topics.length > 0 ? (
                                feedback.recommended_topics.map((item) => (
                                    <span
                                        key={item}
                                        className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-sm text-cyan-300"
                                    >
                                        {item}
                                    </span>
                                ))
                            ) : (
                                <p className="text-slate-400">No recommendations available.</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-8 grid gap-6 lg:grid-cols-2">
                    <div className="rounded-3xl border border-cyan-500/20 bg-cyan-500/10 p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
                        <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">
                            Resume vs JD alignment
                        </p>
                        <p className="mt-4 leading-8 text-slate-200">
                            {feedback.resume_jd_alignment_summary}
                        </p>
                    </div>

                    <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                            Best stories to use
                        </p>
                        <div className="mt-4 space-y-3">
                            {feedback.best_interview_stories.map((story) => (
                                <div
                                    key={story}
                                    className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-slate-200"
                                >
                                    {story}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mt-8 grid gap-6 lg:grid-cols-2">
                    <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
                        <h3 className="text-xl font-semibold text-emerald-300">
                            Matched strengths for this job
                        </h3>
                        <div className="mt-4 flex flex-wrap gap-2">
                            {feedback.matched_strengths_for_job.map((item) => (
                                <span
                                    key={item}
                                    className="rounded-full border border-emerald-500/20 bg-emerald-500/15 px-3 py-1 text-sm text-emerald-200"
                                >
                                    {item}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
                        <h3 className="text-xl font-semibold text-red-300">Risky gaps</h3>
                        <div className="mt-4 space-y-3">
                            {feedback.risky_gaps.map((item) => (
                                <div
                                    key={item}
                                    className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-slate-200"
                                >
                                    {item}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mt-8 rounded-3xl border border-fuchsia-500/20 bg-fuchsia-500/10 p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
                    <p className="text-xs uppercase tracking-[0.18em] text-fuchsia-300">
                        Next practice priorities
                    </p>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                        {feedback.next_practice_priorities.map((item) => (
                            <div
                                key={item}
                                className="rounded-2xl border border-fuchsia-500/20 bg-slate-950/70 p-4 text-slate-200"
                            >
                                {item}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mt-8 grid gap-6 lg:grid-cols-2">
                    <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
                        <h3 className="text-2xl font-semibold text-emerald-300">Strengths</h3>
                        <p className="mt-5 leading-8 text-slate-300">{feedback.strengths}</p>
                    </div>

                    <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
                        <h3 className="text-2xl font-semibold text-amber-300">Improvements</h3>
                        <p className="mt-5 leading-8 text-slate-300">{feedback.improvements}</p>
                    </div>
                </div>

                <div className="mt-10 rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
                    <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                                Question-by-question analysis
                            </p>
                            <h3 className="mt-2 text-2xl font-semibold">
                                Per-answer breakdown
                            </h3>
                        </div>
                        <p className="text-sm text-slate-400">
                            {evaluations.length} evaluated answer{evaluations.length === 1 ? "" : "s"}
                        </p>
                    </div>

                    <div className="space-y-6">
                        {evaluations.map((evaluation) => (
                            <div
                                key={evaluation.id}
                                className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6"
                            >
                                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                                            Question {evaluation.question_index}
                                        </p>
                                        <h4 className="mt-2 text-lg font-semibold text-white">
                                            {evaluation.question_text}
                                        </h4>
                                    </div>

                                    <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-sm font-medium text-cyan-300">
                                        {evaluation.overall_score}/100
                                    </span>
                                </div>

                                <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                                        Your answer
                                    </p>
                                    <p className="mt-2 leading-7 text-slate-300">
                                        {evaluation.answer_text}
                                    </p>
                                </div>

                                {evaluation.code_submission && (
                                    <div className="mt-5 rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/10 p-5">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div>
                                                <p className="text-xs uppercase tracking-[0.16em] text-fuchsia-300">
                                                    Submitted code
                                                </p>
                                                <p className="mt-2 text-sm text-slate-200">
                                                    {evaluation.code_language
                                                        ? `Language: ${evaluation.code_language}`
                                                        : "Code submission"}
                                                </p>
                                            </div>
                                            {evaluation.code_quality_score !== null &&
                                                evaluation.code_quality_score !== undefined && (
                                                    <span className="rounded-full border border-slate-800 bg-slate-950 px-3 py-1 text-sm font-medium text-fuchsia-300">
                                                        {evaluation.code_quality_score}/100
                                                    </span>
                                                )}
                                        </div>
                                        <pre className="mt-4 overflow-x-auto whitespace-pre-wrap rounded-2xl border border-slate-800 bg-slate-950/80 p-4 text-sm leading-6 text-slate-200">
                                            <code>{evaluation.code_submission}</code>
                                        </pre>
                                        {evaluation.code_feedback && (
                                            <p className="mt-4 leading-7 text-slate-200">
                                                {evaluation.code_feedback}
                                            </p>
                                        )}
                                    </div>
                                )}

                                <div className="mt-5 grid gap-4 md:grid-cols-5">
                                    <div className="rounded-2xl bg-slate-900/70 p-4">
                                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                                            Comm
                                        </p>
                                        <p className="mt-2 text-2xl font-bold text-cyan-300">
                                            {evaluation.communication_score}
                                        </p>
                                    </div>
                                    <div className="rounded-2xl bg-slate-900/70 p-4">
                                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                                            Tech
                                        </p>
                                        <p className="mt-2 text-2xl font-bold text-emerald-300">
                                            {evaluation.technical_score}
                                        </p>
                                    </div>
                                    <div className="rounded-2xl bg-slate-900/70 p-4">
                                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                                            Structure
                                        </p>
                                        <p className="mt-2 text-2xl font-bold text-fuchsia-300">
                                            {evaluation.structure_score}
                                        </p>
                                    </div>
                                    <div className="rounded-2xl bg-slate-900/70 p-4">
                                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                                            Confidence
                                        </p>
                                        <p className="mt-2 text-2xl font-bold text-amber-300">
                                            {evaluation.confidence_score}
                                        </p>
                                    </div>
                                    <div className="rounded-2xl bg-slate-900/70 p-4">
                                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                                            Relevance
                                        </p>
                                        <p className="mt-2 text-2xl font-bold text-indigo-300">
                                            {evaluation.relevance_score}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-6 grid gap-6 lg:grid-cols-2">
                                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5">
                                        <p className="text-xs uppercase tracking-[0.16em] text-emerald-300">
                                            What worked
                                        </p>
                                        <p className="mt-3 leading-7 text-slate-200">
                                            {evaluation.strengths}
                                        </p>
                                    </div>

                                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5">
                                        <p className="text-xs uppercase tracking-[0.16em] text-amber-300">
                                            Improve next time
                                        </p>
                                        <p className="mt-3 leading-7 text-slate-200">
                                            {evaluation.improvements}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-6 grid gap-6 lg:grid-cols-2">
                                    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                                            Missed opportunity
                                        </p>
                                        <p className="mt-3 leading-7 text-slate-300">
                                            {evaluation.missed_opportunities}
                                        </p>
                                    </div>

                                    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                                            Better answer shape
                                        </p>
                                        <p className="mt-3 leading-7 text-slate-300">
                                            {evaluation.ideal_answer}
                                        </p>
                                    </div>
                                </div>

                                {evaluation.critic_summary && (
                                    <div className="mt-6 rounded-2xl border border-indigo-500/20 bg-indigo-500/10 p-5">
                                        <p className="text-xs uppercase tracking-[0.16em] text-indigo-300">
                                            Critic audit
                                        </p>
                                        <p className="mt-3 leading-7 text-slate-200">
                                            {evaluation.critic_summary}
                                        </p>
                                    </div>
                                )}

                                {evaluation.recommended_topics.length > 0 && (
                                    <div className="mt-5">
                                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                                            Practice next
                                        </p>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {evaluation.recommended_topics.map((topic) => (
                                                <span
                                                    key={topic}
                                                    className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-sm text-cyan-300"
                                                >
                                                    {topic}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </main>
    );
}