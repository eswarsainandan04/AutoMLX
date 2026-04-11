"use client"

import { useContext, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { API_BASE_URL } from "@/lib/api"
import { getAuth } from "@/lib/auth"
import { DashCtx } from "../context"

const API = API_BASE_URL

function buildEmptyRows(headers, count = 5) {
  return Array.from({ length: count }, () =>
    headers.reduce((acc, h) => ({ ...acc, [h]: "" }), {})
  )
}

function parseCsvLine(line) {
  const out = []
  let cur = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === "," && !inQuotes) {
      out.push(cur)
      cur = ""
      continue
    }
    cur += ch
  }
  out.push(cur)
  return out
}

function parseCsvText(text) {
  const cleaned = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  const lines = cleaned.split("\n").filter((l) => l.trim() !== "")
  if (!lines.length) return { headers: [], rows: [] }

  const headers = parseCsvLine(lines[0]).map((h) => h.trim())
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line)
    const row = {}
    headers.forEach((h, i) => {
      row[h] = values[i] ?? ""
    })
    return row
  })

  return { headers, rows }
}

export default function ExportPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const dashCtx = useContext(DashCtx)

  const [token, setToken] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [datasets, setDatasets] = useState([])
  const [datasetBase, setDatasetBase] = useState("")

  const [schema, setSchema] = useState(null)
  const [rows, setRows] = useState([])
  const [output, setOutput] = useState(null)
  const [code, setCode] = useState("")
  const [codeOpen, setCodeOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [csvExtras, setCsvExtras] = useState([])

  // ── Bootstrap auth + dataset ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      const t = getAuth("token")
      const sid = getAuth("session_id")
      if (!t) { router.push("/login"); return }
      if (!sid) { router.push("/dashboard/upload"); return }

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
        const eligibleRows = rows.filter((d) => !!d?.model_building_completed)
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
          dashCtx?.showSmartPopup?.("Complete Model Training before opening Model Export.", "Section Locked")
          router.push("/dashboard/train")
          return
        }

        const fromQuery = searchParams.get("dataset")
        const fromStorage = sessionStorage.getItem("selected_dataset_base")

        if (eligibleRows.length === 1) {
          const single = eligibleRows[0].dataset_base
          setDatasetBase(single)
          if (typeof window !== "undefined") {
            sessionStorage.setItem("selected_dataset_base", single)
            window.dispatchEvent(new Event("workflow-status-updated"))
          }
          return
        }

        const preferred = fromQuery || fromStorage || ""
        const keep = eligibleRows.some((d) => d.dataset_base === preferred) ? preferred : ""
        setDatasetBase(keep)
        if (typeof window !== "undefined") {
          if (keep) sessionStorage.setItem("selected_dataset_base", keep)
          else sessionStorage.removeItem("selected_dataset_base")
          window.dispatchEvent(new Event("workflow-status-updated"))
        }
      } catch {
        if (cancelled) return
        setDatasets([])
      }
    }

    bootstrap()
    return () => { cancelled = true }
  }, [router, searchParams])

  // ── Fetch schema ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token || !sessionId || !datasetBase) return
    setLoading(true)
    setError("")

    const bootstrap = async () => {
      try {
        const statusRes = await fetch(
          `${API_BASE_URL}/automl/model-building/status/${sessionId}/${encodeURIComponent(datasetBase)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        )
        const status = statusRes.ok ? await statusRes.json() : null
        if (!status?.generated) {
          dashCtx?.showSmartPopup?.("Complete Model Training before opening Model Export.", "Section Locked")
          router.push(`/dashboard/train?dataset=${encodeURIComponent(datasetBase)}`)
          return
        }

        const res = await fetch(`${API}/export/${sessionId}/schema/${encodeURIComponent(datasetBase)}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const d = await res.json()
        if (!res.ok) throw new Error(d?.detail || "Failed to load schema")

        setSchema(d)
        const headers = d.selected_features || []
        setRows(buildEmptyRows(headers))
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }

    bootstrap()
  }, [token, sessionId, datasetBase, dashCtx, router])

  const headers = schema?.selected_features || []

  const updateCell = (rowIdx, col, value) => {
    setRows((prev) => {
      const next = [...prev]
      next[rowIdx] = { ...next[rowIdx], [col]: value }
      return next
    })
  }

  const addRow = () => {
    if (!headers.length) return
    setRows((prev) => [...prev, headers.reduce((acc, h) => ({ ...acc, [h]: "" }), {})])
  }

  const clearRows = () => {
    setRows(buildEmptyRows(headers))
    setOutput(null)
    setError("")
    setCsvExtras([])
  }

  const loadCsvFile = async (file) => {
    if (!file || !headers.length) return
    try {
      setLoading(true)
      const text = await file.text()
      const parsed = parseCsvText(text)
      if (!parsed.headers.length) {
        throw new Error("CSV file is empty or missing headers.")
      }

      const missing = headers.filter((h) => !parsed.headers.includes(h))
      if (missing.length) {
        throw new Error(`CSV missing required columns: ${missing.join(", ")}`)
      }

      const extra = parsed.headers.filter((h) => !headers.includes(h))
      setCsvExtras(extra)

      const normalizedRows = parsed.rows.map((row) => {
        const out = {}
        headers.forEach((h) => {
          out[h] = row[h] ?? ""
        })
        return out
      })

      setRows(normalizedRows.length ? normalizedRows : buildEmptyRows(headers))
      setOutput(null)
      setError("")
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const downloadTemplate = async () => {
    if (!token || !sessionId || !datasetBase) return
    const res = await fetch(`${API}/export/${sessionId}/template/${encodeURIComponent(datasetBase)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${datasetBase}_template.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const buildPayloadRows = () => {
    const fields = schema?.fields || []
    const fieldMap = Object.fromEntries(fields.map((f) => [f.name, f]))

    const nonEmpty = rows.filter((row) =>
      headers.some((h) => String(row[h] ?? "").trim() !== "")
    )
    if (!nonEmpty.length) return []

    return nonEmpty.map((row) => {
      const out = {}
      for (const h of headers) {
        const raw = row[h]
        if (raw === "" || raw === null || raw === undefined) {
          out[h] = null
          continue
        }
        const inputType = fieldMap[h]?.input_type
        if (inputType === "number") {
          const num = Number(raw)
          out[h] = Number.isFinite(num) ? num : raw
        } else {
          out[h] = raw
        }
      }
      return out
    })
  }

  const generatePredictions = async () => {
    setError("")
    setOutput(null)
    const payloadRows = buildPayloadRows()
    if (!payloadRows.length) {
      setError("Please enter at least one row of input values.")
      return
    }
    try {
      setLoading(true)
      const res = await fetch(`${API}/export/${sessionId}/predict/${encodeURIComponent(datasetBase)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rows: payloadRows, save: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.detail || "Prediction failed")
      setOutput(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const downloadOutput = () => {
    if (!output?.csv) return
    const blob = new Blob([output.csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${datasetBase}_predictions.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const generateCode = async () => {
    setError("")
    try {
      setLoading(true)
      const res = await fetch(`${API}/export/${sessionId}/code/${encodeURIComponent(datasetBase)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.detail || "Failed to generate code")
      const next = data.code || ""
      setCode(next)
      setCodeOpen(!!next)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const copyCode = async () => {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
    } catch {
      // ignore clipboard errors
    }
  }

  const outputRows = output?.rows || []
  const outputHeaders = useMemo(() => {
    if (!outputRows.length) return []
    return Object.keys(outputRows[0])
  }, [outputRows])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Export Model</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Enter multiple rows, generate predictions, and export the output CSV.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Dataset</p>
            <p className="text-lg font-semibold text-slate-900 dark:text-white">{datasetBase || "Not selected"}</p>
            {datasets.length > 1 && (
              <div className="mt-2">
                <select
                  value={datasetBase}
                  onChange={(e) => {
                    const next = e.target.value
                    setDatasetBase(next)
                    setSchema(null)
                    setOutput(null)
                    setRows([])
                    if (typeof window !== "undefined") {
                      if (next) sessionStorage.setItem("selected_dataset_base", next)
                      else sessionStorage.removeItem("selected_dataset_base")
                      window.dispatchEvent(new Event("workflow-status-updated"))
                    }
                  }}
                  className="rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                >
                  <option value="">Select dataset</option>
                  {datasets.map((d) => (
                    <option key={d.dataset_base} value={d.dataset_base}>
                      {d.dataset_base} ({d.row_count} rows)
                    </option>
                  ))}
                </select>
              </div>
            )}
            {schema?.task && (
              <p className="text-xs text-slate-500 dark:text-slate-400">Task: {schema.task}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="px-4 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
              Load CSV
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => loadCsvFile(e.target.files?.[0])}
                disabled={loading || !headers.length}
              />
            </label>
            <button
              onClick={downloadTemplate}
              disabled={loading || !datasetBase}
              className="px-4 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Download Template CSV
            </button>
            <button
              onClick={generateCode}
              disabled={loading || !datasetBase}
              className="px-4 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Generate Training Code
            </button>
            <button
              onClick={generatePredictions}
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold"
              disabled={loading || !headers.length}
            >
              Generate Predictions
            </button>
          </div>
        </div>

        {loading && (
          <div className="mt-4 text-sm text-slate-400">Working...</div>
        )}

        {csvExtras.length > 0 && (
          <div className="mt-3 text-xs text-amber-600 dark:text-amber-300">
            Extra CSV columns ignored: {csvExtras.join(", ")}
          </div>
        )}

        {headers.length > 0 && (
          <div className="mt-4 overflow-auto border border-slate-200 dark:border-slate-700 rounded-xl">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800">
                <tr>
                  {headers.map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-slate-600 dark:text-slate-300 font-semibold whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIdx) => (
                  <tr key={rowIdx} className="border-t border-slate-100 dark:border-slate-700">
                    {headers.map((h) => (
                      <td key={h} className="px-2 py-1">
                        <input
                          value={row[h] ?? ""}
                          onChange={(e) => updateCell(rowIdx, h, e.target.value)}
                          className="w-full bg-transparent border-0 px-0 py-1 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-0"
                          placeholder=""
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button
            onClick={addRow}
            className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200"
          >
            + Add Row
          </button>
          <button
            onClick={clearRows}
            className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200"
          >
            Clear
          </button>
        </div>
      </div>

      {output?.extra_columns?.length > 0 && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          Extra columns ignored: {output.extra_columns.join(", ")}
        </div>
      )}

      {outputRows.length > 0 && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Predictions</h3>
            <button
              onClick={downloadOutput}
              className="px-4 py-2 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
            >
              Download Output CSV
            </button>
          </div>
          <div className="overflow-auto border border-slate-200 dark:border-slate-700 rounded-xl">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800">
                <tr>
                  {outputHeaders.map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-slate-600 dark:text-slate-300 font-semibold whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {outputRows.map((row, i) => (
                  <tr key={i} className="border-t border-slate-100 dark:border-slate-700">
                    {outputHeaders.map((h) => (
                      <td key={h} className="px-2 py-1 text-slate-700 dark:text-slate-200">
                        {String(row[h] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {codeOpen && code && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-700">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Training Code</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Colab/Notebook-ready script</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={copyCode}
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200"
                >
                  Copy
                </button>
                <button
                  onClick={() => setCodeOpen(false)}
                  className="px-3 py-1.5 text-xs rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="p-4 overflow-auto max-h-[70vh]">
              <pre className="text-xs bg-slate-950 text-slate-100 rounded-xl p-4 overflow-auto">
                <code>{code}</code>
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
