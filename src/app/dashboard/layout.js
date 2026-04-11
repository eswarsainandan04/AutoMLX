"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { FaSignOutAlt, FaMoon, FaSun } from "react-icons/fa"
import { clearAuth, getAuth, tokenSecondsLeft, refreshToken } from "@/lib/auth"
import { API_BASE_URL } from "@/lib/api"
import { DashCtx } from "./context"

const SESSION_TABS = [
  { href: "/dashboard/overview",  label: "Overview",              icon: "📊" },
  { href: "/dashboard/analytics", label: "Analytics",             icon: "📈" },
  { href: "/dashboard/features",  label: "Feature Engineering",   icon: "🔧" },
  { href: "/dashboard/train",     label: "Model Training",        icon: "🧠" },
  { href: "/dashboard/hpo",       label: "Hyperparameter Tuning", icon: "⚙️" },
  { href: "/dashboard/export",    label: "Export Models",         icon: "💾" },
]

export default function DashboardLayout({ children }) {
  const router   = useRouter()
  const pathname = usePathname()

  const [authChecked,   setAuthChecked]   = useState(false)
  const [isDark,         setIsDark]         = useState(true)
  const [fullname,       setFullname]       = useState("")
  const [userEmail,      setUserEmail]      = useState("")
  const [sidebarOpen,    setSidebarOpen]    = useState(false)
  const [sessionId,      setSessionId]      = useState(null)
  const [showRestart,    setShowRestart]    = useState(false)
  const [smartPopup,     setSmartPopup]     = useState({ open: false, title: "Unable to Complete Request", message: "" })
  const [, setSelectedDatasetBase] = useState("")
  const [featureReady, setFeatureReady] = useState(false)
  const [modelReady, setModelReady] = useState(false)
  // ── Cached API responses — survive tab navigation ──────────────────────
  const [overviewData,   setOverviewData]   = useState(null)
  const [analyticsData,  setAnalyticsData]  = useState(null)

  // ── Initial auth check ──────────────────────────────────────────────────
  useEffect(() => {
    const token = getAuth("token")
    if (!token || tokenSecondsLeft() === 0) { router.replace("/login"); return }
    const fn  = getAuth("fullname")
    const em  = getAuth("email")
    const sid = getAuth("session_id")
    if (fn)  setFullname(fn)
    if (em)  setUserEmail(em)
    if (sid) setSessionId(sid)
    const dark = localStorage.getItem("isDark")
    if (dark !== null) setIsDark(dark !== "false")
    setAuthChecked(true)
  }, [router])

  // ── Token auto-refresh: runs every 60 s, refreshes when ≤ 5 min left ───
  useEffect(() => {
    if (!authChecked) return
    const id = setInterval(async () => {
      const left = tokenSecondsLeft()
      if (left === 0) {
        // Token already expired — force logout
        clearAuth()
        router.replace("/login")
        return
      }
      if (left <= 5 * 60) {
        // Less than 5 minutes left — silently refresh
        const ok = await refreshToken()
        if (!ok) {
          clearAuth()
          router.replace("/login")
        }
      }
    }, 60_000) // check every 60 seconds
    return () => clearInterval(id)
  }, [authChecked, router])

  // Persist theme choice (localStorage — device preference, not session data)
  useEffect(() => {
    localStorage.setItem("isDark", String(isDark))
  }, [isDark])

  // ── Workflow gating status for sidebar locks ───────────────────────────
  useEffect(() => {
    if (!authChecked || typeof window === "undefined") return

    let cancelled = false

    const refreshWorkflowStatus = async () => {
      const tok = getAuth("token")
      const sid = getAuth("session_id")
      const ds = sessionStorage.getItem("selected_dataset_base") || ""

      if (!tok || !sid) {
        if (!cancelled) {
          setSelectedDatasetBase(ds)
          setFeatureReady(false)
          setModelReady(false)
        }
        return
      }

      try {
        const datasetsRes = await fetch(
          `${API_BASE_URL}/automl/feature-engineering/datasets/${sid}`,
          { headers: { Authorization: `Bearer ${tok}` } },
        )
        if (!datasetsRes.ok) {
          if (!cancelled) {
            setSelectedDatasetBase(ds)
            setFeatureReady(false)
            setModelReady(false)
          }
          return
        }

        const datasetsPayload = await datasetsRes.json()
        const rows = Array.isArray(datasetsPayload?.datasets) ? datasetsPayload.datasets : []

        let effectiveSelected = ds
        if (!effectiveSelected && rows.length === 1) {
          effectiveSelected = rows[0]?.dataset_base || ""
        }
        if (effectiveSelected && !rows.some((d) => d?.dataset_base === effectiveSelected)) {
          effectiveSelected = ""
        }

        if (!cancelled) {
          setSelectedDatasetBase(effectiveSelected)
          setFeatureReady(rows.some((d) => !!d?.feature_engineering_completed))
          setModelReady(rows.some((d) => !!d?.model_building_completed))
        }

        if (effectiveSelected) {
          sessionStorage.setItem("selected_dataset_base", effectiveSelected)
        } else {
          sessionStorage.removeItem("selected_dataset_base")
        }
      } catch {
        if (cancelled) return
        setSelectedDatasetBase(ds)
        setFeatureReady(false)
        setModelReady(false)
      }
    }

    refreshWorkflowStatus()
    const handler = () => { refreshWorkflowStatus() }
    window.addEventListener("workflow-status-updated", handler)

    return () => {
      cancelled = true
      window.removeEventListener("workflow-status-updated", handler)
    }
  }, [authChecked, pathname, sessionId])

  // ── Global smart popup for API failures ────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return

    const getPopupMessage = (requestUrl, statusCode) => {
      const url = String(requestUrl || "").toLowerCase()

      // Expected pre-generation 404s — avoid noisy popup on initial load.
      if (
        statusCode === 404 &&
        (
          url.includes("/automl/model-info/") ||
          url.includes("/automl/feature-engineering/saved/") ||
          url.includes("/analytics/load/") ||
          (url.includes("/history/") && url.includes("/model-info/"))
        )
      ) {
        return ""
      }

      if (url.includes("/automl/model-building/run/")) {
        return "sorry We are unable process this dataset"
      }
      if (
        url.includes("/automl/") ||
        url.includes("/history/") ||
        url.includes("/analytics/") ||
        url.includes("/export/") ||
        url.includes("/upload/") ||
        url.includes("/etl/") ||
        url.includes("/overview/")
      ) {
        return "Sorry, we are unable to process this request right now."
      }
      if (statusCode >= 500) {
        return "Sorry, something went wrong. Please try again."
      }
      return ""
    }

    const originalFetch = window.fetch.bind(window)
    window.fetch = async (...args) => {
      const req = args[0]
      const requestUrl = typeof req === "string" ? req : req?.url || ""
      const isApiRequest = requestUrl.includes(API_BASE_URL) || requestUrl.includes("/automl/")

      try {
        const response = await originalFetch(...args)
        if (isApiRequest && !response.ok) {
          const popupMessage = getPopupMessage(requestUrl, response.status)
          if (popupMessage) {
            setSmartPopup((prev) => {
              if (prev.open && prev.message === popupMessage) return prev
              return {
                open: true,
                title: "Unable to Complete Request",
                message: popupMessage,
              }
            })
          }
        }
        return response
      } catch (err) {
        if (isApiRequest) {
          const popupMessage = getPopupMessage(requestUrl, 500) || "Sorry, something went wrong. Please try again."
          setSmartPopup((prev) => {
            if (prev.open && prev.message === popupMessage) return prev
            return {
              open: true,
              title: "Unable to Complete Request",
              message: popupMessage,
            }
          })
        }
        throw err
      }
    }

    return () => {
      window.fetch = originalFetch
    }
  }, [])

  const logout   = () => { clearAuth(); router.replace("/login") }
  const initials = fullname ? fullname.trim()[0].toUpperCase() : "U"

  const handleRestart = () => {
    sessionStorage.removeItem("session_id")
    setSessionId(null)
    setOverviewData(null)
    setAnalyticsData(null)
    setShowRestart(false)
    setSidebarOpen(false)
    router.push("/dashboard/upload")
  }

  const showSmartPopup = (message, title = "Unable to Complete Request") => {
    const normalized = typeof message === "string" && message.trim()
      ? message.trim()
      : "Sorry, something went wrong. Please try again."
    setSmartPopup({ open: true, title, message: normalized })
  }

  const closeSmartPopup = () => {
    setSmartPopup((prev) => ({ ...prev, open: false }))
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400 text-sm animate-pulse">Verifying session…</div>
      </div>
    )
  }

  return (
    <DashCtx.Provider value={{ sessionId, setSessionId, isDark, overviewData, setOverviewData, analyticsData, setAnalyticsData, showSmartPopup }}>
      <div className={isDark ? "dark" : ""}>
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex">

          {/* Sidebar backdrop */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* ── Sidebar ─────────────────────────────────────────────── */}
          <aside
            className={`fixed top-0 left-0 h-full z-40 flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-white/10 shadow-2xl transition-[width] duration-300 ease-in-out overflow-hidden ${
              sidebarOpen ? "w-72" : "w-0"
            }`}
          >
            {/* Logo */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100 dark:border-white/10 min-w-[288px]">
              <img src="/logo.png" alt="DataAIHub" className="h-10 md:h-12 w-auto" />
              <button
                onClick={() => setSidebarOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-white text-2xl font-light transition"
              >
                ×
              </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto px-3 py-4 min-w-[288px]">
              {/* AutoML section */}
              <div className="mb-6">
                <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.12em] px-3 mb-2">
                  AutoML
                </p>
                <div className="space-y-0.5">
                  {sessionId ? (
                    SESSION_TABS.map((tab) => {
                      const isTrainLocked = tab.href === "/dashboard/train" && !featureReady
                      const isExportLocked = tab.href === "/dashboard/export" && !modelReady
                      const isLocked = isTrainLocked || isExportLocked
                      const lockReason = isTrainLocked
                        ? "Complete Feature Engineering before opening Model Training."
                        : isExportLocked
                        ? "Complete Model Training before opening Model Export."
                        : ""
                      const isActive = tab.href && (pathname === tab.href || pathname.startsWith(tab.href + "/"))
                      return (
                        <button
                          key={tab.label}
                          onClick={() => {
                            if (tab.dummy) return
                            if (isLocked) {
                              showSmartPopup(lockReason, "Section Locked")
                              return
                            }
                            router.push(tab.href)
                            setSidebarOpen(false)
                          }}
                          disabled={tab.dummy || isLocked}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition whitespace-nowrap ${
                            isActive
                              ? "bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300"
                              : tab.dummy || isLocked
                              ? "text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-50"
                              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                          }`}
                        >
                          <span className="text-base">{tab.icon}</span>
                          <span>{tab.label}</span>
                          {isLocked && (
                            <span className="ml-auto text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded-full">
                              Locked
                            </span>
                          )}
                          {tab.dummy && (
                            <span className="ml-auto text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 px-1.5 py-0.5 rounded-full">
                              Soon
                            </span>
                          )}
                        </button>
                      )
                    })
                  ) : (
                    <button
                      onClick={() => { router.push("/dashboard/upload"); setSidebarOpen(false) }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition whitespace-nowrap ${
                        pathname === "/dashboard/upload"
                          ? "bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300"
                          : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                      }`}
                    >
                      <span className="text-base">📂</span>
                      <span>Load Dataset</span>
                    </button>
                  )}
                </div>
              </div>

              {/* History section */}
              <div>
                <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.12em] px-3 mb-2">
                  History
                </p>
                <button
                  onClick={() => { router.push("/dashboard/history"); setSidebarOpen(false) }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition whitespace-nowrap ${
                    pathname === "/dashboard/history" || pathname.startsWith("/dashboard/history/")
                      ? "bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                  }`}
                >
                  <span className="text-base">🕐</span>
                  <span>Past Sessions</span>
                </button>
              </div>
            </nav>

            {/* Bottom: theme toggle + logout + profile */}
            <div className="min-w-[288px] px-3 pb-5 border-t border-slate-100 dark:border-white/10 pt-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setIsDark((v) => !v)}
                  className="flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                >
                  {isDark ? <FaSun className="h-4 w-4 text-amber-400" /> : <FaMoon className="h-4 w-4 text-blue-400" />}
                  {isDark ? "Light" : "Dark"}
                </button>
                <button
                  onClick={logout}
                  className="flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-red-100 dark:hover:bg-red-900/30 transition"
                >
                  <FaSignOutAlt className="h-4 w-4" />
                  Logout
                </button>
              </div>

              <div className="flex items-center gap-3 px-3 py-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl">
                <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-blue-600 text-white font-bold text-sm flex items-center justify-center shadow">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{fullname || "User"}</p>
                  <p className="text-xs text-slate-400 truncate">{userEmail}</p>
                </div>

              </div>
            </div>
          </aside>

          {/* ── Main content area ─────────────────────────────────── */}
          <div className="flex-1 flex flex-col min-h-screen">
            {/* Slim topbar: hamburger + brand */}
            <header className="sticky top-0 z-20 flex items-center gap-4 px-5 py-3 bg-white/90 dark:bg-slate-900/80 backdrop-blur border-b border-slate-200 dark:border-white/10">
              <button
                onClick={() => setSidebarOpen((v) => !v)}
                aria-label="Toggle sidebar"
                className="w-9 h-9 flex flex-col items-center justify-center gap-[5px] rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition"
              >
                <span className="w-[18px] h-[2px] bg-slate-500 dark:bg-slate-400 rounded-full" />
                <span className="w-[18px] h-[2px] bg-slate-500 dark:bg-slate-400 rounded-full" />
                <span className="w-[18px] h-[2px] bg-slate-500 dark:bg-slate-400 rounded-full" />
              </button>
              <div className="flex items-center gap-2">
                <img src="/logo.png" alt="DataAIHub" className="h-8 md:h-10 w-auto" />
                <span className="font-extrabold text-slate-900 dark:text-white text-lg tracking-tight select-none"></span>
              </div>
            </header>

            <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
              {children}
            </main>
          </div>

          {/* ── + FAB: visible only when a session is active ──────── */}
          {sessionId && (
            <button
              onClick={() => setShowRestart(true)}
              className="fixed bottom-7 right-7 z-50 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-500 active:scale-95 text-white shadow-[0_4px_24px_rgba(59,130,246,0.45)] flex items-center justify-center transition-all hover:scale-110 text-3xl font-light"
              title="Start new session"
              aria-label="New upload"
            >
              +
            </button>
          )}

          {/* ── Restart confirmation ─────────────────────────────── */}
          {showRestart && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-md">
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl text-center">
                <div className="text-5xl mb-4">🔄</div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Start New Session?</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
                  Your current session will be cleared and you&apos;ll return to the upload screen.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowRestart(false)}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/20 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 font-medium transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRestart}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-semibold transition"
                  >
                    Yes, Restart
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Global Smart Popup ─────────────────────────────────────── */}
          {smartPopup.open && (
            <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/65 backdrop-blur-sm px-4">
              <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl p-6 text-center">
                <button
                  onClick={closeSmartPopup}
                  aria-label="Close popup"
                  className="absolute top-3 right-3 h-8 w-8 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                >
                  ×
                </button>
                <div className="text-4xl mb-3">⚠️</div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{smartPopup.title}</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  {smartPopup.message}
                </p>
                <div className="mt-5 flex items-center justify-center gap-2">
                  <button
                    onClick={closeSmartPopup}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition"
                  >
                    OK
                  </button>
                  <button
                    onClick={closeSmartPopup}
                    className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-semibold text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashCtx.Provider>
  )
}
