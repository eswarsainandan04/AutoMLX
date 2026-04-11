"use client"

import { useCallback, useContext, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { getAuth } from "@/lib/auth"
import { API_BASE_URL } from "@/lib/api"
import { DashCtx } from "../context"
import { Bar } from "react-chartjs-2"
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js"

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend)

const API = API_BASE_URL

// ─── Small reusable components ────────────────────────────────────────────────

function StatCard({ label, value, sub, color = "blue" }) {
  const grad = {
    blue:   "from-blue-500 to-blue-700",
    green:  "from-emerald-500 to-emerald-700",
    orange: "from-orange-500 to-orange-700",
    purple: "from-purple-500 to-purple-700",
    red:    "from-rose-500 to-rose-700",
    teal:   "from-teal-500 to-teal-700",
  }
  return (
    <div className={`relative overflow-hidden rounded-xl p-5 text-white bg-gradient-to-br ${grad[color]}`}>
      <p className="text-white/70 text-xs uppercase tracking-widest font-medium">{label}</p>
      <p className="text-3xl font-extrabold mt-1 leading-none">{value}</p>
      {sub && <p className="text-white/70 text-xs mt-1.5">{sub}</p>}
    </div>
  )
}

function SecondaryCard({ label, value, sub }) {
  return (
    <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4">
      <p className="text-slate-400 text-xs uppercase tracking-wide">{label}</p>
      <p className="text-slate-900 dark:text-white font-bold text-2xl mt-1">{value ?? "—"}</p>
      {sub && <p className="text-slate-400 text-xs mt-1">{sub}</p>}
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <h3 className="text-slate-900 dark:text-white font-bold text-lg mb-3 flex items-center gap-2">
      {children}
    </h3>
  )
}

function Badge({ children, color = "blue" }) {
  const cls = {
    blue:   "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
    green:  "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300",
    orange: "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300",
    red:    "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300",
    gray:   "bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300",
    purple: "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300",
    teal:   "bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300",
    amber:  "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
  }
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${cls[color]}`}>
      {children}
    </span>
  )
}

// ─── EDA Drawer (all-columns panel) ──────────────────────────────────────────

const ACCENT = "#6366f1"

const CHART_OPTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { color: "#94a3b8", maxRotation: 45, font: { size: 9 } }, grid: { color: "rgba(148,163,184,.08)" } },
    y: { ticks: { color: "#94a3b8", font: { size: 9 } }, grid: { color: "rgba(148,163,184,.08)" }, beginAtZero: true },
  },
}

function fmtNum(v) {
  if (v === null || v === undefined) return "—"
  const n = Number(v)
  if (isNaN(n)) return String(v)
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + "B"
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + "M"
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + "K"
  if (Number.isInteger(n)) return n.toLocaleString()
  return parseFloat(n.toFixed(4)).toString()
}

function ColEDARow({ col, filename, sessionId, token }) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/upload/eda/${sessionId}/${filename}/${encodeURIComponent(col.column_name)}`,
      { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(setData).catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  const structColors = {
    numeric: "text-blue-400", categorical: "text-purple-400", text: "text-slate-400",
    datetime: "text-teal-400", boolean: "text-green-400", identifier: "text-amber-400",
  }

  const chartData = data?.chart ? {
    labels: data.chart.labels,
    datasets: [{ data: data.chart.values, backgroundColor: ACCENT + "bb", borderColor: ACCENT, borderWidth: 1, borderRadius: 3 }],
  } : null

  const stats = !data ? [] : data.dtype === "numeric" ? [
    ["Min",       fmtNum(data.min)],
    ["Max",       fmtNum(data.max)],
    ["Avg",       fmtNum(data.mean)],
    ["Median",    fmtNum(data.median)],
    ["Q1",        fmtNum(data.q1)],
    ["Q2",        fmtNum(data.q2)],
    ["Q3",        fmtNum(data.q3)],
    ["IQR",       fmtNum(data.iqr)],
    ["Range",     fmtNum(data.range)],
    ["Std Dev",   fmtNum(data.std)],
    ["Variance",  fmtNum(data.variance)],
    ["Skewness",  fmtNum(data.skewness)],
    ["Kurtosis",  fmtNum(data.kurtosis)],
    ["Sum",       fmtNum(data.sum)],
    ["Unique",    data.unique_count],
    ["Null Count",data.null_count],
    ["Null %",    (data.null_percentage ?? 0).toFixed(2) + "%"],
    ["Total Rows",data.total_rows],
  ] : [
    ["Mode",      data.mode ?? "—"],
    ["Unique",    data.unique_count],
    ["Null Count",data.null_count],
    ["Null %",    (data.null_percentage ?? 0).toFixed(2) + "%"],
    ["Total Rows",data.total_rows],
  ]

  return (
    <div className="py-4">
      {/* Column header */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="font-mono font-bold text-slate-900 dark:text-white">{col.column_name}</span>
        <span className={`text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 font-medium ${structColors[col.structural_type] ?? "text-slate-400"}`}>
          {col.structural_type}
        </span>
        <span className="text-slate-400 text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10">{col.semantic_type}</span>
        <span className="text-slate-400 text-xs font-mono ml-1">{col.inferred_dtype}</span>
        {col.null_count > 0 && (
          <span className="text-rose-400 text-xs ml-2">● {col.null_count} null ({col.null_percentage?.toFixed(1)}%)</span>
        )}
      </div>

      {loading && <div className="text-slate-400 text-xs py-3">Loading…</div>}

      {data && (() => {
        const mid = Math.ceil(stats.length / 2)
        const left  = stats.slice(0, mid)
        const right = stats.slice(mid)
        const tblCls = "text-xs w-full border border-slate-200 dark:border-white/10 rounded-lg overflow-hidden"
        const thCls  = "px-2.5 py-1.5 text-slate-500 dark:text-slate-400 font-semibold"
        const StatsTable = ({ rows }) => (
          <table className={tblCls}>
            <thead>
              <tr className="bg-slate-100 dark:bg-white/10">
                <th className={`${thCls} text-left`}>Field</th>
                <th className={`${thCls} text-right`}>Data</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([f, v]) => (
                <tr key={f} className="border-t border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5">
                  <td className="px-2.5 py-0.5 text-slate-500 dark:text-slate-400 whitespace-nowrap">{f}</td>
                  <td className="px-2.5 py-0.5 text-slate-900 dark:text-white font-medium text-right tabular-nums">{v ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
        return (
          <div className="flex gap-4 items-start">
            {/* Two stat tables side by side */}
            <div className="flex gap-2 flex-shrink-0">
              <div className="w-44"><StatsTable rows={left} /></div>
              {right.length > 0 && <div className="w-44"><StatsTable rows={right} /></div>}
            </div>
            {/* Chart */}
            {chartData && (
              <div className="flex-1 min-w-0" style={{ height: 170 }}>
                <Bar data={chartData} options={CHART_OPTS} />
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}

function EDAModal({ columns, filename, sessionId, token, onClose }) {
  const backdropRef = useRef(null)

  return (
    <div
      ref={backdropRef}
      onClick={e => { if (e.target === backdropRef.current) onClose() }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-4xl max-h-[88vh] flex flex-col shadow-2xl border border-slate-200 dark:border-white/10">

        {/* Sticky header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/10 flex-shrink-0">
          <div>
            <h3 className="text-slate-900 dark:text-white font-bold text-lg">📊 Exploratory Data Analysis</h3>
            <p className="text-slate-400 text-xs mt-0.5">{filename} &middot; {columns.length} columns</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-900 dark:hover:text-white text-2xl leading-none p-1 transition"
          >×</button>
        </div>

        {/* Scrollable body — one section per column */}
        <div className="overflow-y-auto flex-1 px-6 pb-4">
          {columns.map((col, i) => (
            <div key={col.column_name}>
              {i > 0 && <hr className="border-slate-200 dark:border-white/10" />}
              <ColEDARow col={col} filename={filename} sessionId={sessionId} token={token} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const router  = useRouter()
  const dashCtx = useContext(DashCtx)

  // Use cached overview if already loaded; only fetch when context is empty
  const [overview, setOverview] = useState(() => dashCtx?.overviewData ?? null)
  const [selected, setSelected] = useState(0)
  const [loading,  setLoading]  = useState(() => !(dashCtx?.overviewData))
  const [error,    setError]    = useState("")

  const isDark   = dashCtx?.isDark ?? true
  const [edaOpen, setEdaOpen] = useState(false)   // controls EDA drawer

  const fetchOverview = useCallback(async (sid, tok) => {
    try {
      const res = await fetch(`${API}/upload/overview/${sid}`, {
        headers: { Authorization: `Bearer ${tok}` },
      })
      if (!res.ok) throw new Error("Failed to load overview")
      const data = await res.json()
      setOverview(data)
      // Cache in layout so other tabs don't re-fetch
      if (dashCtx?.setOverviewData) dashCtx.setOverviewData(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [dashCtx])

  useEffect(() => {
    // If context already has data, use it — no network call
    if (dashCtx?.overviewData) {
      setOverview(dashCtx.overviewData)
      setLoading(false)
      return
    }
    const t   = getAuth("token")
    const sid = getAuth("session_id")
    if (!t)   { router.push("/login");           return }
    if (!sid) { router.push("/dashboard/upload"); return }
    fetchOverview(sid, t)
  }, [router, fetchOverview, dashCtx])

  // ── Loading / error states ─────────────────────────────────────────────────
  if (loading) return (
    <div className="text-center mt-20 text-slate-400">
      <div className="text-4xl mb-3">⏳</div>
      <p>Loading overview…</p>
    </div>
  )

  if (error) return (
    <div className="max-w-md mx-auto mt-20 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded-xl p-6 text-center">
      <div className="text-3xl mb-2">⚠️</div>
      <p className="text-red-700 dark:text-red-400 font-medium">{error}</p>
      <button
        onClick={() => router.push("/dashboard/upload")}
        className="mt-4 text-sm border border-slate-300 dark:border-slate-600 px-4 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:border-slate-400 transition"
      >
        ← Upload New Files
      </button>
    </div>
  )

  const { total, datasets, constraints } = overview

  // ── Page ───────────────────────────────────────────────────────────────────
  return (
    <>
    <div className="space-y-8 pb-12">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Dataset Overview</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
            {datasets.length} dataset(s) · Session{" "}
            <code className="text-blue-500 dark:text-blue-400 font-mono text-xs">{overview.session_id}</code>
          </p>
        </div>
        <button
          onClick={() => router.push("/dashboard/upload")}
          className="text-sm text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:border-slate-400 px-4 py-2 rounded-lg transition"
        >
          + Upload More
        </button>
        <button
          onClick={() => router.push("/dashboard/analytics")}
          className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition font-medium shadow"
        >
          📈 View Analytics
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 1 — TOTAL OVERVIEW (all datasets combined)
      ══════════════════════════════════════════════════════════════════════ */}
      <section>
        <SectionTitle>📊 Total Summary — All Datasets</SectionTitle>

        {/* Primary stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard label="Files Processed"      value={total.file_count}                                                         color="blue"   />
          <StatCard label="Rows (Before)"         value={total.total_rows_before.toLocaleString()}                                 color="purple" />
          <StatCard label="Rows (After)"          value={total.total_rows_after.toLocaleString()}                                  color="green"  />
          <StatCard label="Rows Cleaned"          value={(total.total_rows_before - total.total_rows_after).toLocaleString()}
                    sub="removed during cleaning"                                                                                   color="orange" />
          <StatCard label="Missing Values Fixed"  value={total.total_missing_before.toLocaleString()}
                    sub={`${total.total_missing_after} remaining`}                                                                 color="teal"   />
          <StatCard label="Duplicates Removed"    value={total.total_duplicates_removed.toLocaleString()}                          color="red"    />
        </div>

        {/* Secondary counts */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SecondaryCard label="Total Columns"           value={total.total_columns} />
          <SecondaryCard label="Columns Transformed"     value={total.total_columns_transformed} />
          <SecondaryCard label="Columns Dropped"         value={total.total_columns_dropped} />
          <SecondaryCard label="Rows Dropped (NaN)"      value={total.total_rows_dropped} />
        </div>

        {/* Primary Keys + Foreign Keys across all files */}
        {(total.all_primary_keys?.length > 0 || total.all_foreign_keys?.length > 0) && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Primary Keys */}
            <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-5">
              <p className="text-slate-400 text-xs uppercase tracking-widest font-medium mb-3">🗝 Primary Keys</p>
              {total.all_primary_keys?.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {total.all_primary_keys.map((pk, i) => (
                    <span
                      key={i}
                      className="bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-700/40 px-3 py-1.5 rounded-lg text-sm font-mono flex items-center gap-2"
                    >
                      <span className="font-semibold">{pk.column}</span>
                      {total.file_count > 1 && (
                        <span className="text-amber-500 dark:text-amber-500 text-xs bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded">
                          {pk.file}
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 text-sm">None detected</p>
              )}
            </div>

            {/* Foreign Keys */}
            <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-5">
              <p className="text-slate-400 text-xs uppercase tracking-widest font-medium mb-3">🔗 Foreign Keys</p>
              {total.all_foreign_keys?.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {total.all_foreign_keys.map((fk, i) => (
                    <span
                      key={i}
                      className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700/40 px-3 py-1.5 rounded-lg text-sm font-mono flex items-center gap-2"
                    >
                      <span className="font-semibold">{fk.column}</span>
                      {total.file_count > 1 && (
                        <span className="text-indigo-500 dark:text-indigo-400 text-xs bg-indigo-100 dark:bg-indigo-900/40 px-1.5 py-0.5 rounded">
                          {fk.file}
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 text-sm">None detected</p>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION — SCHEMA CONSTRAINTS
      ══════════════════════════════════════════════════════════════════════ */}
      {constraints && (
        constraints.primary_keys?.length > 0 ||
        constraints.unique_keys?.length   > 0 ||
        constraints.foreign_keys?.length  > 0
      ) && (
        <section>
          <SectionTitle>🔒 Schema Constraints</SectionTitle>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Primary Keys */}
            <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-5">
              <p className="text-slate-400 text-xs uppercase tracking-widest font-medium mb-3">🗝 Primary Keys</p>
              {constraints.primary_keys?.length > 0 ? (
                <div className="space-y-3">
                  {constraints.primary_keys.map((pk, i) => (
                    <div key={i}>
                      {datasets.length > 1 && (
                        <p className="text-slate-400 text-xs font-mono mb-1.5">{pk.dataset_name}</p>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        {pk.columns.map(col => (
                          <span
                            key={col}
                            className="bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-700/40 px-2.5 py-1 rounded-lg text-xs font-mono font-medium"
                          >
                            🗝 {col}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 text-sm">None detected</p>
              )}
            </div>

            {/* Unique Keys */}
            <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-5">
              <p className="text-slate-400 text-xs uppercase tracking-widest font-medium mb-3">✨ Unique Columns</p>
              {constraints.unique_keys?.length > 0 ? (
                <div className="space-y-3">
                  {constraints.unique_keys.map((uk, i) => (
                    <div key={i}>
                      {datasets.length > 1 && (
                        <p className="text-slate-400 text-xs font-mono mb-1.5">{uk.dataset_name}</p>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        {uk.columns.map(col => (
                          <span
                            key={col}
                            className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-700/40 px-2.5 py-1 rounded-lg text-xs font-mono font-medium"
                          >
                            ✨ {col}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 text-sm">None detected</p>
              )}
            </div>

            {/* Foreign Keys */}
            <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-5">
              <p className="text-slate-400 text-xs uppercase tracking-widest font-medium mb-3">🔗 Foreign Keys</p>
              {constraints.foreign_keys?.length > 0 ? (
                <div className="space-y-2">
                  {constraints.foreign_keys.map((fk, i) => (
                    <div key={i} className="flex items-start gap-2 flex-wrap">
                      <span className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700/40 px-2.5 py-1 rounded-lg text-xs font-mono font-medium whitespace-nowrap">
                        🔗 {fk.column_name}
                      </span>
                      <span className="text-slate-400 text-xs self-center">in</span>
                      <div className="flex flex-wrap gap-1">
                        {fk.datasets.map(ds => (
                          <span
                            key={ds}
                            className="bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded text-xs font-mono"
                          >
                            {ds}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 text-sm">None — only one dataset loaded</p>
              )}
            </div>

          </div>
        </section>
      )}

      {/* Empty state */}
      {datasets.length === 0 && (
        <div className="text-center text-slate-400 mt-16">
          <div className="text-4xl mb-3">📭</div>
          No processed datasets found for this session.
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          FILE SELECTOR (dropdown when multiple files)
      ══════════════════════════════════════════════════════════════════════ */}
      {datasets.length > 1 && (
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">📁 File:</p>
          {datasets.map((ds, i) => (
            <button
              key={i}
              onClick={() => setSelected(i)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                selected === i
                  ? "bg-blue-600 text-white shadow"
                  : "bg-white dark:bg-white/10 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-transparent hover:bg-slate-50 dark:hover:bg-white/20"
              }`}
            >
              {ds.filename}
            </button>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 2 — PER-FILE INDIVIDUAL OVERVIEW
      ══════════════════════════════════════════════════════════════════════ */}
      {datasets.length > 0 && (() => {
        const ds  = datasets[selected]
        const p   = ds.profiling
        const mv  = p.missing_values_summary   ?? {}
        const rp  = p.row_processing_summary   ?? {}
        const tr  = p.transformation_summary   ?? {}
        const fl  = p.dataset_level_flags      ?? {}
        const nRows = p.number_of_rows         ?? 0
        const nCols = p.number_of_columns      ?? 0

        return (
          <div className="space-y-6">

            {/* ── File header card ── */}
            <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-slate-400 text-xs uppercase tracking-widest mb-1">Individual File Overview</p>
                  <h3 className="text-slate-900 dark:text-white font-bold text-xl">{ds.filename}</h3>
                  <p className="text-slate-400 text-sm mt-0.5">{p.file_name}</p>
                </div>
                <div className="flex gap-8 flex-wrap">
                  <div className="text-center">
                    <p className="text-slate-400 text-xs uppercase tracking-wide">Rows (final)</p>
                    <p className="text-slate-900 dark:text-white font-extrabold text-3xl">
                      {(rp.final_row_count ?? nRows).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-slate-400 text-xs uppercase tracking-wide">Columns</p>
                    <p className="text-slate-900 dark:text-white font-extrabold text-3xl">{nCols}</p>
                  </div>
                </div>
              </div>

              {/* Dataset-level flags */}
            
            </div>

            {/* ── Primary Keys ── */}
        

            {/* ── Before & After Preprocessing ── */}
            <section>
              <SectionTitle>🔄 Before &amp; After Preprocessing</SectionTitle>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  {
                    label: "Rows",
                    before: (rp.original_row_count ?? nRows).toLocaleString(),
                    after:  (rp.final_row_count    ?? nRows).toLocaleString(),
                    diff:    rp.dropped_missing_rows   ?? 0,
                    unit:   "dropped (NaN rows)",
                  },
                  {
                    label: "Duplicate Rows",
                    before: ((rp.duplicate_rows_removed ?? 0) + (rp.final_row_count ?? nRows)).toLocaleString(),
                    after:  (rp.final_row_count ?? nRows).toLocaleString(),
                    diff:    rp.duplicate_rows_removed ?? 0,
                    unit:   "removed",
                  },
                  {
                    label: "Missing Values",
                    before: (mv.total_missing_before ?? 0).toLocaleString(),
                    after:  (mv.total_missing_after  ?? 0).toLocaleString(),
                    diff:   (mv.total_missing_before ?? 0) - (mv.total_missing_after ?? 0),
                    unit:   "imputed",
                  },
                  {
                    label: "Columns",
                    before: (nCols + (tr.columns_dropped ?? 0)).toString(),
                    after:  nCols.toString(),
                    diff:    tr.columns_dropped ?? 0,
                    unit:   "dropped",
                  },
                ].map(item => (
                  <div
                    key={item.label}
                    className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4"
                  >
                    <p className="text-slate-400 text-xs uppercase tracking-wide font-medium mb-2">{item.label}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-rose-500 dark:text-rose-400 font-bold text-lg">{item.before}</span>
                      <span className="text-slate-300 dark:text-slate-600 text-sm">→</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold text-lg">{item.after}</span>
                    </div>
                    {item.diff > 0 && (
                      <p className="text-xs text-slate-400 mt-1">
                        <span className="text-amber-500 font-medium">
                          −{typeof item.diff === "number" ? item.diff.toLocaleString() : item.diff}
                        </span>{" "}
                        {item.unit}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* ── Missing Values Column Detail ── */}
            {mv.columns_with_missing && Object.keys(mv.columns_with_missing).length > 0 && (
              <section>
                <SectionTitle>🩹 Missing Values — Column Detail</SectionTitle>
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-white/10">
                        {["Column", "Missing Count", "Missing %", "Data Type", "Imputation Method"].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-slate-600 dark:text-slate-300 font-semibold whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(mv.columns_with_missing).map(([col, info], i) => (
                        <tr
                          key={col}
                          className={`border-t border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors ${
                            i % 2 === 0 ? "bg-white dark:bg-transparent" : "bg-slate-50/60 dark:bg-white/[0.02]"
                          }`}
                        >
                          <td className="px-4 py-2.5 text-slate-800 dark:text-white font-mono font-medium">{col}</td>
                          <td className="px-4 py-2.5 text-rose-600 dark:text-rose-400 font-semibold">{info.missing_count.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{info.missing_percentage?.toFixed(2)}%</td>
                          <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 font-mono">{info.dtype}</td>
                          <td className="px-4 py-2.5"><Badge color="teal">{info.imputation_method}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex gap-4 mt-2 text-xs text-slate-400">
                  <span>AutoGluon validated: {mv.autogluon_validated ? "✅ Yes" : "❌ No"}</span>
                  <span>·</span>
                  <span>Tokens normalized: {mv.tokens_normalized ?? 0}</span>
                </div>
              </section>
            )}

            {/* ── Column-wise Summary Table ── */}
            {p.column_wise_summary?.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <SectionTitle>📋 Column Summary</SectionTitle>
                  <button
                    onClick={() => setEdaOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition"
                  >
                    View EDA 📊
                  </button>
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-white/10">
                        {["Column", "Inferred Type", "Semantic Type", "Attribute Type", "Confidence", "Null Count", "Null %", "Unique / Total"].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-slate-600 dark:text-slate-300 font-semibold whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {p.column_wise_summary.map((col, i) => {
                        const isPK = ds.primary_keys.includes(col.column_name)
                        const conf = col.semantic_confidence ?? 0
                        const confColor = conf >= 0.8 ? "green" : conf >= 0.5 ? "orange" : "red"
                        const structuralColorMap = {
                          numeric:     "blue",
                          categorical: "purple",
                          text:        "gray",
                          datetime:    "teal",
                          date:        "teal",
                          time:        "teal",
                          boolean:     "green",
                          identifier:  "amber",
                          unknown:     "gray",
                        }
                        const attrColor = structuralColorMap[col.structural_type] ?? "gray"
                        return (
                          <tr
                            key={i}
                            className={`border-t border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors ${
                              i % 2 === 0 ? "bg-white dark:bg-transparent" : "bg-slate-50/60 dark:bg-white/[0.02]"
                            }`}
                          >
                            <td className="px-4 py-2.5 text-slate-800 dark:text-white font-mono font-medium whitespace-nowrap">
                              {isPK && <span className="mr-1 text-amber-500" title="Primary Key">🗝</span>}
                              {col.column_name}
                            </td>
                            <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 whitespace-nowrap font-mono">{col.inferred_dtype}</td>
                            <td className="px-4 py-2.5"><Badge color="blue">{col.semantic_type}</Badge></td>
                            <td className="px-4 py-2.5">
                              <Badge color={attrColor}>
                                {col.structural_type ?? "—"}
                              </Badge>
                            </td>
                            <td className="px-4 py-2.5"><Badge color={confColor}>{(conf * 100).toFixed(0)}%</Badge></td>
                            <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">
                              {col.null_count > 0
                                ? <span className="text-rose-500 dark:text-rose-400 font-semibold">{col.null_count.toLocaleString()}</span>
                                : <span className="text-emerald-600 dark:text-emerald-400">0</span>}
                            </td>
                            <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">
                              {col.null_count > 0
                                ? <span className="text-rose-400">{col.null_percentage?.toFixed(2)}%</span>
                                : <span className="text-emerald-600 dark:text-emerald-400">0%</span>}
                            </td>
                            <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                              {(col.unique_count ?? 0).toLocaleString()} / {nRows.toLocaleString()}
                            </td>
                          
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {p.column_wise_summary.some(c => c.semantic_notes) && (
                  <details className="mt-2">
                    <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-300">
                      Show semantic detection notes
                    </summary>
                    <ul className="mt-2 space-y-1">
                      {p.column_wise_summary.filter(c => c.semantic_notes).map(c => (
                        <li key={c.column_name} className="text-xs text-slate-400 font-mono">
                          <span className="text-slate-600 dark:text-slate-300">{c.column_name}:</span> {c.semantic_notes}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </section>
            )}

            {/* ── Transformation Summary ── */}
            {tr.columns_transformed !== undefined && (
              <section>
                <SectionTitle>🔧 Transformation Summary</SectionTitle>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4">
                    <p className="text-slate-400 text-xs uppercase tracking-wide">Columns Transformed</p>
                    <p className="text-slate-900 dark:text-white font-bold text-2xl mt-1">{tr.columns_transformed}</p>
                    {tr.transformed_column_list?.length > 0 && (
                      <p className="text-xs text-slate-400 mt-2 leading-relaxed">{tr.transformed_column_list.join(", ")}</p>
                    )}
                  </div>
                  <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4">
                    <p className="text-slate-400 text-xs uppercase tracking-wide">Columns Skipped</p>
                    <p className="text-slate-900 dark:text-white font-bold text-2xl mt-1">{tr.columns_skipped ?? 0}</p>
                    {tr.skipped_column_list?.length > 0 && (
                      <p className="text-xs text-slate-400 mt-2">{tr.skipped_column_list.join(", ")}</p>
                    )}
                  </div>
                  <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4">
                    <p className="text-slate-400 text-xs uppercase tracking-wide">Columns Dropped</p>
                    <p className="text-slate-900 dark:text-white font-bold text-2xl mt-1">{tr.columns_dropped ?? 0}</p>
                    {tr.dropped_column_list?.length > 0 && (
                      <p className="text-xs text-slate-400 mt-2">{tr.dropped_column_list.join(", ")}</p>
                    )}
                  </div>
                </div>
                {tr.transformation_date && (
                  <p className="text-xs text-slate-400 mt-2">Processed on: {tr.transformation_date}</p>
                )}
                {rp.processing_date && (
                  <p className="text-xs text-slate-400">Row processing on: {rp.processing_date}</p>
                )}
              </section>
            )}

            {/* ── Data Preview ── */}
            {ds.preview?.length > 0 && ds.columns?.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                  <SectionTitle>
                    👁 Data Preview
                    <span className="text-slate-400 font-normal text-sm">({ds.preview.length} rows · cleaned)</span>
                  </SectionTitle>
                  <button
                    onClick={() => {
                      const header = ds.columns.join(",")
                      const rows = ds.preview.map(row =>
                        ds.columns.map(c => {
                          const v = row[c] ?? ""
                          return String(v).includes(",") ? `"${String(v).replace(/"/g, '""')}"` : String(v)
                        }).join(",")
                      )
                      const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" })
                      const url  = URL.createObjectURL(blob)
                      const a    = document.createElement("a")
                      a.href     = url
                      a.download = `${ds.filename}_cleaned.csv`
                      a.click()
                      URL.revokeObjectURL(url)
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition"
                  >
                    ⬇ Download Cleaned CSV
                  </button>
                </div>
                <div className="overflow-x-auto overflow-y-auto max-h-[420px] rounded-xl border border-slate-200 dark:border-white/10">
                  <table className="min-w-full text-sm whitespace-nowrap">
                    <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 shadow-sm">
                      <tr>
                        <th className="px-3 py-3 text-slate-400 font-mono text-xs border-b border-slate-200 dark:border-white/10 text-right w-12">#</th>
                        {ds.columns.map(col => {
                          const isPK = ds.primary_keys.includes(col)
                          return (
                            <th
                              key={col}
                              className={`px-4 py-3 text-left font-semibold border-b border-slate-200 dark:border-white/10 ${
                                isPK ? "text-amber-600 dark:text-amber-400" : "text-slate-700 dark:text-slate-300"
                              }`}
                            >
                              {isPK && "🗝 "}{col}
                            </th>
                          )
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {ds.preview.map((row, i) => (
                        <tr
                          key={i}
                          className={`border-t border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 ${
                            i % 2 === 0 ? "bg-white dark:bg-transparent" : "bg-slate-50/60 dark:bg-white/[0.025]"
                          }`}
                        >
                          <td className="px-3 py-2 text-slate-300 dark:text-slate-600 font-mono text-xs text-right">{i + 1}</td>
                          {ds.columns.map(col => (
                            <td key={col} className="px-4 py-2 text-slate-700 dark:text-slate-300 max-w-[240px] truncate">
                              {row[col] === null || row[col] === "" || row[col] === undefined
                                ? <span className="text-slate-300 dark:text-slate-600 italic">null</span>
                                : String(row[col])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* ── Quick Actions ── */}


          </div>
        )
      })()}

    </div>

    {/* EDA Modal */}
    {edaOpen && (() => {
      const ds = datasets[selected]
      return (
        <EDAModal
          columns={ds.profiling.column_wise_summary}
          filename={ds.filename}
          sessionId={overview.session_id}
          token={getAuth("token")}
          onClose={() => setEdaOpen(false)}
        />
      )
    })()}
    </>
  )
}
