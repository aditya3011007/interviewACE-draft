import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-6 text-center">
        <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1 text-sm text-cyan-300">
          AI Mock Interview + Skill Assessment
        </span>

        <h1 className="mt-6 max-w-4xl text-5xl font-bold leading-tight md:text-7xl">
          Practice smarter with{" "}
          <span className="text-cyan-400">InterviewAce AI</span>
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-slate-300">
          Prepare for technical and behavioral interviews with personalized AI
          feedback, structured scoring, and guided improvement.
        </p>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <Link
            href="/register"
            className="rounded-xl bg-cyan-500 px-6 py-3 font-semibold text-slate-950 hover:bg-cyan-400"
          >
            Get Started
          </Link>

          <Link
            href="/login"
            className="rounded-xl border border-slate-700 px-6 py-3 font-semibold hover:bg-slate-900"
          >
            Login
          </Link>
        </div>
      </section>
    </main>
  );
}