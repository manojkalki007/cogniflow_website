"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import ScrollReveal from "./ScrollReveal";

const stages = [
  { abbr: "STT", name: "Speech-to-Text", time: "~80ms", ms: 80, fill: 16 },
  { abbr: "EOT", name: "End-of-Turn", time: "~50ms", ms: 50, fill: 10 },
  { abbr: "LLM", name: "Language Model", time: "~250ms", ms: 250, fill: 52 },
  { abbr: "TTS", name: "Text-to-Speech", time: "~100ms", ms: 100, fill: 21 },
];

function PipelineVisualization() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <div ref={ref} className="bg-glass border border-glass-border rounded-2xl p-6 space-y-6">
      <div className="text-[10px] text-text-tertiary uppercase tracking-wider font-mono">
        Latency Pipeline
      </div>

      {/* Pipeline stages */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        {stages.map((stage, i) => (
          <motion.div
            key={stage.abbr}
            className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{
              duration: 0.5,
              delay: i * 0.15,
              ease: "easeOut",
            }}
          >
            {/* Stage chip */}
            <div className="flex-1 bg-bg-secondary border border-glass-border rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs uppercase tracking-wider text-text-primary font-semibold">
                  {stage.abbr}
                </span>
              </div>
              <div className="text-[10px] text-text-tertiary">{stage.name}</div>
              <div className="text-lg font-bold font-mono text-text-primary">
                {stage.time}
              </div>
              {/* Progress bar */}
              <div className="h-1 rounded-full bg-glass-border overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-brand/20"
                  initial={{ width: 0 }}
                  animate={isInView ? { width: `${stage.fill}%` } : {}}
                  transition={{
                    duration: 0.8,
                    delay: i * 0.15 + 0.3,
                    ease: "easeOut",
                  }}
                />
              </div>
            </div>

            {/* Arrow connector (not after last item) */}
            {i < stages.length - 1 && (
              <motion.span
                className="hidden sm:flex items-center text-text-tertiary/50 text-lg shrink-0 px-1"
                initial={{ opacity: 0 }}
                animate={isInView ? { opacity: 1 } : {}}
                transition={{ duration: 0.3, delay: i * 0.15 + 0.2 }}
              >
                &rarr;
              </motion.span>
            )}
          </motion.div>
        ))}
      </div>

      {/* Total bar */}
      <motion.div
        className="space-y-2 pt-4 border-t border-border"
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ duration: 0.5, delay: 0.7 }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-text-tertiary uppercase tracking-wider font-mono">
            Total Round-Trip
          </span>
          <span className="text-2xl font-bold font-mono text-brand">
            &lt;480ms
          </span>
        </div>
        <div className="h-2 rounded-full bg-glass-border overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-brand/30"
            initial={{ width: 0 }}
            animate={isInView ? { width: "96%" } : {}}
            transition={{ duration: 1.2, delay: 0.8, ease: "easeOut" }}
          />
        </div>
      </motion.div>
    </div>
  );
}

export default function PerformanceSplit() {
  return (
    <section className="py-32 px-6">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
        {/* Left: pipeline visualization */}
        <div className="order-2 md:order-1">
          <PipelineVisualization />
        </div>

        {/* Right: text */}
        <ScrollReveal className="order-1 md:order-2">
          <div>
            <span className="text-xs uppercase tracking-widest text-brand font-mono">
              Performance
            </span>
            <h2 className="text-4xl md:text-5xl font-bold text-text-primary mt-4 leading-tight">
              Sub-500ms. Every turn.
            </h2>
            <p className="text-text-secondary text-lg leading-relaxed mt-6 max-w-lg">
              From the moment the caller finishes speaking to the moment your
              agent responds — under 500 milliseconds. Faster than your best
              rep&apos;s first breath.
            </p>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
