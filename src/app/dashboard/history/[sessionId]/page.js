"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { getAuth } from "@/lib/auth"
import { API_BASE_URL } from "@/lib/api"
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend, Filler,
} from "chart.js"
import { Bar, Line, Pie, Scatter } from "react-chartjs-2"

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend, Filler,
)

const API = API_BASE_URL


const PALETTE = [
  "#6366f1","#22d3ee","#f59e0b","#10b981","#f43f5e",
  "#8b5cf6","#3b82f6","#ec4899","#14b8a6","#f97316",
  "#a3e635","#fb7185",
]

const BG = (hex, a = 0.75) => {
  const r = parseInt(hex.slice(1,3),16)
  const g = parseInt(hex.slice(3,5),16)
  const b = parseInt(hex.slice(5,7),16)
  return `rgba(${r},${g},${b},${a})`
}

const DARK_OPTS = {
  tickColor: "#94a3b8", gridColor: "#334155",
  tooltipBg: "#1e293b", tooltipTitle: "#f8fafc", tooltipBody: "#cbd5e1",
  legendColor: "#94a3b8",
}

function baseOpts(yMin, yMax) {
  const c = DARK_OPTS
  const opts = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: "top", labels: { color: c.legendColor, font: { size: 12 } } },
      tooltip: { backgroundColor: c.tooltipBg, titleColor: c.tooltipTitle, bodyColor: c.tooltipBody },
    },
    scales: {
      x: { ticks: { color: c.tickColor, maxRotation: 45 }, grid: { color: c.gridColor } },
      y: { ticks: { color: c.tickColor }, grid: { color: c.gridColor } },
    },
  }
  const mn = parseFloat(yMin); const mx = parseFloat(yMax)
  if (!isNaN(mn)) opts.scales.y.min = mn
  if (!isNaN(mx)) opts.scales.y.max = mx
  return opts
}

function filterByCats(xs, ys, cats) {
  if (!cats) return { xs, ys }
  const rx=[], ry=[]
  xs.forEach((x,i) => { if(cats.has(String(x))){ rx.push(x); ry.push(ys[i]) } })
  return rx.length ? { xs: rx, ys: ry } : { xs, ys }
}

function AnalyticsChart({ chart }) {
  const colors   = chart.colors?.length ? chart.colors : PALETTE
  const yMin     = chart.y_min  ?? ""
  const yMax     = chart.y_max  ?? ""
  const swapped  = chart.swap_axes ?? false
  const selCats  = chart.selected_categories ? new Set(chart.selected_categories) : undefined
  const t        = chart.type

  if (t === "bar") {
    const { xs, ys } = filterByCats(chart.x_values, chart.y_values, selCats)
    const data = { labels: xs, datasets: [{ label: chart.y_column, data: ys,
      backgroundColor: xs.map((_,i)=>BG(colors[i%colors.length])),
      borderColor:     xs.map((_,i)=>colors[i%colors.length]),
      borderWidth:1, borderRadius:4 }] }
    return <Bar data={data} options={baseOpts(yMin, yMax)} />
  }

  if (t === "histogram") {
    const color = colors[0] ?? PALETTE[0]
    const { xs, ys } = filterByCats(chart.x_values, chart.y_values, selCats)
    const data = { labels: xs, datasets: [{ label: "Frequency", data: ys,
      backgroundColor: BG(color,0.7), borderColor: color,
      borderWidth:1, borderRadius:2, categoryPercentage:1.0, barPercentage:0.98 }] }
    const opts = { ...baseOpts(yMin, yMax) }
    opts.scales = { ...opts.scales,
      x: { ...opts.scales.x, ticks: { ...opts.scales.x.ticks, maxTicksLimit:10 } } }
    return <Bar data={data} options={opts} />
  }

  if (t === "line") {
    const color = colors[0] ?? PALETTE[0]
    const { xs, ys } = filterByCats(chart.x_values, chart.y_values, selCats)
    const data = { labels: xs, datasets: [{ label: chart.y_column, data: ys,
      borderColor: color, backgroundColor: BG(color,0.15),
      pointBackgroundColor: color, pointRadius:4, tension:0.35, fill:true }] }
    return <Line data={data} options={baseOpts(yMin, yMax)} />
  }

  if (t === "pie") {
    const { xs, ys } = filterByCats(chart.x_values, chart.y_values, selCats)
    const total = ys.reduce((a,b)=>a+(Number(b)||0),0)
    const data = { labels: xs, datasets: [{ data: ys,
      backgroundColor: xs.map((_,i)=>BG(colors[i%colors.length],0.85)),
      borderColor:     xs.map((_,i)=>colors[i%colors.length]), borderWidth:2 }] }
    const pctPlugin = { id:"piePct", afterDatasetDraw(ch) {
      const { ctx } = ch
      ch.getDatasetMeta(0).data.forEach((arc,i) => {
        const val=ys[i]; if(!val||total===0) return
        const pct=((Number(val)/total)*100).toFixed(1)
        if(parseFloat(pct)<3) return
        const {x,y}=arc.tooltipPosition()
        ctx.save(); ctx.font="bold 11px sans-serif"; ctx.fillStyle="#fff"
        ctx.textAlign="center"; ctx.textBaseline="middle"
        ctx.shadowColor="rgba(0,0,0,0.55)"; ctx.shadowBlur=3
        ctx.fillText(`${pct}%`,x,y); ctx.restore()
      })
    }}
    const c=DARK_OPTS
    const pieOpts = { responsive:true, maintainAspectRatio:false,
      plugins: { legend:{ position:"right", labels:{ color:c.legendColor, font:{size:11}, padding:14 } },
        tooltip:{ backgroundColor:c.tooltipBg, titleColor:c.tooltipTitle, bodyColor:c.tooltipBody } } }
    return <Pie data={data} options={pieOpts} plugins={[pctPlugin]} />
  }

  if (t === "scatter") {
    const color = colors[0] ?? PALETTE[0]
    const xs = swapped ? chart.y_values : chart.x_values
    const ys = swapped ? chart.x_values : chart.y_values
    const xLabel = swapped ? chart.y_column : chart.x_column
    const yLabel = swapped ? chart.x_column : chart.y_column
    const data = { datasets: [{ label:`${xLabel} vs ${yLabel}`,
      data: xs.map((x,i)=>({x,y:ys[i]})),
      backgroundColor: BG(color,0.6), borderColor:color, pointRadius:4 }] }
    const opts = { ...baseOpts(yMin,yMax), scales: {
      x: { ...baseOpts(yMin,yMax).scales.x, title:{display:true,text:xLabel,color:DARK_OPTS.tickColor} },
      y: { ...baseOpts(yMin,yMax).scales.y, title:{display:true,text:yLabel,color:DARK_OPTS.tickColor} },
    }}
    return <Scatter data={data} options={opts} />
  }

  if (t === "box") {
    if (!chart.box_stats || !Object.keys(chart.box_stats).length) return null
    const labels=Object.keys(chart.box_stats), stats=Object.values(chart.box_stats)
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs text-slate-700 dark:text-slate-300">
          <thead><tr className="text-slate-500 uppercase text-[10px] tracking-widest">
            <th className="text-left py-2 pr-4">{chart.x_column}</th>
            <th className="text-right py-2 px-2">Min</th><th className="text-right py-2 px-2">Q1</th>
            <th className="text-right py-2 px-2">Median</th><th className="text-right py-2 px-2">Q3</th>
            <th className="text-right py-2 px-2">Max</th>
          </tr></thead>
          <tbody>{labels.map((label,i)=>{
            const s=stats[i]
            return (<tr key={label} className="border-t border-slate-100 dark:border-white/5">
              <td className="py-2 pr-4 font-medium whitespace-nowrap">{label}</td>
              <td className="text-right px-2 tabular-nums">{s.min.toLocaleString()}</td>
              <td className="text-right px-2 tabular-nums">{s.q1.toLocaleString()}</td>
              <td className="text-right px-2 tabular-nums font-semibold">{s.median.toLocaleString()}</td>
              <td className="text-right px-2 tabular-nums">{s.q3.toLocaleString()}</td>
              <td className="text-right px-2 tabular-nums">{s.max.toLocaleString()}</td>
            </tr>)
          })}</tbody>
        </table>
      </div>
    )
  }
  return null
}

// ── Analytics tab content ─────────────────────────────────────────────────────

function AnalyticsTab({ sessionId }) {
  const [analyticsData, setAnalyticsData] = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState("")
  const [selDs,    setSelDs]    = useState(0)

  useEffect(() => {
    const token = getAuth("token")
    if (!token) return
    setLoading(true); setError("")

    const bootstrap = async () => {
      try {
        const statusRes = await fetch(`${API}/analytics/status/${sessionId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!statusRes.ok) {
          throw new Error(`Server error ${statusRes.status}`)
        }

        const status = await statusRes.json()
        if (!status?.generated) {
          setAnalyticsData(null)
          return
        }

        const res = await fetch(`${API}/analytics/load/${sessionId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error(`Server error ${res.status}`)

        const data = await res.json()
        setAnalyticsData(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    bootstrap()
  }, [sessionId])

  if (loading) return (
    <div className="text-slate-400 animate-pulse text-sm py-8 text-center">Loading analytics…</div>
  )

  if (error) return (
    <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/40 text-red-700 dark:text-red-400 text-sm">
      {error}
    </div>
  )

  if (!analyticsData) return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <div className="text-5xl">📊</div>
      <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs">
        No analytics generated for this session yet. Open Analytics from the dashboard to generate them.
      </p>
    </div>
  )

  const { datasets = [], foreign_keys = [] } = analyticsData
  const ds     = datasets[selDs]
  const charts = ds?.charts ?? []

  return (
    <div className="space-y-6">
      {foreign_keys.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700/40">
          <span className="text-indigo-700 dark:text-indigo-300 text-xs font-semibold uppercase tracking-widest">🔗 Foreign Keys</span>
          {foreign_keys.map(fk => (
            <span key={fk} className="bg-indigo-100 dark:bg-indigo-800/50 border border-indigo-300 dark:border-indigo-600/40 text-indigo-700 dark:text-indigo-200 text-xs font-mono px-2.5 py-0.5 rounded-full">
              {fk}
            </span>
          ))}
        </div>
      )}

      {datasets.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {datasets.map((d, i) => (
            <button key={i} onClick={() => setSelDs(i)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                selDs === i
                  ? (d.is_joined ? "bg-emerald-600 text-white" : "bg-blue-600 text-white")
                  : "border border-slate-200 dark:border-white/15 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
              }`}
            >
              {d.is_joined ? "⛓ " : ""}{d.filename}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-slate-500 dark:text-slate-400 text-sm">
          {charts.length} chart{charts.length !== 1 ? "s" : ""} for{" "}
          <span className="text-slate-900 dark:text-white font-medium">{ds?.filename}</span>
        </span>
        {ds?.primary_keys?.length > 0 && (
          <>
            <span className="text-amber-600 dark:text-amber-400 text-xs font-semibold uppercase tracking-widest">🔑 Primary Keys</span>
            {ds.primary_keys.map(pk => (
              <span key={pk} className="bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-600/40 text-amber-700 dark:text-amber-300 text-xs font-mono px-2.5 py-0.5 rounded-full">{pk}</span>
            ))}
          </>
        )}
      </div>

      {charts.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {charts.map((chart, i) => (
            <div key={i} className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 rounded-2xl p-5 flex flex-col gap-3 shadow-sm">
              <div>
                <p className="text-slate-900 dark:text-white font-semibold text-base leading-snug">{chart.title}</p>
                {chart.description && (
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 leading-relaxed">{chart.description}</p>
                )}
              </div>
              <div className={chart.type === "box" ? "" : "relative"} style={chart.type === "box" ? {} : { height: 280 }}>
                <AnalyticsChart chart={chart} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-slate-400 py-12">
          <div className="text-3xl mb-2">📭</div>
          No charts for this dataset.
        </div>
      )}
    </div>
  )
}

// ── Reusable table component with scrollbars ──────────────────────────────────

function DataTable({ columns, rows, label }) {
  if (!columns.length) {
    return (
      <p className="text-slate-400 text-sm italic py-4 text-center">
        No data available for {label}.
      </p>
    )
  }
  return (
    <div className="overflow-auto max-h-[420px] rounded-xl border border-slate-200 dark:border-white/10 text-xs">
      <table className="min-w-full border-collapse">
        <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800">
          <tr>
            {columns.map((col) => (
              <th
                key={col}
                className="px-3 py-2.5 text-left font-semibold text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-white/10 whitespace-nowrap"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              className={`${
                ri % 2 === 0
                  ? "bg-white dark:bg-white/[0.02]"
                  : "bg-slate-50 dark:bg-white/[0.04]"
              } hover:bg-blue-50 dark:hover:bg-blue-900/10 transition`}
            >
              {columns.map((col) => (
                <td
                  key={col}
                  className="px-3 py-2 text-slate-700 dark:text-slate-300 whitespace-nowrap border-b border-slate-100 dark:border-white/5"
                >
                  {row[col] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Profiling summary cards ────────────────────────────────────────────────────

function ProfilingCards({ profiling }) {
  if (!profiling || Object.keys(profiling).length === 0) {
    return <p className="text-slate-400 text-sm italic">No profiling data available.</p>
  }

  const mv   = profiling.missing_values_summary  ?? {}
  const rp   = profiling.row_processing_summary  ?? {}
  const tr   = profiling.transformation_summary  ?? {}
  const cols = profiling.column_wise_summary      ?? []

  const StatCard = ({ label, value, color = "blue" }) => {
    const grad = {
      blue:   "from-blue-500 to-blue-700",
      green:  "from-emerald-500 to-emerald-700",
      orange: "from-orange-500 to-orange-700",
      purple: "from-purple-500 to-purple-700",
      red:    "from-rose-500 to-rose-700",
      teal:   "from-teal-500 to-teal-700",
    }
    return (
      <div className={`relative overflow-hidden rounded-xl p-4 text-white bg-gradient-to-br ${grad[color]}`}>
        <p className="text-white/70 text-[11px] uppercase tracking-widest font-medium">{label}</p>
        <p className="text-2xl font-extrabold mt-1 leading-none">{value ?? "—"}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <StatCard label="Rows (before)"      value={rp.original_row_count  ?? profiling.number_of_rows} color="blue"   />
        <StatCard label="Rows (after)"       value={rp.final_row_count     ?? profiling.number_of_rows} color="green"  />
        <StatCard label="Columns"            value={profiling.number_of_columns}                        color="purple" />
        <StatCard label="Missing (before)"   value={mv.total_missing_before}                            color="orange" />
        <StatCard label="Missing (after)"    value={mv.total_missing_after}                             color="teal"   />
        <StatCard label="Duplicates removed" value={rp.duplicate_rows_removed}                         color="red"    />
        <StatCard label="Cols transformed"   value={tr.columns_transformed}                            color="blue"   />
        <StatCard label="Cols dropped"       value={tr.columns_dropped}                                color="orange" />
      </div>

      {cols.length > 0 && (
        <div>
          <h4 className="text-slate-900 dark:text-white font-bold text-sm mb-3">Column Summary</h4>
          <div className="overflow-auto max-h-[320px] rounded-xl border border-slate-200 dark:border-white/10 text-xs">
            <table className="min-w-full border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800">
                <tr>
                  {["Column", "Inferred Type", "Semantic Type", "Confidence", "Nulls", "Null %", "Unique"].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left font-semibold text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-white/10 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cols.map((c, i) => (
                  <tr
                    key={c.column_name}
                    className={`${i % 2 === 0 ? "bg-white dark:bg-white/[0.02]" : "bg-slate-50 dark:bg-white/[0.04]"} hover:bg-blue-50 dark:hover:bg-blue-900/10 transition`}
                  >
                    <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-100 whitespace-nowrap border-b border-slate-100 dark:border-white/5">{c.column_name}</td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300 whitespace-nowrap border-b border-slate-100 dark:border-white/5">{c.inferred_dtype ?? "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap border-b border-slate-100 dark:border-white/5">
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium">
                        {c.semantic_type ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300 whitespace-nowrap border-b border-slate-100 dark:border-white/5">
                      {c.semantic_confidence != null ? `${(c.semantic_confidence * 100).toFixed(0)}%` : "—"}
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300 whitespace-nowrap border-b border-slate-100 dark:border-white/5">{c.null_count ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300 whitespace-nowrap border-b border-slate-100 dark:border-white/5">
                      {c.null_percentage != null ? `${c.null_percentage.toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300 whitespace-nowrap border-b border-slate-100 dark:border-white/5">{c.unique_count ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── NEW: Model Overview panel ──────────────────────────────────────────────────

function MetricPill({ label, value }) {
  if (value === null || value === undefined) return null
  const n = Number(value)
  const display = isNaN(n) ? String(value) : n.toFixed(4)
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3">
      <span className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-semibold truncate">{label}</span>
      <span className="text-base font-bold text-slate-900 dark:text-white">{display}</span>
    </div>
  )
}

function ModelOverviewPanel({ info }) {
  const isClassification = info.task === "classification"
  const m = info.metrics || {}
  const ensemble = info.ensemble || {}
  const topModels = ensemble.models || info.top_k_models || []
  const finalLabel = ensemble.enabled
    ? `Ensemble (Top ${ensemble.top_k || topModels.length || "K"})`
    : (info.best_model || "—")

  const classMetrics = [
    { label: "Accuracy",           value: m.accuracy          != null ? (m.accuracy * 100).toFixed(2) + "%" : null },
    { label: "Balanced Accuracy",  value: m.balanced_accuracy != null ? (m.balanced_accuracy * 100).toFixed(2) + "%" : null },
    { label: "F1 Macro",           value: m.f1_macro          != null ? (m.f1_macro * 100).toFixed(2) + "%" : null },
    { label: "F1 Weighted",        value: m.f1_weighted       != null ? (m.f1_weighted * 100).toFixed(2) + "%" : null },
    { label: "Precision Macro",    value: m.precision_macro   != null ? (m.precision_macro * 100).toFixed(2) + "%" : null },
    { label: "Recall Macro",       value: m.recall_macro      != null ? (m.recall_macro * 100).toFixed(2) + "%" : null },
    { label: "ROC AUC",            value: m.roc_auc },
    { label: "PR AUC",             value: m.pr_auc },
    { label: "MCC",                value: m.mcc },
    { label: "Cohen Kappa",        value: m.cohen_kappa },
    { label: "Log Loss",           value: m.log_loss },
  ]

  const regMetrics = [
    { label: "R²",                 value: m.r2 },
    { label: "Adj. R²",            value: m.adj_r2 },
    { label: "MAE",                value: m.mae },
    { label: "MSE",                value: m.mse },
    { label: "RMSE",               value: m.rmse },
    { label: "MAPE",               value: m.mape },
    { label: "SMAPE",              value: m.smape },
    { label: "Median Abs Error",   value: m.median_abs_error },
    { label: "Explained Variance", value: m.explained_var },
  ]

  const metrics = isClassification ? classMetrics : regMetrics

  return (
    <div className="space-y-6">
      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-900/20 dark:to-indigo-900/20 border border-violet-100 dark:border-violet-800/30">
        <div className="text-center">
          <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-0.5">Final System</p>
          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{finalLabel}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-0.5">Task</p>
          <p className="text-sm font-bold text-slate-900 dark:text-white capitalize">{info.task || "—"}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-0.5">Target</p>
          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{info.target || "—"}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-0.5">CV Score</p>
          <p className="text-sm font-bold text-violet-600 dark:text-violet-400">
            {info.cv_score != null ? Number(info.cv_score).toFixed(4) : "—"}
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span className="bg-slate-100 dark:bg-white/8 rounded-full px-3 py-1">
          📊 <strong className="text-slate-700 dark:text-slate-200">{info.row_count?.toLocaleString() ?? "—"}</strong> rows
        </span>
        <span className="bg-slate-100 dark:bg-white/8 rounded-full px-3 py-1">
          🔢 <strong className="text-slate-700 dark:text-slate-200">{info.feature_count ?? "—"}</strong> features
        </span>
        <span className="bg-slate-100 dark:bg-white/8 rounded-full px-3 py-1">
          🏗 <strong className="text-slate-700 dark:text-slate-200">{info.models_trained ?? "—"}</strong> models trained
        </span>
        {info.total_pipeline_time_seconds != null && (
          <span className="bg-slate-100 dark:bg-white/8 rounded-full px-3 py-1">
            ⏱ <strong className="text-slate-700 dark:text-slate-200">{Number(info.total_pipeline_time_seconds).toFixed(1)}s</strong>
          </span>
        )}
      </div>

      {/* Metrics grid */}
      <div>
        <h4 className="text-slate-900 dark:text-white font-bold text-sm mb-3">Evaluation Metrics</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {metrics
            .filter(({ value }) => value !== null && value !== undefined)
            .map(({ label, value }) => (
              <MetricPill key={label} label={label} value={value} />
            ))}
        </div>
      </div>

      {/* Feature importance */}
      {info.feature_importance_chart?.labels?.length > 0 && (
        <div>
          <h4 className="text-slate-900 dark:text-white font-bold text-sm mb-3">Feature Importance</h4>
          <div className="space-y-2">
            {info.feature_importance_chart.labels.slice(0, 15).map((label, i) => {
              const val = info.feature_importance_chart.values[i] ?? 0
              const max = Math.max(...info.feature_importance_chart.values.filter(Boolean))
              const pct = max > 0 ? (val / max) * 100 : 0
              return (
                <div key={label} className="flex items-center gap-2 text-xs">
                  <span className="w-36 truncate text-right text-slate-600 dark:text-slate-300 shrink-0">{label}</span>
                  <div className="flex-1 bg-slate-100 dark:bg-white/10 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-14 text-slate-400 dark:text-slate-500 tabular-nums">{Number(val).toFixed(4)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Selected features */}
      {info.selected_features?.length > 0 && (
        <div>
          <h4 className="text-slate-900 dark:text-white font-bold text-sm mb-2">Selected Features</h4>
          <div className="flex flex-wrap gap-1.5">
            {info.selected_features.map((f) => (
              <span key={f} className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800/40">
                {f}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Leaderboard */}
      {info.leaderboard?.length > 0 && (
        <div>
          <h4 className="text-slate-900 dark:text-white font-bold text-sm mb-3">Model Leaderboard</h4>
          <div className="overflow-auto rounded-xl border border-slate-200 dark:border-white/10 text-xs">
            <table className="min-w-full border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800">
                <tr>
                  {["Rank", "Model", "CV Score", "CV Std", "Train Time (s)"].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left font-semibold text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-white/10 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {info.leaderboard.map((row, i) => (
                  <tr
                    key={i}
                    className={`${i === 0 ? "bg-violet-50 dark:bg-violet-900/15" : i % 2 === 0 ? "bg-white dark:bg-white/[0.02]" : "bg-slate-50 dark:bg-white/[0.04]"} hover:bg-blue-50 dark:hover:bg-blue-900/10 transition`}
                  >
                    <td className="px-3 py-2 font-bold text-slate-700 dark:text-slate-200 border-b border-slate-100 dark:border-white/5">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-white/5">{row.model_name}</td>
                    <td className="px-3 py-2 text-violet-700 dark:text-violet-300 font-semibold border-b border-slate-100 dark:border-white/5">
                      {row.cv_score != null ? Number(row.cv_score).toFixed(4) : "—"}
                    </td>
                    <td className="px-3 py-2 text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-white/5">
                      ±{row.cv_std != null ? Number(row.cv_std).toFixed(4) : "—"}
                    </td>
                    <td className="px-3 py-2 text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-white/5">
                      {row.train_time_seconds != null ? Number(row.train_time_seconds).toFixed(2) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── NEW: Inline prediction panel ───────────────────────────────────────────────

function PredictionPanel({ sessionId, datasetBase, token }) {
  const [schema,     setSchema]     = useState(null)
  const [values,     setValues]     = useState({})
  const [prediction, setPrediction] = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [predicting, setPredicting] = useState(false)
  const [error,      setError]      = useState("")

  useEffect(() => {
    if (!token || !sessionId || !datasetBase) return
    setLoading(true); setError(""); setSchema(null); setPrediction(null)
    fetch(`${API}/history/${sessionId}/model-schema/${encodeURIComponent(datasetBase)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json().then(d => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) throw new Error(d?.detail || "Failed to load schema")
        setSchema(d)
        const init = {}
        for (const f of d.fields || []) init[f.name] = ""
        setValues(init)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [token, sessionId, datasetBase])

  const canPredict = useMemo(() => {
    if (!schema?.fields?.length) return false
    return schema.fields.every(f => {
      const v = values[f.name]
      return v !== "" && v !== null && v !== undefined
    })
  }, [schema, values])

  const onPredict = async () => {
    if (!schema) return
    setPredicting(true); setError(""); setPrediction(null)
    try {
      const row = {}
      for (const field of schema.fields || []) {
        const raw = values[field.name]
        row[field.name] = field.input_type === "number"
          ? (raw === "" ? null : Number(raw))
          : raw
      }
      const res = await fetch(
        `${API}/history/${sessionId}/predict/${encodeURIComponent(datasetBase)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ row }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data?.detail || "Prediction failed")
      setPrediction(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setPredicting(false)
    }
  }

  if (loading) return (
    <div className="text-slate-400 animate-pulse text-sm py-8 text-center">Loading input schema…</div>
  )

  if (error && !schema) return (
    <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/40 text-red-700 dark:text-red-400 text-sm">
      {error}
    </div>
  )

  if (!schema) return null

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-bold text-slate-900 dark:text-white mb-0.5">Enter Input Values</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Target: <span className="font-semibold text-slate-700 dark:text-slate-200">{schema.target}</span>
          &nbsp;·&nbsp;Task: <span className="font-semibold capitalize text-slate-700 dark:text-slate-200">{schema.task}</span>
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(schema.fields || []).map((field) => (
          <label key={field.name} className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200">
            <span className="font-medium truncate">
              {field.name}
              <span className="ml-1.5 text-xs text-slate-400 dark:text-slate-500 font-normal">({field.feature_type})</span>
            </span>

            {field.input_type === "number" && (
              <input
                type="number"
                value={values[field.name] ?? ""}
                onChange={(e) => setValues(p => ({ ...p, [field.name]: e.target.value }))}
                placeholder="Enter value"
                className="rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:ring-2 focus:ring-violet-400 outline-none"
              />
            )}

            {field.input_type === "categorical" && (
              <select
                value={values[field.name] ?? ""}
                onChange={(e) => setValues(p => ({ ...p, [field.name]: e.target.value }))}
                className="rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:ring-2 focus:ring-violet-400 outline-none"
              >
                <option value="">Select value</option>
                {(field.options || []).map(opt => (
                  <option key={String(opt)} value={String(opt)}>{String(opt)}</option>
                ))}
              </select>
            )}

            {field.input_type === "text_area" && (
              <textarea
                rows={2}
                value={values[field.name] ?? ""}
                onChange={(e) => setValues(p => ({ ...p, [field.name]: e.target.value }))}
                placeholder="Enter text"
                className="rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:ring-2 focus:ring-violet-400 outline-none resize-none"
              />
            )}
          </label>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={onPredict}
          disabled={!canPredict || predicting}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition"
        >
          {predicting
            ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" />Predicting…</>
            : "▶ Run Prediction"}
        </button>
        {prediction && (
          <button
            onClick={() => { setPrediction(null); setValues(Object.fromEntries(Object.keys(values).map(k => [k, ""]))) }}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/15 text-slate-600 dark:text-slate-300 text-sm hover:bg-slate-100 dark:hover:bg-white/5 transition"
          >
            Clear
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/40 text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {prediction && (
        <div className="rounded-2xl border border-emerald-300 dark:border-emerald-600/50 bg-emerald-50 dark:bg-emerald-900/20 p-5 space-y-3">
          <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">✅ Prediction Result</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-emerald-200 dark:border-emerald-700/40 px-4 py-3">
              <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Predicted Value</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white">{String(prediction.prediction)}</p>
            </div>
            {prediction.probability !== null && prediction.probability !== undefined && (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-emerald-200 dark:border-emerald-700/40 px-4 py-3">
                <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Confidence</p>
                <p className="text-xl font-bold text-violet-600 dark:text-violet-400">
                  {(Number(prediction.probability) * 100).toFixed(2)}%
                </p>
                <div className="mt-2 h-1.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-violet-500 to-emerald-500 rounded-full"
                    style={{ width: `${(Number(prediction.probability) * 100).toFixed(1)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── NEW: Models tab ────────────────────────────────────────────────────────────

function ModelsTab({ sessionId, trainedModels }) {
  const token = getAuth("token")
  const [selectedModel, setSelectedModel] = useState(trainedModels[0] ?? null)
  const [modelInfo,     setModelInfo]     = useState(null)
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState("")
  const [subTab,        setSubTab]        = useState("overview") // "overview" | "test"

  const loadModelInfo = useCallback(async (base) => {
    if (!token || !base) return
    setLoading(true); setError(""); setModelInfo(null)
    try {
      const res = await fetch(
        `${API}/history/${sessionId}/model-info/${encodeURIComponent(base)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data?.detail || "Failed to load model info")
      setModelInfo(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [token, sessionId])

  useEffect(() => {
    if (selectedModel) { setSubTab("overview"); loadModelInfo(selectedModel) }
  }, [selectedModel, loadModelInfo])

  if (trainedModels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        <div className="text-5xl">🤖</div>
        <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs">
          No trained models found for this session. Train a model from the Features page first.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Model selector — only shown when session has multiple models */}
      {trainedModels.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {trainedModels.map(base => (
            <button
              key={base}
              onClick={() => setSelectedModel(base)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                selectedModel === base
                  ? "bg-violet-600 text-white"
                  : "border border-slate-200 dark:border-white/15 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
              }`}
            >
              📦 {base}
            </button>
          ))}
        </div>
      )}

      {/* Overview / Test sub-tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-white/5 p-1 rounded-xl w-fit">
        {[
          { id: "overview", label: "📊 Model Overview" },
          { id: "test",     label: "🧪 Test Model" },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              subTab === t.id
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-slate-400 animate-pulse text-sm py-8 text-center">
          Loading model report for <strong className="text-slate-600 dark:text-slate-300">{selectedModel}</strong>…
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 text-amber-800 dark:text-amber-300 text-sm">
          <p className="font-semibold mb-1">⚠️ Model report unavailable</p>
          <p className="text-xs opacity-80">{error}</p>
        </div>
      ) : modelInfo ? (
        <>
          {subTab === "overview" && <ModelOverviewPanel info={modelInfo} />}
          {subTab === "test"     && <PredictionPanel sessionId={sessionId} datasetBase={selectedModel} token={token} />}
        </>
      ) : null}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function HistoryDetailPage() {
  const { sessionId } = useParams()
  const router = useRouter()

  const [detail,       setDetail]      = useState(null)
  const [loading,      setLoading]     = useState(true)
  const [error,        setError]       = useState("")
  const [activeFile,   setActiveFile]  = useState(0)
  const [activeTab,    setActiveTab]   = useState("input")
  const [downloading,  setDownloading] = useState(false)

  const parsedDate = (() => {
    if (!sessionId) return ""
    try {
      const d = new Date(
        sessionId.slice(0, 4)   + "-" +
        sessionId.slice(4, 6)   + "-" +
        sessionId.slice(6, 8)   + "T" +
        sessionId.slice(8, 10)  + ":" +
        sessionId.slice(10, 12) + ":" +
        sessionId.slice(12, 14)
      )
      return d.toLocaleString(undefined, {
        year: "numeric", month: "long", day: "numeric",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
      })
    } catch { return sessionId }
  })()

  const fetchDetail = useCallback(async () => {
    const token = getAuth("token")
    if (!token) { router.replace("/login"); return }
    setLoading(true); setError("")
    try {
      const res = await fetch(`${API}/history/${sessionId}/detail`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const data = await res.json()
      setDetail(data)
      setActiveFile(0)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [sessionId, router])

  useEffect(() => { fetchDetail() }, [fetchDetail])

  const handleDownload = async (filename) => {
    const token = getAuth("token")
    setDownloading(true)
    try {
      const res = await fetch(
        `${API}/history/${sessionId}/cleaned-csv/${encodeURIComponent(filename)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (!res.ok) throw new Error("Download failed")
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement("a")
      a.href     = url
      a.download = `${filename.replace(/\.[^.]+$/, "")}_cleaned.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.message)
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-slate-400 animate-pulse text-sm">Loading session…</div>
      </div>
    )
  }

  const datasets      = detail?.datasets       ?? []
  const trainedModels = detail?.trained_models  ?? []
  const ds = datasets[activeFile]

  // Models tab only appears when the session has trained models
  const tabs = [
    { key: "input",     label: "📥 Input Data" },
    { key: "cleaned",   label: "✅ Cleaned Data" },
    { key: "profiling", label: "📊 Profiling" },
    { key: "analytics", label: "📈 Analytics" },
    ...(trainedModels.length > 0
      ? [{ key: "models", label: `🤖 Models (${trainedModels.length})` }]
      : []
    ),
  ]

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/dashboard/history")}
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 dark:border-white/15 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition text-lg"
        >
          ←
        </button>
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">Session Detail</h1>
          <p className="text-slate-400 text-xs mt-0.5 font-mono">{parsedDate} · {sessionId}</p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/40 text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {datasets.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-center">
          <div className="text-5xl">🗂️</div>
          <p className="text-slate-500 dark:text-slate-400 text-sm">No datasets found for this session.</p>
        </div>
      )}

      {datasets.length > 0 && (
        <>
          {/* File selector */}
          {datasets.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {datasets.map((d, i) => (
                <button
                  key={d.filename}
                  onClick={() => setActiveFile(i)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    activeFile === i
                      ? "bg-blue-600 text-white"
                      : "border border-slate-200 dark:border-white/15 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                  }`}
                >
                  📄 {d.filename}
                </button>
              ))}
            </div>
          )}

          {/* Tab bar — identical style to original, Models appended */}
          <div className="flex gap-1 bg-slate-100 dark:bg-white/5 p-1 rounded-xl w-fit flex-wrap">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  activeTab === t.key
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content panel */}
          <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6">

            {activeTab === "input" && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    Input Data — <span className="font-normal text-slate-500">{ds?.filename}</span>
                  </h3>
                  <span className="text-xs text-slate-400">
                    {ds?.input_rows?.length ?? 0} rows shown (max 500) · {ds?.input_columns?.length ?? 0} columns
                  </span>
                </div>
                <DataTable columns={ds?.input_columns ?? []} rows={ds?.input_rows ?? []} label="input data" />
              </div>
            )}

            {activeTab === "cleaned" && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    Cleaned Data — <span className="font-normal text-slate-500">{ds?.filename}</span>
                  </h3>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">
                      {ds?.cleaned_rows?.length ?? 0} rows shown (max 500) · {ds?.cleaned_columns?.length ?? 0} columns
                    </span>
                    <button
                      onClick={() => handleDownload(ds?.filename)}
                      disabled={downloading || !ds?.cleaned_rows?.length}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold transition"
                    >
                      {downloading ? "⏳ Downloading…" : "⬇ Download CSV"}
                    </button>
                  </div>
                </div>
                <DataTable columns={ds?.cleaned_columns ?? []} rows={ds?.cleaned_rows ?? []} label="cleaned data" />
              </div>
            )}

            {activeTab === "profiling" && (
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-5">
                  Profiling Report — <span className="font-normal text-slate-500">{ds?.filename}</span>
                </h3>
                <ProfilingCards profiling={ds?.profiling} />
              </div>
            )}

            {activeTab === "analytics" && (
              <AnalyticsTab sessionId={sessionId} />
            )}

            {activeTab === "models" && (
              <ModelsTab sessionId={sessionId} trainedModels={trainedModels} />
            )}

          </div>
        </>
      )}
    </div>
  )
}