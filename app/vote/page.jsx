"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { RATING_VALUES, SUBJECTS } from "@/lib/subjects";

export default function VotePage() {
  const router = useRouter();
  const [student, setStudent] = useState(null);
  const [ratings, setRatings] = useState({});
  const [hasVoted, setHasVoted] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me")
      .then(async (response) => {
        if (!response.ok) {
          router.push("/");
          return null;
        }
        return response.json();
      })
      .then((body) => {
        if (!active || !body) return;
        if (body.role !== "student") {
          router.push(body.role === "admin" ? "/admin" : "/");
          return;
        }
        setStudent(body.student);
        setHasVoted(body.hasVoted);
      })
      .catch(() => {
        if (active) setError("Could not load your account. Refresh the page to try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [router]);

  const completed = useMemo(
    () => SUBJECTS.filter((subject) => ratings[subject] != null).length,
    [ratings],
  );

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  async function submitVote() {
    setSubmitting(true);
    setError("");

    let response;
    try {
      response = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ratings: SUBJECTS.map((subject) => ({ subject, percentage: ratings[subject] })),
        }),
      });
    } catch {
      setError("Could not connect to the server. Check your internet connection and try again.");
      setSubmitting(false);
      return;
    }

    const responseText = await response.text();
    let body;
    try {
      body = responseText ? JSON.parse(responseText) : {};
    } catch {
      body = {};
    }

    if (!response.ok) {
      setError(
        body.error ||
          `The server could not save your ratings (error ${response.status}). Please try again or contact the administrator.`,
      );
      if (response.status === 409) setHasVoted(true);
      setSubmitting(false);
      return;
    }

    if (!body.submitted) {
      setError("The server response was incomplete. Check your connection before trying again.");
      setSubmitting(false);
      return;
    }

    setHasVoted(true);
    setSuccess(true);
    setSubmitting(false);
  }

  if (loading) {
    return <main className="grid min-h-screen place-items-center bg-slate-50 text-slate-500">Loading your voting dashboard…</main>;
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/" className="font-bold tracking-tight text-slate-900">Class Voice</Link>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-slate-500 sm:block">{student?.name}</span>
            <button onClick={signOut} className="text-sm font-semibold text-slate-600 hover:text-indigo-600">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-9">
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-indigo-600">Student dashboard</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Rate your teachers</h1>
            <p className="mt-2 text-slate-500">Choose a percentage for every subject. Your submission can only be made once.</p>
          </div>
          {!hasVoted && !success ? (
            <div className="min-w-52 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex justify-between text-sm"><span className="text-slate-500">Progress</span><span className="font-semibold">{completed}/{SUBJECTS.length}</span></div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${(completed / SUBJECTS.length) * 100}%` }} />
              </div>
            </div>
          ) : null}
        </div>

        {hasVoted || success ? (
          <section className="rounded-3xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-2xl text-emerald-700">✓</div>
            <h2 className="mt-4 text-2xl font-bold text-slate-900">{success ? "Ratings recorded successfully" : "Your vote has been recorded"}</h2>
            <p className="mx-auto mt-2 max-w-lg text-slate-500">
              Thank you, {student?.name}. The system has recorded one submission for this roster entry.
            </p>
            <button onClick={signOut} className="mt-6 rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-700">
              Done
            </button>
          </section>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {SUBJECTS.map((subject, index) => (
                <section key={subject} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-50 text-sm font-bold text-indigo-700">{String(index + 1).padStart(2, "0")}</span>
                    <div className="min-h-10 pt-1">
                      <h2 className="font-semibold text-slate-900">{subject}</h2>
                      <p className="mt-1 text-xs text-slate-500">How would you rate the teaching?</p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-5 gap-2">
                    {RATING_VALUES.map((value) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={ratings[subject] === value}
                        onClick={() => setRatings((current) => ({ ...current, [subject]: value }))}
                        className={`rounded-lg border px-1 py-2 text-sm font-medium transition ${
                          ratings[subject] === value
                            ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
                            : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-indigo-50"
                        }`}
                      >
                        {value}%
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            {error ? <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p> : null}

            {reviewing ? (
              <section className="mt-8 rounded-3xl border border-indigo-100 bg-indigo-50/60 p-6">
                <h2 className="text-xl font-bold text-slate-900">Review your ratings</h2>
                <p className="mt-1 text-sm text-slate-500">Check each subject before your one-time submission.</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {SUBJECTS.map((subject) => (
                    <div key={subject} className="flex justify-between rounded-xl bg-white px-4 py-3 text-sm">
                      <span className="text-slate-600">{subject}</span><strong className="text-slate-900">{ratings[subject]}%</strong>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <div className="sticky bottom-4 mt-8 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">{completed} of {SUBJECTS.length} subjects rated</p>
              {reviewing ? (
                <div className="flex gap-3">
                  <button onClick={() => setReviewing(false)} className="rounded-xl border border-slate-200 px-4 py-3 font-semibold text-slate-700 hover:bg-slate-50">Edit ratings</button>
                  <button disabled={submitting} onClick={submitVote} className="rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                    {submitting ? "Submitting…" : "Confirm and submit"}
                  </button>
                </div>
              ) : (
                <button
                  disabled={completed !== SUBJECTS.length}
                  onClick={() => setReviewing(true)}
                  className="rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  Review ratings
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
