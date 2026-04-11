"use client"

import { useCallback, useContext, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { getAuth } from "@/lib/auth"
import { API_BASE_URL } from "@/lib/api"
import { DashCtx } from "../context"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js"
import { Bar, Line, Pie, Scatter } from "react-chartjs-2"

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
)

const API = API_BASE_URL

// ── Colour palette ────────────────────────────────────────────────────────────
const PALETTE = [
  "#6366f1", "#22d3ee", "#f59e0b", "#10b981", "#f43f5e",
  "#8b5cf6", "#3b82f6", "#ec4899", "#14b8a6", "#f97316",
  "#a3e635", "#fb7185",
]

const BG = (hex, a = 0.75) => {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

// ── Filter x/y arrays by selected category set ────────────────────────────────
function filterByCategories(xVals, yVals, selCats) {
  if (!selCats) return { xs: xVals, ys: yVals }
  const xs = [], ys = []
  xVals.forEach((x, i) => {
    if (selCats.has(String(x))) { xs.push(x); ys.push(yVals[i]) }
  })
  return xs.length > 0 ? { xs, ys } : { xs: xVals, ys: yVals }
}

// ── Theme-adaptive Chart.js colors ───────────────────────────────────────────
function getChartColors(isDark) {
  return {
    tickColor:    isDark ? "#94a3b8" : "#475569",
    gridColor:    isDark ? "#334155" : "#e2e8f0",
    tooltipBg:    isDark ? "#1e293b" : "#ffffff",
    tooltipTitle: isDark ? "#f8fafc" : "#0f172a",
    tooltipBody:  isDark ? "#cbd5e1" : "#334155",
    legendColor:  isDark ? "#94a3b8" : "#475569",
    axisTitle:    isDark ? "#94a3b8" : "#475569",
  }
}

function buildBaseOpts(isDark, yMin, yMax) {
  const c = getChartColors(isDark)
  const opts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top", labels: { color: c.legendColor, font: { size: 12 } } },
      tooltip: { backgroundColor: c.tooltipBg, titleColor: c.tooltipTitle, bodyColor: c.tooltipBody },
    },
    scales: {
      x: { ticks: { color: c.tickColor, maxRotation: 45 }, grid: { color: c.gridColor } },
      y: { ticks: { color: c.tickColor }, grid: { color: c.gridColor } },
    },
  }
  if (yMin !== "" && yMin !== undefined && yMin !== null && !isNaN(Number(yMin))) {
    opts.scales.y.min = Number(yMin)
  }
  if (yMax !== "" && yMax !== undefined && yMax !== null && !isNaN(Number(yMax))) {
    opts.scales.y.max = Number(yMax)
  }
  return opts
}

function buildPieOpts(isDark) {
  const c = getChartColors(isDark)
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "right", labels: { color: c.legendColor, font: { size: 11 }, padding: 14 } },
      tooltip: {
        backgroundColor: c.tooltipBg,
        titleColor: c.tooltipTitle,
        bodyColor: c.tooltipBody,
        callbacks: {
          label: (ctx) => {
            const total = ctx.dataset.data.reduce((a, b) => a + (Number(b) || 0), 0)
            const pct   = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : "0.0"
            return ` ${ctx.label}: ${pct}%`
          },
        },
      },
      // Inline percentage labels on each slice
      datalabels: false,
    },
    // Draw percentage text directly on slices via afterDraw plugin (registered per-chart)
    _showPctLabels: true,
  }
}

// ── Individual chart renderers ────────────────────────────────────────────────

function BarChart({ chart, isDark, overrides, chartRef }) {
  const palette = overrides?.colors ?? PALETTE
  const { xs, ys } = filterByCategories(chart.x_values, chart.y_values, overrides?.selectedCategories)
  const data = {
    labels: xs,
    datasets: [{
      label: chart.y_column === "count" ? "Count" : chart.y_column,
      data:  ys,
      backgroundColor: xs.map((_, i) => BG(palette[i % palette.length])),
      borderColor:     xs.map((_, i) => palette[i % palette.length]),
      borderWidth: 1,
      borderRadius: 4,
    }],
  }
  return <Bar ref={chartRef} data={data} options={buildBaseOpts(isDark, overrides?.yMin, overrides?.yMax)} />
}

function LineChart({ chart, isDark, overrides, chartRef }) {
  const palette = overrides?.colors ?? PALETTE
  const color = palette[0]
  const { xs, ys } = filterByCategories(chart.x_values, chart.y_values, overrides?.selectedCategories)
  const data = {
    labels: xs,
    datasets: [{
      label:           chart.y_column === "count" ? "Count" : chart.y_column,
      data:            ys,
      borderColor:     color,
      backgroundColor: BG(color, 0.15),
      pointBackgroundColor: color,
      pointRadius: 4,
      tension: 0.35,
      fill: true,
    }],
  }
  return <Line ref={chartRef} data={data} options={buildBaseOpts(isDark, overrides?.yMin, overrides?.yMax)} />
}

function PieChart({ chart, isDark, overrides, chartRef }) {
  const palette = overrides?.colors ?? PALETTE
  const { xs, ys } = filterByCategories(chart.x_values, chart.y_values, overrides?.selectedCategories)
  const data = {
    labels: xs,
    datasets: [{
      data:            ys,
      backgroundColor: xs.map((_, i) => BG(palette[i % palette.length], 0.85)),
      borderColor:     xs.map((_, i) => palette[i % palette.length]),
      borderWidth: 2,
    }],
  }
  const total = ys.reduce((a, b) => a + (Number(b) || 0), 0)
  const pctPlugin = {
    id: "piePercent",
    afterDatasetDraw(chart) {
      const { ctx } = chart
      chart.getDatasetMeta(0).data.forEach((arc, i) => {
        const val = ys[i]
        if (!val || total === 0) return
        const pct = ((Number(val) / total) * 100).toFixed(1)
        if (parseFloat(pct) < 3) return   // skip tiny slices
        const { x, y } = arc.tooltipPosition()
        ctx.save()
        ctx.font        = "bold 11px sans-serif"
        ctx.fillStyle   = "#ffffff"
        ctx.textAlign   = "center"
        ctx.textBaseline = "middle"
        ctx.shadowColor = "rgba(0,0,0,0.55)"
        ctx.shadowBlur  = 3
        ctx.fillText(`${pct}%`, x, y)
        ctx.restore()
      })
    },
  }
  return <Pie ref={chartRef} data={data} options={buildPieOpts(isDark)} plugins={[pctPlugin]} />
}

function HistogramChart({ chart, isDark, overrides, chartRef }) {
  const palette = overrides?.colors ?? PALETTE
  const color = palette[0] ?? PALETTE[0]
  const { xs, ys } = filterByCategories(chart.x_values, chart.y_values, overrides?.selectedCategories)
  const data = {
    labels: xs,
    datasets: [{
      label:           "Frequency",
      data:            ys,
      backgroundColor: BG(color, 0.7),
      borderColor:     color,
      borderWidth: 1,
      borderRadius: 2,
      categoryPercentage: 1.0,
      barPercentage: 0.98,
    }],
  }
  const base = buildBaseOpts(isDark, overrides?.yMin, overrides?.yMax)
  const opts = {
    ...base,
    scales: {
      ...base.scales,
      x: { ...base.scales.x, ticks: { ...base.scales.x.ticks, maxTicksLimit: 10 } },
    },
  }
  return <Bar ref={chartRef} data={data} options={opts} />
}

function ScatterChart({ chart, isDark, overrides, chartRef }) {
  const palette = overrides?.colors ?? PALETTE
  const color = palette[0] ?? PALETTE[0]
  const swapped = overrides?.swapAxes
  const xs = swapped ? chart.y_values : chart.x_values
  const ys = swapped ? chart.x_values : chart.y_values
  const xLabel = swapped ? chart.y_column : chart.x_column
  const yLabel = swapped ? chart.x_column : chart.y_column
  const points = xs.map((x, i) => ({ x, y: ys[i] }))
  const data = {
    datasets: [{
      label:           `${xLabel} vs ${yLabel}`,
      data:            points,
      backgroundColor: BG(color, 0.6),
      borderColor:     color,
      pointRadius: 4,
    }],
  }
  const c = getChartColors(isDark)
  const base = buildBaseOpts(isDark, overrides?.yMin, overrides?.yMax)
  const opts = {
    ...base,
    scales: {
      x: { ...base.scales.x, title: { display: true, text: xLabel, color: c.axisTitle } },
      y: { ...base.scales.y, title: { display: true, text: yLabel, color: c.axisTitle } },
    },
  }
  return <Scatter ref={chartRef} data={data} options={opts} />
}

function BoxChart({ chart, isDark }) {
  if (!chart.box_stats || Object.keys(chart.box_stats).length === 0) return null
  const labels = Object.keys(chart.box_stats)
  const stats  = Object.values(chart.box_stats)

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs text-slate-700 dark:text-slate-300">
        <thead>
          <tr className="text-slate-500 dark:text-slate-500 uppercase text-[10px] tracking-widest">
            <th className="text-left py-2 pr-4">{chart.x_column}</th>
            <th className="text-right py-2 px-2">Min</th>
            <th className="text-right py-2 px-2">Q1</th>
            <th className="text-right py-2 px-2">Median</th>
            <th className="text-right py-2 px-2">Q3</th>
            <th className="text-right py-2 px-2">Max</th>
            <th className="text-left  py-2 pl-4">Distribution</th>
          </tr>
        </thead>
        <tbody>
          {labels.map((label, i) => {
            const s      = stats[i]
            const range  = s.max - s.min || 1
            const q1pct  = ((s.q1 - s.min) / range) * 100
            const medpct = ((s.median - s.min) / range) * 100
            const q3pct  = ((s.q3 - s.min) / range) * 100
            return (
              <tr key={label} className="border-t border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5">
                <td className="py-2 pr-4 text-slate-800 dark:text-slate-200 font-medium whitespace-nowrap">{label}</td>
                <td className="text-right px-2 tabular-nums">{s.min.toLocaleString()}</td>
                <td className="text-right px-2 tabular-nums">{s.q1.toLocaleString()}</td>
                <td className="text-right px-2 tabular-nums font-semibold text-slate-800 dark:text-slate-100">{s.median.toLocaleString()}</td>
                <td className="text-right px-2 tabular-nums">{s.q3.toLocaleString()}</td>
                <td className="text-right px-2 tabular-nums">{s.max.toLocaleString()}</td>
                <td className="pl-4 pr-2 py-2 w-40">
                  <div className="relative h-4 bg-slate-200 dark:bg-slate-700 rounded overflow-hidden">
                    {/* IQR box — neutral slate */}
                    <div
                      className="absolute top-0 bottom-0 rounded bg-slate-400 dark:bg-slate-500 opacity-70"
                      style={{ left: `${q1pct}%`, width: `${q3pct - q1pct}%` }}
                    />
                    {/* Median line */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-slate-900 dark:bg-white"
                      style={{ left: `${medpct}%` }}
                    />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── ChartRenderer — shared renderer used in card AND in edit modal ────────────
function ChartRenderer({ chart, type, isDark, overrides, chartRef }) {
  const t = type ?? chart.type
  if (t === "bar"       ) return <BarChart       chart={chart} isDark={isDark} overrides={overrides} chartRef={chartRef} />
  if (t === "histogram" ) return <HistogramChart chart={chart} isDark={isDark} overrides={overrides} chartRef={chartRef} />
  if (t === "line"      ) return <LineChart      chart={chart} isDark={isDark} overrides={overrides} chartRef={chartRef} />
  if (t === "pie"       ) return <PieChart       chart={chart} isDark={isDark} overrides={overrides} chartRef={chartRef} />
  if (t === "scatter"   ) return <ScatterChart   chart={chart} isDark={isDark} overrides={overrides} chartRef={chartRef} />
  if (t === "box"       ) return <BoxChart       chart={chart} isDark={isDark} />
  return null
}

// ── Chart Edit Modal ──────────────────────────────────────────────────────────
function ChartEditModal({ chart, isDark, onClose, filename, sessionId, token, dsIdx, chartIdx, onSave }) {
  const previewRef = useRef(null)

  const [title,              setTitle]              = useState(chart.title)
  const [chartType,          setChartType]          = useState(chart.type)
  const [colors,             setColors]             = useState(() => chart.colors?.length ? [...chart.colors] : [...PALETTE])
  const [yMin,               setYMin]               = useState(chart.y_min ?? "")
  const [yMax,               setYMax]               = useState(chart.y_max ?? "")
  const [swapAxes,           setSwapAxes]           = useState(chart.swap_axes ?? false)
  const [selectedCategories, setSelectedCategories] = useState(() =>
    chart.selected_categories
      ? new Set(chart.selected_categories)
      : new Set(chart.x_values.map(String))
  )
  const [showCatFilter,      setShowCatFilter]      = useState(false)
  const [saving,             setSaving]             = useState(false)
  const [saved,              setSaved]              = useState(false)

  // How many palette slots are actually consumed by this chart type
  const usedCount = chartType === "bar" || chartType === "pie"
    ? selectedCategories.size || chart.x_values.length
    : 1   // histogram, line and scatter all use a single color

  const overrides = { colors, yMin, yMax, swapAxes, selectedCategories }
  const isCanvas  = chartType !== "box"
  const hasCatFilter = ["bar", "line", "pie", "histogram"].includes(chartType)

  const updateColor = (idx, val) => {
    const next = [...colors]
    next[idx] = val
    setColors(next)
  }

  const saveToFile = async () => {
    setSaving(true)
    setSaved(false)
    const updatedChart = {
      ...chart,
      title,
      type:                chartType,
      colors:              [...colors],
      y_min:               yMin  !== "" ? yMin  : null,
      y_max:               yMax  !== "" ? yMax  : null,
      swap_axes:           swapAxes,
      selected_categories: [...selectedCategories],
    }
    try {
      const res = await fetch(`${API}/analytics/save-chart/${sessionId}`, {
        method:  "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body:    JSON.stringify({ filename, chart_idx: chartIdx, chart: updatedChart }),
      })
      if (!res.ok) throw new Error("Save failed")
      setSaved(true)
      onSave(updatedChart, dsIdx, chartIdx)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      // silent — save failed
    } finally {
      setSaving(false)
    }
  }

  const saveAsImage = () => {
    const t = chartType
    if (t === "box") return

    const lightC    = getChartColors(false)
    const palette   = colors ?? PALETTE
    const lightBase = buildBaseOpts(false, overrides.yMin, overrides.yMax)
    const lightPie  = buildPieOpts(false)

    // Filtered data for categorical charts
    const hasCat = ["bar", "line", "pie", "histogram"].includes(t)
    const { xs, ys } = hasCat
      ? filterByCategories(chart.x_values, chart.y_values, overrides.selectedCategories)
      : { xs: chart.x_values, ys: chart.y_values }

    let chartType2, chartData, chartOpts

    if (t === "bar" || t === "histogram") {
      chartType2 = "bar"
      const histColor = t === "histogram" ? (palette[0] ?? PALETTE[0]) : null
      chartData  = {
        labels: xs,
        datasets: [{
          label: chart.y_column === "count" ? "Count" : chart.y_column,
          data:  ys,
          backgroundColor: histColor
            ? BG(histColor, 0.7)
            : xs.map((_, i) => BG(palette[i % palette.length], 0.75)),
          borderColor: histColor
            ? histColor
            : xs.map((_, i) => palette[i % palette.length]),
          borderWidth: 1, borderRadius: 4,
          ...(t === "histogram" ? { categoryPercentage: 1.0, barPercentage: 0.98 } : {}),
        }],
      }
      chartOpts = t === "histogram"
        ? { ...lightBase, scales: { ...lightBase.scales, x: { ...lightBase.scales.x, ticks: { ...lightBase.scales.x.ticks, maxTicksLimit: 10 } } } }
        : lightBase
    } else if (t === "line") {
      chartType2 = "line"
      const color = palette[0]
      chartData   = {
        labels: xs,
        datasets: [{
          label: chart.y_column === "count" ? "Count" : chart.y_column,
          data:  ys,
          borderColor: color, backgroundColor: BG(color, 0.15),
          pointBackgroundColor: color, pointRadius: 4, tension: 0.35, fill: true,
        }],
      }
      chartOpts = lightBase
    } else if (t === "pie") {
      chartType2 = "pie"
      chartData  = {
        labels: xs,
        datasets: [{
          data:            ys,
          backgroundColor: xs.map((_, i) => BG(palette[i % palette.length], 0.85)),
          borderColor:     xs.map((_, i) => palette[i % palette.length]),
          borderWidth: 2,
        }],
      }
      chartOpts = lightPie
    } else if (t === "scatter") {
      const swapped = overrides.swapAxes
      const sxs     = swapped ? chart.y_values : chart.x_values
      const sys     = swapped ? chart.x_values : chart.y_values
      const color   = palette[0] ?? PALETTE[0]
      chartType2    = "scatter"
      chartData     = {
        datasets: [{
          label: `${chart.x_column} vs ${chart.y_column}`,
          data:  sxs.map((x, i) => ({ x, y: sys[i] })),
          backgroundColor: BG(color, 0.6), borderColor: color, pointRadius: 4,
        }],
      }
      chartOpts = {
        ...lightBase,
        scales: {
          x: { ...lightBase.scales.x, title: { display: true, text: swapped ? chart.y_column : chart.x_column, color: lightC.axisTitle } },
          y: { ...lightBase.scales.y, title: { display: true, text: swapped ? chart.x_column : chart.y_column, color: lightC.axisTitle } },
        },
      }
    } else return

    // Render on an offscreen canvas with white background, always light theme
    const canvas       = document.createElement("canvas")
    canvas.width       = 900
    canvas.height      = 500
    canvas.style.cssText = "position:absolute;left:-9999px;top:0"
    document.body.appendChild(canvas)

    const whiteBgPlugin = {
      id: "whiteBg",
      beforeDraw: (ch) => {
        ch.ctx.save()
        ch.ctx.fillStyle = "#ffffff"
        ch.ctx.fillRect(0, 0, ch.width, ch.height)
        ch.ctx.restore()
      },
    }

    const exportPlugins = [whiteBgPlugin]

    if (chartType2 === "pie") {
      const totalExport = ys.reduce((a, b) => a + (Number(b) || 0), 0)
      exportPlugins.push({
        id: "piePercentExport",
        afterDatasetDraw(ch) {
          const { ctx } = ch
          ch.getDatasetMeta(0).data.forEach((arc, i) => {
            const val = ys[i]
            if (!val || totalExport === 0) return
            const pct = ((Number(val) / totalExport) * 100).toFixed(1)
            if (parseFloat(pct) < 3) return
            const { x, y } = arc.tooltipPosition()
            ctx.save()
            ctx.font         = "bold 13px sans-serif"
            ctx.fillStyle    = "#ffffff"
            ctx.textAlign    = "center"
            ctx.textBaseline = "middle"
            ctx.shadowColor  = "rgba(0,0,0,0.55)"
            ctx.shadowBlur   = 3
            ctx.fillText(`${pct}%`, x, y)
            ctx.restore()
          })
        },
      })
    }

    const exportTitle = (title || "").trim()
    const exportOpts  = {
      ...chartOpts,
      animation: false,
      responsive: false,
      maintainAspectRatio: false,
      plugins: {
        ...(chartOpts.plugins ?? {}),
        title: {
          display: !!exportTitle,
          text:    exportTitle,
          color:   "#1e293b",
          font:    { size: 18, weight: "bold", family: "sans-serif" },
          padding: { top: 14, bottom: 10 },
          align:   "center",
        },
      },
    }

    const instance = new ChartJS(canvas, {
      type:    chartType2,
      data:    chartData,
      options: exportOpts,
      plugins: exportPlugins,
    })

    requestAnimationFrame(() => {
      const url = canvas.toDataURL("image/png")
      instance.destroy()
      document.body.removeChild(canvas)
      const a       = document.createElement("a")
      a.href        = url
      a.download    = `${(title || "chart").replace(/\s+/g, "_")}.png`
      a.click()
    })
  }

  // Prevent background scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])

  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-5xl mx-4 max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/10 flex-shrink-0">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">✏️ Edit Chart</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 transition text-lg"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden min-h-0">

          {/* ── Controls panel ────────────────────────────────────────────── */}
          <div className="w-72 flex-shrink-0 border-r border-slate-200 dark:border-white/10 p-5 overflow-y-auto space-y-6">

            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {['bar','line','pie'].includes(chart.type) && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Chart Type</label>
                <select
                  value={chartType}
                  onChange={(e) => setChartType(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ colorScheme: 'dark' }}
                >
                  <option value="bar" className="bg-white dark:bg-slate-700 text-slate-900 dark:text-white">Bar Chart</option>
                  <option value="line" className="bg-white dark:bg-slate-700 text-slate-900 dark:text-white">Line Chart</option>
                  <option value="pie" className="bg-white dark:bg-slate-700 text-slate-900 dark:text-white">Pie Chart</option>
                </select>
              </div>
            )}

            {/* Y-axis range */}
            {chartType !== "pie" && chartType !== "box" && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Y-Axis Range</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={yMin}
                    onChange={(e) => setYMin(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={yMax}
                    onChange={(e) => setYMax(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            {/* Swap axes (scatter only) */}
            {chartType === "scatter" && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Columns</label>
                <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <span className="font-mono text-xs bg-slate-100 dark:bg-white/10 px-2 py-0.5 rounded">{chart.x_column}</span>
                  <span className="text-slate-400">↔</span>
                  <span className="font-mono text-xs bg-slate-100 dark:bg-white/10 px-2 py-0.5 rounded">{chart.y_column}</span>
                </div>
                <button
                  onClick={() => setSwapAxes((v) => !v)}
                  className={`mt-1 text-xs px-3 py-1.5 rounded-lg border transition font-medium ${
                    swapAxes
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-slate-300 dark:border-white/20 text-slate-600 dark:text-slate-300 hover:border-blue-400"
                  }`}
                >
                  {swapAxes ? "↩ Restore Axes" : "⇄ Swap X ↔ Y"}
                </button>
              </div>
            )}

            {/* Column info (non-scatter) */}
            {chartType !== "scatter" && chartType !== "box" && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Columns</label>
                <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                  {chart.x_column && <div>X: <span className="font-mono text-slate-800 dark:text-slate-200">{chart.x_column}</span></div>}
                  {chart.y_column && <div>Y: <span className="font-mono text-slate-800 dark:text-slate-200">{chart.y_column}</span></div>}
                </div>
              </div>
            )}

            {/* X-axis category filter */}
            {hasCatFilter && chart.x_values.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-widest">X Categories</label>
                  <button
                    onClick={() => setShowCatFilter((v) => !v)}
                    className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/10 border border-slate-300 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/20 transition font-medium"
                  >
                    {showCatFilter ? "▲ Hide" : "▼ Select"}
                  </button>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-500">
                  {selectedCategories.size} / {chart.x_values.length} showing
                </p>
                {showCatFilter && (
                  <div className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 overflow-hidden">
                    {/* All / None shortcuts */}
                    <div className="flex gap-3 px-3 py-2 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-white/10">
                      <button
                        onClick={() => setSelectedCategories(new Set(chart.x_values.map(String)))}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                      >All</button>
                      <span className="text-slate-300 dark:text-white/20">|</span>
                      <button
                        onClick={() => setSelectedCategories(new Set())}
                        className="text-xs text-slate-500 hover:underline"
                      >None</button>
                    </div>
                    {/* Scrollable checklist */}
                    <div className="max-h-44 overflow-y-auto divide-y divide-slate-100 dark:divide-white/5">
                      {chart.x_values.map((xv) => {
                        const key     = String(xv)
                        const checked = selectedCategories.has(key)
                        return (
                          <label
                            key={key}
                            className="flex items-center gap-2.5 px-3 py-1.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 select-none"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setSelectedCategories((prev) => {
                                  const next = new Set(prev)
                                  if (next.has(key)) next.delete(key)
                                  else next.add(key)
                                  return next
                                })
                              }
                              className="w-3.5 h-3.5 accent-blue-500 flex-shrink-0"
                            />
                            <span className="text-xs text-slate-700 dark:text-slate-300 truncate">{xv}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Color palette */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Colors</label>
              <div className="grid grid-cols-6 gap-2">
                {colors.slice(0, Math.max(1, usedCount)).map((color, i) => (
                  <div key={i} className="relative w-8 h-8">
                    <div
                      className="w-8 h-8 rounded-lg border-2 border-slate-300 dark:border-white/25 shadow-sm cursor-pointer hover:scale-110 hover:border-blue-400 transition-transform"
                      style={{ backgroundColor: color }}
                    />
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => updateColor(i, e.target.value)}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                      title={`Color ${i + 1}: ${color}`}
                    />
                  </div>
                ))}
              </div>
              <button
                onClick={() => setColors([...PALETTE])}
                className="text-xs text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition underline"
              >
                Reset to defaults
              </button>
            </div>

          </div>

          {/* ── Preview panel ─────────────────────────────────────────────── */}
          <div className="flex-1 p-6 flex flex-col gap-4 overflow-y-auto min-w-0">
            {/* Preview title */}
            <p className="text-slate-900 dark:text-white font-semibold text-base leading-snug">
              {title || <span className="text-slate-400 italic">Untitled</span>}
            </p>

            {/* Chart preview */}
            <div className={isCanvas ? "relative flex-1" : "flex-1"} style={isCanvas ? { minHeight: 320 } : {}}>
              <ChartRenderer
                chart={chart}
                type={chartType}
                isDark={isDark}
                overrides={overrides}
                chartRef={isCanvas ? previewRef : undefined}
              />
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3 pt-2 flex-shrink-0 flex-wrap">
              {/* Save to dashboard */}
              <button
                onClick={saveToFile}
                disabled={saving}
                className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition shadow-sm ${
                  saved
                    ? "bg-green-600 text-white"
                    : "bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-60"
                }`}
              >
                {saving ? "Saving…" : saved ? "✓ Saved" : "💾 Save"}
              </button>
              {isCanvas && (
                <button
                  onClick={saveAsImage}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition shadow-sm"
                >
                  <span>🖼</span> Save as Image
                </button>
              )}
              <button
                onClick={onClose}
                className="flex items-center gap-2 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-700 dark:text-slate-200 text-sm font-medium px-4 py-2 rounded-lg transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Card wrapper ──────────────────────────────────────────────────────────────
function ChartCard({ chart, isDark, onEdit }) {
  const isBox = chart.type === "box"

  // Apply any saved customizations from the edit modal
  const overrides = {
    colors:             chart.colors?.length ? chart.colors : undefined,
    yMin:               chart.y_min  ?? "",
    yMax:               chart.y_max  ?? "",
    swapAxes:           chart.swap_axes ?? false,
    selectedCategories: chart.selected_categories
      ? new Set(chart.selected_categories)
      : undefined,
  }

  return (
    <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 rounded-2xl p-5 flex flex-col gap-3 shadow-sm dark:shadow-none">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-slate-900 dark:text-white font-semibold text-base leading-snug">{chart.title}</p>
          {chart.description && (
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 leading-relaxed">{chart.description}</p>
          )}
        </div>
        <button
          onClick={() => onEdit(chart)}
          title="Edit chart"
          className="flex-shrink-0 flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/15 hover:text-slate-800 dark:hover:text-white transition"
        >
          ✏️ Edit
        </button>
      </div>
      <div className={isBox ? "" : "relative"} style={isBox ? {} : { height: 280 }}>
        <ChartRenderer chart={chart} isDark={isDark} overrides={overrides} />
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const router  = useRouter()
  const dashCtx = useContext(DashCtx)

  // Use cached analytics data if already loaded; only fetch when context is empty
  const [data,      setData]      = useState(() => dashCtx?.analyticsData ?? null)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState("")
  const [selDs,     setSelDs]     = useState(0)
  const [editChart, setEditChart] = useState(null)   // { chart, dsIdx, chartIdx }
  const [isDark,    setIsDark]    = useState(() => {
    if (typeof window !== "undefined") {
      const s = localStorage.getItem("isDark")
      return s !== null ? s !== "false" : true
    }
    return true
  })
  // Keep isDark in sync with context (layout theme toggle)
  useEffect(() => {
    if (dashCtx?.isDark !== undefined) setIsDark(dashCtx.isDark)
  }, [dashCtx?.isDark])

  // Sync data changes back to the layout context (must be outside state updaters)
  useEffect(() => {
    if (data && dashCtx?.setAnalyticsData) dashCtx.setAnalyticsData(data)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  // Also react to theme changes from other tabs
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "isDark") setIsDark(e.newValue !== "false")
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const generateDashboards = useCallback(async () => {
    const tok = getAuth("token")
    const sid = getAuth("session_id")
    if (!tok) { router.push("/login"); return }
    if (!sid) { router.push("/dashboard/upload"); return }
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`${API}/analytics/generate-dashboards/${sid}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tok}` },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail || "Dashboard generation failed")
      }
      const result = await res.json()
      setData(result)
      if (dashCtx?.setAnalyticsData) dashCtx.setAnalyticsData(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [router, dashCtx])

  // Auth guard + conditionally load saved analytics only when artifacts exist
  useEffect(() => {
    const tok = getAuth("token")
    const sid = getAuth("session_id")
    if (!tok) { router.push("/login"); return }

    // If context already has data, use it — no network call
    if (dashCtx?.analyticsData) {
      setData(dashCtx.analyticsData)
      return
    }

    if (!sid) { router.push("/dashboard/upload"); return }

    const bootstrap = async () => {
      setLoading(true)
      try {
        const statusRes = await fetch(`${API}/analytics/status/${sid}`, {
          headers: { Authorization: `Bearer ${tok}` },
        })
        if (!statusRes.ok) return

        const status = await statusRes.json()
        if (!status?.generated) return

        const res = await fetch(`${API}/analytics/load/${sid}`, {
          headers: { Authorization: `Bearer ${tok}` },
        })
        if (!res.ok) return

        const result = await res.json()
        setData(result)
        if (dashCtx?.setAnalyticsData) dashCtx.setAnalyticsData(result)
      } catch {
        // Silent — user can generate dashboards manually.
      } finally {
        setLoading(false)
      }
    }

    bootstrap()
  }, [router, dashCtx])

  const handleSaveChart = useCallback((updatedChart, dsIdx, chartIdx) => {
    setData(prev => {
      if (!prev) return prev
      const nextDatasets = prev.datasets.map((ds, di) => {
        if (di !== dsIdx) return ds
        const nextCharts = ds.charts.map((c, ci) => ci === chartIdx ? updatedChart : c)
        return { ...ds, charts: nextCharts }
      })
      return { ...prev, datasets: nextDatasets }
    })
    setEditChart(null)
  }, [])

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
      <div className="w-14 h-14 rounded-full border-4 border-violet-500 border-t-transparent animate-spin" />
      <p className="text-slate-500 dark:text-slate-400 text-sm">Loading analytics&hellip;</p>
      <p className="text-slate-400 dark:text-slate-600 text-xs max-w-xs">
        The AI is analysing your data and building charts. This may take 20–60 seconds.
      </p>
    </div>
  )

  // ── Error ────────────────────────────────────────────────────────────────
  if (error) return (
    <div className="max-w-md mx-auto mt-20 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-500/30 rounded-xl p-6 text-center">
      <div className="text-3xl mb-2">⚠️</div>
      <p className="text-red-600 dark:text-red-400 font-medium mb-4">{error}</p>
      <div className="flex gap-3 justify-center">
        <button
          onClick={generateDashboards}
          className="text-sm bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg transition"
        >
          Try Again
        </button>
        <button
          onClick={() => router.push("/dashboard/overview")}
          className="text-sm border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 px-4 py-2 rounded-lg hover:border-slate-500 transition"
        >
          ← Back to Overview
        </button>
      </div>
    </div>
  )

  // ── No data yet — show Generate Dashboards landing ───────────────────────
  if (!data) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
      <div className="text-7xl">📊</div>
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Analytics Dashboard</h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
          Let AI analyse your cleaned data and build insightful charts automatically.
        </p>
      </div>
      <button
        onClick={generateDashboards}
        className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-semibold px-8 py-3 rounded-xl transition shadow-md text-base"
      >
        📊 Generate Dashboards
      </button>
    </div>
  )

  const { datasets, foreign_keys = [] } = data
  const individualDs = datasets.filter(d => !d.is_joined)
  const joinedDs     = datasets.filter(d => d.is_joined)
  const allDs        = datasets
  const ds           = allDs[selDs]
  const charts       = ds?.charts ?? []

  // ── Page ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-12">

      {/* Edit modal */}
      {editChart && (
        <ChartEditModal
          chart={editChart.chart}
          filename={allDs[editChart.dsIdx]?.filename}
          sessionId={data.session_id}
          token={getAuth("token")}
          dsIdx={editChart.dsIdx}
          chartIdx={editChart.chartIdx}
          isDark={isDark}
          onClose={() => setEditChart(null)}
          onSave={handleSaveChart}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Analytics</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
            AI-generated charts &mdash; session{" "}
            <code className="text-blue-600 dark:text-blue-400 font-mono text-xs">{data.session_id}</code>
          </p>
        </div>
        <button
          onClick={() => router.push("/dashboard/overview")}
          className="text-sm border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-slate-500 dark:hover:border-slate-400 px-4 py-2 rounded-lg transition"
        >
          ← Overview
        </button>
      </div>

      {/* Foreign keys info bar */}
      {foreign_keys.length > 0 && (
        <div className="bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700/40 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
          <span className="text-indigo-700 dark:text-indigo-300 text-xs font-semibold uppercase tracking-widest">🔗 Foreign Keys Detected</span>
          <div className="flex flex-wrap gap-2">
            {foreign_keys.map(fk => (
              <span key={fk} className="bg-indigo-100 dark:bg-indigo-800/50 border border-indigo-300 dark:border-indigo-600/40 text-indigo-700 dark:text-indigo-200 text-xs font-mono px-2.5 py-0.5 rounded-full">
                {fk}
              </span>
            ))}
          </div>
          {joinedDs.length > 0 && (
            <span className="ml-auto text-emerald-600 dark:text-emerald-400 text-xs font-medium">
              ✅ {joinedDs.length} joined dataset{joinedDs.length !== 1 ? "s" : ""} created
            </span>
          )}
        </div>
      )}

      {/* Dataset tabs */}
      {allDs.length > 1 && (
        <div className="space-y-2">
          {individualDs.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-slate-400 dark:text-slate-500 text-xs uppercase tracking-widest font-medium w-20">Individual</span>
              {individualDs.map((d) => {
                const idx = allDs.indexOf(d)
                return (
                  <button
                    key={d.filename}
                    onClick={() => setSelDs(idx)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                      selDs === idx
                        ? "bg-blue-600 text-white shadow"
                        : "bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-transparent hover:bg-slate-200 dark:hover:bg-white/20"
                    }`}
                  >
                    {d.filename}
                  </button>
                )
              })}
            </div>
          )}

          {joinedDs.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-slate-400 dark:text-slate-500 text-xs uppercase tracking-widest font-medium w-20">Joined</span>
              {joinedDs.map((d) => {
                const idx = allDs.indexOf(d)
                return (
                  <button
                    key={d.filename}
                    onClick={() => setSelDs(idx)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
                      selDs === idx
                        ? "bg-emerald-600 text-white shadow"
                        : "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700/40 hover:bg-emerald-100 dark:hover:bg-emerald-800/40"
                    }`}
                  >
                    <span>⛓</span>
                    {d.filename}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Active dataset info */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-slate-500 dark:text-slate-400 text-sm">
            {charts.length} chart{charts.length !== 1 ? "s" : ""} for{" "}
            <span className="text-slate-900 dark:text-white font-medium">{ds?.filename}</span>
          </span>
          {ds?.is_joined && (
            <span className="bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-300 dark:border-emerald-700/40 text-emerald-700 dark:text-emerald-300 text-xs px-2.5 py-0.5 rounded-full font-medium">
              ⛓ Joined Dataset
            </span>
          )}
          {ds?.description && (
            <span className="text-slate-400 dark:text-slate-500 text-xs italic">{ds.description}</span>
          )}
        </div>
        {ds?.primary_keys?.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-amber-600 dark:text-amber-400 text-xs font-semibold uppercase tracking-widest">🔑 Primary Keys</span>
            {ds.primary_keys.map(pk => (
              <span key={pk} className="bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-600/40 text-amber-700 dark:text-amber-300 text-xs font-mono px-2.5 py-0.5 rounded-full">
                {pk}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Charts grid */}
      {charts.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {charts.map((chart, i) => (
            <ChartCard
              key={i}
              chart={chart}
              isDark={isDark}
              onEdit={(c) => setEditChart({ chart: c, dsIdx: selDs, chartIdx: i })}
            />
          ))}
        </div>
      ) : (
        <div className="text-center text-slate-400 dark:text-slate-500 mt-16">
          <div className="text-4xl mb-3">📭</div>
          No charts could be generated for this dataset.
        </div>
      )}
    </div>
  )
}

