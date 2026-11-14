"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RATING_VALUES } from "@/lib/subjects";

function StatCard({ label, value, note }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
      {note ? <p className="mt-1 text-xs text-slate-400">{note}</p> : null}
    </div>
  );
}

async function readResponse(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "The server could not complete this request.");
  return body;
}

export default function AdminPage() {
  const [signedIn, setSignedIn] = useState(false);
  const [password, setPassword] = useState("");
  const [results, setResults] = useState(null);
  const [students, setStudents] = useState([]);
  const [newName, setNewName] = useState("");
  const [section, setSection] = useState("results");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadData = useCallback(async () => {
    const [resultsResponse, studentsResponse] = await Promise.all([
      fetch("/api/admin/results"),
      fetch("/api/admin/students"),
    ]);
    const [resultBody, studentBody] = await Promise.all([
      readResponse(resultsResponse),
      readResponse(studentsResponse),
    ]);
    setResults(resultBody);
    setStudents(studentBody.students);
    setSignedIn(true);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me")
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json();
      })
      .then(async (body) => {
        if (!active || body?.role !== "admin") return;
        await loadData();
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || "Could not load administrator data.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [loadData]);

  async function signIn(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      await readResponse(response);
      setPassword("");
      await loadData();
    } catch (signInError) {
      setError(signInError.message || "Administrator sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function addStudent(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      await readResponse(response);
      setNewName("");
      await loadData();
    } catch (addError) {
      setError(addError.message || "Student could not be added.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    setSignedIn(false);
    setResults(null);
    setStudents([]);
  }

  async function refreshData() {
    setError("");
    try {
      await loadData();
    } catch (refreshError) {
      setError(refreshError.message || "Could not refresh results.");
      if (refreshError.message === "Please sign in to continue.") setSignedIn(false);
    }
  }

  const mostVotes = useMemo(
    () => Math.max(1, ...(results?.results || []).map((item) => Math.max(...Object.values(item.distribution)))),
    [results],
  );

  if (loading) {
    return <main className="grid min-h-screen place-items-center bg-slate-50 text-slate-500">Loading administrator dashboard…</main>;
  }

  if (!signedIn) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-5 py-10">
        <section className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
          <Link href="/" className="text-sm font-semibold text-indigo-600">← Back to student sign in</Link>
          <p className="mt-8 text-sm font-semibold uppercase tracking-[0.16em] text-indigo-600">Restricted access</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Administrator sign in</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Results and roster management require the administrator password.</p>
          <form onSubmit={signIn} className="mt-6 space-y-4">
            <label htmlFor="admin-password" className="block text-sm font-medium text-slate-700">Admin password</label>
            <input id="admin-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" />
            {error ? <p role="alert" className="text-sm text-rose-600">{error}</p> : null}
            <button disabled={busy} className="w-full rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white hover:bg-slate-700 disabled:opacity-60">{busy ? "Signing in…" : "Sign in"}</button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Class Voice</p><h1 className="font-bold text-slate-900">Administrator dashboard</h1></div>
          <div className="flex items-center gap-4">
            <Link href="/" className="hidden text-sm font-medium text-slate-500 hover:text-indigo-600 sm:block">Student portal</Link>
            <button onClick={signOut} className="text-sm font-semibold text-slate-600 hover:text-indigo-600">Sign out</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8">
        <div className="mb-7 flex flex-wrap gap-2">
          <button onClick={() => setSection("results")} className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${section === "results" ? "bg-indigo-600 text-white" : "border border-slate-200 bg-white text-slate-600"}`}>Results</button>
          <button onClick={() => setSection("students")} className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${section === "students" ? "bg-indigo-600 text-white" : "border border-slate-200 bg-white text-slate-600"}`}>Student roster</button>
          <button onClick={refreshData} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Refresh results</button>
        </div>

        {error ? <p role="alert" className="mb-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p> : null}

        {section === "results" && results ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Rostered students" value={results.totalStudents} note="Eligible to submit one vote" />
              <StatCard label="Votes received" value={results.totalVotes} note="Unique student submissions" />
              <StatCard label="Participation" value={`${(results.participation * 100).toFixed(1)}%`} note="Of rostered students" />
              <StatCard label="Subjects rated" value={results.results.filter((item) => item.totalVotes > 0).length} note={`Out of ${results.results.length} subjects`} />
            </div>

            <section className="mt-7 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <div className="mb-5"><h2 className="text-xl font-bold text-slate-900">Subject averages</h2><p className="mt-1 text-sm text-slate-500">Average percentage score from submitted ratings.</p></div>
              <div className="space-y-4">
                {results.ranking.map((item, index) => (
                  <div key={item.subject} className="grid gap-2 sm:grid-cols-[2rem_13rem_1fr_5rem] sm:items-center">
                    <span className="text-sm font-semibold text-slate-400">#{index + 1}</span>
                    <span className="text-sm font-medium text-slate-700">{item.subject}</span>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${item.average}%` }} /></div>
                    <span className="text-sm font-bold text-slate-900 sm:text-right">{item.average.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-7 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-5 sm:px-7"><h2 className="text-xl font-bold text-slate-900">Ratings and distribution</h2><p className="mt-1 text-sm text-slate-500">Aggregated directly from recorded votes.</p></div>
              <div className="overflow-x-auto">
                <table className="min-w-[900px] w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr><th className="px-5 py-3">Subject</th><th className="px-4 py-3">Votes</th><th className="px-4 py-3">Total points</th><th className="px-4 py-3">Average</th>{RATING_VALUES.map((value) => <th key={value} className="px-2 py-3 text-center">{value}%</th>)}</tr>
                  </thead>
                  <tbody>
                    {results.results.map((item) => (
                      <tr key={item.subject} className="border-t border-slate-100 hover:bg-slate-50/70">
                        <th className="whitespace-nowrap px-5 py-3 font-semibold text-slate-800">{item.subject}</th>
                        <td className="px-4 py-3 text-slate-600">{item.totalVotes}</td>
                        <td className="px-4 py-3 text-slate-600">{item.totalPoints}%</td>
                        <td className="px-4 py-3 font-semibold text-indigo-700">{item.average.toFixed(1)}%</td>
                        {RATING_VALUES.map((value) => <td key={value} className="px-2 py-3 text-center text-slate-500">{item.distribution[value]}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mt-7 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <h2 className="text-xl font-bold text-slate-900">Rating distribution chart</h2>
              <p className="mt-1 text-sm text-slate-500">Bars show vote counts for each percentage. Hover for the exact count.</p>
              <div className="mt-6 space-y-5">
                {results.results.map((item) => (
                  <div key={item.subject}>
                    <div className="mb-2 flex justify-between text-sm"><span className="font-medium text-slate-700">{item.subject}</span><span className="text-slate-400">{item.totalVotes} votes</span></div>
                    <div className="flex h-24 items-end gap-1 border-b border-slate-100 pb-1">
                      {RATING_VALUES.map((value) => {
                        const count = item.distribution[value];
                        return <div key={value} title={`${value}%: ${count} vote${count === 1 ? "" : "s"}`} className="group flex h-full flex-1 flex-col items-center justify-end gap-1">
                          <span className="text-[10px] text-slate-400">{count || ""}</span>
                          <div className="w-full max-w-8 rounded-t bg-indigo-400 transition hover:bg-indigo-600" style={{ height: `${count ? Math.max(8, (count / mostVotes) * 58) : 0}px` }} />
                          <span className="text-[9px] text-slate-400">{value}</span>
                        </div>;
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : null}

        {section === "students" ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div><h2 className="text-xl font-bold text-slate-900">Student activity</h2><p className="mt-1 text-sm text-slate-500">Roster entries and vote submission status.</p></div>
              <form onSubmit={addStudent} className="flex w-full gap-2 sm:max-w-md">
                <input required maxLength={100} value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Student’s full name" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" />
                <button disabled={busy} className="rounded-xl bg-indigo-600 px-4 py-2.5 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">Add student</button>
              </form>
            </div>
            <div className="mt-6 overflow-hidden rounded-2xl border border-slate-100">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Rostered</th><th className="px-4 py-3">Vote status</th></tr></thead>
                <tbody>
                  {students.map((student) => <tr key={student.id} className="border-t border-slate-100"><td className="px-4 py-3 font-medium text-slate-800">{student.name}</td><td className="px-4 py-3 text-slate-500">{new Date(student.createdAt).toLocaleDateString()}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${student.vote ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{student.vote ? "Submitted" : "Not voted"}</span></td></tr>)}
                  {!students.length ? <tr><td colSpan="3" className="px-4 py-8 text-center text-slate-500">No students on the roster yet.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
