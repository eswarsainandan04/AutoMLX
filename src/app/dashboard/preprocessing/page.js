"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { getAuth } from "@/lib/auth"
import { API_BASE_URL } from "@/lib/api"

const API = API_BASE_URL

const STEP_META = {
  profiling:            { label: "Data Profiling",       icon: "🔍" },
  column_handler:       { label: "Column Detection",     icon: "📋" },
  column_type_resolver: { label: "Type Resolution",      icon: "🔎" },
  row_handler:          { label: "Row Handler",          icon: "📏" },
  missing_values:       { label: "Missing Values",       icon: "🩹" },
}

const COLORS = {
  done:    "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-600/30",
  running: "bg-blue-50 dark:bg-blue-900/20 border-blue-400 dark:border-blue-500/40 animate-pulse",
  error:   "bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-500/30",
  pending: "bg-white dark:bg-white/5 border-slate-200 dark:border-white/5",
}
const BADGES = {
  done:    "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400",
  running: "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300",
  error:   "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400",
  pending: "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400",
}
const STATUS_ICON = { done: "✅", running: "⏳", error: "❌", pending: "○" }

export default function PreprocessingPage() {
  const router = useRouter()
  const [token,          setToken]          = useState(null)
  const [sessionId,      setSessionId]      = useState(null)
  const [pipelineStatus, setPipelineStatus] = useState(null)
  const pollRef = useRef(null)

  // Load token + session_id from sessionStorage
  useEffect(() => {
    const t   = getAuth("token")
    const sid = getAuth("session_id")
    if (!t)   { router.push("/login");           return }
    if (!sid) { router.push("/dashboard/upload"); return }
    setToken(t)
    setSessionId(sid)
  }, [router])

  // Navigate to overview once pipeline finishes
  const goToOverview = useCallback(() => {
    router.push("/dashboard/overview")
  }, [router])

  // Poll pipeline status every 2.5 s
  useEffect(() => {
    if (!sessionId || !token) return
    const poll = async () => {
      try {
        const res = await fetch(`${API}/upload/status/${sessionId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) return
        const data = await res.json()
        setPipelineStatus(data)
        if (data.status === "done") {
          clearInterval(pollRef.current)
          goToOverview()
        } else if (data.status === "error") {
          clearInterval(pollRef.current)
        }
      } catch (_) {}
    }
    poll()
    pollRef.current = setInterval(poll, 2500)
    return () => clearInterval(pollRef.current)
  }, [sessionId, token, goToOverview])

  if (!sessionId) return null

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
        Preprocessing Pipeline
      </h2>
      <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
        Session&nbsp;
        <code className="text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-white/5 px-2 py-0.5 rounded font-mono text-xs">
          {sessionId}
        </code>
      </p>

      {pipelineStatus ? (
        <>
          <div className="space-y-3">
            {pipelineStatus.steps.map((step) => {
              const meta = STEP_META[step.name] || { label: step.name, icon: "○" }
              return (
                <div
                  key={step.name}
                  className={`flex items-center gap-4 rounded-xl p-4 border transition-all ${COLORS[step.status] || COLORS.pending}`}
                >
                  <span className="text-2xl w-8 text-center">
                    {STATUS_ICON[step.status] || "○"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base mr-1">{meta.icon}</span>
                      <span className="text-slate-900 dark:text-white font-medium">
                        {meta.label}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${BADGES[step.status] || BADGES.pending}`}>
                        {step.status}
                      </span>
                    </div>
                    {step.error && (
                      <p className="text-red-500 dark:text-red-400 text-xs mt-1 truncate">
                        {step.error}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {pipelineStatus.status === "done" && (
            <div className="mt-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-500/30 rounded-xl p-5 text-center">
              <div className="text-4xl mb-2">🎉</div>
              <p className="text-green-700 dark:text-green-400 font-bold text-lg">
                All steps completed!
              </p>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                {pipelineStatus.files?.length} file(s) processed successfully.
              </p>
              <button
                onClick={goToOverview}
                className="mt-4 bg-green-600 hover:bg-green-500 text-white font-semibold px-8 py-2.5 rounded-xl transition"
              >
                View Dataset Overview →
              </button>
            </div>
          )}

          {pipelineStatus.status === "error" && (
            <div className="mt-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded-xl p-5">
              <p className="text-red-700 dark:text-red-400 font-bold">
                Pipeline encountered an error
              </p>
              <p className="text-red-600 dark:text-red-300 text-sm mt-1">
                {pipelineStatus.error}
              </p>
              <button
                onClick={() => router.push("/dashboard/upload")}
                className="mt-4 text-sm border border-slate-300 dark:border-slate-600 px-4 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:border-slate-400 transition"
              >
                ← Back to Upload
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="text-slate-400 text-sm mt-8 text-center">
          <div className="text-4xl mb-3">⏳</div>
          Starting pipeline…
        </div>
      )}
    </div>
  )
}
