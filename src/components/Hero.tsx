"use client";

import { ArrowRight, Play } from "lucide-react";

const SIGNUP_URL = "https://cogniflowautomations.com/login?mode=signup";

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

        {/* Dashboard screenshot placeholder */}
        <div className="mt-16 relative mx-auto max-w-4xl">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)] shadow-2xl overflow-hidden aspect-[16/9] flex items-center justify-center">
            <div className="text-center p-8">
              <div className="w-16 h-16 rounded-2xl bg-[var(--color-brand-light)] flex items-center justify-center mx-auto mb-4">
                <Play size={28} className="text-[var(--color-brand)] ml-1" />
              </div>
              <p className="text-[var(--color-text-muted)] text-sm">Dashboard Preview</p>
            </div>
          </div>
          {/* Gradient shadow */}
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-3/4 h-16 bg-[var(--color-brand)] opacity-10 blur-3xl rounded-full" />
        </div>
      </div>
    </section>
  );
}
