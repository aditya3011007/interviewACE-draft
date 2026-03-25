"use client";

import { useState } from "react";
import api from "@/lib/api";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import Link from "next/link";

export default function RegisterPage() {
    const router = useRouter();
    const setToken = useAuthStore((state) => state.setToken);

    const [form, setForm] = useState({
        name: "",
        email: "",
        password: "",
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        setForm((prev) => ({
            ...prev,
            [e.target.name]: e.target.value,
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const res = await api.post("/auth/register", form);

            const token = res.data.access_token;
            setToken(token);

            router.push("/dashboard");
        } catch (err: any) {
            console.error("Registration failed:", err);
            setError(
                err?.response?.data?.detail ||
                "Something went wrong during registration."
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-slate-950 text-white">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute left-[-10%] top-[-5%] h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
                <div className="absolute right-[-8%] top-[18%] h-80 w-80 rounded-full bg-fuchsia-500/10 blur-3xl" />
                <div className="absolute bottom-[-8%] left-[20%] h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
            </div>

            <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
                <div className="grid w-full max-w-6xl overflow-hidden rounded-[32px] border border-slate-800 bg-slate-900/70 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur lg:grid-cols-2">
                    <div className="hidden border-r border-slate-800 bg-slate-950/60 p-10 lg:flex lg:flex-col lg:justify-between">
                        <div>
                            <div className="inline-flex items-center rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-cyan-300">
                                InterviewAce AI
                            </div>

                            <h1 className="mt-6 text-4xl font-bold tracking-tight">
                                Build your interview practice hub
                            </h1>

                            <p className="mt-4 max-w-md text-slate-300">
                                Create an account to start tailored mock interviews, track your
                                sessions, and generate AI-powered feedback reports.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                                <p className="text-sm font-medium text-white">
                                    AI-generated interviews
                                </p>
                                <p className="mt-2 text-sm text-slate-400">
                                    Practice with adaptive questions based on your role,
                                    difficulty, and interview type.
                                </p>
                            </div>

                            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                                <p className="text-sm font-medium text-white">
                                    Reports that help you improve
                                </p>
                                <p className="mt-2 text-sm text-slate-400">
                                    Get structured summaries, rubric-style scores, and actionable
                                    areas to improve.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="p-8 sm:p-10 lg:p-12">
                        <div className="mx-auto w-full max-w-md">
                            <div className="mb-8">
                                <div className="inline-flex items-center rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-300">
                                    Create account
                                </div>

                                <h2 className="mt-5 text-3xl font-bold tracking-tight">
                                    Start your practice journey
                                </h2>
                                <p className="mt-3 text-slate-400">
                                    Set up your account and begin building interview confidence
                                    with AI.
                                </p>
                            </div>

                            {error && (
                                <div className="mb-5 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                                    {error}
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-300">
                                        Full Name
                                    </label>
                                    <input
                                        type="text"
                                        name="name"
                                        placeholder="Aditya Singh"
                                        value={form.name}
                                        onChange={handleChange}
                                        required
                                        className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3.5 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-500"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-300">
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        name="email"
                                        placeholder="you@example.com"
                                        value={form.email}
                                        onChange={handleChange}
                                        required
                                        className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3.5 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-500"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-300">
                                        Password
                                    </label>
                                    <input
                                        type="password"
                                        name="password"
                                        placeholder="••••••••"
                                        value={form.password}
                                        onChange={handleChange}
                                        required
                                        className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3.5 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-500"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full rounded-2xl bg-cyan-500 px-4 py-3.5 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {loading ? "Creating account..." : "Register"}
                                </button>
                            </form>

                            <p className="mt-6 text-center text-sm text-slate-400">
                                Already have an account?{" "}
                                <Link
                                    href="/login"
                                    className="font-medium text-cyan-400 transition hover:text-cyan-300"
                                >
                                    Login
                                </Link>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}