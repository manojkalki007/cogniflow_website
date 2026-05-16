"use client";

import { useState } from "react";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Check } from "lucide-react";

const PLANS = [
  {
    name: "Starter",
    monthlyPrice: 49,
    features: [
      "1,000 minutes included",
      "1 agent",
      "Inbound only",
      "Email support",
      "Basic analytics",
    ],
    cta: "Start Free Trial",
    href: "#demo",
    highlighted: false,
  },
  {
    name: "Growth",
    monthlyPrice: 199,
    badge: "Most Popular",
    features: [
      "5,000 minutes included",
      "5 agents",
      "Inbound + Outbound",
      "CRM integrations",
      "WhatsApp handoff",
      "Priority support",
      "Revenue attribution",
    ],
    cta: "Start Free Trial",
    href: "#demo",
    highlighted: true,
  },
  {
    name: "Enterprise",
    monthlyPrice: null,
    features: [
      "Unlimited minutes",
      "Unlimited agents",
      "Agent cloning",
      "Compliance guardrails",
      "Revenue attribution",
      "Dedicated success manager",
      "Custom SLA",
    ],
    cta: "Contact Sales",
    href: "#demo",
    highlighted: false,
  },
];

export default function Pricing() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [annual, setAnnual] = useState(false);

  return (
    <section id="pricing" className="relative py-32 px-6" ref={ref}>
      <div className="max-w-6xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-12"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-text-secondary mb-4">
            Pricing
          </p>
          <h2 className="text-4xl md:text-5xl font-semibold tracking-[-0.02em] mb-4">
            Simple, <span className="gradient-text">transparent pricing</span>
          </h2>
          <p className="text-text-secondary mb-8">
            Start free. Scale as you grow. No hidden fees.
          </p>

          <div className="inline-flex items-center gap-3 glass-card rounded-full px-1.5 py-1.5">
            <button
              onClick={() => setAnnual(false)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                !annual
                  ? "bg-brand text-white"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                annual
                  ? "bg-brand text-white"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              Annual
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/20 text-accent font-semibold">
                Save 20%
              </span>
            </button>
          </div>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 items-start">
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{
                duration: 0.7,
                delay: 0.2 + i * 0.15,
                ease: [0.16, 1, 0.3, 1],
              }}
              className={`glass-card rounded-2xl p-8 relative ${
                plan.highlighted
                  ? "border-brand/30 shadow-[0_0_40px_rgba(37,99,235,0.1)] md:scale-105"
                  : ""
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-brand text-white text-xs font-semibold">
                  {plan.badge}
                </div>
              )}

              <h3 className="text-xl font-semibold mb-2">{plan.name}</h3>

              <div className="mb-6">
                {plan.monthlyPrice !== null ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold">
                      ${annual ? Math.round(plan.monthlyPrice * 0.8) : plan.monthlyPrice}
                    </span>
                    <span className="text-text-tertiary text-sm">/mo</span>
                  </div>
                ) : (
                  <span className="text-4xl font-bold">Custom</span>
                )}
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm">
                    <Check className="w-4 h-4 text-brand shrink-0 mt-0.5" />
                    <span className="text-text-secondary">{feature}</span>
                  </li>
                ))}
              </ul>

              <a
                href={plan.href}
                className={`block w-full text-center py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  plan.highlighted
                    ? "bg-brand text-white hover:bg-brand-light shadow-[0_0_20px_rgba(37,99,235,0.2)]"
                    : "border border-white/[0.08] text-text-primary hover:border-white/[0.15] hover:bg-white/[0.03]"
                }`}
              >
                {plan.cta}
              </a>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
