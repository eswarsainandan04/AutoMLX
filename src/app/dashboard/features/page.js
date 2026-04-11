"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { API_BASE_URL } from "@/lib/api"
import { getAuth } from "@/lib/auth"
import { getCachedFeatureSelection, setCachedFeatureSelection } from "@/lib/session-cache"

// ─── Small helpers ────────────────────────────────────────────────────────────

const TYPE_COLORS = {
  numeric:     "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  categorical: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
  boolean:     "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  datetime:    "bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300",
  text:        "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  unknown:     "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400",
}

function typeBadge(type = "unknown") {
  const key = type.toLowerCase()
  const cls = TYPE_COLORS[key] || TYPE_COLORS.unknown
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>
      {type}
    </span>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TargetCard({ card, task }) {
  if (!card) return null
  return (
    <div className="rounded-2xl border-2 border-emerald-400 dark:border-emerald-500 bg-emerald-50/60 dark:bg-emerald-900/20 p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-emerald-600 dark:text-emerald-400 text-lg">🎯</span>
          <span className="font-semibold text-slate-900 dark:text-white text-base">{card.column}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-200 dark:bg-emerald-700 text-emerald-800 dark:text-emerald-200 font-medium">
            Target
          </span>
        </div>
        <div className="flex items-center gap-2">
          {typeBadge(card.structural_type)}
          {task && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 font-medium capitalize">
              {task}
            </span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        {[
          { label: "Dtype", value: card.inferred_dtype || "—" },
          { label: "Unique", value: card.unique_count ?? "—" },
          {
            label: "Nulls",
            value: (
              <>
                {card.null_count ?? 0}
                <span className="text-slate-400 font-normal ml-1">({card.null_percentage ?? 0}%)</span>
              </>
            ),
          },
          { label: "Samples", value: card.sample_values?.slice(0, 3).join(", ") || "—" },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-700/40 px-3 py-2">
            <p className="text-slate-500 dark:text-slate-400 mb-0.5">{label}</p>
            <p className="font-semibold text-slate-800 dark:text-white truncate">{value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function FeatureCard({ card }) {
  if (!card) return null
  const pct = Math.round((card.importance_normalized ?? 0) * 100)
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-slate-900 dark:text-white text-sm leading-snug break-all">
          {card.feature}
        </p>
        {typeBadge(card.structural_type)}
      </div>
      <div>
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
          <span>MI Importance</span>
          <span className="font-medium text-slate-700 dark:text-slate-200">{card.importance_tag}</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
          <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        {[
          { label: "Dtype", value: card.inferred_dtype || "—" },
          { label: "Unique", value: card.unique_count ?? "—" },
          { label: "Nulls", value: card.null_count ?? 0 },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg bg-slate-50 dark:bg-slate-900/50 px-2 py-1.5 text-center">
            <p className="text-slate-400 dark:text-slate-500 text-[10px] leading-tight">{label}</p>
            <p className="font-medium text-slate-700 dark:text-slate-200 truncate">{value}</p>
          </div>
        ))}
      </div>
      {card.sample_values?.length > 0 && (
        <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
          <span className="font-medium text-slate-500 dark:text-slate-400">Samples: </span>
          {card.sample_values.slice(0, 4).join(", ")}
        </p>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FeaturesPage() {
  const router = useRouter()

  const [token, setToken]           = useState(null)
  const [sessionId, setSessionId]   = useState(null)
  const [loading, setLoading]       = useState(true)
  const [busy, setBusy]             = useState(false)
  const [error, setError]           = useState("")

  const [datasets, setDatasets]                 = useState([])
  const [datasetBase, setDatasetBase]           = useState("")
  const [target, setTarget]                     = useState("")
  const [recommendations, setRecommendations]   = useState([])
  const [task, setTask]                         = useState("")
  const [selectedFeatures, setSelectedFeatures] = useState([])

  const [featuresSaved, setFeaturesSaved] = useState(false)
  const [savedData, setSavedData]         = useState(null)

  // Modal state
  const [showTargetModal, setShowTargetModal]   = useState(false)
  const [creatingTarget, setCreatingTarget]     = useState(false)
  const [targetColumnName, setTargetColumnName] = useState("target_generated")
  const [targetType, setTargetType]             = useState("binary_classification")
  const [metricColumns, setMetricColumns]       = useState([])
  const [conditions, setConditions]             = useState([
    { metric: "", operator: ">", value: "", value2: "", output_value: "" },
  ])
  const [defaultValue, setDefaultValue]                   = useState("")
  const [targetPreview, setTargetPreview]                 = useState([])
  const [targetPreviewColumns, setTargetPreviewColumns]   = useState([])

  const selectDataset = useCallback((nextDatasetBase) => {
    const next = nextDatasetBase || ""
    setDatasetBase(next)
    if (typeof window !== "undefined") {
      if (next) sessionStorage.setItem("selected_dataset_base", next)
      else sessionStorage.removeItem("selected_dataset_base")
      window.dispatchEvent(new Event("workflow-status-updated"))
    }
  }, [])

  // ── Auth ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const t   = getAuth("token")
    const sid = getAuth("session_id")
    if (!t)   { router.push("/login"); return }
    if (!sid) { router.push("/dashboard/upload"); return }
    setToken(t)
    setSessionId(sid)
  }, [router])

  // ── Load datasets ─────────────────────────────────────────────────────────────
  const loadDatasets = useCallback(
    async (preferredDatasetBase = "") => {
      if (!token || !sessionId) return
      setLoading(true)
      setError("")
      try {
        const res  = await fetch(`${API_BASE_URL}/automl/feature-engineering/datasets/${sessionId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.detail || "Failed to load datasets")
        const rows = data?.datasets || []
        setDatasets(rows)
        if (rows.length > 0) {
          const firstPending = rows.find((d) => !d?.feature_engineering_completed)?.dataset_base || ""
          const keep =
            preferredDatasetBase && rows.some((d) => d.dataset_base === preferredDatasetBase)
              ? preferredDatasetBase
              : rows.some((d) => d.dataset_base === datasetBase)
              ? datasetBase
              : firstPending || rows[0].dataset_base
          selectDataset(keep)
        } else {
          selectDataset("")
        }
      } catch (e) {
        setError(e.message || "Failed to load datasets")
      } finally {
        setLoading(false)
      }
    },
    [token, sessionId, datasetBase, selectDataset]
  )

  useEffect(() => {
    if (!token || !sessionId) return
    loadDatasets()
  }, [token, sessionId, loadDatasets])

  const activeDataset = useMemo(
    () => datasets.find((d) => d.dataset_base === datasetBase) || null,
    [datasets, datasetBase]
  )
  const completedDatasets = useMemo(
    () => datasets.filter((d) => !!d?.feature_engineering_completed),
    [datasets]
  )
  const pendingDatasets = useMemo(
    () => datasets.filter((d) => !d?.feature_engineering_completed),
    [datasets]
  )
  const nextPendingDatasetBase = useMemo(() => {
    if (!pendingDatasets.length) return ""
    return pendingDatasets.find((d) => d.dataset_base !== datasetBase)?.dataset_base || pendingDatasets[0].dataset_base
  }, [pendingDatasets, datasetBase])
  const columns = activeDataset?.columns || []

  // ── Reset + load saved when dataset changes ───────────────────────────────────
  useEffect(() => {
    if (!token || !sessionId || !datasetBase) return

    const cachedSelection = getCachedFeatureSelection(sessionId, datasetBase)
    if (cachedSelection) {
      setSavedData(cachedSelection)
      setFeaturesSaved(true)
    } else {
      setFeaturesSaved(false)
      setSavedData(null)
    }

    setTarget("")
    setRecommendations([])
    setSelectedFeatures([])
    setTask("")
    setTargetPreview([])
    setTargetPreviewColumns([])

    ;(async () => {
      try {
        const statusRes = await fetch(
          `${API_BASE_URL}/automl/feature-engineering/status/${sessionId}/${encodeURIComponent(datasetBase)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        if (!statusRes.ok) return

        const status = await statusRes.json()
        if (!status?.generated) {
          setFeaturesSaved(false)
          setSavedData(null)
          return
        }

        const res = await fetch(
          `${API_BASE_URL}/automl/feature-engineering/saved/${sessionId}/${encodeURIComponent(datasetBase)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        if (!res.ok) return

        const data = await res.json()
        setSavedData(data)
        setFeaturesSaved(true)
        setCachedFeatureSelection(sessionId, datasetBase, data)
      } catch { /* silent */ }
    })()
  }, [datasetBase, token, sessionId])

  // ── Modal helpers ─────────────────────────────────────────────────────────────
  const openCreateTargetModal = () => {
    setShowTargetModal(true)
    setTargetPreview([])
    setTargetPreviewColumns([])
    setTargetType("binary_classification")
    setTargetColumnName(`target_${Date.now()}`)
    setMetricColumns([])
    setDefaultValue("")
    setConditions([{ metric: "", operator: ">", value: "", value2: "", output_value: "" }])
  }

  const closeCreateTargetModal = () => {
    if (creatingTarget) return
    setShowTargetModal(false)
  }

  const updateCondition = (idx, key, value) =>
    setConditions((prev) => prev.map((r, i) => (i === idx ? { ...r, [key]: value } : r)))

  const addCondition = () =>
    setConditions((prev) => [...prev, { metric: "", operator: "=", value: "", output_value: "" }])

  const removeCondition = (idx) =>
    setConditions((prev) => prev.filter((_, i) => i !== idx))

  const generateTargetColumn = async () => {
    if (!datasetBase)               { setError("Choose a dataset first"); return }
    if (!targetColumnName.trim())   { setError("Enter a new target column name"); return }
    if (metricColumns.length === 0) { setError("Select at least one metric column"); return }

    const hasUsableRule = conditions.some((r) => r.metric && r.operator && r.value !== "")
    if (!hasUsableRule) {
      setError("Add at least one valid condition")
      return
    }

    setCreatingTarget(true)
    setError("")
    try {
      const preparedConditions = conditions
        .filter((r) => r.metric && r.operator && r.value !== "")
        .map((r) => ({
          metric:       r.metric,
          operator:     r.operator,
          value:        r.value,
          value2:       r.value2 === "" ? null : r.value2,
          output_value: r.output_value === "" ? null : r.output_value,
        }))

      const res = await fetch(`${API_BASE_URL}/automl/feature-engineering/create-target/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          dataset_base:       datasetBase,
          target_column_name: targetColumnName.trim(),
          metric_columns:     metricColumns,
          target_type:        targetType,
          conditions:         preparedConditions,
          default_value:      defaultValue === "" ? null : defaultValue,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data?.detail || "Failed to generate target column")

      const previewRows = data?.preview || []
      setTargetPreview(previewRows)
      setTargetPreviewColumns(previewRows.length > 0 ? Object.keys(previewRows[0]) : [])

      await loadDatasets(datasetBase)
      const newTarget = data?.target_column || targetColumnName.trim()
      setTarget(newTarget)
      setTask(data?.target_type || task)
      setRecommendations([])
      setSelectedFeatures([])
    } catch (e) {
      setError(e.message || "Failed to generate target column")
    } finally {
      setCreatingTarget(false)
    }
  }

  // ── Feature recommendations ───────────────────────────────────────────────────
  const fetchRecommendations = async () => {
    if (!target) return
    setBusy(true)
    setError("")
    try {
      const res = await fetch(`${API_BASE_URL}/automl/feature-engineering/recommend/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ dataset_base: datasetBase, target }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.detail || "Failed to compute feature importance")
      const recs = data?.recommendations || []
      setRecommendations(recs)
      setTask(data?.task || "")
      setSelectedFeatures(recs.map((r) => r.feature))
    } catch (e) {
      setError(e.message || "Failed to compute feature importance")
    } finally {
      setBusy(false)
    }
  }

  const toggleFeature = (name) =>
    setSelectedFeatures((prev) =>
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]
    )

  const saveFeatureSelection = async () => {
    if (!target)                       { setError("Select a target column first"); return }
    if (selectedFeatures.length === 0) { setError("Select at least one feature"); return }
    setBusy(true)
    setError("")
    try {
      const res = await fetch(`${API_BASE_URL}/automl/feature-engineering/select/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ dataset_base: datasetBase, target, selected_features: selectedFeatures }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.detail || "Failed to save feature selection")

      sessionStorage.setItem("selected_dataset_base", datasetBase)

      const savedRes = await fetch(
        `${API_BASE_URL}/automl/feature-engineering/saved/${sessionId}/${encodeURIComponent(datasetBase)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const savedJson = await savedRes.json()
      if (!savedRes.ok) throw new Error(savedJson?.detail || "Failed to load saved feature cards")

      setSavedData(savedJson)
      setFeaturesSaved(true)
      setCachedFeatureSelection(sessionId, datasetBase, savedJson)
      await loadDatasets(datasetBase)
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("workflow-status-updated"))
      }
    } catch (e) {
      setError(e.message || "Failed to save feature selection")
    } finally {
      setBusy(false)
    }
  }

  const goToBuildModel = () => {
    if (!datasetBase) return
    router.push(`/dashboard/train?dataset=${encodeURIComponent(datasetBase)}`)
  }

  const handleReselect = () => {
    setFeaturesSaved(false)
    setSavedData(null)
    setRecommendations([])
    setSelectedFeatures([])
    setTarget("")
    setTask("")
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

      {/* Page header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Feature Engineering</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          Pick a target column, review feature importance (MI), choose inputs, then build your model.
        </p>
      </div>

      {loading && (
        <div className="text-slate-500 dark:text-slate-400 text-sm">Loading session datasets…</div>
      )}

      {!loading && datasets.length > 1 && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Dataset Progress</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {completedDatasets.length} of {datasets.length} dataset{datasets.length !== 1 ? "s" : ""} completed
              </p>
            </div>
            {pendingDatasets.length > 0 && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                {pendingDatasets.length} pending
              </span>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            {datasets.map((d) => {
              const isActive = d.dataset_base === datasetBase
              const isDone = !!d.feature_engineering_completed
              return (
                <button
                  key={d.dataset_base}
                  type="button"
                  onClick={() => selectDataset(d.dataset_base)}
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
                      {isDone ? "Completed" : "Pending"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{d.row_count} rows</p>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── CONFIRMED VIEW ── */}
      {!loading && featuresSaved && savedData && (
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-emerald-300 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-5 py-3">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-medium text-sm">
              <span>✅</span>
              <span>
                Features confirmed for <strong>{savedData.dataset_base}</strong> —{" "}
                {savedData.feature_count} feature{savedData.feature_count !== 1 ? "s" : ""} selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              {datasets.length > 1 && nextPendingDatasetBase && nextPendingDatasetBase !== datasetBase && (
                <button
                  onClick={() => selectDataset(nextPendingDatasetBase)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition"
                >
                  Next Dataset
                </button>
              )}
              <button
                onClick={handleReselect}
                className="text-xs px-3 py-1.5 rounded-lg border border-emerald-400 dark:border-emerald-600 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-800/40 transition"
              >
                Re-select
              </button>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Target Column
            </p>
            <TargetCard card={savedData.target_card} task={savedData.task} />
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              Selected Features ({savedData.feature_count})
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {savedData.feature_cards.map((card) => (
                <FeatureCard key={card.feature} card={card} />
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3.5 text-sm text-red-700 dark:text-red-300">
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {datasets.length > 1 && pendingDatasets.length > 0 && (
            <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-4 py-3 text-sm text-blue-700 dark:text-blue-300">
              {pendingDatasets.length} dataset{pendingDatasets.length !== 1 ? "s" : ""} still pending. Use Dataset Progress above to continue feature selection for each dataset.
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              onClick={goToBuildModel}
              className="px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-md shadow-emerald-500/20 transition"
            >
              🚀 Let's Build Model
            </button>
          </div>
        </div>
      )}

      {/* ── SELECTION UI ── */}
      {!loading && !featuresSaved && (
        <>
          {/* Step 1 */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Step 1 — Choose Dataset &amp; Target
            </p>

            <div className={`grid ${datasets.length > 1 ? "md:grid-cols-2" : "md:grid-cols-1"} gap-4`}>
              {datasets.length > 1 ? (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                    Dataset
                  </label>
                  <select
                    value={datasetBase}
                    onChange={(e) => {
                      const next = e.target.value
                      selectDataset(next)
                    }}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                  >
                    {datasets.map((d) => (
                      <option key={d.dataset_base} value={d.dataset_base} className="bg-white dark:bg-slate-800">
                        {d.dataset_base} ({d.row_count} rows)
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                    Dataset
                  </label>
                  <div className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100">
                    {datasetBase || datasets[0]?.dataset_base || "—"}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                  Target Column
                </label>
                <select
                  value={target}
                  onChange={(e) => {
                    setTarget(e.target.value)
                    setRecommendations([])
                    setSelectedFeatures([])
                    setTask("")
                  }}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                >
                  <option value="" disabled className="text-slate-400">Select target column</option>
                  {columns.map((c) => (
                    <option key={c} value={c} className="bg-white dark:bg-slate-800">{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 items-center">
              <button
                onClick={openCreateTargetModal}
                disabled={!datasetBase || busy}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white font-semibold text-sm transition"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Create Target Column
              </button>

              <button
                onClick={fetchRecommendations}
                disabled={!target || busy}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold text-sm transition"
              >
                {busy && recommendations.length === 0 ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Computing…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Get Feature Importance
                  </>
                )}
              </button>

              {task && (
                <span className="text-xs px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 font-medium">
                  Task: {task}
                </span>
              )}
            </div>
          </div>

          {/* Step 2 */}
          {recommendations.length > 0 && (
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  Step 2 — Select Feature Inputs
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Selected: {selectedFeatures.length} / {recommendations.length}
                </p>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Importance tag shows normalized MI score. Toggle to include / exclude.
              </p>

              <div className="grid md:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
                {recommendations.map((item) => {
                  const checked = selectedFeatures.includes(item.feature)
                  return (
                    <label
                      key={item.feature}
                      className={`rounded-xl border p-3 flex items-start justify-between gap-3 cursor-pointer transition ${
                        checked
                          ? "border-blue-400 bg-blue-50/60 dark:bg-blue-500/10"
                          : "border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleFeature(item.feature)}
                          className="mt-1"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                            {item.feature}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            MI: {item.mi_score.toFixed(6)}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 whitespace-nowrap">
                        {item.importance_tag}
                      </span>
                    </label>
                  )
                })}
              </div>

              <div className="mt-5 flex items-center justify-end">
                <button
                  onClick={saveFeatureSelection}
                  disabled={busy || selectedFeatures.length === 0}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold text-sm transition"
                >
                  {busy ? "Saving…" : "Select Features"}
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3.5 text-sm text-red-700 dark:text-red-300">
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <span>{error}</span>
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          CREATE TARGET MODAL — Professional redesign
      ══════════════════════════════════════════════════════════════════════ */}
      {showTargetModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(15,23,42,0.65)", backdropFilter: "blur(4px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) closeCreateTargetModal() }}
        >
          <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">

            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-900/40">
                  <svg className="w-5 h-5 text-violet-600 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </span>
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white leading-tight">
                    Create Target Column
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Build a target column from existing metrics using rule conditions
                  </p>
                </div>
              </div>
              <button
                onClick={closeCreateTargetModal}
                disabled={creatingTarget}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body — scrollable */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

              {/* Section A — Column config */}
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                  Column Configuration
                </p>
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                      Column Name
                    </label>
                    <input
                      value={targetColumnName}
                      onChange={(e) => setTargetColumnName(e.target.value)}
                      placeholder="customer_risk_target"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2.5 text-sm placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                      Target Type
                    </label>
                    <select
                      value={targetType}
                      onChange={(e) => setTargetType(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
                    >
                      <option value="binary_classification" className="bg-white dark:bg-slate-800">Binary Classification</option>
                      <option value="multiclass_classification" className="bg-white dark:bg-slate-800">Multi-class Classification</option>
                      <option value="regression" className="bg-white dark:bg-slate-800">Regression</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                      Default Value
                      <span className="ml-1 text-[10px] normal-case font-normal text-slate-400">(optional)</span>
                    </label>
                    <input
                      value={defaultValue}
                      onChange={(e) => setDefaultValue(e.target.value)}
                      placeholder={targetType === "multiclass_classification" ? "class_0" : "0"}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2.5 text-sm placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800" />

              {/* Section B — Metric Columns — checkbox list (dark mode safe) */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Step 1 — Select Metric Columns
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                      Click to toggle. Select all columns you want to use in the rule.
                    </p>
                  </div>
                  {metricColumns.length > 0 && (
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
                      {metricColumns.length} selected
                    </span>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="max-h-44 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {columns.length === 0 ? (
                      <p className="text-xs text-slate-400 dark:text-slate-500 px-4 py-3">No columns available</p>
                    ) : (
                      columns.map((col) => {
                        const selected = metricColumns.includes(col)
                        return (
                          <button
                            key={col}
                            type="button"
                            onClick={() =>
                              setMetricColumns((prev) =>
                                prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
                              )
                            }
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                              selected
                                ? "bg-violet-50 dark:bg-violet-900/20 text-violet-800 dark:text-violet-200"
                                : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                            }`}
                          >
                            <span className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                              selected
                                ? "bg-violet-600 border-violet-600"
                                : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                            }`}>
                              {selected && (
                                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </span>
                            <span className="truncate">{col}</span>
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800" />

              {/* Section C — Rule Builder */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Step 2 — Rule Builder
                  </p>
                  <button
                    type="button"
                    onClick={addCondition}
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Add Condition
                  </button>
                </div>

                <div className="space-y-2">
                  {conditions.map((rule, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-12 gap-2 items-end bg-slate-50 dark:bg-slate-800/60 rounded-xl px-3 py-3 border border-slate-200 dark:border-slate-700"
                    >
                      {/* Metric */}
                      <div className="col-span-3 flex flex-col gap-1">
                        <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                          Metric
                        </label>
                        <select
                          value={rule.metric}
                          onChange={(e) => updateCondition(idx, "metric", e.target.value)}
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500 transition"
                        >
                          <option value="" className="bg-white dark:bg-slate-800">Select column</option>
                          {metricColumns.map((col) => (
                            <option key={col} value={col} className="bg-white dark:bg-slate-800">{col}</option>
                          ))}
                        </select>
                      </div>

                      {/* Operator */}
                      <div className="col-span-2 flex flex-col gap-1">
                        <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                          Operator
                        </label>
                        <select
                          value={rule.operator}
                          onChange={(e) => updateCondition(idx, "operator", e.target.value)}
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500 transition"
                        >
                          {[">",">=","<","<=","=","!=","between"].map((op) => (
                            <option key={op} value={op} className="bg-white dark:bg-slate-800">{op}</option>
                          ))}
                        </select>
                      </div>

                      {/* Value */}
                      <div className="col-span-3 flex flex-col gap-1">
                        <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                          Value
                        </label>
                        <input
                          type="text"
                          autoComplete="off"
                          placeholder="e.g. 60, Yes"
                          value={rule.value}
                          onChange={(e) => updateCondition(idx, "value", e.target.value)}
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-2 py-2 text-xs placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500 transition"
                        />
                      </div>

                      {/* Output */}
                      <div className="col-span-3 flex flex-col gap-1">
                        <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                          Output Value
                        </label>
                        <input
                          type="text"
                          autoComplete="off"
                          placeholder="e.g. 1, Positive"
                          value={rule.output_value}
                          onChange={(e) => updateCondition(idx, "output_value", e.target.value)}
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-2 py-2 text-xs placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500 transition"
                        />
                      </div>

                      {/* Delete */}
                      <div className="col-span-1 flex justify-center pb-0.5">
                        <button
                          type="button"
                          onClick={() => removeCondition(idx)}
                          disabled={conditions.length === 1}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview table */}
              {targetPreview.length > 0 && (
                <>
                  <div className="border-t border-slate-100 dark:border-slate-800" />
                  <div className="rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50/70 dark:bg-emerald-900/20 overflow-hidden">
                    <div className="px-4 py-3 border-b border-emerald-200 dark:border-emerald-800">
                      <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                        Preview — generated target values
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs">
                        <thead className="bg-emerald-100/60 dark:bg-emerald-900/30">
                          <tr>
                            {targetPreviewColumns.map((c) => (
                              <th key={c} className="text-left px-3 py-2 font-semibold text-emerald-900 dark:text-emerald-200 border-b border-emerald-200 dark:border-emerald-800">
                                {c}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {targetPreview.slice(0, 12).map((row, i) => (
                            <tr key={i} className={i % 2 === 0 ? "" : "bg-emerald-50/40 dark:bg-emerald-900/10"}>
                              {targetPreviewColumns.map((c) => (
                                <td key={`${i}-${c}`} className="px-3 py-2 border-b border-emerald-100 dark:border-emerald-900 text-slate-700 dark:text-slate-300">
                                  {String(row[c] ?? "")}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex-shrink-0">
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {metricColumns.length === 0
                  ? "Select metric columns to continue"
                  : `${metricColumns.length} column${metricColumns.length !== 1 ? "s" : ""} · ${conditions.filter((r) => r.metric && r.value !== "").length} rule${conditions.filter((r) => r.metric && r.value !== "").length !== 1 ? "s" : ""} defined`}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={closeCreateTargetModal}
                  disabled={creatingTarget}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={generateTargetColumn}
                  disabled={creatingTarget}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 active:bg-violet-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm transition shadow-sm"
                >
                  {creatingTarget ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Generating…
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Generate Target
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}