"use client";

import { useState } from "react";
import api from "@/lib/api";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import Link from "next/link";

export default function LoginPage() {
    const router = useRouter();
    const setToken = useAuthStore((state) => state.setToken);

    const [form, setForm] = useState({
        email: "",
        password: "",
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
            const formData = new URLSearchParams();
            formData.append("username", form.email);
            formData.append("password", form.password);

            const res = await api.post("/auth/login", formData, {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            });

            setToken(res.data.access_token);
            router.push("/dashboard");
        } catch (err: any) {
            setError(err?.response?.data?.detail || "Login failed");
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
                                Step back into your interview flow
                            </h1>

                            <p className="mt-4 max-w-md text-slate-300">
                                Continue mock interviews, revisit reports, and keep building
                                stronger answers with AI-guided practice.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                                <p className="text-sm font-medium text-white">Track progress</p>
                                <p className="mt-2 text-sm text-slate-400">
                                    Review your past sessions, scores, and improvement areas in
                                    one place.
                                </p>
                            </div>

                            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                                <p className="text-sm font-medium text-white">Practice smarter</p>
                                <p className="mt-2 text-sm text-slate-400">
                                    Get adaptive AI follow-up questions and richer interview
                                    reports after every session.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="p-8 sm:p-10 lg:p-12">
                        <div className="mx-auto w-full max-w-md">
                            <div className="mb-8">
                                <div className="inline-flex items-center rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-300">
                                    Welcome back
                                </div>

                                <h2 className="mt-5 text-3xl font-bold tracking-tight">
                                    Login to your account
                                </h2>
                                <p className="mt-3 text-slate-400">
                                    Continue your interview practice and pick up where you left
                                    off.
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
                                    {loading ? "Logging in..." : "Login"}
                                </button>
                            </form>

                            <p className="mt-6 text-center text-sm text-slate-400">
                                Don&apos;t have an account?{" "}
                                <Link
                                    href="/register"
                                    className="font-medium text-cyan-400 transition hover:text-cyan-300"
                                >
                                    Register
                                </Link>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}