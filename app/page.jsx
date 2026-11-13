"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function signIn(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error || "Unable to sign in.");
        return;
      }
      router.push("/vote");
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto grid min-h-screen max-w-7xl items-center gap-12 px-5 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:px-10">
        <section>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Student Teacher Rating
          </div>
          <h1 className="mt-7 max-w-2xl text-5xl font-bold leading-tight tracking-tight sm:text-6xl">
            Your feedback helps great teaching grow.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-400">
            Rate each subject teacher in one simple, private-to-the-class submission. Take your time,
            review every choice, then submit once.
          </p>
          <div className="mt-10 flex flex-wrap gap-3 text-sm text-slate-300">
            <span className="rounded-full bg-white/5 px-4 py-2">12 subjects</span>
            <span className="rounded-full bg-white/5 px-4 py-2">10%–100% ratings</span>
            <span className="rounded-full bg-white/5 px-4 py-2">One submission per student</span>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white p-7 text-slate-900 shadow-2xl shadow-black/30 sm:p-9">
          <div className="mb-7">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">Student access</p>
            <h2 className="mt-2 text-2xl font-bold">Enter your name</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Any student can continue by entering their name. Use the same name if you return later.
            </p>
          </div>

          <form onSubmit={signIn} className="space-y-4">
            <label htmlFor="student-name" className="block text-sm font-medium text-slate-700">
              Student name
            </label>
            <input
              id="student-name"
              autoComplete="name"
              required
              maxLength={100}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Alex Johnson"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
            />
            {error ? <p role="alert" className="text-sm text-rose-600">{error}</p> : null}
            <button
              disabled={loading}
              className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Signing you in…" : "Continue to ratings"}
            </button>
          </form>

          <p className="mt-5 text-xs leading-5 text-slate-500">
            Name-only access does not verify identity. Do not treat it as protection against someone
            using another student’s name.
          </p>
          <div className="mt-7 border-t border-slate-100 pt-5 text-center">
            <Link href="/admin" className="text-sm font-semibold text-slate-600 hover:text-indigo-600">
              Administrator sign in →
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
