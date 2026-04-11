"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getAuth } from "@/lib/auth"
import { API_BASE_URL } from "@/lib/api"

const API = API_BASE_URL

// Module-level cache — survives tab switches within the same browser session
let _cachedSessions = null

// ── Small helpers ──────────────────────────────────────────────────────────────

function FileChip({ name }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800/40">
      📄 {name}
    </span>
  )
}

function ConfirmDialog({ sessionDatetime, onConfirm, onCancel, isDark }) {
  return (
    <div className={`fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-md ${isDark ? "dark" : ""}`}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl text-center">
        <div className="text-5xl mb-4">🗑️</div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Delete Session?</h3>
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-1">
          This will permanently delete all files for
        </p>
        <p className="text-slate-700 dark:text-slate-200 text-sm font-semibold mb-6">{sessionDatetime}</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-6">
          Input files, profiling data, and cleaned datasets will all be removed. This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/20 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 font-medium transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold transition"
          >
            Yes, Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const router = useRouter()
  const [sessions,    setSessions]    = useState(() => _cachedSessions ?? [])
  const [loading,     setLoading]     = useState(_cachedSessions === null)
  const [error,       setError]       = useState("")
  const [delTarget,   setDelTarget]   = useState(null)   // { session_id, datetime }
  const [deleting,    setDeleting]    = useState(null)   // session_id being deleted
  const [isDark,      setIsDark]      = useState(true)

  useEffect(() => {
    const dark = localStorage.getItem("isDark")
    if (dark !== null) setIsDark(dark !== "false")
  }, [])

  // Fetch session list ──────────────────────────────────────────────────────────
  const fetchSessions = async () => {
    const token = getAuth("token")
    if (!token) { router.replace("/login"); return }
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`${API}/history/`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const data = await res.json()
      _cachedSessions = data
      setSessions(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (_cachedSessions !== null) return  // already cached, skip fetch
    fetchSessions()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Delete session ──────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!delTarget) return
    const token = getAuth("token")
    setDeleting(delTarget.session_id)
    setDelTarget(null)
    try {
      const res = await fetch(`${API}/history/${delTarget.session_id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`Delete failed: ${res.status}`)
      const updated = (sessions ?? []).filter((s) => s.session_id !== delTarget.session_id)
      _cachedSessions = updated
      setSessions(updated)
    } catch (err) {
      setError(err.message)
    } finally {
      setDeleting(null)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-slate-400 animate-pulse text-sm">Loading history…</div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            🕐 Past Sessions
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            All preprocessing sessions for your account
          </p>
        </div>
        <button
          onClick={() => { _cachedSessions = null; fetchSessions() }}
          className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/15 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition font-medium"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/40 text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Empty state */}
      {sessions.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center">
          <div className="text-6xl">📂</div>
          <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs">
            No sessions found. Upload a dataset to start preprocessing.
          </p>
          <button
            onClick={() => router.push("/dashboard/upload")}
            className="mt-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition"
          >
            Upload Dataset
          </button>
        </div>
      )}

      {/* Session list */}
      <div className="space-y-4">
        {sessions.map((s) => (
          <div
            key={s.session_id}
            className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm hover:shadow-md transition"
          >
            <div className="flex items-start justify-between gap-4">
              {/* Left: date + files */}
              <div className="flex-1 min-w-0">
                <p className="text-slate-900 dark:text-white font-bold text-base">
                  {s.datetime}
                </p>
                <div className="flex flex-wrap gap-2">
                  {s.input_files.length > 0 ? (
                    s.input_files.map((f) => <FileChip key={f} name={f} />)
                  ) : (
                    <span className="text-slate-400 text-xs italic">No input files found</span>
                  )}
                </div>
              </div>

              {/* Right: actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => router.push(`/dashboard/history/${s.session_id}`)}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition"
                >
                  👁 View
                </button>
                <button
                  onClick={() => setDelTarget({ session_id: s.session_id, datetime: s.datetime })}
                  disabled={deleting === s.session_id}
                  className="px-4 py-2 rounded-xl border border-red-200 dark:border-red-700/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 font-semibold text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleting === s.session_id ? "Deleting…" : "🗑 Delete"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Confirm delete dialog */}
      {delTarget && (
        <ConfirmDialog
          sessionDatetime={delTarget.datetime}
          onConfirm={handleDelete}
          onCancel={() => setDelTarget(null)}
          isDark={isDark}
        />
      )}
    </div>
  )
}
