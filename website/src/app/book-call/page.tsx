"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import Cal, { getCalApi } from "@calcom/embed-react";
import { useEffect } from "react";

const CAL_LINK = process.env.NEXT_PUBLIC_CAL_LINK || "cogniflow/30min";

export default function BookCallPage() {
  const [leadSaved, setLeadSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", company: "", phone: "" });

  useEffect(() => {
    (async () => {
      const cal = await getCalApi();
      cal("ui", {
        theme: "dark",
        cssVarsPerTheme: {
          dark: {
            "cal-brand": "#0052CC",
            "cal-text": "#ffffff",
            "cal-text-emphasis": "#ffffff",
            "cal-border-emphasis": "rgba(255,255,255,0.1)",
            "cal-bg": "#0A0A0C",
            "cal-bg-emphasis": "#111114",
          },
          light: {
            "cal-brand": "#0052CC",
          },
        },
        hideEventTypeDetails: false,
      });
    })();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch("/api/book-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setLeadSaved(true);
    } catch {
      setLeadSaved(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A0A0C" }}>
      {/* Header */}
      <div className="max-w-5xl mx-auto px-6 pt-8 pb-4">
        <a
          href="/"
          className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </a>
      </div>

      {!leadSaved ? (
        /* Step 1: Capture lead info */
        <div className="max-w-md mx-auto px-6 py-16">
          <h1
            className="text-3xl md:text-4xl font-semibold text-white leading-tight"
            style={{ fontFamily: "'Instrument Sans', sans-serif" }}
          >
            Book a Free Call
          </h1>
          <p
            className="mt-3 text-white/60 text-base leading-relaxed"
            style={{ fontFamily: "'Instrument Sans', sans-serif" }}
          >
            Tell us a bit about yourself, then pick a time that works.
          </p>

          <form onSubmit={handleSubmit} className="mt-10 space-y-5">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#0052CC]/50 focus:ring-1 focus:ring-[#0052CC]/25 transition-all"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">
                Work Email *
              </label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#0052CC]/50 focus:ring-1 focus:ring-[#0052CC]/25 transition-all"
                placeholder="john@company.com"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">
                Company
              </label>
              <input
                type="text"
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                className="w-full px-4 py-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#0052CC]/50 focus:ring-1 focus:ring-[#0052CC]/25 transition-all"
                placeholder="Acme Corp"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">
                Phone
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-4 py-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#0052CC]/50 focus:ring-1 focus:ring-[#0052CC]/25 transition-all"
                placeholder="+91 98765 43210"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-full bg-[#0052CC] text-white font-semibold text-base hover:bg-[#003d99] transition-colors disabled:opacity-60"
            >
              {submitting ? "Saving..." : "Continue to Schedule"}
            </button>
          </form>
        </div>
      ) : (
        /* Step 2: Cal.com scheduler */
        <div className="max-w-4xl mx-auto px-6 py-8">
          <h1
            className="text-2xl md:text-3xl font-semibold text-white text-center"
            style={{ fontFamily: "'Instrument Sans', sans-serif" }}
          >
            Pick a time that works for you
          </h1>
          <p className="mt-2 text-white/50 text-center text-sm mb-8">
            15-minute call with the Cogniflow team
          </p>

          <Cal
            calLink={CAL_LINK}
            config={{
              name: form.name,
              email: form.email,
              theme: "dark",
            }}
            style={{
              width: "100%",
              height: "100%",
              overflow: "scroll",
              minHeight: "600px",
            }}
          />
        </div>
      )}
    </div>
  );
}
