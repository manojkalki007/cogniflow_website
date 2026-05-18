"use client";

import { Zap, Brain, MessageSquare, Globe, Calendar, TrendingUp } from "lucide-react";

const FEATURES = [
  {
    icon: Zap,
    title: "Sub-500ms Latency",
    description: "Parallel STT + LLM + TTS pipeline ensures natural, real-time conversations with zero awkward pauses.",
  },
  {
    icon: Brain,
    title: "Sentiment Analysis",
    description: "Real-time emotion detection adjusts tone and approach mid-call for higher conversion rates.",
  },
  {
    icon: MessageSquare,
    title: "Multi-Channel",
    description: "Calls, WhatsApp, and email in one unified session. Follow up on the channel your lead prefers.",
  },
  {
    icon: Globe,
    title: "10+ Indian Languages",
    description: "Hindi, Tamil, Telugu, Kannada, Malayalam, Bengali, Marathi, Gujarati, English, and more.",
  },
  {
    icon: Calendar,
    title: "Smart Booking",
    description: "AI auto-detects booking intent, checks calendar availability, and schedules instantly.",
  },
  {
    icon: TrendingUp,
    title: "Revenue Attribution",
    description: "Track every call to meeting to deal to revenue. Know exactly what your AI agents earn.",
  },
];

export default function FeatureGrid() {
  return (
    <section id="features" className="py-20 px-4 sm:px-6 bg-[var(--color-bg-subtle)]">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-2xl sm:text-3xl md:text-[40px] font-semibold text-[var(--color-text)] tracking-[-0.01em]">
            Built for real conversations
          </h2>
          <p className="mt-4 text-[var(--color-text-muted)] max-w-xl mx-auto">
            Every feature designed to make AI calls indistinguishable from human ones.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div key={title} className="bento-card">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-brand-light)] flex items-center justify-center mb-4">
                <Icon size={20} className="text-[var(--color-brand)]" />
              </div>
              <h3 className="text-base font-semibold text-[var(--color-text)] mb-2">{title}</h3>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
