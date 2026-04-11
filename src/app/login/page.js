"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { FaHome } from "react-icons/fa"
import { isAuthenticated, storeAuthResponse } from "@/lib/auth"
import { API_BASE_URL } from "@/lib/api"

export default function Login() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [checking, setChecking] = useState(true)

  // If the user already has a valid token, send them straight to the dashboard
  useEffect(() => {
    if (isAuthenticated()) {
      router.replace("/dashboard")
    } else {
      setChecking(false)
    }
  }, [router])

  const login = async () => {
    setError("")
    const cleanEmail = email.trim()

    if (!cleanEmail || !password) {
      setError("Please enter both email and password.")
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, password }),
      })
      const data = await res.json()
      if (data.access_token) {
        storeAuthResponse(data)
        router.push("/dashboard")
      } else {
        setError(data.detail || "Invalid email or password.")
      }
    } catch {
      setError("Network error. Is the backend running?")
    } finally {
      setLoading(false)
    }
  }

  if (checking) return null

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 to-slate-700">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-10 relative">
        <div className="flex justify-center mb-4">
          <img src="/logo.png" alt="DataAIHub" className="h-12 w-auto" />
        </div>
        <p className="text-slate-400 text-sm text-center mb-8">Login to your AutoML account</p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3 mb-5">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Email</label>
            <input
              type="email"
              className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              placeholder="you@example.com"
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Password</label>
            <input
              type="password"
              className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              placeholder="••••••••"
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            onClick={login}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-all duration-200 mt-2"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </div>

        <p className="text-center text-sm text-slate-500 mt-6">
          Don&apos;t have an account?{" "}
          <a href="/signup" className="text-blue-600 font-semibold hover:underline">Sign Up</a>
        </p>
        <button
          onClick={() => router.push("/")}
          className="mt-6 mx-auto flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          aria-label="Back to home"
        >
          <FaHome className="h-4 w-4" />
          Back to Home
        </button>
      </div>
    </div>
  )
}