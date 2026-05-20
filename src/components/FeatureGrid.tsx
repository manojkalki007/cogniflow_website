"use client";

import { Zap, Brain, MessageSquare, Globe, Calendar, TrendingUp } from "lucide-react";
import { FadeUp, StaggerChildren, StaggerItem } from "./animations";

const LANGUAGES = ["Hindi", "Tamil", "Telugu", "Kannada", "Malayalam", "Bengali", "Marathi", "Gujarati", "English", "Punjabi"];

export default function FeatureGrid() {
  return (
    <section id="features" className="py-20 px-4 sm:px-6 bg-[var(--color-bg-subtle)]">
      <div className="max-w-6xl mx-auto">
        <FadeUp>
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl md:text-[40px] font-semibold text-[var(--color-text)] tracking-[-0.01em]">
              Built for real conversations
            </h2>
            <p className="mt-4 text-[var(--color-text-muted)] max-w-xl mx-auto">
              Every feature designed to make AI calls indistinguishable from human ones.
            </p>
          </div>
        </FadeUp>

        <StaggerChildren className="grid sm:grid-cols-2 gap-5">
          {/* Hero card 1: Sub-500ms Latency */}
          <StaggerItem>
            <div className="bento-card min-h-[240px]">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-brand-light)] flex items-center justify-center mb-4">
                <Zap size={20} className="text-[var(--color-brand)]" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--color-text)] mb-2">Sub-500ms Latency</h3>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-5">
                Parallel STT + LLM + TTS pipeline ensures natural, real-time conversations with zero awkward pauses.
              </p>
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-light)]">
                <div className="flex items-center gap-1.5">
                  <div className="px-2.5 py-1 rounded-md bg-[var(--color-brand-light)] text-[var(--color-brand)] font-medium">STT</div>
                  <span className="text-[var(--color-text-light)]">→</span>
                  <div className="px-2.5 py-1 rounded-md bg-[var(--color-brand-light)] text-[var(--color-brand)] font-medium">LLM</div>
                  <span className="text-[var(--color-text-light)]">→</span>
                  <div className="px-2.5 py-1 rounded-md bg-[var(--color-brand-light)] text-[var(--color-brand)] font-medium">TTS</div>
                </div>
                <span className="ml-auto text-[var(--color-brand)] font-semibold">~350ms</span>
              </div>
            </div>
          </StaggerItem>

          {/* Hero card 2: 10+ Indian Languages */}
          <StaggerItem>
            <div className="bento-card min-h-[240px]">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-brand-light)] flex items-center justify-center mb-4">
                <Globe size={20} className="text-[var(--color-brand)]" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--color-text)] mb-2">10+ Indian Languages</h3>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-5">
                Native support for Hindi, Tamil, Telugu, Kannada, and more. Mixed-language conversations handled naturally.
              </p>
              <div className="flex flex-wrap gap-2">
                {LANGUAGES.map((lang) => (
                  <span key={lang} className="px-2.5 py-1 rounded-full bg-[var(--color-brand-light)] text-[var(--color-brand)] text-xs font-medium">
                    {lang}
                  </span>
                ))}
              </div>
            </div>
          </StaggerItem>

          {/* 4 smaller cards */}
          {[
            { icon: Brain, title: "Sentiment Analysis", description: "Real-time emotion detection adjusts tone and approach mid-call for higher conversion rates." },
            { icon: MessageSquare, title: "Multi-Channel", description: "Calls, WhatsApp, and email in one unified session. Follow up on the channel your lead prefers." },
            { icon: Calendar, title: "Smart Booking", description: "AI auto-detects booking intent, checks calendar availability, and schedules instantly." },
            { icon: TrendingUp, title: "Revenue Attribution", description: "Track every call to meeting to deal to revenue. Know exactly what your AI agents earn." },
          ].map(({ icon: Icon, title, description }) => (
            <StaggerItem key={title} className="sm:col-span-1">
              <div className="bento-card h-full">
                <div className="w-10 h-10 rounded-xl bg-[var(--color-brand-light)] flex items-center justify-center mb-4">
                  <Icon size={20} className="text-[var(--color-brand)]" />
                </div>
                <h3 className="text-base font-semibold text-[var(--color-text)] mb-2">{title}</h3>
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{description}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerChildren>
      </div>
    </section>
  );
}
