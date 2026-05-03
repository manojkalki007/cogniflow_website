"use client";

import { motion } from "framer-motion";
import ScrollReveal from "./ScrollReveal";

const TRANSCRIPT = [
  {
    speaker: "Agent",
    text: "Hi Sarah, thanks for taking the time today. I saw Acme Corp just closed a Series B — congratulations. I'd love to understand how your SDR team is scaling.",
    sentiment: "green",
  },
  {
    speaker: "Sarah",
    text: "Thanks! Yeah, we're growing fast. Honestly, hiring SDRs has been our biggest bottleneck. We can't onboard them fast enough.",
    sentiment: "green",
  },
  {
    speaker: "Agent",
    text: "That's a common challenge at your stage. How many outbound calls is your team handling daily right now?",
    sentiment: null,
  },
  {
    speaker: "Sarah",
    text: "Around 200, but we need to hit 500 by next quarter. The math just doesn't work with human reps alone.",
    sentiment: "yellow",
  },
  {
    speaker: "Agent",
    text: "Exactly. That's where our Growth plan comes in — it can handle the volume increase without the 3-month ramp time of a new hire.",
    sentiment: "green",
  },
  {
    speaker: "Sarah",
    text: "Interesting. But how does it handle objections? Our sales cycle is pretty complex.",
    sentiment: "yellow",
  },
  {
    speaker: "Agent",
    text: "Great question. The agent trains on your playbook and adapts in real time. It handled an objection about pricing earlier today and converted the lead.",
    sentiment: "green",
  },
  {
    speaker: "Sarah",
    text: "That's impressive. Can you walk me through the Growth plan pricing?",
    sentiment: "green",
  },
];

const INFO_ROWS = [
  { label: "Lead Score", value: "87/100", highlight: true },
  { label: "Previous Calls", value: "2", highlight: false },
  { label: "CRM Status", value: "Qualified", badge: "green" },
  { label: "Source", value: "LinkedIn Campaign", highlight: false },
];

const STATS = [
  { label: "Talk Ratio", value: "42/58%", sub: "agent/caller" },
  { label: "Key Topics", value: "3", sub: "detected" },
  { label: "Engagement", value: "High", color: "text-green-400" },
  { label: "Objections", value: "1", sub: "handled" },
];

const BAR_HEIGHTS = [60, 80, 45, 90, 75];
const BAR_SENTIMENTS = ["green", "green", "yellow", "green", "green"];

export default function LiveCallExperience() {
  return (
    <section className="w-full py-32 bg-bg-secondary">
      <ScrollReveal>
        <div className="text-center mb-16 px-6">
          <p className="text-xs uppercase tracking-widest text-brand font-mono mb-4">
            See it live
          </p>
          <h2 className="text-4xl md:text-5xl font-bold text-text-primary">
            The call experience
          </h2>
        </div>

        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_280px] gap-4">
            {/* Left Panel - Caller Profile */}
            <div className="bg-glass border border-glass-border rounded-2xl p-6">
              <p className="text-xs uppercase text-text-tertiary tracking-wider mb-5">
                Caller Profile
              </p>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-brand/20 flex items-center justify-center text-brand text-sm font-semibold shrink-0">
                  SC
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    Sarah Chen
                  </p>
                  <p className="text-xs text-text-tertiary">
                    Acme Corp — Head of Sales
                  </p>
                </div>
              </div>

              <div className="h-px bg-border my-4" />

              <div className="space-y-3">
                {INFO_ROWS.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-text-tertiary">{row.label}</span>
                    {row.badge === "green" ? (
                      <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 text-[10px] font-medium">
                        {row.value}
                      </span>
                    ) : (
                      <span
                        className={
                          row.highlight
                            ? "text-brand font-medium"
                            : "text-text-secondary"
                        }
                      >
                        {row.value}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-6 p-3 rounded-xl bg-brand/5 border border-brand/10">
                <p className="text-[10px] uppercase text-text-tertiary mb-1 tracking-wider">
                  Suggested Action
                </p>
                <p className="text-xs text-brand font-medium">
                  Recommend: Growth Plan
                </p>
              </div>
            </div>

            {/* Center Panel - Live Transcript */}
            <div className="bg-glass border border-glass-border rounded-2xl p-6 flex flex-col">
              <div className="flex items-center justify-between mb-5">
                <p className="text-xs uppercase text-text-tertiary tracking-wider">
                  Live Transcript
                </p>
                <div className="flex items-center gap-2">
                  <motion.div
                    className="w-2 h-2 rounded-full bg-red-500"
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                  <span className="text-xs text-text-tertiary font-mono">
                    04:32
                  </span>
                </div>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto max-h-[400px] pr-2">
                {TRANSCRIPT.map((line, i) => (
                  <div key={i} className="flex gap-2">
                    {line.sentiment && (
                      <div
                        className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                          line.sentiment === "green"
                            ? "bg-green-400"
                            : "bg-yellow-400"
                        }`}
                      />
                    )}
                    {!line.sentiment && (
                      <div className="w-1.5 shrink-0" />
                    )}
                    <div>
                      <span
                        className={`text-xs font-medium ${
                          line.speaker === "Agent"
                            ? "text-brand"
                            : "text-text-primary"
                        }`}
                      >
                        {line.speaker}:
                      </span>
                      <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                        {line.text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 pt-4 border-t border-border flex items-center gap-2">
                <span className="text-xs text-text-tertiary">
                  Agent is analyzing
                </span>
                <motion.span
                  className="text-xs text-text-tertiary"
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  ...
                </motion.span>
              </div>
            </div>

            {/* Right Panel - Analytics Sidebar */}
            <div className="bg-glass border border-glass-border rounded-2xl p-6">
              <p className="text-xs uppercase text-text-tertiary tracking-wider mb-5">
                Call Analytics
              </p>

              {/* Sentiment Chart */}
              <div className="mb-6">
                <p className="text-[10px] text-text-tertiary mb-3 uppercase tracking-wider">
                  Sentiment (last 5 min)
                </p>
                <div className="flex items-end gap-2 h-20">
                  {BAR_HEIGHTS.map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-sm"
                      style={{
                        height: `${h}%`,
                        background:
                          BAR_SENTIMENTS[i] === "green"
                            ? "linear-gradient(to top, #22c55e, #4ade80)"
                            : "linear-gradient(to top, #eab308, #facc15)",
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                {STATS.map((stat) => (
                  <div
                    key={stat.label}
                    className="p-3 rounded-xl bg-bg-secondary/50"
                  >
                    <p className="text-[10px] text-text-tertiary uppercase tracking-wider">
                      {stat.label}
                    </p>
                    <p
                      className={`text-sm font-semibold mt-1 ${
                        stat.color || "text-text-primary"
                      }`}
                    >
                      {stat.value}
                    </p>
                    {stat.sub && (
                      <p className="text-[10px] text-text-tertiary">
                        {stat.sub}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Qualification Score */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] text-text-tertiary uppercase tracking-wider">
                    Qualification Score
                  </p>
                  <span className="text-xs text-brand font-medium">87%</span>
                </div>
                <div className="h-1.5 rounded-full bg-bg-secondary overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-brand"
                    initial={{ width: 0 }}
                    animate={{ width: "87%" }}
                    transition={{ duration: 1.5, delay: 0.5, ease: "easeOut" }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
}
