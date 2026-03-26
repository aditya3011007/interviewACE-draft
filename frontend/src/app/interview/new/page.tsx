"use client";

import { AxiosError } from "axios";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";
import {
    JobDescriptionProfile,
    ResumeProfile,
} from "@/types/personalization";

function getErrorMessage(error: unknown, fallback: string) {
    if (error instanceof AxiosError) {
        const detail = (error.response?.data as { detail?: string } | undefined)?.detail;
        if (detail) {
            return detail;
        }
    }

    return fallback;
}

export default function NewInterviewPage() {
    const router = useRouter();
    const token = useAuthStore((state) => state.token);
    const searchParams = useSearchParams();

    const [form, setForm] = useState({
        interview_type: "technical",
        role: "software engineer",
        difficulty: "medium",
        duration: 30,
        resume_id: "",
        job_description_id: "",
    });

    const [resumes, setResumes] = useState<ResumeProfile[]>([]);
    const [jobDescriptions, setJobDescriptions] = useState<JobDescriptionProfile[]>([]);
    const [assetsLoading, setAssetsLoading] = useState(true);
    const [didAutoSelectPersonalization, setDidAutoSelectPersonalization] =
        useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const interview_type = searchParams.get("interview_type");
        const role = searchParams.get("role");
        const difficulty = searchParams.get("difficulty");
        const duration = searchParams.get("duration");
        const resume_id = searchParams.get("resume_id");
        const job_description_id = searchParams.get("job_description_id");

        setForm((prev) => ({
            interview_type: interview_type || prev.interview_type,
            role: role || prev.role,
            difficulty: difficulty || prev.difficulty,
            duration: duration ? Number(duration) : prev.duration,
            resume_id: resume_id || prev.resume_id,
            job_description_id: job_description_id || prev.job_description_id,
        }));
    }, [searchParams]);

    useEffect(() => {
        if (!token) {
            setAssetsLoading(false);
            return;
        }

        const fetchProfiles = async () => {
            try {
                const [resumeRes, jobDescriptionRes] = await Promise.all([
                    api.get("/profiles/resumes", {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }),
                    api.get("/profiles/job-descriptions", {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }),
                ]);

                setResumes(resumeRes.data || []);
                setJobDescriptions(jobDescriptionRes.data || []);
            } catch (fetchError) {
                console.error("Failed to fetch personalization assets:", fetchError);
            } finally {
                setAssetsLoading(false);
            }
        };

        fetchProfiles();
    }, [token]);

    useEffect(() => {
        if (assetsLoading || didAutoSelectPersonalization) {
            return;
        }

        const hasValidResumeSelection =
            !form.resume_id ||
            resumes.some((resume) => String(resume.id) === form.resume_id);
        const hasValidJobDescriptionSelection =
            !form.job_description_id ||
            jobDescriptions.some(
                (jobDescription) => String(jobDescription.id) === form.job_description_id
            );

        setForm((prev) => ({
            ...prev,
            resume_id:
                prev.resume_id && hasValidResumeSelection
                    ? prev.resume_id
                    : resumes.length > 0
                        ? String(resumes[0].id)
                        : "",
            job_description_id:
                prev.job_description_id && hasValidJobDescriptionSelection
                    ? prev.job_description_id
                    : jobDescriptions.length > 0
                        ? String(jobDescriptions[0].id)
                        : "",
        }));

        setDidAutoSelectPersonalization(true);
    }, [
        assetsLoading,
        didAutoSelectPersonalization,
        form.job_description_id,
        form.resume_id,
        jobDescriptions,
        resumes,
    ]);

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
            const payload = {
                ...form,
                resume_id: form.resume_id ? Number(form.resume_id) : null,
                job_description_id: form.job_description_id
                    ? Number(form.job_description_id)
                    : null,
            };

            const res = await api.post("/interviews/", payload, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (payload.interview_type === "hr_voice") {
                router.push(`/interview/${res.data.id}/hr-voice`);
            } else {
                router.push(`/interview/${res.data.id}`);
            }
        } catch (err: unknown) {
            console.error("Failed to create interview:", err);
            setError(getErrorMessage(err, "Failed to create interview."));
        } finally {
            setLoading(false);
        }
    };

    const estimatedQuestions =
        form.duration <= 15 ? 3 : form.duration <= 30 ? 5 : form.duration <= 45 ? 7 : 9;

    const selectedResume = useMemo(
        () => resumes.find((resume) => String(resume.id) === form.resume_id) || null,
        [resumes, form.resume_id]
    );
    const selectedJobDescription = useMemo(
        () =>
            jobDescriptions.find(
                (jobDescription) => String(jobDescription.id) === form.job_description_id
            ) || null,
        [jobDescriptions, form.job_description_id]
    );

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
                                        <option value="hr_voice">HR Voice</option>
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

                            <div className="grid gap-6 md:grid-cols-2">
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-300">
                                        Resume Context
                                    </label>
                                    <select
                                        name="resume_id"
                                        value={form.resume_id}
                                        onChange={handleChange}
                                        className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3.5 outline-none transition focus:border-cyan-500"
                                    >
                                        <option value="">No resume selected</option>
                                        {resumes.map((resume) => (
                                            <option key={resume.id} value={resume.id}>
                                                {resume.title}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="mt-2 text-sm text-slate-500">
                                        Give the interviewer your background so questions can target
                                        stronger story prompts.
                                    </p>
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-300">
                                        Job Description Context
                                    </label>
                                    <select
                                        name="job_description_id"
                                        value={form.job_description_id}
                                        onChange={handleChange}
                                        className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3.5 outline-none transition focus:border-cyan-500"
                                    >
                                        <option value="">No job description selected</option>
                                        {jobDescriptions.map((jobDescription) => (
                                            <option key={jobDescription.id} value={jobDescription.id}>
                                                {jobDescription.title}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="mt-2 text-sm text-slate-500">
                                        Anchor the mock interview to a real target role and skill
                                        profile.
                                    </p>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                                            Personalization
                                        </p>
                                        <h3 className="mt-2 text-xl font-semibold text-white">
                                            Optional context that sharpens the interview
                                        </h3>
                                        <p className="mt-2 max-w-2xl text-sm text-slate-400">
                                            The interview still works without saved documents, but
                                            adding them gives Gemini better hooks for role fit,
                                            resume stories, and follow-up depth.
                                        </p>
                                    </div>

                                    <Link
                                        href="/personalization"
                                        className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-300 transition hover:bg-cyan-500/15"
                                    >
                                        Manage Personalization
                                    </Link>
                                </div>

                                <div className="mt-5 grid gap-4 md:grid-cols-2">
                                    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                                            Resume context
                                        </p>
                                        <p className="mt-2 text-sm font-medium text-white">
                                            {selectedResume?.title || "None selected"}
                                        </p>
                                        <p className="mt-2 text-sm text-slate-400">
                                            {selectedResume?.extracted_profile.summary ||
                                                "Use a resume to steer behavioral probes and project follow-ups."}
                                        </p>
                                    </div>

                                    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                                            Job description context
                                        </p>
                                        <p className="mt-2 text-sm font-medium text-white">
                                            {selectedJobDescription?.title || "None selected"}
                                        </p>
                                        <p className="mt-2 text-sm text-slate-400">
                                            {selectedJobDescription?.extracted_profile.summary ||
                                                "Use a job description to target the exact role priorities you want to practice."}
                                        </p>
                                    </div>
                                </div>

                                {!assetsLoading &&
                                    resumes.length === 0 &&
                                    jobDescriptions.length === 0 && (
                                        <div className="mt-5 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                                            No saved resumes or job descriptions yet. You can still
                                            start a role-based session now, or add personalized
                                            context first.
                                        </div>
                                    )}
                            </div>

                            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                                    What happens next
                                </p>

                                <div className="mt-4 grid gap-4 md:grid-cols-3">
                                    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                                        <p className="text-sm font-medium text-white">AI interviewer</p>
                                        <p className="mt-2 text-sm text-slate-400">
                                            Generates a role-aware opening question and adaptive
                                            follow-ups.
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

                                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-4">
                                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                                        Personalization Status
                                    </p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <span
                                            className={`rounded-full px-3 py-1 text-sm ${selectedResume
                                                ? "bg-cyan-500/10 text-cyan-300"
                                                : "bg-slate-800 text-slate-400"
                                                }`}
                                        >
                                            {selectedResume ? "Resume linked" : "Resume optional"}
                                        </span>
                                        <span
                                            className={`rounded-full px-3 py-1 text-sm ${selectedJobDescription
                                                ? "bg-emerald-500/10 text-emerald-300"
                                                : "bg-slate-800 text-slate-400"
                                                }`}
                                        >
                                            {selectedJobDescription
                                                ? "JD linked"
                                                : "JD optional"}
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