"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { API_BASE_URL } from "@/lib/api"
import { getAuth } from "@/lib/auth"
import { getCachedModelInfo, setCachedModelInfo } from "@/lib/session-cache"
import { useDash } from "../context"

// ─── Chart.js (loaded dynamically to avoid SSR issues) ───────────────────────
let Chart = null
if (typeof window !== "undefined") {
  import("chart.js/auto").then((mod) => {
    Chart = mod.default
  })
}

// ════════════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════════════

const fmt = (v, digits = 4) => (v == null || !Number.isFinite(v) ? "—" : Number(v).toFixed(digits))
const pct = (v) => (v == null || !Number.isFinite(v) ? "—" : `${(Number(v) * 100).toFixed(2)}%`)
const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0))

const CLASSIFICATION_METRICS = [
  // [key, label, isRate, description]
  ["accuracy",          "Accuracy",            true,  "Overall correct predictions"],
  ["balanced_accuracy", "Balanced Accuracy",   true,  "Mean recall across classes"],
  ["precision_macro",   "Precision (Macro)",   true,  "Avg precision across classes"],
  ["recall_macro",      "Recall / Sensitivity",true,  "Avg recall across classes"],
  ["specificity",       "Specificity",         true,  "True negative rate (binary)"],
  ["f1_macro",          "F1 (Macro)",          true,  "Harmonic mean of precision & recall"],
  ["f1_weighted",       "F1 (Weighted)",       true,  "F1 weighted by class support"],
  ["f2_macro",          "Fβ=2 (Macro)",        true,  "F-beta with β=2, recalls weighted"],
  ["roc_auc",           "ROC-AUC",             true,  "Area under ROC curve"],
  ["pr_auc",            "PR-AUC",              true,  "Area under Precision-Recall curve"],
  ["mcc",               "MCC",                 false, "Matthews Correlation Coefficient"],
  ["cohen_kappa",       "Cohen's Kappa",       false, "Agreement corrected for chance"],
  ["hamming_loss",      "Hamming Loss",        false, "Fraction of wrong labels (↓ better)"],
  ["jaccard_macro",     "Jaccard Index",       true,  "Intersection over union (Macro)"],
  ["log_loss",          "Log Loss",            false, "Cross-entropy loss (↓ better)"],
  ["top_k_accuracy_k3", "Top-3 Accuracy",      true,  "Correct in top-3 predictions"],
]

const REGRESSION_METRICS = [
  ["r2",               "R² Score",             false, "Coefficient of determination (↑ better)"],
  ["adj_r2",           "Adjusted R²",          false, "R² penalised for # features"],
  ["explained_var",    "Explained Variance",   false, "Variance explained by model"],
  ["mae",              "MAE",                  false, "Mean Absolute Error (↓ better)"],
  ["mse",              "MSE",                  false, "Mean Squared Error (↓ better)"],
  ["rmse",             "RMSE",                 false, "Root Mean Squared Error (↓ better)"],
  ["rmsle",            "RMSLE",                false, "Root Mean Squared Log Error (↓ better)"],
  ["median_abs_error", "Median Abs Error",     false, "Median absolute error (↓ better)"],
  ["mape",             "MAPE",                 false, "Mean Absolute Percentage Error (↓ better)"],
  ["smape",            "SMAPE",                false, "Symmetric MAPE (↓ better)"],
]

// ════════════════════════════════════════════════════════════════════════════
// MICRO-COMPONENTS
// ════════════════════════════════════════════════════════════════════════════

function Pill({ text, color = "blue" }) {
  const colors = {
    blue:   "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    green:  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    purple: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
    amber:  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    red:    "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${colors[color]}`}>
      {text}
    </span>
  )
}

function Card({ children, className = "" }) {
  return (
    <div className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 ${className}`}>
      {children}
    </div>
  )
}

function SectionTitle({ children, sub }) {
  return (
    <div className="mb-4">
      <h3 className="font-bold text-slate-900 dark:text-white text-base">{children}</h3>
      {sub && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// Animated gauge / radial progress
function RadialGauge({ value, label, color = "#10b981", size = 90 }) {
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const v = clamp01(value)
  const offset = circumference * (1 - v)

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} viewBox="0 0 90 90">
        <circle cx="45" cy="45" r={radius} fill="none" stroke="currentColor"
          strokeWidth="8" className="text-slate-200 dark:text-slate-700" />
        <circle cx="45" cy="45" r={radius} fill="none" stroke={color}
          strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 45 45)"
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
        <text x="45" y="50" textAnchor="middle" fontSize="13" fontWeight="700" fill={color}>
          {(v * 100).toFixed(1)}%
        </text>
      </svg>
      <span className="text-xs text-slate-600 dark:text-slate-300 font-medium text-center leading-tight">{label}</span>
    </div>
  )
}

// Horizontal metric bar row
function MetricBar({ label, value, description, isRate, lowerBetter = false }) {
  const numVal = Number(value)
  const hasVal = Number.isFinite(numVal)

  let barWidth = 0
  if (hasVal) {
    if (isRate) {
      barWidth = Math.max(0, Math.min(100, Math.abs(numVal) * 100))
    } else {
      // For MCC/Kappa: range [-1, 1] → remap to [0, 100]
      barWidth = Math.max(0, Math.min(100, ((numVal + 1) / 2) * 100))
    }
  }

  const displayStr = hasVal
    ? (isRate ? `${(Math.abs(numVal) * 100).toFixed(2)}%` : numVal.toFixed(4))
    : "—"

  const isGood = lowerBetter ? numVal < 0.2 : numVal > 0.75
  const barColor = !hasVal ? "bg-slate-300 dark:bg-slate-600"
    : lowerBetter
      ? (numVal < 0.1 ? "bg-emerald-500" : numVal < 0.3 ? "bg-amber-500" : "bg-red-500")
      : (numVal > 0.8 ? "bg-emerald-500" : numVal > 0.6 ? "bg-blue-500" : "bg-amber-500")

  return (
    <div className="group">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-slate-700 dark:text-slate-300 font-medium">{label}</span>
        <span className={`font-bold tabular-nums ${!hasVal ? "text-slate-400" : isGood ? "text-emerald-600 dark:text-emerald-400" : "text-slate-700 dark:text-slate-200"}`}>
          {displayStr}
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
        <div className={`h-full rounded-full ${barColor} transition-all duration-700`}
          style={{ width: `${barWidth}%` }} />
      </div>
      {description && (
        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {description}
        </p>
      )}
    </div>
  )
}

// Confusion matrix renderer
function ConfusionMatrix({ matrix, classes }) {
  if (!matrix?.length || !classes?.length) return null
  const maxVal = Math.max(...matrix.flat())

  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse mx-auto">
        <thead>
          <tr>
            <th className="p-1 text-slate-400 text-right pr-2">Pred →<br />True ↓</th>
            {classes.map((c) => (
              <th key={c} className="p-1 text-center font-semibold text-slate-600 dark:text-slate-300 min-w-[48px]">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, ri) => (
            <tr key={ri}>
              <td className="p-1 pr-2 font-semibold text-slate-600 dark:text-slate-300 text-right">
                {classes[ri]}
              </td>
              {row.map((val, ci) => {
                const intensity = maxVal > 0 ? val / maxVal : 0
                const isDiag = ri === ci
                const bg = isDiag
                  ? `rgba(16,185,129,${0.15 + intensity * 0.7})`
                  : `rgba(239,68,68,${intensity * 0.6})`
                return (
                  <td key={ci} className="p-1 text-center rounded font-bold tabular-nums"
                    style={{ backgroundColor: bg, color: intensity > 0.5 ? "white" : undefined }}>
                    {val}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Chart.js wrapper
function ChartCanvas({ id, config, height = 240 }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current || !config) return
    const init = () => {
      if (!Chart) { setTimeout(init, 100); return }
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null }
      chartRef.current = new Chart(canvasRef.current, config)
    }
    init()
    return () => { chartRef.current?.destroy(); chartRef.current = null }
  }, [config])

  return <canvas ref={canvasRef} id={id} style={{ maxHeight: height }} />
}

// ════════════════════════════════════════════════════════════════════════════
// LOADING OVERLAY
// ════════════════════════════════════════════════════════════════════════════

const TRAINING_STEPS = [
  { icon: "🔍", label: "Loading dataset features" },
  { icon: "⚙️", label: "Building preprocessing pipeline" },
  { icon: "🧩", label: "Generating candidate models" },
  { icon: "⚡", label: "HPO for each model" },
  { icon: "🏆", label: "Ranking tuned models" },
  { icon: "🧠", label: "Ensembling top K" },
  { icon: "🧪", label: "Training final system" },
  { icon: "📊", label: "Validating hold-out set" },
  { icon: "💾", label: "Saving model & report" },
]

function TrainingOverlay({ visible }) {
  const [stepIdx, setStepIdx] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!visible) { setStepIdx(0); setElapsed(0); return }
    const start = Date.now()
    intervalRef.current = setInterval(() => {
      const secs = Math.floor((Date.now() - start) / 1000)
      setElapsed(secs)
      // Advance step roughly every ~8s
      setStepIdx(Math.min(TRAINING_STEPS.length - 1, Math.floor(secs / 8)))
    }, 500)
    return () => clearInterval(intervalRef.current)
  }, [visible])

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-center justify-center px-4">
      <div className="max-w-lg w-full rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-8 shadow-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-5xl mb-3 animate-bounce">🤖</div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Training Models</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Running AutoML model selection pipeline…
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-2 mb-6">
          {TRAINING_STEPS.map((step, i) => {
            const isDone = i < stepIdx
            const isActive = i === stepIdx
            return (
              <div key={i} className={`flex items-center gap-3 rounded-xl px-3 py-2 transition-all ${
                isActive ? "bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700"
                  : isDone ? "opacity-50" : "opacity-30"
              }`}>
                <span className="text-lg">{isDone ? "✅" : isActive ? step.icon : "⏳"}</span>
                <span className={`text-sm font-medium ${
                  isActive ? "text-blue-700 dark:text-blue-300" : "text-slate-600 dark:text-slate-400"
                }`}>{step.label}</span>
                {isActive && (
                  <span className="ml-auto flex gap-1">
                    {[0, 1, 2].map((d) => (
                      <span key={d} className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce"
                        style={{ animationDelay: `${d * 0.15}s` }} />
                    ))}
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* Progress bar */}
        <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden mb-3">
          <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${((stepIdx + 1) / TRAINING_STEPS.length) * 100}%` }} />
        </div>

        <p className="text-center text-xs text-slate-400 dark:text-slate-500">
          Elapsed: {elapsed}s — This may take 30–120 seconds depending on dataset size
        </p>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// LEADERBOARD
// ════════════════════════════════════════════════════════════════════════════

function Leaderboard({ leaderboard, task, bestModel, topModels = [] }) {
  if (!leaderboard?.length) return null
  const metric = task === "classification" ? "Accuracy" : "R²"

  return (
    <Card>
      <SectionTitle sub={`Ranked by tuned cross-validated ${metric}`}>🏆 Model Leaderboard</SectionTitle>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="text-left py-2 px-2 text-slate-500 dark:text-slate-400 font-semibold">Rank</th>
              <th className="text-left py-2 px-2 text-slate-500 dark:text-slate-400 font-semibold">Model</th>
              <th className="text-right py-2 px-2 text-slate-500 dark:text-slate-400 font-semibold">Tuned CV {metric}</th>
              <th className="text-right py-2 px-2 text-slate-500 dark:text-slate-400 font-semibold">±Std</th>
              <th className="text-right py-2 px-2 text-slate-500 dark:text-slate-400 font-semibold">Time (s)</th>
              <th className="text-left py-2 px-2 text-slate-500 dark:text-slate-400 font-semibold">Folds</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((row, i) => {
              const isBest = row.model_name === bestModel
              const isTop = topModels.includes(row.model_name)
              const status = String(row.hpo_status || "").toLowerCase()
              const statusColor = status === "completed" ? "green" : status === "skipped" ? "amber" : "red"
              return (
                <tr key={i} className={`border-b border-slate-100 dark:border-slate-700/50 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/30 ${
                  isBest ? "bg-emerald-50 dark:bg-emerald-900/20" : ""
                }`}>
                  <td className="py-2 px-2 font-bold text-slate-500">
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                  </td>
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold ${isBest ? "text-emerald-700 dark:text-emerald-300" : "text-slate-800 dark:text-slate-200"}`}>
                        {row.model_name}
                      </span>
                      {isBest && <Pill text="BEST" color="green" />}
                      {isTop && <Pill text="TOP-K" color="blue" />}
                      {row.scaling_required && <Pill text="scaled" color="purple" />}
                      {status && <Pill text={status} color={statusColor} />}
                    </div>
                  </td>
                  <td className="py-2 px-2 text-right font-bold tabular-nums text-slate-800 dark:text-slate-200">
                    {fmt(row.cv_score)}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums text-slate-500">
                    ±{fmt(row.cv_std, 4)}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums text-slate-500">
                    {fmt(row.train_time_seconds, 2)}
                  </td>
                  <td className="py-2 px-2">
                    <div className="flex gap-0.5">
                      {(row.cv_scores || []).map((s, j) => {
                        const v = clamp01(Number(s))
                        return (
                          <div key={j} className="w-2 rounded-sm bg-blue-400 dark:bg-blue-500 opacity-80"
                            style={{ height: `${Math.max(4, v * 20)}px`, alignSelf: "flex-end" }}
                            title={`Fold ${j + 1}: ${Number(s).toFixed(4)}`} />
                        )
                      })}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function HpoSummary({ report }) {
  if (!report) return null
  const hpo = report.hpo || {}
  const hpoModels = report.hpo_models || []
  const ensemble = report.ensemble || {}
  const topModels = ensemble.models || report.top_k_models || []
  const status = (hpo.status || "unknown").toLowerCase()
  const statusColor = status === "completed" ? "green" : status === "failed" ? "red" : "amber"
  const metricLabel = report.task === "classification" ? "Accuracy" : "R²"
  const tunedCount = hpo.tuned_models ?? hpoModels.length
  const bestRow = (report.leaderboard || []).find((row) => row.model_name === report.best_model) || {}
  const params = bestRow.hpo_best_params || {}
  const entries = Object.entries(params)
  const displayEntries = entries.slice(0, 8)
  const remaining = entries.length - displayEntries.length

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/70 via-white to-blue-50/60 dark:from-emerald-900/20 dark:via-slate-900 dark:to-blue-900/20" />
      <div className="relative">
        <SectionTitle sub="Optuna tuning summary across all candidate models">⚡ Hyperparameter Optimization</SectionTitle>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Pill text={`Status: ${status}`} color={statusColor} />
          {tunedCount != null && <Pill text={`Models tuned: ${tunedCount}`} color="blue" />}
          {hpo.per_model_trials != null && <Pill text={`Trials/model: ${hpo.per_model_trials}`} color="purple" />}
          {hpo.cv != null && <Pill text={`CV: ${hpo.cv}`} color="amber" />}
          {hpo.time_seconds != null && <Pill text={`HPO Time: ${hpo.time_seconds}s`} color="red" />}
          {ensemble.enabled && <Pill text={`Top K: ${ensemble.top_k || topModels.length}`} color="green" />}
          {ensemble.voting && <Pill text={`Voting: ${ensemble.voting}`} color="purple" />}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-900/20 p-4">
            <p className="text-xs text-emerald-600 dark:text-emerald-400">Best Tuned CV {metricLabel}</p>
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{fmt(hpo.best_score)}</p>
            <p className="text-xs text-emerald-500">Top model: {report.best_model || "—"}</p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/70 p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">Validation Score</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{fmt(report.final_validation_score)}</p>
            <p className="text-xs text-slate-400">Hold-out set</p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/70 p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">Final System</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {ensemble.enabled ? `Ensemble (Top ${ensemble.top_k || topModels.length})` : (report.best_model || "Single")}
            </p>
            <p className="text-xs text-slate-400">{ensemble.enabled ? `Voting: ${ensemble.voting || "hard"}` : "Single model"}</p>
          </div>
        </div>

        {topModels.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {topModels.map((m) => (
              <Pill key={m} text={m} color="blue" />
            ))}
          </div>
        )}

        <div className="mt-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Best Parameters (Top Model)</p>
          {displayEntries.length === 0 ? (
            <p className="text-xs text-slate-400">No tuned parameters reported.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {displayEntries.map(([k, v]) => (
                <span key={k} className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 font-mono">
                  {k}: {String(v)}
                </span>
              ))}
              {remaining > 0 && (
                <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs text-slate-500 dark:text-slate-400">
                  +{remaining} more
                </span>
              )}
            </div>
          )}
        </div>

        {hpoModels.length > 0 && (
          <div className="mt-5">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Per-Model HPO Summary</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-2 px-2 text-slate-500 dark:text-slate-400 font-semibold">Model</th>
                    <th className="text-left py-2 px-2 text-slate-500 dark:text-slate-400 font-semibold">Status</th>
                    <th className="text-right py-2 px-2 text-slate-500 dark:text-slate-400 font-semibold">Best CV</th>
                    <th className="text-right py-2 px-2 text-slate-500 dark:text-slate-400 font-semibold">Trials</th>
                    <th className="text-right py-2 px-2 text-slate-500 dark:text-slate-400 font-semibold">Time (s)</th>
                  </tr>
                </thead>
                <tbody>
                  {hpoModels.map((row) => (
                    <tr key={row.model_name} className="border-b border-slate-100 dark:border-slate-700/50">
                      <td className="py-2 px-2 font-semibold text-slate-800 dark:text-slate-200">{row.model_name}</td>
                      <td className="py-2 px-2 text-slate-500 dark:text-slate-400">{row.status || "—"}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-slate-700 dark:text-slate-200">{fmt(row.best_score)}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-slate-500 dark:text-slate-400">{row.n_trials ?? "—"}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-slate-500 dark:text-slate-400">{row.time_seconds ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// FEATURE PROCESSING TABLE
// ════════════════════════════════════════════════════════════════════════════

function FeatureProcessingTable({ featureProcessing, featureImportanceChart }) {
  if (!featureProcessing || !Object.keys(featureProcessing).length) return null

  const colors = { OneHotEncoding: "blue", "BinaryEncoding (0/1)": "purple", StandardScaler: "amber" }
  const importanceMap = {}
  if (featureImportanceChart?.labels) {
    featureImportanceChart.labels.forEach((l, i) => {
      importanceMap[l] = featureImportanceChart.values[i]
    })
  }

  return (
    <Card>
      <SectionTitle sub="Encoding strategies applied to each feature">⚙️ Feature Processing</SectionTitle>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="text-left py-2 px-2 text-slate-500 dark:text-slate-400 font-semibold">Feature</th>
              <th className="text-left py-2 px-2 text-slate-500 dark:text-slate-400 font-semibold">Encoding</th>
              {Object.keys(importanceMap).length > 0 && (
                <th className="text-right py-2 px-2 text-slate-500 dark:text-slate-400 font-semibold">MI Importance</th>
              )}
            </tr>
          </thead>
          <tbody>
            {Object.entries(featureProcessing).map(([feat, enc]) => {
              const color = colors[enc] || "blue"
              const imp = importanceMap[feat]
              return (
                <tr key={feat} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="py-2 px-2 font-semibold text-slate-800 dark:text-slate-200">{feat}</td>
                  <td className="py-2 px-2"><Pill text={enc} color={color} /></td>
                  {Object.keys(importanceMap).length > 0 && (
                    <td className="py-2 px-2 text-right tabular-nums text-slate-600 dark:text-slate-300">
                      {imp != null ? imp.toFixed(4) : "—"}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// CLASSIFICATION DASHBOARD
// ════════════════════════════════════════════════════════════════════════════

function ClassificationDashboard({ report }) {
  const m = report.metrics || {}
  const metricsRep = report.metrics_representation || {}
  const metricsDisplayName = metricsRep.display_name
    || report.metrics_model_display_name
    || (report.final_model === "ensemble" ? "Ensemble" : (report.best_model || "Model"))
  const metricsMembers = metricsRep.members || report.top_k_models || []
  const metricsContextText = metricsRep.type === "ensemble" && metricsMembers.length
    ? `${metricsDisplayName}: ${metricsMembers.join(", ")}`
    : metricsDisplayName

  // Gauge metrics (rates)
  const gauges = [
    { key: "accuracy",        label: "Accuracy",    color: "#10b981" },
    { key: "f1_macro",        label: "F1 Macro",    color: "#3b82f6" },
    { key: "roc_auc",         label: "ROC-AUC",     color: "#8b5cf6" },
    { key: "balanced_accuracy", label: "Bal. Acc.", color: "#f59e0b" },
  ].filter((g) => m[g.key] != null)

  // Radar chart config
  const radarConfig = useMemo(() => {
    const keys = ["accuracy", "precision_macro", "recall_macro", "f1_macro", "roc_auc", "balanced_accuracy"]
    const labels = ["Accuracy", "Precision", "Recall", "F1", "ROC-AUC", "Bal. Acc."]
    const values = keys.map((k) => Math.round(clamp01(m[k] || 0) * 100))
    return {
      type: "radar",
      data: {
        labels,
        datasets: [{
          label: metricsDisplayName,
          data: values,
          backgroundColor: "rgba(59,130,246,0.15)",
          borderColor: "#3b82f6",
          borderWidth: 2,
          pointBackgroundColor: "#3b82f6",
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { position: "top" } },
        scales: {
          r: {
            beginAtZero: true, max: 100,
            ticks: { stepSize: 20, font: { size: 9 } },
            grid: { color: "rgba(100,116,139,0.15)" },
            pointLabels: { font: { size: 10 } },
          },
        },
      },
    }
  }, [m, metricsDisplayName])

  // Per-class bar chart
  const perClassConfig = useMemo(() => {
    if (!m.classes?.length) return null
    return {
      type: "bar",
      data: {
        labels: m.classes,
        datasets: [
          { label: "Precision", data: m.per_class_precision || [], backgroundColor: "rgba(59,130,246,0.7)" },
          { label: "Recall",    data: m.per_class_recall    || [], backgroundColor: "rgba(16,185,129,0.7)" },
          { label: "F1",        data: m.per_class_f1        || [], backgroundColor: "rgba(139,92,246,0.7)" },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { position: "top" } },
        scales: {
          y: { beginAtZero: true, max: 1, ticks: { callback: (v) => `${(v * 100).toFixed(0)}%` } },
        },
      },
    }
  }, [m])

  return (
    <div className="space-y-5">
      {/* Gauges row */}
      {gauges.length > 0 && (
        <Card>
          <SectionTitle sub="Key performance indicators at a glance">📈 Performance Overview</SectionTitle>
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
            Metrics shown for: <span className="font-semibold text-slate-700 dark:text-slate-200">{metricsContextText}</span>
          </p>
          <div className="flex flex-wrap justify-center gap-6">
            {gauges.map((g) => (
              <RadialGauge key={g.key} value={m[g.key]} label={g.label} color={g.color} />
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Radar */}
        <Card>
          <SectionTitle sub="Multi-dimensional performance view">🕸️ Metrics Radar</SectionTitle>
          <ChartCanvas id="radar-chart" config={radarConfig} height={260} />
        </Card>

        {/* Confusion matrix */}
        {m.confusion_matrix?.length > 0 && (
          <Card>
            <SectionTitle sub="Predicted vs actual class distribution">📋 Confusion Matrix</SectionTitle>
            <ConfusionMatrix matrix={m.confusion_matrix} classes={m.classes} />
          </Card>
        )}
      </div>

      {/* All metrics bars */}
      <Card>
        <SectionTitle sub="All computed classification metrics">📊 Full Metric Suite</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
          {CLASSIFICATION_METRICS.map(([key, label, isRate, desc]) => {
            const val = m[key]
            if (val == null) return null
            const lowerBetter = ["hamming_loss", "log_loss"].includes(key)
            return (
              <MetricBar key={key} label={label} value={val}
                isRate={isRate} description={desc} lowerBetter={lowerBetter} />
            )
          })}
        </div>
      </Card>

      {/* Per-class bars */}
      {perClassConfig && (
        <Card>
          <SectionTitle sub="Precision, recall, and F1 broken down by class">🎯 Per-Class Metrics</SectionTitle>
          <ChartCanvas id="per-class-chart" config={perClassConfig} height={220} />
        </Card>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// REGRESSION DASHBOARD
// ════════════════════════════════════════════════════════════════════════════

function RegressionDashboard({ report }) {
  const m = report.metrics || {}

  // Actual vs Predicted scatter
  const scatterConfig = useMemo(() => {
    const avp = m.actual_vs_predicted || {}
    const actual = avp.actual || []
    const predicted = avp.predicted || []
    if (!actual.length) return null

    const points = actual.map((a, i) => ({ x: a, y: predicted[i] }))
    const allVals = [...actual, ...predicted].filter(Number.isFinite)
    const minV = Math.min(...allVals)
    const maxV = Math.max(...allVals)

    return {
      type: "scatter",
      data: {
        datasets: [
          {
            label: "Predictions",
            data: points,
            backgroundColor: "rgba(59,130,246,0.4)",
            pointRadius: 3,
          },
          {
            label: "Perfect fit",
            data: [{ x: minV, y: minV }, { x: maxV, y: maxV }],
            type: "line",
            borderColor: "#10b981",
            borderWidth: 2,
            borderDash: [6, 4],
            pointRadius: 0,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { position: "top" } },
        scales: {
          x: { title: { display: true, text: "Actual" } },
          y: { title: { display: true, text: "Predicted" } },
        },
      },
    }
  }, [m])

  // Residuals histogram
  const residualsConfig = useMemo(() => {
    const counts = m.residuals_hist_counts || []
    const edges  = m.residuals_hist_edges  || []
    if (!counts.length) return null
    return {
      type: "bar",
      data: {
        labels: edges.slice(0, -1).map((e, i) => `${e.toFixed(2)}→${edges[i + 1]?.toFixed(2)}`),
        datasets: [{
          label: "Residuals",
          data: counts,
          backgroundColor: "rgba(139,92,246,0.65)",
          borderColor: "#8b5cf6",
          borderWidth: 1,
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { position: "top" } },
        scales: {
          x: { ticks: { maxRotation: 45, font: { size: 9 } } },
          y: { title: { display: true, text: "Frequency" } },
        },
      },
    }
  }, [m])

  return (
    <div className="space-y-5">
      {/* Score cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { key: "r2",    label: "R² Score",  icon: "📈", color: "text-emerald-600 dark:text-emerald-400" },
          { key: "rmse",  label: "RMSE",      icon: "📉", color: "text-blue-600 dark:text-blue-400" },
          { key: "mae",   label: "MAE",       icon: "📏", color: "text-purple-600 dark:text-purple-400" },
          { key: "mape",  label: "MAPE",      icon: "📐", color: "text-amber-600 dark:text-amber-400" },
        ].map(({ key, label, icon, color }) => (
          <Card key={key} className="text-center !p-4">
            <div className="text-2xl mb-1">{icon}</div>
            <div className={`text-xl font-black tabular-nums ${color}`}>{fmt(m[key])}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">{label}</div>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {scatterConfig && (
          <Card>
            <SectionTitle sub="Predicted vs actual values (up to 200 samples)">🎯 Actual vs Predicted</SectionTitle>
            <ChartCanvas id="scatter-chart" config={scatterConfig} height={260} />
          </Card>
        )}
        {residualsConfig && (
          <Card>
            <SectionTitle sub="Distribution of prediction errors">📊 Residuals Distribution</SectionTitle>
            <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
              Mean: {fmt(m.residuals_mean, 4)} | Std: {fmt(m.residuals_std, 4)}
            </div>
            <ChartCanvas id="residuals-chart" config={residualsConfig} height={220} />
          </Card>
        )}
      </div>

      {/* All metrics bars */}
      <Card>
        <SectionTitle sub="All computed regression metrics">📊 Full Metric Suite</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
          {REGRESSION_METRICS.map(([key, label, , desc]) => {
            const val = m[key]
            if (val == null) return null
            const lowerBetter = !["r2", "adj_r2", "explained_var"].includes(key)
            return (
              <MetricBar key={key} label={label} value={val}
                isRate={false} description={desc} lowerBetter={lowerBetter} />
            )
          })}
        </div>
      </Card>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════════════

export default function TrainPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const dash = useDash()

  const [token, setToken] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [datasets, setDatasets] = useState([])
  const [datasetBase, setDatasetBase] = useState("")

  const [running, setRunning] = useState(false)
  const [bootstrapping, setBootstrapping] = useState(true)
  const [reportLoading, setReportLoading] = useState(false)
  const [modelReport, setModelReport] = useState(null)
  const [activeTab, setActiveTab] = useState("metrics")

  const selectDataset = useCallback((nextDatasetBase, options = {}) => {
    const { sidForCache = sessionId, hydrateFromCache = true } = options
    const next = nextDatasetBase || ""
    setDatasetBase(next)
    if (next && hydrateFromCache && sidForCache) {
      const cached = getCachedModelInfo(sidForCache, next)
      setModelReport(cached || null)
    } else {
      setModelReport(null)
    }
    if (typeof window !== "undefined") {
      if (next) sessionStorage.setItem("selected_dataset_base", next)
      else sessionStorage.removeItem("selected_dataset_base")
      window.dispatchEvent(new Event("workflow-status-updated"))
    }
  }, [sessionId])

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      setBootstrapping(true)
      const t = getAuth("token")
      const sid = getAuth("session_id")
      if (!t) {
        setBootstrapping(false)
        router.push("/login")
        return
      }
      if (!sid) {
        setBootstrapping(false)
        router.push("/dashboard/upload")
        return
      }

      setToken(t)
      setSessionId(sid)

      try {
        const res = await fetch(`${API_BASE_URL}/automl/feature-engineering/datasets/${sid}`, {
          headers: { Authorization: `Bearer ${t}` },
        })
        if (!res.ok) {
          if (!cancelled) {
            setDatasets([])
            setDatasetBase("")
          }
          return
        }

        const data = await res.json()
        if (cancelled) return

        const rows = data?.datasets || []
        const eligibleRows = rows.filter((d) => !!d?.feature_engineering_completed)
        setDatasets(eligibleRows)

        if (!rows.length) {
          router.push("/dashboard/upload")
          return
        }

        if (!eligibleRows.length) {
          setDatasetBase("")
          if (typeof window !== "undefined") {
            sessionStorage.removeItem("selected_dataset_base")
            window.dispatchEvent(new Event("workflow-status-updated"))
          }
          dash?.showSmartPopup?.("Complete Feature Engineering before opening Model Training.", "Section Locked")
          router.push("/dashboard/features")
          return
        }

        const fromQuery = searchParams.get("dataset")
        const fromStorage = sessionStorage.getItem("selected_dataset_base")
        const firstPending = eligibleRows.find((d) => !d?.model_building_completed)?.dataset_base || ""

        if (eligibleRows.length === 1) {
          const single = eligibleRows[0].dataset_base
          selectDataset(single, { sidForCache: sid, hydrateFromCache: true })
          return
        }

        const preferred = fromQuery || fromStorage || ""
        const keep = eligibleRows.some((d) => d.dataset_base === preferred)
          ? preferred
          : firstPending || eligibleRows[0].dataset_base
        selectDataset(keep, { sidForCache: sid, hydrateFromCache: true })
      } catch {
        if (cancelled) return
        setDatasets([])
      } finally {
        if (!cancelled) setBootstrapping(false)
      }
    }

    bootstrap()
    return () => { cancelled = true }
  }, [router, searchParams, selectDataset, dash])

  useEffect(() => {
    if (!token || !sessionId || !datasetBase) return

    let cancelled = false
    const guardTrainingAccess = async () => {
      try {
        const statusRes = await fetch(
          `${API_BASE_URL}/automl/feature-engineering/status/${sessionId}/${encodeURIComponent(datasetBase)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        )
        if (!statusRes.ok) return

        const status = await statusRes.json()
        if (cancelled) return

        if (!status?.generated) {
          dash?.showSmartPopup?.("Complete Feature Engineering before opening Model Training.", "Section Locked")
          router.push(`/dashboard/features`)
        }
      } catch {
        // keep page stable on transient errors
      }
    }

    guardTrainingAccess()
    return () => { cancelled = true }
  }, [token, sessionId, datasetBase, dash, router])

  // ── Load existing report ───────────────────────────────────────────────────
  const loadReport = async (sid, ds, tkn) => {
    if (!sid || !ds || !tkn) return

    setReportLoading(true)
    try {
      const statusRes = await fetch(
        `${API_BASE_URL}/automl/model-building/status/${sid}/${encodeURIComponent(ds)}`,
        { headers: { Authorization: `Bearer ${tkn}` } },
      )
      if (!statusRes.ok) return

      const status = await statusRes.json()
      if (!status?.generated) return

      const res = await fetch(
        `${API_BASE_URL}/automl/model-info/${sid}/${encodeURIComponent(ds)}`,
        { headers: { Authorization: `Bearer ${tkn}` } },
      )
      if (!res.ok) return

      const data = await res.json()
      setModelReport(data)
      setCachedModelInfo(sid, ds, data)
    } catch {
      // No report yet — that's fine
    } finally {
      setReportLoading(false)
    }
  }

  useEffect(() => {
    if (!sessionId || !datasetBase || !token) return
    loadReport(sessionId, datasetBase, token)
  }, [sessionId, datasetBase, token])

  // ── Run model selection ────────────────────────────────────────────────────
  const runModelSelection = async () => {
    if (!datasetBase) {
      dash?.showSmartPopup?.("Select a dataset before starting Model Training.", "Dataset Required")
      return
    }

    setRunning(true)
    try {
      const res = await fetch(`${API_BASE_URL}/automl/model-building/run/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ dataset_base: datasetBase }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        const safeDetail = typeof data?.detail === "string"
          ? data.detail
          : "sorry We are unable process this dataset"
        throw new Error(safeDetail)
      }
      // Reload enriched report from model-info endpoint
      await loadReport(sessionId, datasetBase, token)
      setDatasets((prev) => prev.map((d) => (
        d.dataset_base === datasetBase ? { ...d, model_building_completed: true } : d
      )))
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("workflow-status-updated"))
      }
    } catch {
      // Popup is handled globally in dashboard layout.
    } finally {
      setRunning(false)
    }
  }

  const openTestModel = () => {
    if (!datasetBase) return
    router.push(`/dashboard/train/test?dataset=${encodeURIComponent(datasetBase)}`)
  }

  const task = String(modelReport?.task || "").toLowerCase()
  const hasReport = !!modelReport
  const completedDatasets = useMemo(
    () => datasets.filter((d) => !!d?.model_building_completed),
    [datasets]
  )
  const pendingDatasets = useMemo(
    () => datasets.filter((d) => !d?.model_building_completed),
    [datasets]
  )
  const nextPendingDatasetBase = useMemo(() => {
    if (!pendingDatasets.length) return ""
    return pendingDatasets.find((d) => d.dataset_base !== datasetBase)?.dataset_base || pendingDatasets[0].dataset_base
  }, [pendingDatasets, datasetBase])
  const hpoStatus = String(modelReport?.hpo?.status || "").toLowerCase()
  const hpoScore = modelReport?.hpo?.best_score
  const ensembleInfo = modelReport?.ensemble || {}
  const topModels = ensembleInfo.models || modelReport?.top_k_models || []
  const topK = ensembleInfo.top_k || modelReport?.hpo?.top_k || topModels.length || 0
  const finalLabel = ensembleInfo.enabled
    ? `Ensemble (Top ${topK || topModels.length})`
    : modelReport?.best_model

  const tabs = [
    { id: "metrics",    label: "📊 Metrics" },
    { id: "leaderboard", label: "🏆 Leaderboard" },
    { id: "features",  label: "⚙️ Features" },
  ]

  const showSessionBuffer = bootstrapping || (!!datasetBase && reportLoading && !modelReport && !running)

  if (showSessionBuffer) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <Card className="animate-pulse">
          <div className="h-6 w-56 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="mt-2 h-4 w-72 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="mt-5 grid sm:grid-cols-2 gap-3">
            <div className="h-24 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700" />
            <div className="h-24 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700" />
          </div>
          <div className="mt-4 h-10 w-40 rounded-xl bg-slate-200 dark:bg-slate-700" />
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Build Model</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Run AutoML model selection, review full metrics, then test your model.
          </p>
        </div>
        {hasReport && (
          <div className="flex gap-2 flex-wrap">
            <Pill text={task === "classification" ? "Classification" : "Regression"} color={task === "classification" ? "blue" : "amber"} />
            <Pill text={`v. ${modelReport.framework || "sklearn"}`} color="purple" />
          </div>
        )}
      </div>

      {datasets.length > 1 && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Model Building Progress</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {completedDatasets.length} of {datasets.length} dataset{datasets.length !== 1 ? "s" : ""} trained
              </p>
            </div>
            {pendingDatasets.length > 0 && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                {pendingDatasets.length} pending
              </span>
            )}
          </div>

          <div className="mt-3 grid sm:grid-cols-2 gap-2">
            {datasets.map((d) => {
              const isDone = !!d.model_building_completed
              const isActive = d.dataset_base === datasetBase
              return (
                <button
                  key={d.dataset_base}
                  type="button"
                  onClick={() => {
                    setActiveTab("metrics")
                    selectDataset(d.dataset_base)
                  }}
                  className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                    isActive
                      ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20"
                      : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 hover:bg-slate-100 dark:hover:bg-slate-900"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{d.dataset_base}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${
                      isDone
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                        : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                    }`}>
                      {isDone ? "Trained" : "Pending"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{d.row_count} rows</p>
                </button>
              )
            })}
          </div>
        </Card>
      )}

      {/* ── Control Card ───────────────────────────────────────────────────── */}
      <Card>
        <div className="flex flex-wrap items-center gap-4 justify-between">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Session Dataset</p>
            <p className="font-semibold text-slate-900 dark:text-white text-lg">{datasetBase || "Not selected"}</p>
            {datasets.length > 1 && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Use the Model Building Progress cards above to switch datasets.
              </p>
            )}
            {hasReport && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {modelReport.row_count?.toLocaleString()} rows · {modelReport.feature_count} features · Target: <strong>{modelReport.target}</strong>
              </p>
            )}
          </div>

          <div className="flex gap-3 flex-wrap">
            {!hasReport && (
              <button
                onClick={runModelSelection}
                disabled={running || !datasetBase || !token || !sessionId}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold text-sm shadow-sm transition"
              >
                🚀 Select Model
              </button>
            )}
            {hasReport && (
              <>
                <button
                  onClick={runModelSelection}
                  disabled={running || !datasetBase || !token || !sessionId}
                  className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-60 font-semibold text-sm transition"
                >
                  🔁 Re-train
                </button>
                <button
                  onClick={openTestModel}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-sm transition"
                >
                  🧪 Test Model →
                </button>
                {nextPendingDatasetBase && nextPendingDatasetBase !== datasetBase && (
                  <button
                    onClick={() => {
                      setActiveTab("metrics")
                      selectDataset(nextPendingDatasetBase)
                    }}
                    className="px-5 py-2.5 rounded-xl border border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 font-semibold text-sm transition"
                  >
                    Next Dataset
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Best model banner */}
        {hasReport && (
          <div className="mt-4 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 p-4">
            <div className="flex flex-wrap items-start gap-4 justify-between">
              <div>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider">Final System</p>
                <p className="text-lg font-black text-emerald-800 dark:text-emerald-200">{finalLabel || "—"}</p>
                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                  Top model: <strong>{modelReport.best_model}</strong>
                  {" "}· Tuned CV {modelReport.metric}: <strong>{fmt(modelReport.cv_score || hpoScore)}</strong>
                  {" "}· Val: <strong>{fmt(modelReport.final_validation_score)}</strong>
                  {" "}· HPO: <strong>{hpoStatus || "unknown"}</strong>
                  {" "}· Pipeline: {modelReport.total_pipeline_time_seconds}s
                </p>
                {topModels.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {topModels.map((name) => (
                      <Pill key={name} text={name} color="blue" />
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-4 flex-wrap">
                <div className="text-center">
                  <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
                    {modelReport.models_trained}
                  </div>
                  <div className="text-xs text-emerald-600 dark:text-emerald-400">Models tuned</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-black text-slate-700 dark:text-slate-200">
                    {modelReport.feature_count}
                  </div>
                  <div className="text-xs text-slate-500">Features</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {datasets.length > 1 && pendingDatasets.length > 0 && (
        <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-4 py-3 text-sm text-blue-700 dark:text-blue-300">
          {pendingDatasets.length} dataset{pendingDatasets.length !== 1 ? "s" : ""} still pending for model training. Use the progress panel to continue with each dataset.
        </div>
      )}

      {/* ── Report Tabs ────────────────────────────────────────────────────── */}
      {hasReport && (
        <>
          {/* Tab bar */}
          <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors ${
                  activeTab === tab.id
                    ? "bg-white dark:bg-slate-800 border border-b-white dark:border-slate-700 dark:border-b-slate-800 text-blue-600 dark:text-blue-400"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Metrics Tab */}
          {activeTab === "metrics" && (
            <>
              <HpoSummary report={modelReport} />
              {task === "classification"
                ? <ClassificationDashboard report={modelReport} />
                : <RegressionDashboard report={modelReport} />}
            </>
          )}

          {/* Leaderboard Tab */}
          {activeTab === "leaderboard" && (
            <Leaderboard
              leaderboard={modelReport.leaderboard}
              task={task}
              bestModel={modelReport.best_model}
              topModels={topModels}
            />
          )}

          {/* Features Tab */}
          {activeTab === "features" && (
            <FeatureProcessingTable
              featureProcessing={modelReport.feature_processing}
              featureImportanceChart={modelReport.feature_importance_chart}
            />
          )}

          {/* Test Model CTA */}
          <div className="flex justify-end">
            <button
              onClick={openTestModel}
              className="px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md transition"
            >
              🧪 Open Test Model →
            </button>
          </div>
        </>
      )}

      {/* ── Training Overlay ───────────────────────────────────────────────── */}
      <TrainingOverlay visible={running} />
    </div>
  )
}