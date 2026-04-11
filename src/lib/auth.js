import { API_BASE_URL } from "@/lib/api"

/**
 * auth.js — Centralised auth storage + token-refresh helpers
 *
 * WHY sessionStorage instead of localStorage?
 * - sessionStorage is scoped to one browser tab/window.
 * - Multiple users can be logged in simultaneously in separate tabs
 *   without their tokens or session IDs overwriting each other.
 * - Auth data is automatically cleared when the tab is closed,
 *   reducing the window of token exposure.
 *
 * Theme preference (isDark) is intentionally kept in localStorage
 * because it is not sensitive and should persist across sessions.
 */

const _ok = typeof window !== "undefined"

/** Read an auth value from sessionStorage. Returns null on the server. */
export function getAuth(key) {
  return _ok ? sessionStorage.getItem(key) : null
}

/** Write an auth value to sessionStorage. No-ops on the server. */
export function setAuth(key, value) {
  if (_ok) sessionStorage.setItem(key, value)
}

/** Clear all sessionStorage auth data (used on logout). */
export function clearAuth() {
  if (_ok) sessionStorage.clear()
}

/**
 * Store the full login/signup response payload.
 * Call this once after a successful authentication response.
 */
export function storeAuthResponse(data) {
  if (!_ok) return
  if (data.access_token) setAuth("token",      data.access_token)
  if (data.user_id)      setAuth("user_id",    data.user_id)
  if (data.fullname)     setAuth("fullname",   data.fullname)
  if (data.email)        setAuth("email",      data.email)
}

/**
 * Decode a JWT payload (client-side only, no signature verification).
 * Returns the payload object, or null if the token is missing/malformed.
 */
export function decodeToken(token) {
  try {
    if (!token) return null
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")
    return JSON.parse(atob(base64))
  } catch {
    return null
  }
}

/**
 * Return the number of seconds until the stored token expires.
 * Returns 0 if there is no token or it has already expired.
 */
export function tokenSecondsLeft() {
  const token = getAuth("token")
  const payload = decodeToken(token)
  if (!payload?.exp) return 0
  return Math.max(0, payload.exp - Math.floor(Date.now() / 1000))
}

/**
 * Returns true when a valid, not-yet-expired token exists.
 */
export function isAuthenticated() {
  return tokenSecondsLeft() > 0
}

/**
 * Call POST /login/refresh with the current token.
 * On success, stores the new token and returns true.
 * On failure (expired / network error) returns false.
 */
export async function refreshToken() {
  const token = getAuth("token")
  if (!token) return false
  try {
    const res = await fetch(`${API_BASE_URL}/login/refresh`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return false
    const data = await res.json()
    if (data.access_token) {
      setAuth("token", data.access_token)
      return true
    }
    return false
  } catch {
    return false
  }
}
