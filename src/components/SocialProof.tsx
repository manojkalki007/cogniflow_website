"use client";

import { Phone, Globe, Zap, Shield, Lock, Server } from "lucide-react";
import { FadeUp, FadeIn, CountUp } from "./animations";

export default function SocialProof() {
  return (
    <section className="py-16 px-4 sm:px-6 bg-[var(--color-bg-subtle)] border-y border-[var(--color-border)]">
      <div className="max-w-6xl mx-auto">
        <FadeIn>
          <p className="text-center text-sm text-[var(--color-text-light)] mb-10">
            Trusted by businesses across Bangalore &amp; India
          </p>
        </FadeIn>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
          {[
            { icon: Phone, target: 1000, suffix: "+", label: "Calls Handled" },
            { icon: Globe, target: 10, suffix: "+", label: "Languages Supported" },
            { icon: Zap, prefix: "<", value: "500ms", label: "Response Latency" },
          ].map(({ icon: Icon, target, suffix, prefix, value, label }, i) => (
            <FadeUp key={label} delay={i * 0.15}>
              <div className="text-center">
                <div className="w-10 h-10 rounded-xl bg-[var(--color-brand-light)] flex items-center justify-center mx-auto mb-3">
                  <Icon size={20} className="text-[var(--color-brand)]" />
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-[var(--color-text)]">
                  {target ? <CountUp target={target} suffix={suffix} /> : `${prefix}${value}`}
                </div>
                <div className="text-sm text-[var(--color-text-muted)] mt-1">{label}</div>
              </div>
            </FadeUp>
          ))}
        </div>

        <FadeIn delay={0.5}>
          <div className="flex flex-wrap justify-center gap-6 mt-12 pt-8 border-t border-[var(--color-border)]">
            {[
              { icon: Shield, label: "TRAI Compliant" },
              { icon: Lock, label: "PCI DSS Ready" },
              { icon: Server, label: "99.9% Uptime" },
              { icon: Globe, label: "Made in India" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-sm text-[var(--color-text-light)]">
                <Icon size={16} />
                {label}
              </div>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
