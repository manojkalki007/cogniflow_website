"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import AnimatedCounter from "./AnimatedCounter";

const PIPELINE = [
  { label: "STT", ms: 80, color: "bg-brand" },
  { label: "EOT", ms: 50, color: "bg-cyan-500" },
  { label: "LLM", ms: 100, color: "bg-brand-light" },
  { label: "TTS", ms: 40, color: "bg-cyan-400" },
  { label: "Network", ms: 60, color: "bg-brand/70" },
];

const TOTAL = PIPELINE.reduce((s, p) => s + p.ms, 0);

const COMPARISONS = [
  { label: "GPT-4o", value: "1.4s", color: "text-red-400", line: true },
  { label: "Competitors", value: "800ms", color: "text-yellow-400", line: false },
  { label: "Cogniflow", value: "350ms", color: "text-green-400", glow: true },
];

export default function LatencyVisual() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="relative py-32 px-6" ref={ref}>
      <div className="max-w-4xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-16"
        >
          <h2 className="text-5xl md:text-7xl font-bold tracking-tight mb-4">
            <AnimatedCounter target={350} suffix="ms" />
          </h2>
          <p className="text-lg text-text-secondary">
            average response time
          </p>
          <p className="text-text-tertiary mt-2">
            Faster than human conversation. Your callers won&apos;t know it&apos;s AI.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="glass-card rounded-2xl p-8 mb-8"
        >
          <div className="flex items-center gap-2 mb-6">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] text-text-tertiary font-mono uppercase tracking-wider">
              Latency Waterfall
            </span>
          </div>

          <div className="relative">
            <div className="flex gap-1 h-14 rounded-xl overflow-hidden bg-white/[0.02]">
              {PIPELINE.map((stage, i) => {
                const widthPercent = (stage.ms / TOTAL) * 100;
                return (
                  <motion.div
                    key={stage.label}
                    initial={{ width: 0 }}
                    animate={isInView ? { width: `${widthPercent}%` } : {}}
                    transition={{
                      duration: 0.8,
                      delay: 0.5 + i * 0.15,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className={`${stage.color} rounded-lg flex items-center justify-center relative group`}
                  >
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] font-mono font-bold text-white">
                        {stage.label}
                      </span>
                      <span className="text-[9px] font-mono text-white/70">
                        {stage.ms}ms
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <div className="flex items-center justify-between mt-3">
              <span className="text-xs font-mono text-text-tertiary">0ms</span>
              <motion.div
                initial={{ opacity: 0 }}
                animate={isInView ? { opacity: 1 } : {}}
                transition={{ delay: 1.5 }}
                className="flex items-center gap-2"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                <span className="text-xs font-mono text-green-400 font-semibold">{TOTAL}ms total</span>
              </motion.div>
              <div className="flex items-center gap-1">
                <span className="text-xs font-mono text-text-tertiary">500ms</span>
                <div className="w-px h-3 bg-red-400/50" />
                <span className="text-[9px] text-red-400/70">human threshold</span>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="grid grid-cols-3 gap-4"
        >
          {COMPARISONS.map((comp) => (
            <div
              key={comp.label}
              className={`glass-card rounded-xl p-5 text-center ${
                comp.glow ? "border-green-500/20 shadow-[0_0_20px_rgba(34,197,94,0.08)]" : ""
              }`}
            >
              <p className={`text-2xl font-bold font-mono ${comp.color} ${comp.line ? "line-through opacity-60" : ""}`}>
                {comp.value}
              </p>
              <p className="text-xs text-text-tertiary mt-1">{comp.label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
