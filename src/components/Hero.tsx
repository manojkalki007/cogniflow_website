"use client";

import { ArrowRight, Play } from "lucide-react";

const SIGNUP_URL = "https://cogniflowautomations.com/login?mode=signup";

function DashboardMockup() {
  const barHeights = [40, 65, 50, 80, 60, 90, 75, 55, 85, 70, 95, 68];

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-white shadow-2xl overflow-hidden">
      {/* Window chrome */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50/80">
        <span className="w-3 h-3 rounded-full bg-red-400" />
        <span className="w-3 h-3 rounded-full bg-amber-400" />
        <span className="w-3 h-3 rounded-full bg-emerald-400" />
        <span className="ml-4 text-xs text-gray-400 font-medium">home.cogniflowautomations.com</span>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className="hidden sm:flex w-48 flex-col border-r border-gray-100 bg-[#0B1120] p-4 gap-1">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500" />
            <span className="text-white text-sm font-semibold">Cogniflow</span>
          </div>
          {["Dashboard", "Agents", "Calls", "Campaigns", "Analytics", "Settings"].map((item, i) => (
            <div
              key={item}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium ${
                i === 0 ? "bg-white/10 text-white" : "text-gray-500"
              }`}
            >
              <div className={`w-4 h-4 rounded ${i === 0 ? "bg-cyan-400/30" : "bg-gray-700"}`} />
              {item}
            </div>
          ))}
        </div>

        {/* Main content */}
        <div className="flex-1 p-4 sm:p-5 bg-gray-50/50 min-h-[280px] sm:min-h-[340px]">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-sm font-semibold text-gray-900">Dashboard</p>
              <p className="text-[11px] text-gray-400 mt-0.5">May 2026</p>
            </div>
            <div className="flex gap-2">
              <div className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-[10px] text-gray-500 font-medium">Last 30 days</div>
              <div className="px-3 py-1.5 rounded-lg bg-[var(--color-brand)] text-white text-[10px] font-medium">Export</div>
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {[
              { label: "Total Calls", value: "12,847", change: "+23%", color: "text-emerald-500" },
              { label: "Active Agents", value: "24", change: "+3", color: "text-emerald-500" },
              { label: "Avg Duration", value: "3:42", change: "-8%", color: "text-emerald-500" },
              { label: "Conversion", value: "34.2%", change: "+5.1%", color: "text-emerald-500" },
            ].map((stat) => (
              <div key={stat.label} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{stat.label}</p>
                <p className="text-lg font-bold text-gray-900 mt-1">{stat.value}</p>
                <p className={`text-[10px] font-medium ${stat.color} mt-0.5`}>{stat.change} vs last month</p>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold text-gray-700">Call Volume</p>
              <div className="flex gap-3">
                <span className="flex items-center gap-1 text-[10px] text-gray-400">
                  <span className="w-2 h-2 rounded-full bg-[var(--color-brand)]" /> Inbound
                </span>
                <span className="flex items-center gap-1 text-[10px] text-gray-400">
                  <span className="w-2 h-2 rounded-full bg-cyan-300" /> Outbound
                </span>
              </div>
            </div>
            <div className="flex items-end gap-[6px] h-24">
              {barHeights.map((h, i) => (
                <div key={i} className="flex-1 flex flex-col gap-[2px] items-stretch">
                  <div
                    className="rounded-t-sm bg-[var(--color-brand)] opacity-80"
                    style={{ height: `${h}%` }}
                  />
                  <div
                    className="rounded-b-sm bg-cyan-300 opacity-60"
                    style={{ height: `${Math.max(10, h * 0.4)}%` }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Hero() {
  return (
    <section className="hero-gradient pt-28 pb-20 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--color-brand-light)] text-[var(--color-brand-dark)] text-sm font-medium mb-8">
          <span className="w-2 h-2 rounded-full bg-[var(--color-brand)] animate-pulse" />
          Now with 10+ Indian language support
        </div>

        {/* Headline */}
        <h1
          className="text-3xl sm:text-4xl md:text-5xl lg:text-[56px] font-bold text-[var(--color-text)] leading-tight tracking-[-0.02em] max-w-3xl mx-auto"
          style={{ lineHeight: 1.15 }}
        >
          AI Agents That Handle{" "}
          <span className="text-[var(--color-brand)]">Your Business Calls</span>
        </h1>

        {/* Subheadline */}
        <p className="mt-6 text-base sm:text-lg text-[var(--color-text-muted)] max-w-2xl mx-auto leading-relaxed">
          Deploy AI calling agents for appointment booking, lead qualification,
          and sales outreach — with sub-500ms response time across 10+ Indian languages.
        </p>

        {/* CTAs */}
        <div className="flex items-center justify-center gap-4 mt-8 flex-wrap">
          <a href={SIGNUP_URL} className="btn-primary text-base !py-3.5 !px-7">
            Start Free Trial <ArrowRight size={16} />
          </a>
          <a href="#demo" className="btn-ghost text-base !py-3.5 !px-7">
            <Play size={16} /> Book a Demo
          </a>
        </div>

        {/* Trust metrics */}
        <div className="flex items-center justify-center gap-6 sm:gap-8 mt-10 text-sm text-[var(--color-text-light)]">
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Sub-500ms latency
          </span>
          <span className="hidden sm:inline text-[var(--color-border)]">|</span>
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            10+ languages
          </span>
          <span className="hidden sm:inline text-[var(--color-border)]">|</span>
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            From &#8377;2.47/min
          </span>
        </div>

        {/* Dashboard preview */}
        <div className="mt-16 relative mx-auto max-w-4xl">
          <DashboardMockup />
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-3/4 h-16 bg-[var(--color-brand)] opacity-10 blur-3xl rounded-full" />
        </div>
      </div>
    </section>
  );
}
