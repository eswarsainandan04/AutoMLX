"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { API_BASE_URL } from "@/lib/api"
import { getAuth } from "@/lib/auth"
import { getCachedModelTestingSchema, setCachedModelTestingSchema } from "@/lib/session-cache"

export default function TestModelPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [token, setToken] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [datasetBase, setDatasetBase] = useState("")

  const [schema, setSchema] = useState(null)
  const [values, setValues] = useState({})
  const [prediction, setPrediction] = useState(null)
  const [loading, setLoading] = useState(true)
  const [predicting, setPredicting] = useState(false)
  const [error, setError] = useState("")
  const [confidenceThresholdPercent, setConfidenceThresholdPercent] = useState(50)

  useEffect(() => {
    const t = getAuth("token")
    const sid = getAuth("session_id")

    if (!t) {
      router.push("/login")
      return
    }
    if (!sid) {
      router.push("/dashboard/upload")
      return
    }

    const fromQuery = searchParams.get("dataset")
    const fromStorage = sessionStorage.getItem("selected_dataset_base")
    const selected = fromQuery || fromStorage || ""

    if (!selected) {
      router.push("/dashboard/train")
      return
    }

    setToken(t)
    setSessionId(sid)
    setDatasetBase(selected)
  }, [router, searchParams])

  useEffect(() => {
    if (!token || !sessionId || !datasetBase) return

    const cachedSchema = getCachedModelTestingSchema(sessionId, datasetBase)
    if (cachedSchema) {
      setSchema(cachedSchema)
      const cachedInitial = {}
      for (const f of cachedSchema.fields || []) {
        cachedInitial[f.name] = ""
      }
      setValues(cachedInitial)

      const cachedThreshold = Number(cachedSchema?.default_confidence_threshold_percent)
      setConfidenceThresholdPercent(
        Number.isFinite(cachedThreshold)
          ? Math.min(100, Math.max(0, cachedThreshold))
          : 50
      )
      setLoading(false)
    }

    const load = async () => {
      if (!cachedSchema) setLoading(true)
      setError("")
      try {
        const res = await fetch(
          `${API_BASE_URL}/automl/model-testing/schema/${sessionId}/${encodeURIComponent(datasetBase)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        const data = await res.json()
        if (!res.ok) throw new Error(data?.detail || "Failed to load model testing schema")

        setSchema(data)
        setCachedModelTestingSchema(sessionId, datasetBase, data)
        const initial = {}
        for (const f of data.fields || []) {
          initial[f.name] = ""
        }
        setValues(initial)

        const defaultThreshold = Number(data?.default_confidence_threshold_percent)
        setConfidenceThresholdPercent(
          Number.isFinite(defaultThreshold)
            ? Math.min(100, Math.max(0, defaultThreshold))
            : 50
        )
      } catch (e) {
        setError(e.message || "Failed to load model testing schema")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [token, sessionId, datasetBase])

  const canPredict = useMemo(() => {
    if (!schema?.fields?.length) return false
    return schema.fields.every((f) => {
      const v = values[f.name]
      return v !== "" && v !== null && v !== undefined
    })
  }, [schema, values])

  const filledCount = useMemo(() => {
    if (!schema?.fields?.length) return 0
    return schema.fields.filter((f) => {
      const v = values[f.name]
      return v !== "" && v !== null && v !== undefined
    }).length
  }, [schema, values])

  const onPredict = async () => {
    if (!schema) return

    setPredicting(true)
    setError("")
    setPrediction(null)

    try {
      const row = {}
      for (const field of schema.fields || []) {
        const raw = values[field.name]
        if (field.input_type === "number") {
          row[field.name] = raw === "" ? null : Number(raw)
        } else {
          row[field.name] = raw
        }
      }

      const thresholdToSend = Math.min(
        100,
        Math.max(0, Number(confidenceThresholdPercent) || 0)
      )

      const res = await fetch(`${API_BASE_URL}/automl/model-testing/predict/${sessionId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          dataset_base: datasetBase,
          row,
          confidence_threshold_percent: thresholdToSend,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data?.detail || "Prediction failed")
      setPrediction(data)
    } catch (e) {
      setError(e.message || "Prediction failed")
    } finally {
      setPredicting(false)
    }
  }

  const probabilityPercent =
    prediction?.probability !== null && prediction?.probability !== undefined
      ? Number(prediction.probability) * 100
      : null

  const probabilityPercentText =
    probabilityPercent !== null && Number.isFinite(probabilityPercent)
      ? probabilityPercent.toFixed(2)
      : null

  const predictionWarnings = Array.isArray(prediction?.warnings) ? prediction.warnings : []

  const predictionThresholdPercent = Number.isFinite(Number(prediction?.confidence_threshold_percent))
    ? Number(prediction.confidence_threshold_percent)
    : confidenceThresholdPercent

  const meetsConfidenceThreshold =
    typeof prediction?.meets_confidence_threshold === "boolean"
      ? prediction.meets_confidence_threshold
      : null

  const confidenceColor =
    probabilityPercent !== null && meetsConfidenceThreshold === false
      ? { bar: "bg-red-500", text: "text-red-600 dark:text-red-400", badge: "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700" }
      : probabilityPercent !== null && probabilityPercent >= 80
      ? { bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", badge: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700" }
      : probabilityPercent !== null && probabilityPercent >= 50
      ? { bar: "bg-amber-500", text: "text-amber-600 dark:text-amber-400", badge: "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700" }
      : { bar: "bg-red-500", text: "text-red-600 dark:text-red-400", badge: "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700" }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-wrap gap-3 items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
              <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Test Model</h2>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm ml-10">
            Enter a sample row to get a live prediction
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium border border-slate-200 dark:border-slate-700 truncate max-w-[200px]">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7C5 4 4 5 4 7z" />
            </svg>
            {datasetBase}
          </span>
          <button
            onClick={() => router.push(`/dashboard/train?dataset=${encodeURIComponent(datasetBase)}`)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Metrics
          </button>
        </div>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-10 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 dark:text-slate-400 text-sm">Loading test schema...</p>
        </div>
      )}

      {/* ── Schema Form ── */}
      {!loading && schema && (
        <div className="grid lg:grid-cols-3 gap-5">

          {/* Left: Input Fields */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">

            {/* Card Header */}
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Input Fields</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Fill all fields to enable prediction
                </p>
              </div>
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                {filledCount} / {schema.fields?.length ?? 0} filled
              </span>
            </div>

            {/* Fields */}
            <div className="p-5 grid sm:grid-cols-2 gap-4">
              {(schema.fields || []).map((field) => (
                <div key={field.name} className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                    {field.name}
                    <span className="ml-1.5 text-[10px] font-normal normal-case text-slate-400 dark:text-slate-500">
                      ({field.input_type})
                    </span>
                  </label>

                  {field.input_type === "number" && (
                    <input
                      type="number"
                      value={values[field.name] ?? ""}
                      onChange={(e) => setValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
                      min={field.min ?? undefined}
                      max={field.max ?? undefined}
                      step="any"
                      placeholder="Enter number"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 py-2.5 text-sm placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                    />
                  )}

                  {field.input_type === "categorical" && (
                    <select
                      value={values[field.name] ?? ""}
                      onChange={(e) => setValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition appearance-none cursor-pointer"
                    >
                      <option value="" disabled className="text-slate-400">— Select value —</option>
                      {(field.options || []).map((opt) => (
                        <option key={String(opt)} value={String(opt)} className="text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800">
                          {String(opt)}
                        </option>
                      ))}
                    </select>
                  )}

                  {field.input_type === "text_area" && (
                    <textarea
                      rows={3}
                      value={values[field.name] ?? ""}
                      onChange={(e) => setValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
                      placeholder="Enter text…"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 py-2.5 text-sm placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition resize-none"
                    />
                  )}

                  {field.input_type === "number" && (field.min !== undefined || field.max !== undefined) && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Min: {field.min ?? "-"} | Max: {field.max ?? "-"}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Footer / Action */}
            <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/60">
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {canPredict ? "All fields filled — ready to predict." : "Fill all fields to run prediction."}
              </p>
              <button
                onClick={onPredict}
                disabled={!canPredict || predicting}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors shadow-sm"
              >
                {predicting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Predicting…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Run Prediction
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right: Meta + Result */}
          <div className="flex flex-col gap-4">

            {/* Model Info Card */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 space-y-3">
              <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Model Info</h4>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Target Column</span>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md">{schema.target}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Task Type</span>
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-md capitalize">{schema.task}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Features</span>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">{schema.fields?.length ?? 0}</span>
                </div>

                {schema.task === "classification" && (
                  <div className="pt-2 mt-1 border-t border-slate-100 dark:border-slate-700 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 dark:text-slate-400">Confidence Threshold</span>
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                        {confidenceThresholdPercent.toFixed(0)}%
                      </span>
                    </div>

                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={confidenceThresholdPercent}
                      onChange={(e) => {
                        const next = Number(e.target.value)
                        if (!Number.isFinite(next)) return
                        setConfidenceThresholdPercent(Math.min(100, Math.max(0, next)))
                      }}
                      className="w-full accent-emerald-500"
                    />

                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={confidenceThresholdPercent}
                        onChange={(e) => {
                          const next = Number(e.target.value)
                          if (!Number.isFinite(next)) return
                          setConfidenceThresholdPercent(Math.min(100, Math.max(0, next)))
                        }}
                        className="w-24 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <span className="text-xs text-slate-500 dark:text-slate-400">%</span>
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Predictions below this confidence are flagged as below-threshold.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Prediction Result Card */}
            {prediction ? (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Prediction Result</h4>
                </div>

                {/* Predicted value */}
                <div className="rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-4 py-3 text-center">
                  <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Predicted Value</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{String(prediction.prediction)}</p>
                </div>

                {/* Confidence */}
                {probabilityPercent !== null && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Confidence</p>
                      <span className={`text-sm font-bold ${confidenceColor.text}`}>
                        {probabilityPercentText}%
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <span>Threshold</span>
                      <span className="font-semibold">{predictionThresholdPercent.toFixed(2)}%</span>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${confidenceColor.bar}`}
                        style={{ width: `${Math.min(probabilityPercent, 100)}%` }}
                      />
                    </div>
                    <span className={`inline-block text-[11px] font-semibold px-2.5 py-1 rounded-lg border ${confidenceColor.badge}`}>
                      {meetsConfidenceThreshold === true
                        ? `Meets ${predictionThresholdPercent.toFixed(0)}% threshold`
                        : meetsConfidenceThreshold === false
                        ? `Below ${predictionThresholdPercent.toFixed(0)}% threshold`
                        : probabilityPercent >= 80
                        ? "High confidence"
                        : probabilityPercent >= 50
                        ? "Moderate confidence"
                        : "Low confidence"}
                    </span>
                  </div>
                )}

                {predictionWarnings.length > 0 && (
                  <div className="rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-3.5 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300 mb-2">
                      Prediction Warnings
                    </p>
                    <ul className="space-y-1.5">
                      {predictionWarnings.map((w, idx) => (
                        <li key={idx} className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
                          • {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-600 rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-2">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                  <svg className="w-5 h-5 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.847a4.5 4.5 0 003.09 3.09L15.75 12l-2.847.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No prediction yet</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">Fill all fields and run prediction</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3.5 text-sm text-red-700 dark:text-red-300">
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}