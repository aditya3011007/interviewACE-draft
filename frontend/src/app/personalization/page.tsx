"use client";

import { AxiosError } from "axios";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import {
    JobDescriptionProfile,
    ProfileComparison,
    ResumeProfile,
} from "@/types/personalization";

function SectionChip({
    label,
    accentClass,
}: {
    label: string;
    accentClass: string;
}) {
    return (
        <span className={`rounded-full px-3 py-1 text-sm ${accentClass}`}>{label}</span>
    );
}

function getErrorMessage(error: unknown, fallback: string) {
    if (error instanceof AxiosError) {
        const detail = (error.response?.data as { detail?: string } | undefined)?.detail;
        if (detail) {
            return detail;
        }
    }

    return fallback;
}

type TextFormState = {
    title: string;
    raw_text: string;
};

export default function PersonalizationPage() {
    const router = useRouter();
    const token = useAuthStore((state) => state.token);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [resumes, setResumes] = useState<ResumeProfile[]>([]);
    const [jobDescriptions, setJobDescriptions] = useState<JobDescriptionProfile[]>([]);

    const [resumeForm, setResumeForm] = useState<TextFormState>({
        title: "",
        raw_text: "",
    });
    const [jobDescriptionForm, setJobDescriptionForm] = useState<TextFormState>({
        title: "",
        raw_text: "",
    });

    const [resumeUploadTitle, setResumeUploadTitle] = useState("");
    const [jobDescriptionUploadTitle, setJobDescriptionUploadTitle] = useState("");
    const [resumeFile, setResumeFile] = useState<File | null>(null);
    const [jobDescriptionFile, setJobDescriptionFile] = useState<File | null>(null);

    const [savingResume, setSavingResume] = useState(false);
    const [savingJobDescription, setSavingJobDescription] = useState(false);
    const [uploadingResume, setUploadingResume] = useState(false);
    const [uploadingJobDescription, setUploadingJobDescription] = useState(false);
    const [deletingKey, setDeletingKey] = useState("");
    const [comparisonResumeId, setComparisonResumeId] = useState("");
    const [comparisonJobDescriptionId, setComparisonJobDescriptionId] = useState("");
    const [comparisonLoading, setComparisonLoading] = useState(false);
    const [comparison, setComparison] = useState<ProfileComparison | null>(null);

    const fetchProfiles = async (authToken: string) => {
        const [resumeRes, jobDescriptionRes] = await Promise.all([
            api.get("/profiles/resumes", {
                headers: {
                    Authorization: `Bearer ${authToken}`,
                },
            }),
            api.get("/profiles/job-descriptions", {
                headers: {
                    Authorization: `Bearer ${authToken}`,
                },
            }),
        ]);

        setResumes(resumeRes.data || []);
        setJobDescriptions(jobDescriptionRes.data || []);
    };

    useEffect(() => {
        if (!token) {
            router.push("/login");
            return;
        }

        const loadPage = async () => {
            try {
                await fetchProfiles(token);
            } catch (loadError) {
                console.error("Failed to load personalization data:", loadError);
                setError("Failed to load personalization assets.");
            } finally {
                setLoading(false);
            }
        };

        loadPage();
    }, [token, router]);

    const totalAssets = resumes.length + jobDescriptions.length;
    const selectedResume = useMemo(() => resumes[0] || null, [resumes]);
    const selectedJobDescription = useMemo(
        () => jobDescriptions[0] || null,
        [jobDescriptions]
    );

    useEffect(() => {
        if (!comparisonResumeId && resumes.length > 0) {
            setComparisonResumeId(String(resumes[0].id));
        }
    }, [resumes, comparisonResumeId]);

    useEffect(() => {
        if (!comparisonJobDescriptionId && jobDescriptions.length > 0) {
            setComparisonJobDescriptionId(String(jobDescriptions[0].id));
        }
    }, [jobDescriptions, comparisonJobDescriptionId]);

    const handleSaveResumeText = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token) return;

        setSavingResume(true);
        setError("");

        try {
            await api.post("/profiles/resumes", resumeForm, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            setResumeForm({ title: "", raw_text: "" });
            await fetchProfiles(token);
        } catch (saveError: unknown) {
            console.error("Failed to save resume:", saveError);
            setError(getErrorMessage(saveError, "Failed to save resume."));
        } finally {
            setSavingResume(false);
        }
    };

    const handleSaveJobDescriptionText = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token) return;

        setSavingJobDescription(true);
        setError("");

        try {
            await api.post("/profiles/job-descriptions", jobDescriptionForm, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            setJobDescriptionForm({ title: "", raw_text: "" });
            await fetchProfiles(token);
        } catch (saveError: unknown) {
            console.error("Failed to save job description:", saveError);
            setError(getErrorMessage(saveError, "Failed to save job description."));
        } finally {
            setSavingJobDescription(false);
        }
    };

    const handleUploadResume = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token || !resumeFile) return;

        const formData = new FormData();
        formData.append("file", resumeFile);
        if (resumeUploadTitle.trim()) {
            formData.append("title", resumeUploadTitle.trim());
        }

        setUploadingResume(true);
        setError("");

        try {
            await api.post("/profiles/resumes/upload", formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "multipart/form-data",
                },
            });
            setResumeFile(null);
            setResumeUploadTitle("");
            await fetchProfiles(token);
        } catch (uploadError: unknown) {
            console.error("Failed to upload resume:", uploadError);
            setError(getErrorMessage(uploadError, "Failed to upload resume."));
        } finally {
            setUploadingResume(false);
        }
    };

    const handleUploadJobDescription = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token || !jobDescriptionFile) return;

        const formData = new FormData();
        formData.append("file", jobDescriptionFile);
        if (jobDescriptionUploadTitle.trim()) {
            formData.append("title", jobDescriptionUploadTitle.trim());
        }

        setUploadingJobDescription(true);
        setError("");

        try {
            await api.post("/profiles/job-descriptions/upload", formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "multipart/form-data",
                },
            });
            setJobDescriptionFile(null);
            setJobDescriptionUploadTitle("");
            await fetchProfiles(token);
        } catch (uploadError: unknown) {
            console.error("Failed to upload job description:", uploadError);
            setError(
                getErrorMessage(uploadError, "Failed to upload job description.")
            );
        } finally {
            setUploadingJobDescription(false);
        }
    };

    const handleDelete = async (kind: "resume" | "job-description", id: number) => {
        if (!token) return;

        const confirmed = window.confirm(
            `Delete this ${kind === "resume" ? "resume" : "job description"} profile?`
        );
        if (!confirmed) return;

        const key = `${kind}-${id}`;
        setDeletingKey(key);
        setError("");

        try {
            const path =
                kind === "resume"
                    ? `/profiles/resumes/${id}`
                    : `/profiles/job-descriptions/${id}`;
            await api.delete(path, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            await fetchProfiles(token);
        } catch (deleteError: unknown) {
            console.error("Failed to delete profile:", deleteError);
            setError(getErrorMessage(deleteError, "Failed to delete profile."));
        } finally {
            setDeletingKey("");
        }
    };

    const handleCompare = async () => {
        if (!token || !comparisonResumeId || !comparisonJobDescriptionId) return;

        setComparisonLoading(true);
        setError("");

        try {
            const response = await api.get(
                `/profiles/compare?resume_id=${comparisonResumeId}&job_description_id=${comparisonJobDescriptionId}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );
            setComparison(response.data);
        } catch (comparisonError: unknown) {
            console.error("Failed to compare profiles:", comparisonError);
            setError(
                getErrorMessage(
                    comparisonError,
                    "Failed to compare resume and job description."
                )
            );
        } finally {
            setComparisonLoading(false);
        }
    };

    if (!token || loading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
                Loading personalization...
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-950 text-white">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute left-[-8%] top-[-4%] h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
                <div className="absolute right-[-10%] top-[18%] h-80 w-80 rounded-full bg-fuchsia-500/10 blur-3xl" />
                <div className="absolute bottom-[-10%] left-[22%] h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
            </div>

            <div className="relative mx-auto max-w-7xl px-6 py-10">
                <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                        <div className="inline-flex items-center rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-cyan-300">
                            Personalization
                        </div>

                        <h1 className="mt-4 text-4xl font-bold tracking-tight">
                            Resume and job context
                        </h1>

                        <p className="mt-3 max-w-3xl text-slate-300">
                            Save your resume and target job descriptions so interviews can probe
                            the right stories, skill gaps, and role priorities.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <Link
                            href="/dashboard"
                            className="rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-2.5 font-medium text-slate-200 transition hover:bg-slate-800"
                        >
                            Back to Dashboard
                        </Link>
                        <Link
                            href="/interview/new"
                            className="rounded-xl bg-cyan-500 px-4 py-2.5 font-semibold text-slate-950 transition hover:bg-cyan-400"
                        >
                            Start Personalized Interview
                        </Link>
                    </div>
                </div>

                {error && (
                    <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                        {error}
                    </div>
                )}

                <div className="grid gap-6 md:grid-cols-3">
                    <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                            Total assets
                        </p>
                        <p className="mt-4 text-4xl font-bold text-cyan-400">{totalAssets}</p>
                    </div>
                    <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                            Resumes
                        </p>
                        <p className="mt-4 text-4xl font-bold text-emerald-400">
                            {resumes.length}
                        </p>
                    </div>
                    <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                            Job descriptions
                        </p>
                        <p className="mt-4 text-4xl font-bold text-fuchsia-400">
                            {jobDescriptions.length}
                        </p>
                    </div>
                </div>

                <div className="mt-8 grid gap-6 xl:grid-cols-2">
                    <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                            Resume Intake
                        </p>
                        <h2 className="mt-3 text-2xl font-semibold">Save your resume context</h2>

                        <form onSubmit={handleSaveResumeText} className="mt-6 space-y-4">
                            <input
                                value={resumeForm.title}
                                onChange={(e) =>
                                    setResumeForm((prev) => ({
                                        ...prev,
                                        title: e.target.value,
                                    }))
                                }
                                placeholder="Resume title"
                                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3.5 outline-none transition placeholder:text-slate-500 focus:border-cyan-500"
                            />
                            <textarea
                                rows={8}
                                value={resumeForm.raw_text}
                                onChange={(e) =>
                                    setResumeForm((prev) => ({
                                        ...prev,
                                        raw_text: e.target.value,
                                    }))
                                }
                                placeholder="Paste your resume text here."
                                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 outline-none transition placeholder:text-slate-500 focus:border-cyan-500"
                            />
                            <button
                                type="submit"
                                disabled={
                                    savingResume ||
                                    !resumeForm.title.trim() ||
                                    !resumeForm.raw_text.trim()
                                }
                                className="rounded-xl bg-cyan-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-60"
                            >
                                {savingResume ? "Saving..." : "Save Resume Text"}
                            </button>
                        </form>

                        <form onSubmit={handleUploadResume} className="mt-6 space-y-4">
                            <input
                                value={resumeUploadTitle}
                                onChange={(e) => setResumeUploadTitle(e.target.value)}
                                placeholder="Optional upload title"
                                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3.5 outline-none transition placeholder:text-slate-500 focus:border-cyan-500"
                            />
                            <input
                                type="file"
                                accept=".pdf,.docx,.txt,.md"
                                onChange={(e) =>
                                    setResumeFile(e.target.files?.[0] || null)
                                }
                                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3.5 text-sm text-slate-300"
                            />
                            <button
                                type="submit"
                                disabled={uploadingResume || !resumeFile}
                                className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 font-medium text-cyan-300 transition hover:bg-cyan-500/15 disabled:opacity-60"
                            >
                                {uploadingResume ? "Uploading..." : "Upload Resume File"}
                            </button>
                        </form>
                    </div>

                    <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                            Job Targeting
                        </p>
                        <h2 className="mt-3 text-2xl font-semibold">
                            Save a target job description
                        </h2>

                        <form
                            onSubmit={handleSaveJobDescriptionText}
                            className="mt-6 space-y-4"
                        >
                            <input
                                value={jobDescriptionForm.title}
                                onChange={(e) =>
                                    setJobDescriptionForm((prev) => ({
                                        ...prev,
                                        title: e.target.value,
                                    }))
                                }
                                placeholder="Job description title"
                                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3.5 outline-none transition placeholder:text-slate-500 focus:border-cyan-500"
                            />
                            <textarea
                                rows={8}
                                value={jobDescriptionForm.raw_text}
                                onChange={(e) =>
                                    setJobDescriptionForm((prev) => ({
                                        ...prev,
                                        raw_text: e.target.value,
                                    }))
                                }
                                placeholder="Paste the job description text here."
                                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 outline-none transition placeholder:text-slate-500 focus:border-cyan-500"
                            />
                            <button
                                type="submit"
                                disabled={
                                    savingJobDescription ||
                                    !jobDescriptionForm.title.trim() ||
                                    !jobDescriptionForm.raw_text.trim()
                                }
                                className="rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
                            >
                                {savingJobDescription ? "Saving..." : "Save Job Description"}
                            </button>
                        </form>

                        <form onSubmit={handleUploadJobDescription} className="mt-6 space-y-4">
                            <input
                                value={jobDescriptionUploadTitle}
                                onChange={(e) => setJobDescriptionUploadTitle(e.target.value)}
                                placeholder="Optional upload title"
                                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3.5 outline-none transition placeholder:text-slate-500 focus:border-cyan-500"
                            />
                            <input
                                type="file"
                                accept=".pdf,.docx,.txt,.md"
                                onChange={(e) =>
                                    setJobDescriptionFile(e.target.files?.[0] || null)
                                }
                                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3.5 text-sm text-slate-300"
                            />
                            <button
                                type="submit"
                                disabled={uploadingJobDescription || !jobDescriptionFile}
                                className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 font-medium text-emerald-300 transition hover:bg-emerald-500/15 disabled:opacity-60"
                            >
                                {uploadingJobDescription
                                    ? "Uploading..."
                                    : "Upload Job Description File"}
                            </button>
                        </form>
                    </div>
                </div>

                <div className="mt-8 grid gap-6 xl:grid-cols-2">
                    <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                                    Saved resumes
                                </p>
                                <h2 className="mt-2 text-2xl font-semibold">
                                    Background you can interview against
                                </h2>
                            </div>
                            <SectionChip
                                label={`${resumes.length} saved`}
                                accentClass="bg-cyan-500/10 text-cyan-300"
                            />
                        </div>

                        <div className="mt-6 space-y-4">
                            {resumes.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/70 p-6 text-slate-400">
                                    No resumes saved yet.
                                </div>
                            ) : (
                                resumes.map((resume) => (
                                    <div
                                        key={resume.id}
                                        className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5"
                                    >
                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                            <div>
                                                <h3 className="text-lg font-semibold text-white">
                                                    {resume.title}
                                                </h3>
                                                <p className="mt-2 text-sm text-slate-400">
                                                    {resume.extracted_profile.summary ||
                                                        "Resume summary unavailable."}
                                                </p>
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    {(resume.extracted_profile.skills || []).map(
                                                        (skill) => (
                                                            <SectionChip
                                                                key={skill}
                                                                label={skill}
                                                                accentClass="bg-cyan-500/10 text-cyan-300"
                                                            />
                                                        )
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() =>
                                                    handleDelete("resume", resume.id)
                                                }
                                                disabled={deletingKey === `resume-${resume.id}`}
                                                className="rounded-xl border border-red-500/30 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/10 disabled:opacity-60"
                                            >
                                                {deletingKey === `resume-${resume.id}`
                                                    ? "Deleting..."
                                                    : "Delete"}
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                                    Saved job descriptions
                                </p>
                                <h2 className="mt-2 text-2xl font-semibold">
                                    Roles you want to target
                                </h2>
                            </div>
                            <SectionChip
                                label={`${jobDescriptions.length} saved`}
                                accentClass="bg-emerald-500/10 text-emerald-300"
                            />
                        </div>

                        <div className="mt-6 space-y-4">
                            {jobDescriptions.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/70 p-6 text-slate-400">
                                    No job descriptions saved yet.
                                </div>
                            ) : (
                                jobDescriptions.map((jobDescription) => (
                                    <div
                                        key={jobDescription.id}
                                        className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5"
                                    >
                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                            <div>
                                                <h3 className="text-lg font-semibold text-white">
                                                    {jobDescription.title}
                                                </h3>
                                                <p className="mt-2 text-sm text-slate-400">
                                                    {jobDescription.extracted_profile.summary ||
                                                        "Job description summary unavailable."}
                                                </p>
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    {(
                                                        jobDescription.extracted_profile
                                                            .required_skills || []
                                                    ).map((skill) => (
                                                        <SectionChip
                                                            key={skill}
                                                            label={skill}
                                                            accentClass="bg-emerald-500/10 text-emerald-300"
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() =>
                                                    handleDelete(
                                                        "job-description",
                                                        jobDescription.id
                                                    )
                                                }
                                                disabled={
                                                    deletingKey ===
                                                    `job-description-${jobDescription.id}`
                                                }
                                                className="rounded-xl border border-red-500/30 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/10 disabled:opacity-60"
                                            >
                                                {deletingKey ===
                                                `job-description-${jobDescription.id}`
                                                    ? "Deleting..."
                                                    : "Delete"}
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                        Ready for interview setup
                    </p>
                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                            <p className="text-sm font-medium text-white">
                                Default resume for practice
                            </p>
                            <p className="mt-2 text-sm text-slate-400">
                                {selectedResume?.title ||
                                    "Add a resume to unlock story-aware questioning."}
                            </p>
                        </div>
                        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                            <p className="text-sm font-medium text-white">
                                Default target role context
                            </p>
                            <p className="mt-2 text-sm text-slate-400">
                                {selectedJobDescription?.title ||
                                    "Add a job description to practice toward a real opening."}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                                Resume vs JD analysis
                            </p>
                            <h2 className="mt-2 text-2xl font-semibold">
                                Surface fit, gaps, and interview risks
                            </h2>
                            <p className="mt-2 max-w-3xl text-sm text-slate-400">
                                Compare one saved resume against one target job description before
                                you start an interview. This is the fastest way to see what your
                                practice session should emphasize.
                            </p>
                        </div>
                    </div>

                    <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
                        <select
                            value={comparisonResumeId}
                            onChange={(e) => setComparisonResumeId(e.target.value)}
                            className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3.5 outline-none transition focus:border-cyan-500"
                        >
                            <option value="">Select a resume</option>
                            {resumes.map((resume) => (
                                <option key={resume.id} value={resume.id}>
                                    {resume.title}
                                </option>
                            ))}
                        </select>

                        <select
                            value={comparisonJobDescriptionId}
                            onChange={(e) => setComparisonJobDescriptionId(e.target.value)}
                            className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3.5 outline-none transition focus:border-cyan-500"
                        >
                            <option value="">Select a job description</option>
                            {jobDescriptions.map((jobDescription) => (
                                <option
                                    key={jobDescription.id}
                                    value={jobDescription.id}
                                >
                                    {jobDescription.title}
                                </option>
                            ))}
                        </select>

                        <button
                            onClick={handleCompare}
                            disabled={
                                comparisonLoading ||
                                !comparisonResumeId ||
                                !comparisonJobDescriptionId
                            }
                            className="rounded-2xl bg-fuchsia-500 px-5 py-3.5 font-semibold text-slate-950 transition hover:bg-fuchsia-400 disabled:opacity-60"
                        >
                            {comparisonLoading ? "Analyzing..." : "Compare"}
                        </button>
                    </div>

                    {comparison && (
                        <div className="mt-6 space-y-6">
                            <div className="rounded-2xl border border-fuchsia-500/20 bg-gradient-to-r from-fuchsia-500/10 to-cyan-500/10 p-5">
                                <p className="text-xs uppercase tracking-[0.16em] text-fuchsia-300">
                                    Role fit summary
                                </p>
                                <p className="mt-3 leading-7 text-slate-200">
                                    {comparison.role_fit_summary}
                                </p>
                            </div>

                            <div className="grid gap-6 lg:grid-cols-3">
                                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5">
                                    <h3 className="text-lg font-semibold text-emerald-300">
                                        Match areas
                                    </h3>
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {comparison.match_areas.map((item) => (
                                            <SectionChip
                                                key={item}
                                                label={item}
                                                accentClass="bg-emerald-500/15 text-emerald-200"
                                            />
                                        ))}
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5">
                                    <h3 className="text-lg font-semibold text-amber-300">
                                        Gap areas
                                    </h3>
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {comparison.gap_areas.map((item) => (
                                            <SectionChip
                                                key={item}
                                                label={item}
                                                accentClass="bg-amber-500/15 text-amber-200"
                                            />
                                        ))}
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-5">
                                    <h3 className="text-lg font-semibold text-cyan-300">
                                        Interview risk zones
                                    </h3>
                                    <div className="mt-4 space-y-3">
                                        {comparison.interview_risk_zones.map((item) => (
                                            <div
                                                key={item}
                                                className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-200"
                                            >
                                                {item}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
