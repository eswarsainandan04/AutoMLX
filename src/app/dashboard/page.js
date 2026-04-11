"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { getAuth } from "@/lib/auth"

export default function DashboardPage() {
  const router = useRouter()
  useEffect(() => {
    const sid = getAuth("session_id")
    router.replace(sid ? "/dashboard/overview" : "/dashboard/upload")
  }, [router])
  return null
}
