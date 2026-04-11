"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { isAuthenticated, storeAuthResponse } from "@/lib/auth"
import { API_BASE_URL } from "@/lib/api"

export default function Signup() {
  const router = useRouter()
  const [fullname, setFullname] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
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

  const signup = async () => {
    setError("")
    const cleanFullname = fullname.trim()
    const cleanEmail = email.trim()

    if (!cleanFullname || !cleanEmail || !password || !confirmPassword) {
      setError("Please fill in all fields.")
      return
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }

    if (password !== confirmPassword) {
      setError("Password and confirm password do not match.")
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/signup/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullname: cleanFullname,
          email: cleanEmail,
          password,
          confirm_password: confirmPassword,
        }),
      })
      const data = await res.json()
      if (data.access_token) {
        storeAuthResponse(data)
        router.push("/dashboard")
      } else {
        setError(data.detail || "Signup failed. Please try again.")
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
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-10">
        <div className="flex justify-center mb-4">
          <img src="/logo.png" alt="DataAIHub" className="h-12 w-auto" />
        </div>
        <p className="text-slate-400 text-sm text-center mb-8">Join AutoML and start building models</p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3 mb-5">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Full Name</label>
            <input
              className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              placeholder="John Doe"
              onChange={(e) => setFullname(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Email</label>
            <input
              type="email"
              className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              placeholder="you@example.com"
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Password</label>
            <input
              type="password"
              className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              placeholder="••••••••"
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="mt-1 text-xs text-slate-500">Use at least 8 characters.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Confirm Password</label>
            <input
              type="password"
              className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              placeholder="••••••••"
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <button
            onClick={signup}
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-all duration-200 mt-2"
          >
            {loading ? "Creating account..." : "Sign Up"}
          </button>
        </div>

        <p className="text-center text-sm text-slate-500 mt-6">
          Already have an account?{" "}
          <a href="/login" className="text-emerald-600 font-semibold hover:underline">Login</a>
        </p>
      </div>
    </div>
  )
}