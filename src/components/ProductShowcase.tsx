"use client";

import ScrollReveal from "./ScrollReveal";
import TiltCard from "./TiltCard";
import { Phone, Target, TrendingUp } from "lucide-react";

function WaveformVisual() {
  return (
    <div className="flex items-center gap-[2px] h-8">
      {Array.from({ length: 24 }).map((_, i) => (
        <div
          key={i}
          className="w-[3px] bg-brand rounded-full animate-pulse"
          style={{
            height: `${20 + Math.sin(i * 0.6) * 60}%`,
            animationDelay: `${i * 80}ms`,
            animationDuration: "1.2s",
          }}
        />
      ))}
    </div>
  );
}

export default function ProductShowcase() {
  return (
    <section id="product" className="relative py-32 px-6">
      <div className="max-w-6xl mx-auto relative z-10">
        <ScrollReveal className="text-center mb-16">
          <p className="text-xs uppercase tracking-[0.2em] text-text-secondary mb-4">
            What Cogniflow Does
          </p>
          <h2 className="text-4xl md:text-5xl font-semibold tracking-[-0.02em] leading-[1.1]">
            Two agents. <span className="gradient-text">One revenue engine.</span>
          </h2>
        </ScrollReveal>

        <div className="grid md:grid-cols-2 gap-6">
          <ScrollReveal delay={0.1} className="md:row-span-2">
            <TiltCard className="rounded-2xl p-8 h-full">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-brand/10 flex items-center justify-center">
                  <Phone className="w-5 h-5 text-brand" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">AI Calling Agent</h3>
                  <p className="text-xs text-text-secondary">Voice-first. Real-time. Human-like.</p>
                </div>
              </div>

              <p className="text-text-secondary text-sm leading-relaxed mb-8">
                Handles inbound and outbound calls with human-like conversation.
                Answers questions, books appointments, qualifies leads, sends
                WhatsApp confirmations — all in sub-500ms.
              </p>

              <div className="glass-card rounded-xl p-5 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[10px] text-text-tertiary font-mono uppercase tracking-wider">
                    Live Call
                  </span>
                </div>
                <WaveformVisual />
              </div>

              <div className="inline-flex items-center gap-2 rounded-lg bg-brand/10 px-3 py-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-brand" />
                <span className="text-xs font-mono text-brand">&lt; 500ms latency</span>
              </div>
            </TiltCard>
          </ScrollReveal>

          <ScrollReveal delay={0.2}>
            <TiltCard className="rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                  <Target className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">AI SDR</h3>
                  <p className="text-xs text-text-secondary">Research. Sequence. Convert.</p>
                </div>
              </div>

              <p className="text-text-secondary text-sm leading-relaxed mb-4">
                Autonomously prospects, researches, and reaches out to your ideal
                customers. Calls, emails, and follows up — without human intervention.
              </p>

              <div className="inline-flex items-center gap-2 rounded-lg bg-cyan-500/10 px-3 py-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                <span className="text-xs font-mono text-cyan-400">10x more meetings booked</span>
              </div>
            </TiltCard>
          </ScrollReveal>

          <ScrollReveal delay={0.3}>
            <TiltCard className="rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">Revenue Attribution</h3>
                  <p className="text-xs text-text-secondary">Every call. Every rupee.</p>
                </div>
              </div>

              <p className="text-text-secondary text-sm leading-relaxed mb-4">
                Track every call to revenue. Know exactly how much Cogniflow
                generated for you this month.
              </p>

              <div className="inline-flex items-center gap-2 rounded-lg bg-accent/10 px-3 py-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                <span className="text-xs font-mono text-accent">avg monthly revenue per client</span>
              </div>
            </TiltCard>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
