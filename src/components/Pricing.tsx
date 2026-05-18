"use client";

import { Check, ArrowRight } from "lucide-react";

const DASHBOARD_URL = "https://cogniflowautomations.com/login";

const PLANS = [
  {
    name: "Starter",
    price: "2,999",
    period: "/month",
    minutes: "250 minutes included",
    description: "Perfect for small businesses getting started with AI calling.",
    features: [
      "1 AI agent",
      "250 call minutes/month",
      "5 Indian languages",
      "Basic analytics",
      "Email support",
      "CRM integration",
    ],
    cta: "Start Free Trial",
    popular: false,
  },
  {
    name: "Growth",
    price: "7,999",
    period: "/month",
    minutes: "1,000 minutes included",
    description: "For growing teams that need more power and flexibility.",
    features: [
      "5 AI agents",
      "1,000 call minutes/month",
      "10+ languages",
      "Advanced analytics & sentiment",
      "Priority support",
      "WhatsApp + Email channels",
      "Custom agent templates",
      "Webhook integrations",
    ],
    cta: "Start Free Trial",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    minutes: "Unlimited agents & minutes",
    description: "For large teams with custom requirements.",
    features: [
      "Unlimited AI agents",
      "Unlimited call minutes",
      "All languages",
      "Custom voice cloning",
      "Dedicated account manager",
      "SLA guarantee",
      "On-premise deployment",
      "Custom integrations",
    ],
    cta: "Book a Demo",
    popular: false,
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="py-20 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-2xl sm:text-3xl md:text-[40px] font-semibold text-[var(--color-text)] tracking-[-0.01em]">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-[var(--color-text-muted)] max-w-xl mx-auto">
            No hidden fees. Extra minutes at &#8377;10/min. 7-day free trial on all plans.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl p-7 flex flex-col ${
                plan.popular
                  ? "bg-[var(--color-dark-bg)] text-white ring-2 ring-[var(--color-brand)] relative"
                  : "bg-white border border-[var(--color-border)]"
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[var(--color-brand)] text-white text-xs font-medium">
                  Most Popular
                </span>
              )}

              <div className="mb-6">
                <h3 className={`text-lg font-semibold mb-1 ${plan.popular ? "text-white" : "text-[var(--color-text)]"}`}>
                  {plan.name}
                </h3>
                <p className={`text-sm mb-4 ${plan.popular ? "text-white/60" : "text-[var(--color-text-muted)]"}`}>
                  {plan.description}
                </p>
                <div className="flex items-baseline gap-1">
                  {plan.price !== "Custom" && <span className={`text-sm ${plan.popular ? "text-white/60" : "text-[var(--color-text-light)]"}`}>&#8377;</span>}
                  <span className={`text-4xl font-bold ${plan.popular ? "text-white" : "text-[var(--color-text)]"}`}>
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className={`text-sm ${plan.popular ? "text-white/60" : "text-[var(--color-text-light)]"}`}>
                      {plan.period}
                    </span>
                  )}
                </div>
                <p className={`text-xs mt-2 ${plan.popular ? "text-white/50" : "text-[var(--color-text-light)]"}`}>
                  {plan.minutes}
                </p>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm">
                    <Check
                      size={16}
                      className={`flex-shrink-0 mt-0.5 ${plan.popular ? "text-[var(--color-brand)]" : "text-[var(--color-brand)]"}`}
                    />
                    <span className={plan.popular ? "text-white/80" : "text-[var(--color-text-muted)]"}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <a
                href={DASHBOARD_URL}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm transition-all ${
                  plan.popular
                    ? "bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-dark)]"
                    : "bg-[var(--color-bg-subtle)] text-[var(--color-text)] hover:bg-[var(--color-border)]"
                }`}
              >
                {plan.cta} <ArrowRight size={14} />
              </a>
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-[var(--color-text-light)] mt-8">
          No credit card required. 7-day free trial on Starter &amp; Growth plans.
        </p>
      </div>
    </section>
  );
}
