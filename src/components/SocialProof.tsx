"use client";

import { Phone, Globe, Zap } from "lucide-react";

const METRICS = [
  { icon: Phone, value: "1,000+", label: "Calls Handled" },
  { icon: Globe, value: "10+", label: "Languages Supported" },
  { icon: Zap, value: "<500ms", label: "Response Latency" },
];

export default function SocialProof() {
  return (
    <section className="py-16 px-4 sm:px-6 bg-[var(--color-bg-subtle)] border-y border-[var(--color-border)]">
      <div className="max-w-6xl mx-auto">
        <p className="text-center text-sm text-[var(--color-text-light)] mb-10">
          Trusted by businesses across Bangalore &amp; India
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
          {METRICS.map(({ icon: Icon, value, label }) => (
            <div key={label} className="text-center">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-brand-light)] flex items-center justify-center mx-auto mb-3">
                <Icon size={20} className="text-[var(--color-brand)]" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-[var(--color-text)]">{value}</div>
              <div className="text-sm text-[var(--color-text-muted)] mt-1">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
