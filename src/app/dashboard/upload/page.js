"use client"

import { useCallback, useContext, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { getAuth, setAuth } from "@/lib/auth"
import { API_BASE_URL } from "@/lib/api"
import { DashCtx } from "../context"

const API = API_BASE_URL

// ─── Gear SVG (Heroicons cog-6-tooth outline) ───────────────────────────
function GearSVG({ size = 48, className = "", style }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style}
    >
      <path d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.398.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z" />
      <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  )
}

// ─── Preprocessing step groups ───────────────────────────────────
const STEP_GROUPS = [
  { label: "Data Cleaning",            icon: "🧹", steps: ["profiling", "column_handler", "column_type_resolver", "row_handler"] },
  { label: "Handling Missing Values",  icon: "🩹", steps: ["missing_values"] },
  { label: "Analyzing Attribute Type", icon: "🔬", steps: ["structural_type_detector"] },
]

// ─── Preprocessing modal ──────────────────────────────────────────
function PreprocessingModal({ sessionId, token, isDark, onDone, onDismissError }) {
  const [steps,    setSteps]    = useState([])
  const [status,   setStatus]   = useState("running")
  const [errorMsg, setErrorMsg] = useState("")
  const pollRef = useRef(null)

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`${API}/upload/status/${sessionId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) return
        const data = await res.json()
        setSteps(data.steps || [])
        if (data.status === "done") {
          clearInterval(pollRef.current)
          setStatus("done")
          setTimeout(onDone, 900)
        } else if (data.status === "error") {
          clearInterval(pollRef.current)
          setStatus("error")
          setErrorMsg(data.error || "Pipeline encountered an error.")
        }
      } catch (_) {}
    }
    poll()
    pollRef.current = setInterval(poll, 2500)
    return () => clearInterval(pollRef.current)
  }, [sessionId, token, onDone])

  const getGroupStatus = (groupSteps) => {
    const matching = steps.filter((s) => groupSteps.includes(s.name))
    if (!matching.length)                             return "pending"
    if (matching.some((s) => s.status === "error"))   return "error"
    if (matching.some((s) => s.status === "running")) return "running"
    if (matching.every((s) => s.status === "done"))   return "done"
    return "pending"
  }

  const groupCls = {
    done:    "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-600/30 text-green-700 dark:text-green-400",
    running: "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-500/40 text-blue-700 dark:text-blue-300",
    error:   "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400",
    pending: "bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400",
  }
  const groupIcon = { done: "✅", running: "⏳", error: "❌", pending: "○" }

  return (
    <div className={`fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-md ${isDark ? "dark" : ""}`}>
      <div className="bg-white dark:bg-slate-800 rounded-3xl px-10 pt-10 pb-8 max-w-md w-full mx-4 shadow-2xl">
        {/* Two interlocking animated gears */}
        <div className="flex items-end justify-center mb-8 h-28">
          <GearSVG size={100} className="text-blue-500 animate-spin" style={{ animationDuration: "4s" }} />
          <GearSVG size={64}  className="text-slate-400 dark:text-slate-500 animate-spin-reverse mb-1 ml-[-12px]" />
        </div>

        <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white text-center mb-1.5">Preprocessing</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm text-center mb-8">Running the pipeline on your dataset…</p>

        <div className="space-y-3">
          {STEP_GROUPS.map((group) => {
            const gs = getGroupStatus(group.steps)
            return (
              <div key={group.label} className={`flex items-center gap-3 rounded-xl px-4 py-3.5 border transition-all ${groupCls[gs]}`}>
                <span className="text-xl w-7 text-center flex-shrink-0">{groupIcon[gs]}</span>
                <span className="text-sm font-semibold">{group.icon} {group.label}</span>
                {gs === "running" && (
                  <span className="ml-auto flex-shrink-0 w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin opacity-60" />
                )}
              </div>
            )
          })}
        </div>

        {status === "done" && (
          <p className="mt-6 text-center text-sm font-semibold text-green-600 dark:text-green-400">
            ✨ All done! Redirecting to overview…
          </p>
        )}
        {status === "error" && (
          <div className="mt-6 text-center space-y-3">
            <p className="text-sm text-red-600 dark:text-red-400">{errorMsg}</p>
            <button
              onClick={onDismissError}
              className="text-sm text-slate-500 dark:text-slate-400 underline hover:text-slate-700 dark:hover:text-slate-300 transition"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── ETL "Connect to Server" modal ───────────────────────────────────────────
const ETL_SERVER_TYPES = [
  { value: "postgresql", label: "PostgreSQL", icon: "🐘" },
  { value: "mysql",      label: "MySQL",      icon: "🐬" },
  { value: "sqlserver",  label: "SQL Server", icon: "🪟" },
]
const ETL_DEFAULT_PORT = { postgresql: "5432", mysql: "3306", sqlserver: "1433" }

function EtlModal({ token, isDark, onSuccess, onClose }) {
  const [phase,          setPhase]          = useState("form")   // "form" | "tables"
  const [serverType,     setServerType]     = useState("postgresql")
  const [host,           setHost]           = useState("")
  const [port,           setPort]           = useState("5432")
  const [username,       setUsername]       = useState("")
  const [password,       setPassword]       = useState("")
  const [database,       setDatabase]       = useState("")
  const [tables,         setTables]         = useState([])
  const [selectedTables, setSelectedTables] = useState(new Set())
  const [connecting,     setConnecting]     = useState(false)
  const [extracting,     setExtracting]     = useState(false)
  const [error,          setError]          = useState("")

  const connFields = { server_type: serverType, host, port: port ? +port : null, username, password, database }

  const handleTypeChange = (v) => {
    setServerType(v)
    setPort(ETL_DEFAULT_PORT[v] || "")
    setError("")
  }

  const handleConnect = async () => {
    if (!host || !username || !database) { setError("Host, username and database are required."); return }
    setConnecting(true)
    setError("")
    try {
      const res  = await fetch(`${API}/etl/connect`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify(connFields),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || "Connection failed")
      setTables(data.tables)
      setSelectedTables(new Set(data.tables))
      setPhase("tables")
    } catch (err) {
      setError(err.message)
    } finally {
      setConnecting(false)
    }
  }

  const toggleTable = (t) => {
    setSelectedTables(prev => {
      const next = new Set(prev)
      next.has(t) ? next.delete(t) : next.add(t)
      return next
    })
  }

  const handleExtract = async () => {
    if (!selectedTables.size) { setError("Select at least one table."); return }
    setExtracting(true)
    setError("")
    try {
      const res  = await fetch(`${API}/etl/extract`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ ...connFields, tables: [...selectedTables] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || "Extraction failed")
      onSuccess(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setExtracting(false)
    }
  }

  return (
    <div className={`fixed inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 ${isDark ? "dark" : ""}`}>
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 dark:border-white/10 flex-shrink-0">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
              {phase === "form" ? "🔌 Connect to Server" : "📋 Select Tables"}
            </h2>
            {phase === "tables" && (
              <p className="text-xs text-slate-400 mt-0.5">{tables.length} table{tables.length !== 1 ? "s" : ""} found in <span className="font-mono">{database}</span></p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-2xl leading-none transition">×</button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {phase === "form" && (
            <>
              {/* Server type pills */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Database</label>
                <div className="flex gap-2">
                  {ETL_SERVER_TYPES.map(({ value, label, icon }) => (
                    <button
                      key={value}
                      onClick={() => handleTypeChange(value)}
                      className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition ${
                        serverType === value
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-blue-300"
                      }`}
                    >
                      {icon} {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Connection fields */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Host</label>
                  <input
                    value={host} onChange={e => setHost(e.target.value)}
                    placeholder="localhost"
                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Port</label>
                  <input
                    value={port} onChange={e => setPort(e.target.value)}
                    placeholder={ETL_DEFAULT_PORT[serverType]}
                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Username</label>
                  <input
                    value={username} onChange={e => setUsername(e.target.value)}
                    placeholder="postgres"
                    autoComplete="username"
                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Password</label>
                  <input
                    type="password"
                    value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Database name</label>
                  <input
                    value={database} onChange={e => setDatabase(e.target.value)}
                    placeholder="my_database"
                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </>
          )}

          {phase === "tables" && (
            <>
              {/* Select all / Deselect all */}
              <div className="flex gap-3">
                <button onClick={() => setSelectedTables(new Set(tables))} className="text-xs text-blue-500 hover:text-blue-600 transition">Select all</button>
                <span className="text-slate-300 dark:text-slate-600">|</span>
                <button onClick={() => setSelectedTables(new Set())} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition">Deselect all</button>
                <span className="ml-auto text-xs text-slate-400">{selectedTables.size} selected</span>
              </div>
              {/* Table list */}
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {tables.map(t => (
                  <label key={t} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-100 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer transition">
                    <input
                      type="checkbox"
                      checked={selectedTables.has(t)}
                      onChange={() => toggleTable(t)}
                      className="accent-blue-600 w-4 h-4 flex-shrink-0"
                    />
                    <span className="text-sm font-mono text-slate-700 dark:text-slate-200 truncate">{t}</span>
                  </label>
                ))}
              </div>
            </>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 dark:border-red-500/40 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-600 dark:text-red-300">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-white/10 flex gap-3 flex-shrink-0">
          {phase === "tables" && (
            <button
              onClick={() => { setPhase("form"); setError("") }}
              className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-white/5 transition"
            >
              ← Back
            </button>
          )}
          <button
            onClick={phase === "form" ? handleConnect : handleExtract}
            disabled={connecting || extracting}
            className="flex-1 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition-all"
          >
            {phase === "form"
              ? (connecting ? "Connecting…" : "🔌 Connect & List Tables")
              : (extracting ? "Extracting…" : `⬇ Extract & Load${selectedTables.size ? ` (${selectedTables.size} table${selectedTables.size > 1 ? "s" : ""})` : ""}`)}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── CSV parser ──────────────────────────────────────────────────────────────
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean)
  if (lines.length === 0) return { columns: [], rows: [] }
  const columns = lines[0].split(",").map(c => c.replace(/^"|"$/g, "").trim())
  const rows = lines.slice(1, 51).map(line => {
    const vals = line.split(",").map(v => v.replace(/^"|"$/g, "").trim())
    const obj = {}
    columns.forEach((c, i) => { obj[c] = vals[i] ?? "" })
    return obj
  })
  return { columns, rows }
}

export default function UploadPage() {
  const router  = useRouter()
  const dashCtx = useContext(DashCtx)
  const [token, setToken] = useState(null)

  const [dragOver,      setDragOver]      = useState(false)
  const [selectedFiles, setSelectedFiles] = useState([])
  const [previews,      setPreviews]      = useState([])
  const [activePreview, setActivePreview] = useState(0)

  const [uploading,     setUploading]     = useState(false)
  const [uploaded,      setUploaded]      = useState(null)
  const [uploadError,   setUploadError]   = useState("")
  const [showPrepModal, setShowPrepModal] = useState(false)
  const [etlOpen,       setEtlOpen]       = useState(false)
  const fileInputRef = useRef(null)

  const handleEtlSuccess = (data) => {
    setEtlOpen(false)
    setAuth("session_id", data.session_id)
    if (data.user_id) setAuth("user_id", data.user_id)
    if (dashCtx?.setSessionId) dashCtx.setSessionId(data.session_id)
    setUploaded(data)
    setShowPrepModal(true)
  }

  useEffect(() => {
    const t = getAuth("token")
    if (!t) { router.push("/login"); return }
    setToken(t)
  }, [router])

  // ── Read CSV preview whenever files change ─────────────────────────────────
  useEffect(() => {
    let cancelled = false
    async function loadPreviews() {
      const results = await Promise.all(
        selectedFiles.map(f =>
          f.name.toLowerCase().endsWith(".csv")
            ? f.text().then(txt => ({ name: f.name, ...parseCsv(txt) }))
            : Promise.resolve({ name: f.name, columns: [], rows: [] })
        )
      )
      if (!cancelled) {
        setPreviews(results)
        setActivePreview(0)
      }
    }
    if (selectedFiles.length) loadPreviews()
    else setPreviews([])
    return () => { cancelled = true }
  }, [selectedFiles])

  const addFiles = (files) => {
    const valid = Array.from(files).filter(f => /\.(csv|xlsx|xls)$/i.test(f.name))
    setSelectedFiles(prev => [...prev, ...valid])
    setUploaded(null)
    setUploadError("")
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    addFiles(e.dataTransfer.files)
  }

  const handleFileInput = (e) => {
    addFiles(e.target.files)
    e.target.value = ""
  }

  const removeFile = (idx) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== idx))
    setPreviews(prev => prev.filter((_, i) => i !== idx))
    setActivePreview(0)
    setUploaded(null)
  }

  // ── Step 1: Upload files → get session_id back ─────────────────────────────
  const handleUpload = async () => {
    if (!selectedFiles.length || !token) return
    setUploading(true)
    setUploadError("")
    try {
      const form = new FormData()
      selectedFiles.forEach(f => form.append("files", f))
      const res  = await fetch(`${API}/upload/`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}` },
        body:    form,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || "Upload failed")
      setAuth("session_id", data.session_id)
      if (data.user_id) setAuth("user_id", data.user_id)
      // Notify layout so sidebar shows session tabs immediately
      if (dashCtx?.setSessionId) dashCtx.setSessionId(data.session_id)
      setUploaded(data)
    } catch (err) {
      setUploadError(err.message)
    } finally {
      setUploading(false)
    }
  }

  // ── Step 2: open preprocessing modal ─────────────────────────────────────
  const handleProcess = () => {
    if (!uploaded) return
    setShowPrepModal(true)
  }

  const handlePrepDone = useCallback(() => {
    setShowPrepModal(false)
    router.push("/dashboard/overview")
  }, [router])

  const cur  = previews[activePreview]
  const dark = dashCtx?.isDark ?? false

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Upload Datasets</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          Upload CSV or Excel files. Preview the data, then click&nbsp;
          <strong className="text-slate-700 dark:text-slate-200">Upload</strong> to store, and&nbsp;
          <strong className="text-emerald-600 dark:text-emerald-400">Process</strong> to run the pipeline.
        </p>
      </div>

      {uploadError && (
        <div className="bg-red-50 dark:bg-red-900/40 border border-red-200 dark:border-red-500/40 text-red-600 dark:text-red-300 rounded-xl px-4 py-3 text-sm">
          {uploadError}
        </div>
      )}

      {/* ── Two-option cards (hidden once files selected) ── */}
      {!selectedFiles.length && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Card 1 — Upload files */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all select-none ${
              dragOver
                ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20 scale-[1.01]"
                : "border-slate-300 dark:border-slate-600 hover:border-blue-300 dark:hover:border-slate-400 bg-white dark:bg-white/5"
            }`}
          >
            <div className="text-5xl mb-4">📂</div>
            <p className="text-slate-700 dark:text-slate-200 font-semibold text-base">Upload Files</p>
            <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">.csv .xlsx .xls</p>
            <input ref={fileInputRef} type="file" multiple accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileInput} />
          </div>

          {/* Card 2 — Connect to server */}
          <button
            onClick={() => setEtlOpen(true)}
            className="border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-blue-300 dark:hover:border-slate-400 bg-white dark:bg-white/5 rounded-2xl p-12 text-center cursor-pointer transition-all select-none"
          >
            <div className="text-5xl mb-4">🔌</div>
            <p className="text-slate-700 dark:text-slate-200 font-semibold text-base">Connect to Server</p>
            <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">MySQL · PostgreSQL · SQL Server</p>
          </button>
        </div>
      )}

      {/* ── File list + actions ── */}
      {selectedFiles.length > 0 && (
        <div className="space-y-3">
          {/* File chips */}
          <div className="flex flex-wrap gap-2 items-center">
            {selectedFiles.map((f, i) => (
              <span
                key={i}
                onClick={() => setActivePreview(i)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm cursor-pointer border transition select-none ${
                  activePreview === i
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white dark:bg-white/5 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-white/10 hover:border-blue-300"
                }`}
              >
                <span className="text-xs opacity-70">{(f.size / 1024).toFixed(1)} KB</span>
                {f.name}
                <button
                  onClick={e => { e.stopPropagation(); removeFile(i) }}
                  className={`text-lg leading-none hover:text-red-400 transition ${activePreview === i ? "text-white/70" : "text-slate-400"}`}
                >
                  ×
                </button>
              </span>
            ))}
            {/* Add more */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-lg text-sm border border-dashed border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500 hover:border-blue-400 hover:text-blue-500 transition"
            >
              + Add file
            </button>
            <input ref={fileInputRef} type="file" multiple accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileInput} />
          </div>

          {/* CSV table preview */}
          {cur && cur.columns.length > 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Preview — {cur.name}
                  <span className="ml-2 font-normal normal-case">
                    ({cur.rows.length} rows shown · {cur.columns.length} columns)
                  </span>
                </p>
              </div>
              <div className="overflow-x-auto overflow-y-auto max-h-64">
                <table className="min-w-full text-xs whitespace-nowrap">
                  <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 z-10">
                    <tr>
                      <th className="px-3 py-2 text-right text-slate-400 font-mono w-10 border-b border-slate-200 dark:border-white/10">#</th>
                      {cur.columns.map(c => (
                        <th key={c} className="px-3 py-2 text-left text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-white/10">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cur.rows.map((row, i) => (
                      <tr
                        key={i}
                        className={`border-t border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 ${
                          i % 2 === 0 ? "bg-white dark:bg-transparent" : "bg-slate-50/60 dark:bg-white/[0.02]"
                        }`}
                      >
                        <td className="px-3 py-1.5 text-right text-slate-300 dark:text-slate-600 font-mono">{i + 1}</td>
                        {cur.columns.map(c => (
                          <td key={c} className="px-3 py-1.5 text-slate-700 dark:text-slate-300 max-w-[200px] truncate">
                            {row[c] === "" ? <span className="italic text-slate-300 dark:text-slate-600">null</span> : row[c]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Non-CSV notice */}
          {cur && cur.columns.length === 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-white/10 px-4 py-8 text-center text-slate-400 text-sm bg-white dark:bg-white/5">
              Preview not available for Excel files. File will be processed after upload.
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-1">
            {!uploaded ? (
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="flex-1 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-all text-base"
              >
                {uploading
                  ? "Uploading…"
                  : `⬆ Upload ${selectedFiles.length} File${selectedFiles.length > 1 ? "s" : ""}`}
              </button>
            ) : (
              <>
                <div className="flex-1 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/40 rounded-xl px-4 py-3 flex items-center gap-3">
                  <span className="text-emerald-600 dark:text-emerald-400 text-xl">✓</span>
                  <div>
                    <p className="text-emerald-700 dark:text-emerald-300 font-semibold text-sm">
                      {uploaded.files.length} file{uploaded.files.length > 1 ? "s" : ""} uploaded
                    </p>
                    <p className="text-emerald-600/70 dark:text-emerald-400/70 text-xs font-mono">
                      session: {uploaded.session_id}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleProcess}
                  className="px-8 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold py-3.5 rounded-xl transition-all text-base"
                >
                  ⚙ Process
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Preprocessing popup modal */}
      {showPrepModal && uploaded && token && (
        <PreprocessingModal
          sessionId={uploaded.session_id}
          token={token}
          isDark={dark}
          onDone={handlePrepDone}
          onDismissError={() => setShowPrepModal(false)}
        />
      )}

      {/* ETL connect-to-server modal */}
      {etlOpen && token && (
        <EtlModal
          token={token}
          isDark={dark}
          onSuccess={handleEtlSuccess}
          onClose={() => setEtlOpen(false)}
        />
      )}
    </div>
  )
}
