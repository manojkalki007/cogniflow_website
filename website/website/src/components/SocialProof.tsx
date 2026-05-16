"use client";

import ScrollReveal from "./ScrollReveal";
import AnimatedCounter from "./AnimatedCounter";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const TESTIMONIALS = [
  {
    quote: "We replaced 8 SDRs with Cogniflow and booked more meetings in the first month than the previous quarter. The AI handles objections better than most humans I've trained.",
    name: "Priya Sharma",
    title: "VP Sales",
    company: "TechScale India",
  },
  {
    quote: "The sub-500ms latency is real. Our customers genuinely can't tell they're talking to AI. We went from 2-hour response times to under 30 seconds.",
    name: "Arjun Mehta",
    title: "CTO",
    company: "GrowthLoop",
  },
  {
    quote: "Agent cloning was the killer feature for us. We uploaded our top closer's recordings and had an AI copy running the next day. Revenue attribution means I know exactly what ROI we're getting.",
    name: "Neha Patel",
    title: "Head of Revenue",
    company: "CloudServe",
  },
];

const STATS = [
  { value: 2, suffix: "M+", label: "calls handled" },
  { value: 200, suffix: "+", label: "companies" },
  { value: 30, suffix: "+", label: "languages" },
  { value: 350, suffix: "ms", label: "P50 latency", prefix: "< " },
];

export default function SocialProof() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="relative py-32 px-6" ref={ref}>
      <div className="max-w-6xl mx-auto relative z-10">
        <ScrollReveal className="text-center mb-16">
          <p className="text-xs uppercase tracking-[0.2em] text-text-secondary mb-4">
            Social Proof
          </p>
          <h2 className="text-4xl md:text-5xl font-semibold tracking-[-0.02em]">
            Trusted by <span className="gradient-text">revenue teams</span>
          </h2>
        </ScrollReveal>

        <div className="grid md:grid-cols-3 gap-6 mb-20">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{
                duration: 0.7,
                delay: 0.2 + i * 0.15,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="glass-card rounded-2xl p-8"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" className="text-brand/30 mb-4">
                <path
                  fill="currentColor"
                  d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179z"
                />
              </svg>

              <p className="text-sm text-text-secondary leading-relaxed mb-6">
                &ldquo;{t.quote}&rdquo;
              </p>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center text-sm font-semibold text-brand">
                  {t.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div>
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-xs text-text-tertiary">
                    {t.title}, {t.company}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.6 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-6"
        >
          {STATS.map((stat) => (
            <div key={stat.label} className="glass-card rounded-xl p-6 text-center">
              <p className="text-3xl md:text-4xl font-bold font-mono gradient-text mb-1">
                {stat.prefix}
                <AnimatedCounter target={stat.value} suffix={stat.suffix} />
              </p>
              <p className="text-xs text-text-tertiary uppercase tracking-wider">
                {stat.label}
              </p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
