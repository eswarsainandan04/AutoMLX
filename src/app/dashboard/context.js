"use client"

import { createContext, useContext } from "react"

/**
 * Shared dashboard state passed through context:
 *   sessionId / setSessionId — active pipeline session
 *   isDark                  — current theme
 *   overviewData  / setOverviewData  — cached /upload/overview response
 *   analyticsData / setAnalyticsData — cached /analytics/run response
 */
export const DashCtx = createContext(null)

export const useDash = () => useContext(DashCtx)
