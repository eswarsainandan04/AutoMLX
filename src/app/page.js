"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { isAuthenticated } from "@/lib/auth"

function Icon({ className = "h-5 w-5", path }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={path} />
    </svg>
  )
}

const ICONS = {
  moon:       "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z",
  sun:        "M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42M12 5a7 7 0 1 0 0 14A7 7 0 0 0 12 5z",
  arrowRight: "M5 12h14M12 5l7 7-7 7",
  check:      "M20 6L9 17l-5-5",
  chevLeft:   "M15 18l-6-6 6-6",
  chevRight:  "M9 18l6-6-6-6",
}

// ─────────────────────────────────────────────────────────────────────────────
//  SVG SLIDES — fixed dark background, fully legible in both page themes
// ─────────────────────────────────────────────────────────────────────────────

function Slide1() {
  const rows = [
    { col:"customer_id", type:"INT",      nulls:"0%",   status:"OK",   sc:"#22C55E", rb:"#052e16" },
    { col:"income",      type:"FLOAT",    nulls:"3.2%", status:"OK",   sc:"#22C55E", rb:"#052e16" },
    { col:"age",         type:"STRING",   nulls:"0%",   status:"DRIFT",sc:"#F59E0B", rb:"#2d1b00" },
    { col:"region",      type:"CATEGORY", nulls:"12%",  status:"WARN", sc:"#EF4444", rb:"#2a0a0a" },
    { col:"score",       type:"FLOAT",    nulls:"0%",   status:"OK",   sc:"#22C55E", rb:"#052e16" },
  ]
  return (
    <svg width="100%" viewBox="0 0 520 215" xmlns="http://www.w3.org/2000/svg" style={{display:"block"}}>
      <rect width="520" height="215" fill="#0F172A" rx="0"/>
      <text x="20" y="28" fill="#60A5FA" fontSize="11" fontWeight="700" fontFamily="ui-monospace,monospace" letterSpacing="2">SCHEMA SCAN</text>
      {/* Header */}
      <rect x="14" y="36" width="492" height="26" rx="5" fill="#1E3A5F"/>
      {["Column","Type","Nulls","Status"].map((h,i) => (
        <text key={h} x={[28,200,300,420][i]} y="53" fill="#93C5FD" fontSize="11" fontWeight="700" fontFamily="ui-monospace,monospace">{h}</text>
      ))}
      {/* Rows */}
      {rows.map((r,i) => (
        <g key={r.col}>
          <rect x="14" y={66+i*27} width="492" height="23" rx="4" fill={i%2===0?"#162032":"#0F172A"}/>
          <text x="28"  y={82+i*27} fill="#E2E8F0" fontSize="11" fontFamily="ui-monospace,monospace">{r.col}</text>
          <text x="200" y={82+i*27} fill="#7DD3FC" fontSize="11" fontFamily="ui-monospace,monospace">{r.type}</text>
          <text x="300" y={82+i*27} fill="#94A3B8" fontSize="11" fontFamily="ui-monospace,monospace">{r.nulls}</text>
          <rect x="410" y={70+i*27} width="62" height="16" rx="8" fill={r.rb}/>
          <text x="441" y={82+i*27} textAnchor="middle" fill={r.sc} fontSize="10" fontWeight="700" fontFamily="ui-monospace,monospace">{r.status}</text>
        </g>
      ))}
      {/* Animated scan line */}
      <rect x="14" y="36" width="492" height="2" rx="1" fill="#3B82F6" opacity="0.9">
        <animateTransform attributeName="transform" type="translate" values="0,0;0,135;0,0" dur="3s" repeatCount="indefinite" calcMode="easeInOut"/>
      </rect>
      <text x="14" y="210" fill="#334155" fontSize="9" fontFamily="ui-monospace,monospace">5 columns · 2 issues detected · auto-profiling active</text>
    </svg>
  )
}

function Slide2() {
  const steps = [
    { label:"Impute", c:"#818CF8", cx:55  },
    { label:"Encode", c:"#60A5FA", cx:148 },
    { label:"Scale",  c:"#22D3EE", cx:241 },
    { label:"Select", c:"#34D399", cx:334 },
    { label:"Ready",  c:"#4ADE80", cx:427 },
  ]
  const bars = [
    { name:"income",   w:220, c:"#60A5FA" },
    { name:"age",      w:170, c:"#818CF8" },
    { name:"category", w:130, c:"#22D3EE" },
    { name:"region",   w:100, c:"#34D399" },
    { name:"score",    w:190, c:"#A78BFA" },
  ]
  return (
    <svg width="100%" viewBox="0 0 520 215" xmlns="http://www.w3.org/2000/svg" style={{display:"block"}}>
      <rect width="520" height="215" fill="#0F172A" rx="0"/>
      <text x="20" y="28" fill="#60A5FA" fontSize="11" fontWeight="700" fontFamily="ui-monospace,monospace" letterSpacing="2">FEATURE PIPELINE</text>
      {/* Step nodes */}
      {steps.map((s,i) => (
        <g key={s.label}>
          {i>0 && <line x1={steps[i-1].cx+28} y1="55" x2={s.cx-28} y2="55" stroke="#1E3A5F" strokeWidth="2" strokeDasharray="4 3"/>}
          <circle cx={s.cx} cy="55" r="24" fill={s.c+"18"} stroke={s.c} strokeWidth="1.5"/>
          <text x={s.cx} y="51" textAnchor="middle" fill={s.c} fontSize="10" fontWeight="700" fontFamily="ui-monospace,monospace">{s.label}</text>
          <text x={s.cx} y="65" textAnchor="middle" fill={s.c+"99"} fontSize="8" fontFamily="ui-monospace,monospace">0{i+1}</text>
        </g>
      ))}
      {/* Importance bars */}
      <text x="20" y="103" fill="#475569" fontSize="9" fontWeight="700" fontFamily="ui-monospace,monospace" letterSpacing="1">FEATURE IMPORTANCE</text>
      {bars.map((b,i) => (
        <g key={b.name}>
          <text x="95" y={119+i*21} textAnchor="end" fill="#94A3B8" fontSize="10" fontFamily="ui-monospace,monospace">{b.name}</text>
          <rect x="100" y={108+i*21} width="340" height="14" rx="4" fill="#1E293B"/>
          <rect x="100" y={108+i*21} width={b.w} height="14" rx="4" fill={b.c+"55"}/>
          <rect x="100" y={108+i*21} width={b.w*0.6} height="14" rx="4" fill={b.c}/>
          <text x={b.w+108} y={120+i*21} fill={b.c} fontSize="10" fontWeight="700" fontFamily="ui-monospace,monospace">{Math.round(b.w/3.4)}%</text>
        </g>
      ))}
    </svg>
  )
}

function Slide3() {
  const models = [
    { label:"XGBoost",  acc:94, c:"#60A5FA", best:true  },
    { label:"LightGBM", acc:91, c:"#A78BFA", best:false },
    { label:"CatBoost", acc:89, c:"#22D3EE", best:false },
    { label:"Neural",   acc:88, c:"#FBBF24", best:false },
    { label:"RandomF",  acc:85, c:"#64748B", best:false },
  ]
  const MAXH = 130
  return (
    <svg width="100%" viewBox="0 0 520 215" xmlns="http://www.w3.org/2000/svg" style={{display:"block"}}>
      <rect width="520" height="215" fill="#0F172A" rx="0"/>
      <text x="20" y="28" fill="#60A5FA" fontSize="11" fontWeight="700" fontFamily="ui-monospace,monospace" letterSpacing="2">MODEL SELECTION</text>
      {/* Grid lines */}
      {[45,70,95,120,145,170].map(y => (
        <line key={y} x1="50" y1={y} x2="510" y2={y} stroke="#1E293B" strokeWidth="1" strokeDasharray="4 3"/>
      ))}
      <line x1="50" y1="40" x2="50" y2="175" stroke="#1E3A5F" strokeWidth="1"/>
      {models.map((m,i) => {
        const bh = (m.acc/100)*MAXH
        const bx = 62+i*90
        return (
          <g key={m.label}>
            <rect x={bx} y={175-MAXH} width="60" height={MAXH} rx="4" fill="#1E293B"/>
            <rect x={bx} y={175-bh}   width="60" height={bh}   rx="4" fill={m.best ? m.c : m.c+"66"}/>
            {m.best && <rect x={bx} y={175-bh-4} width="60" height="5" rx="2" fill={m.c}/>}
            <text x={bx+30} y={170-bh} textAnchor="middle" fill={m.best?"#ffffff":m.c} fontSize={m.best?"13":"11"} fontWeight="700" fontFamily="ui-monospace,monospace">{m.acc}%</text>
            <text x={bx+30} y="192"    textAnchor="middle" fill="#94A3B8" fontSize="9" fontFamily="ui-monospace,monospace">{m.label}</text>
            {m.best && (
              <g>
                <rect x={bx+6} y={175-bh-22} width="48" height="16" rx="8" fill="#1D4ED8"/>
                <text x={bx+30} y={175-bh-11} textAnchor="middle" fill="#BFDBFE" fontSize="9" fontWeight="700" fontFamily="ui-monospace,monospace">★ BEST</text>
              </g>
            )}
          </g>
        )
      })}
      <text x="18" y="100" fill="#334155" fontSize="9" fontFamily="ui-monospace,monospace" transform="rotate(-90,18,120)">Accuracy</text>
    </svg>
  )
}

function Slide4() {
  const shap = [
    { f:"income",  w:150, c:"#60A5FA" },
    { f:"age",     w:115, c:"#A78BFA" },
    { f:"region",  w: 88, c:"#22D3EE" },
    { f:"score",   w: 67, c:"#34D399" },
  ]
  return (
    <svg width="100%" viewBox="0 0 520 215" xmlns="http://www.w3.org/2000/svg" style={{display:"block"}}>
      <rect width="520" height="215" fill="#0F172A" rx="0"/>
      <text x="20" y="28" fill="#60A5FA" fontSize="11" fontWeight="700" fontFamily="ui-monospace,monospace" letterSpacing="2">LIVE ANALYTICS</text>

      {/* Confusion Matrix */}
      <text x="14" y="50" fill="#475569" fontSize="9" fontWeight="700" fontFamily="ui-monospace,monospace" letterSpacing="1">CONFUSION MATRIX</text>
      {[[92,8],[6,94]].map((row,r) => row.map((val,c) => (
        <g key={`${r}${c}`}>
          <rect x={14+c*72} y={56+r*64} width="66" height="58" rx="8"
            fill={r===c?"#1D4ED8":"#450A0A"}
            stroke={r===c?"#3B82F6":"#EF4444"} strokeWidth="1.5"/>
          <text x={47+c*72} y={89+r*64} textAnchor="middle"
            fill={r===c?"#BFDBFE":"#FCA5A5"}
            fontSize="24" fontWeight="800" fontFamily="ui-monospace,monospace">{val}</text>
          <text x={47+c*72} y={103+r*64} textAnchor="middle"
            fill={r===c?"#60A5FA66":"#F8717166"} fontSize="9" fontFamily="ui-monospace,monospace">%</text>
        </g>
      )))}

      {/* Divider */}
      <line x1="166" y1="45" x2="166" y2="195" stroke="#1E293B" strokeWidth="1"/>

      {/* SHAP */}
      <text x="175" y="50" fill="#475569" fontSize="9" fontWeight="700" fontFamily="ui-monospace,monospace" letterSpacing="1">SHAP IMPACT</text>
      {shap.map((b,i) => (
        <g key={b.f}>
          <text x="248" y={68+i*34} textAnchor="end" fill="#94A3B8" fontSize="10" fontFamily="ui-monospace,monospace">{b.f}</text>
          <rect x="254" y={56+i*34} width="250" height="16" rx="4" fill="#1E293B"/>
          <rect x="254" y={56+i*34} width={b.w} height="16" rx="4" fill={b.c+"44"}/>
          <rect x="254" y={56+i*34} width={b.w*0.6} height="16" rx="4" fill={b.c}/>
          <text x={b.w+262} y={68+i*34} fill={b.c} fontSize="10" fontWeight="700" fontFamily="ui-monospace,monospace">{Math.round(b.w/1.7)}%</text>
        </g>
      ))}

      {/* Drift alert */}
             </svg>
  )
}

function Slide5() {
  const targets = [
    { x:16,  y:36,  label:"ONNX",    sub:"Cross-platform", c:"#A78BFA" },
    { x:16,  y:96,  label:"Pickle",  sub:"Python native",  c:"#60A5FA" },
    { x:16,  y:156, label:"JSON",    sub:"Config export",  c:"#22D3EE" },
    { x:392, y:36,  label:"REST API",sub:"Live endpoint",  c:"#4ADE80" },
    { x:392, y:96,  label:"Docker",  sub:"Container",      c:"#FB923C" },
    { x:392, y:156, label:"S3",      sub:"Cloud storage",  c:"#FBBF24" },
  ]
  return (
    <svg width="100%" viewBox="0 0 520 215" xmlns="http://www.w3.org/2000/svg" style={{display:"block"}}>
      <rect width="520" height="215" fill="#0F172A" rx="0"/>
      <text x="20" y="28" fill="#60A5FA" fontSize="11" fontWeight="700" fontFamily="ui-monospace,monospace" letterSpacing="2">EXPORT & DEPLOY</text>

      {/* Center model box */}
      <rect x="185" y="72" width="150" height="72" rx="12" fill="#1E3A5F" stroke="#3B82F6" strokeWidth="2"/>
      <text x="260" y="108" textAnchor="middle" fill="#E2E8F0" fontSize="14" fontWeight="800" fontFamily="ui-monospace,monospace">Trained</text>
      <text x="260" y="126" textAnchor="middle" fill="#93C5FD" fontSize="12" fontFamily="ui-monospace,monospace">Model v2.4</text>

      {/* Pulse ring */}
      <circle cx="260" cy="108" r="50" fill="none" stroke="#3B82F6" strokeWidth="1" opacity="0.5">
        <animate attributeName="r" values="50;68;50" dur="3s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.5;0;0.5" dur="3s" repeatCount="indefinite"/>
      </circle>

      {targets.map(t => {
        const isLeft = t.x < 260
        const lx1 = isLeft ? t.x + 112 : t.x
        const lx2 = isLeft ? 185 : 335
        return (
          <g key={t.label}>
            <line x1={lx1} y1={t.y+22} x2={lx2} y2="108" stroke={t.c} strokeWidth="1" strokeDasharray="5 3" opacity="0.55"/>
            <rect x={t.x} y={t.y} width="112" height="46" rx="8" fill={t.c+"18"} stroke={t.c+"77"} strokeWidth="1"/>
            <text x={t.x+56} y={t.y+19} textAnchor="middle" fill={t.c} fontSize="11" fontWeight="700" fontFamily="ui-monospace,monospace">{t.label}</text>
            <text x={t.x+56} y={t.y+33} textAnchor="middle" fill={t.c+"99"} fontSize="9" fontFamily="ui-monospace,monospace">{t.sub}</text>
          </g>
        )
      })}
    </svg>
  )
}

const SLIDES = [
  { id:1, label:"Dynamic Data Ingestion",         caption:"Upload any CSV or JSON. The agent auto-detects schema, types, nulls, and drift — before any model sees the data.",               Comp:Slide1 },
  { id:2, label:"Autonomous Feature Engineering", caption:"Context-aware encoding, scaling, and selection adapt to your actual data structure — no templates, zero configuration.",          Comp:Slide2 },
  { id:3, label:"Model Selection & Training",     caption:"XGBoost, LightGBM, CatBoost, and Neural Nets compete in parallel. The best performer is surfaced automatically.",               Comp:Slide3 },
  { id:4, label:"Real-time Analytics",            caption:"Live confusion matrices, SHAP explainability, and schema drift alerts keep every pipeline decision transparent.",                 Comp:Slide4 },
  { id:5, label:"Export & Deploy",                caption:"Download as ONNX, Pickle, or JSON — or deploy straight to a REST endpoint. Every run is saved for diffing and replay.",          Comp:Slide5 },
]

const STATS = [
  { v:"40+",  label:"Data Pattern Detectors", sub:"Semantic type inference across all column formats", col:"text-blue-400",    sh:"shadow-blue-500/10"   },
  { v:"8×",   label:"Faster Pipeline Setup",  sub:"vs manual ML engineering on comparable workflows", col:"text-violet-400",  sh:"shadow-violet-500/10" },
  { v:"Auto", label:"Model Family Selection", sub:"Tree ensembles to deep nets — picked for your data",col:"text-cyan-400",    sh:"shadow-cyan-500/10"   },
  { v:"Live", label:"Pipeline Monitoring",    sub:"Drift detection and retraining triggers built-in",  col:"text-emerald-400", sh:"shadow-emerald-500/10"},
]

const STEPS = [
  { n:"01", title:"Upload Your Dataset",       desc:"Drop any CSV or JSON. Schema, types, nulls, and semantic patterns are profiled instantly.", col:"bg-blue-600"    },
  { n:"02", title:"Agent Cleans & Validates",  desc:"Outliers, class imbalance, and dirty columns are resolved before any model sees the data.", col:"bg-violet-600"  },
  { n:"03", title:"Feature Pipeline Executes", desc:"Encoding, scaling, and feature selection adapt to your dataset's actual structure.",         col:"bg-cyan-600"    },
  { n:"04", title:"Models Train & Compete",    desc:"Multiple families train in parallel. The winner is surfaced with full explainability.",      col:"bg-emerald-600" },
  { n:"05", title:"Export & Iterate",          desc:"Download or deploy your model. History is saved for diffing and continuous improvement.",    col:"bg-orange-600"  },
]

export default function Home() {
  const router = useRouter()
  const [ready,  setReady]  = useState(false)
  const [isDark, setIsDark] = useState(true)
  const [slide,  setSlide]  = useState(0)
  const [fading, setFading] = useState(false)
  const timer = useRef(null)

  useEffect(() => {
    if (isAuthenticated()) { router.replace("/dashboard") } else { setReady(true) }
  }, [router])

  useEffect(() => {
    const s = window.localStorage.getItem("automl-theme")
    if (s) { setIsDark(s === "dark"); return }
    setIsDark(window.matchMedia("(prefers-color-scheme: dark)").matches)
  }, [])
  useEffect(() => { window.localStorage.setItem("automl-theme", isDark ? "dark" : "light") }, [isDark])

  const goTo = (idx) => {
    if (idx === slide) return
    setFading(true)
    setTimeout(() => { setSlide(idx); setFading(false) }, 250)
  }
  const resetTimer = () => {
    clearInterval(timer.current)
    timer.current = setInterval(() => setSlide(p => (p + 1) % SLIDES.length), 4800)
  }
  useEffect(() => {
    timer.current = setInterval(() => setSlide(p => (p + 1) % SLIDES.length), 4800)
    return () => clearInterval(timer.current)
  }, [])
  const nav = (i) => { goTo(i); resetTimer() }

  if (!ready) return null

  const bg      = isDark ? "bg-slate-950 text-slate-100"                      : "bg-slate-50 text-slate-900"
  const navBg   = isDark ? "bg-slate-950/80 border-white/10"                  : "bg-white/90 border-slate-200"
  const card    = isDark ? "bg-slate-900 border-white/10"                     : "bg-white border-slate-200"
  const hover   = isDark ? "hover:bg-slate-800/60"                            : "hover:bg-slate-50"
  const muted   = isDark ? "text-slate-400"                                   : "text-slate-500"
  const subtle  = isDark ? "text-slate-300"                                   : "text-slate-600"
  const heading = isDark ? "text-white"                                        : "text-slate-900"
  const accent  = isDark ? "text-blue-400"                                    : "text-blue-600"
  const divider = isDark ? "border-white/10"                                  : "border-slate-200"
  const tagBg   = isDark ? "bg-blue-500/10 border-blue-400/30 text-blue-300" : "bg-blue-50 border-blue-200 text-blue-700"
  const ghost   = isDark ? "border-white/15 text-slate-200 hover:bg-white/5" : "border-slate-200 text-slate-700 bg-white hover:bg-slate-50"
  const dotOff  = isDark ? "bg-white/20 hover:bg-white/40"                   : "bg-slate-300 hover:bg-slate-400"

  const Curr = SLIDES[slide].Comp

  return (
    <div className={`min-h-screen ${bg} antialiased`}>

      {/* ── Topbar ──────────────────────────────────────── */}
      <header className={`fixed inset-x-0 top-0 z-50 border-b backdrop-blur-md ${navBg}`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
          <img src="/logo.png" alt="DataAIHub" className="h-9 md:h-11 w-auto"/>
          <div className="flex items-center gap-2">
            <a href="/login" className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${isDark?"text-slate-300 hover:bg-white/8":"text-slate-700 hover:bg-slate-100"}`}>Log in</a>
            <a href="/signup" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-blue-500/30 transition hover:bg-blue-500 hover:scale-[1.02]">Get Started</a>
            <button onClick={() => setIsDark(v=>!v)} className={`ml-1 rounded-xl border p-2 transition ${isDark?"border-white/10 bg-slate-900 text-slate-400 hover:bg-slate-800":"border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`} aria-label="Toggle theme">
              <Icon path={isDark ? ICONS.sun : ICONS.moon} className="h-4 w-4"/>
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-24 pb-16 px-5 md:pt-32 md:pb-24">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className={`absolute -top-10 -left-24 h-96 w-96 rounded-full blur-3xl ${isDark?"bg-blue-600/12":"bg-blue-400/16"}`}/>
          <div className={`absolute top-20 right-0 h-80 w-80 rounded-full blur-3xl ${isDark?"bg-violet-600/8":"bg-violet-300/12"}`}/>
        </div>
        <div className="relative mx-auto max-w-7xl">
          <div className="mb-6 flex">
            <span className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1 text-xs font-bold uppercase tracking-widest ${tagBg}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse inline-block"/>
              Autonomous Machine Learning Platform
            </span>
          </div>
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            {/* Copy */}
            <div>
              <h1 className={`text-4xl font-black leading-[1.1] tracking-tight md:text-6xl ${heading}`}>
                Autonomous {" "}
                <span className="bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">AI Agent</span>
                {" "}for <br></br>End-to-End Data Analytics
              </h1>
              <p className={`mt-5 max-w-xl text-base leading-relaxed md:text-lg ${subtle}`}>
                Upload any dataset. The platform profiles your data, engineers features, trains the best model, and delivers transparent analytics — fully autonomous, end-to-end.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="/signup" className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/30 transition hover:-translate-y-0.5 hover:bg-blue-500">
                  Start Free <Icon path={ICONS.arrowRight} className="h-4 w-4"/>
                </a>
                <a href="/login" className={`inline-flex items-center gap-2 rounded-2xl border px-6 py-3 text-sm font-bold transition hover:-translate-y-0.5 ${ghost}`}>
                  Log in to Dashboard
                </a>
              </div>
              <div className="mt-7 flex flex-wrap gap-2">
                {["No code required","Any CSV or JSON","Explainable results"].map(t => (
                  <span key={t} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${isDark?"border-white/10 bg-white/5 text-slate-300":"border-slate-200 bg-slate-50 text-slate-600"}`}>
                    <Icon path={ICONS.check} className="h-3 w-3 text-emerald-400"/>{t}
                  </span>
                ))}
              </div>
            </div>

            {/* Slide panel */}
            <div className={`rounded-3xl border overflow-hidden shadow-2xl ${card} ${isDark?"shadow-blue-500/8":"shadow-slate-300/60"}`}>
              {/* SVG visual — always rendered on dark bg for maximum contrast */}
              <div
                className="bg-slate-950 overflow-hidden"
                style={{ transition:"opacity .25s ease", opacity: fading ? 0 : 1 }}
              >
                <Curr/>
              </div>

              {/* Caption + nav */}
              <div className="p-5">
                <p className={`text-xs font-bold uppercase tracking-widest mb-1.5 ${accent}`}>
                  {SLIDES[slide].label}
                </p>
                <p className={`text-sm leading-relaxed ${muted}`} style={{minHeight:"2.6rem", transition:"opacity .25s ease", opacity: fading ? 0 : 1}}>
                  {SLIDES[slide].caption}
                </p>
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex gap-1.5 items-center">
                    {SLIDES.map((s,i) => (
                      <button key={s.id} onClick={() => nav(i)}
                        className={`rounded-full transition-all duration-300 ${i===slide ? "w-6 h-2 bg-blue-500" : `w-2 h-2 ${dotOff}`}`}
                        aria-label={`Slide ${i+1}`}/>
                    ))}
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => nav((slide-1+SLIDES.length)%SLIDES.length)}
                      className={`flex h-7 w-7 items-center justify-center rounded-lg border transition ${isDark?"border-white/10 bg-white/5 text-slate-300 hover:bg-white/10":"border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
                      <Icon path={ICONS.chevLeft} className="h-3.5 w-3.5"/>
                    </button>
                    <button onClick={() => nav((slide+1)%SLIDES.length)}
                      className={`flex h-7 w-7 items-center justify-center rounded-lg border transition ${isDark?"border-white/10 bg-white/5 text-slate-300 hover:bg-white/10":"border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
                      <Icon path={ICONS.chevRight} className="h-3.5 w-3.5"/>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ────────────────────────────────────────── */}
      <section className="px-5 pb-20">
        <div className="mx-auto max-w-7xl grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map(s => (
            <div key={s.label} className={`rounded-2xl border p-5 transition duration-200 hover:-translate-y-1 shadow-lg ${card} ${hover} ${s.sh}`}>
              <p className={`text-3xl font-black tracking-tight ${s.col}`}>{s.v}</p>
              <p className={`mt-1 text-sm font-bold ${heading}`}>{s.label}</p>
              <p className={`mt-1 text-xs leading-relaxed ${muted}`}>{s.sub}</p>
            </div>
          ))}
        </div>
      </section>

      <div className={`mx-auto max-w-7xl px-5 border-t ${divider}`}/>

      {/* ── How It Works ─────────────────────────────────── */}
      <section className="px-5 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10">
            <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${accent}`}>Workflow</p>
            <h2 className={`text-2xl font-black md:text-4xl ${heading}`}>How the Platform Works</h2>
            <p className={`mt-3 max-w-2xl text-sm md:text-base ${subtle}`}>
              One continuous workflow — raw data to deployed model — with no manual intervention at any step.
            </p>
          </div>
          <div className="space-y-3">
            {STEPS.map(s => (
              <div key={s.n} className={`flex gap-5 rounded-2xl border p-5 transition duration-200 hover:-translate-y-0.5 ${card} ${hover}`}>
                <div className="flex-shrink-0">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-black text-white shadow-md ${s.col}`}>{s.n}</div>
                </div>
                <div>
                  <p className={`text-sm font-bold ${heading}`}>{s.title}</p>
                  <p className={`mt-1 text-sm leading-relaxed ${muted}`}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className={`mx-auto max-w-7xl px-5 border-t ${divider}`}/>

      {/* ── CTA ──────────────────────────────────────────── */}
      <section className="px-5 py-20">
        <div className="mx-auto max-w-7xl">
          <div className={`rounded-3xl border p-8 md:p-12 text-center ${card}`}>
            <h2 className={`text-2xl font-black md:text-4xl ${heading}`}>Ready to analyse your dataset?</h2>
            <p className={`mx-auto mt-4 max-w-xl text-sm md:text-base ${subtle}`}>
              No setup. No configuration. Upload a file and the autonomous pipeline takes it from there.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <a href="/signup" className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-7 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/30 transition hover:-translate-y-0.5 hover:bg-blue-500">
                Create Free Account <Icon path={ICONS.arrowRight} className="h-4 w-4"/>
              </a>
              <a href="/login" className={`inline-flex items-center gap-2 rounded-2xl border px-7 py-3 text-sm font-bold transition hover:-translate-y-0.5 ${ghost}`}>
                Sign In
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Contact ──────────────────────────────────────── */}
      <section className="px-5 pb-20">
        <div className="mx-auto max-w-7xl">
          <div className={`rounded-3xl border p-6 md:p-8 ${card}`}>
            <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${accent}`}>Contact</p>
            <h3 className={`text-xl font-black ${heading}`}>Get in touch</h3>
            <p className={`mt-1 text-sm ${muted}`}>Questions about integrating your workflow? Reach out to the right team.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                { team:"Product",      email:"automl@dataaihub.ai",       color:"text-blue-400"    },
                { team:"Engineering",  email:"eswarsainandan04@gmail.com", color:"text-violet-400"  },
                { team:"Partnerships", email:"automl.partners@company.ai", color:"text-emerald-400" },
              ].map(({ team, email, color }) => (
                <a key={team} href={`mailto:${email}`} className={`rounded-xl border p-4 block transition hover:-translate-y-0.5 ${card} ${hover}`}>
                  <p className={`text-xs font-bold uppercase tracking-widest ${color}`}>{team}</p>
                  <p className={`mt-1 text-sm font-semibold ${heading} truncate`}>{email}</p>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────── */}
      <footer className={`border-t ${divider} px-5 py-6`}>
        <div className={`mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs ${muted}`}>
          <img src="/logo.png" alt="DataAIHub" className="h-7 w-auto opacity-60"/>
          <p>© {new Date().getFullYear()} DataAIHub. Autonomous ML Platform.</p>
        </div>
      </footer>
    </div>
  )
}