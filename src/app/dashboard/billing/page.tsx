"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Crown, Zap, ArrowRight } from "lucide-react";
import { openCheckout } from "@/hooks/useRazorpay";

const PLANS = [
  {
    id: "starter" as const,
    name: "Starter",
    price: "2,999",
    period: "/month",
    features: [
      "500 call minutes/month",
      "2 AI agents",
      "5 concurrent calls",
      "Hindi + English",
      "Email support",
    ],
  },
  {
    id: "growth" as const,
    name: "Growth",
    price: "7,999",
    period: "/month",
    popular: true,
    features: [
      "2,000 call minutes/month",
      "10 AI agents",
      "20 concurrent calls",
      "10+ Indian languages",
      "Priority support",
      "CRM integrations",
      "Custom voice cloning",
    ],
  },
];

export default function BillingPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleSubscribe(plan: "starter" | "growth") {
    setLoading(plan);
    setError("");
    try {
      await openCheckout(plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--d-text)" }}>
          Billing & Plans
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--d-text-2)" }}>
          Choose a plan to start handling calls with AI
        </p>
      </div>

      {error && (
        <div
          className="mb-6 px-4 py-3 rounded-lg text-sm"
          style={{
            background: "rgba(248,113,113,0.1)",
            border: "1px solid rgba(248,113,113,0.2)",
            color: "var(--d-error)",
          }}
        >
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {PLANS.map((plan, i) => (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="dash-card relative overflow-hidden"
            style={plan.popular ? {
              borderColor: "rgba(0,188,212,0.3)",
              boxShadow: "0 0 32px rgba(0,188,212,0.08)",
            } : undefined}
          >
            {plan.popular && (
              <div
                className="absolute top-0 right-0 px-3 py-1 text-[11px] font-bold uppercase tracking-wider rounded-bl-lg"
                style={{ background: "var(--d-primary)", color: "#06070B" }}
              >
                Popular
              </div>
            )}
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4">
                {plan.popular ? (
                  <Crown size={20} style={{ color: "var(--d-primary)" }} />
                ) : (
                  <Zap size={20} style={{ color: "var(--d-text-2)" }} />
                )}
                <h2 className="text-lg font-bold" style={{ color: "var(--d-text)" }}>
                  {plan.name}
                </h2>
              </div>

              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-3xl font-bold" style={{ color: "var(--d-text)" }}>
                  ₹{plan.price}
                </span>
                <span className="text-sm" style={{ color: "var(--d-text-3)" }}>
                  {plan.period}
                </span>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2.5">
                    <Check size={16} style={{ color: "var(--d-primary)" }} />
                    <span className="text-sm" style={{ color: "var(--d-text-2)" }}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSubscribe(plan.id)}
                disabled={loading !== null}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold transition-all"
                style={{
                  background: plan.popular ? "var(--d-primary)" : "var(--d-surface-2)",
                  color: plan.popular ? "#06070B" : "var(--d-text)",
                  border: plan.popular ? "none" : "1px solid var(--d-border)",
                  opacity: loading !== null ? 0.6 : 1,
                  cursor: loading !== null ? "wait" : "pointer",
                }}
              >
                {loading === plan.id ? "Processing..." : "Subscribe"}
                {loading !== plan.id && <ArrowRight size={16} />}
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-6 text-center">
        <p className="text-xs" style={{ color: "var(--d-text-3)" }}>
          All prices in INR. No credit card required for demo. Cancel anytime.
        </p>
      </div>
    </div>
  );
}
