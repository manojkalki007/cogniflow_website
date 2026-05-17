"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import ScrollReveal from "./ScrollReveal";

export default function FinalCTA() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  return (
    <section
      id="book-demo"
      className="relative py-32 overflow-hidden"
    >
      {/* Decorative gradients */}
      <div
        className="absolute rounded-full mix-blend-screen pointer-events-none"
        style={{
          top: "-10%",
          left: "30%",
          width: "500px",
          height: "500px",
          background: "rgba(30, 58, 138, 0.15)",
          filter: "blur(120px)",
        }}
      />
      <div
        className="absolute rounded-full mix-blend-screen pointer-events-none"
        style={{
          bottom: "0%",
          right: "25%",
          width: "400px",
          height: "400px",
          background: "rgba(49, 46, 129, 0.12)",
          filter: "blur(120px)",
        }}
      />

      <ScrollReveal className="relative z-10 px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          {/* Left — copy */}
          <div>
            <p
              className="text-2xl sm:text-3xl text-white leading-[1.2]"
              style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic" }}
            >
              Your next SDR doesn&apos;t need a salary
            </p>
            <h2
              className="mt-4 text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tighter leading-[0.95] bg-gradient-to-b from-white via-white to-[#7dd3fc] bg-clip-text text-transparent"
              style={{ fontFamily: "'Instrument Sans', sans-serif" }}
            >
              Book a Demo
            </h2>
            <p
              className="mt-6 text-base sm:text-lg text-white/60 leading-relaxed max-w-md"
              style={{ fontFamily: "'Instrument Sans', sans-serif" }}
            >
              See Cogniflow in action. Get a personalized 15-minute walkthrough
              of how our AI SDR can transform your sales pipeline.
            </p>

            {/* Trust signals */}
            <div className="mt-10 flex flex-col gap-4">
              {[
                "Live AI call demonstration",
                "Custom ROI analysis for your team",
                "No commitment required",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-brand/20 flex items-center justify-center flex-shrink-0">
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#0052CC" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <span
                    className="text-sm text-white/70"
                    style={{ fontFamily: "'Instrument Sans', sans-serif" }}
                  >
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right — form */}
          <div
            className="rounded-2xl p-8 border border-white/[0.08] backdrop-blur-xl"
            style={{
              background: "rgba(255,255,255,0.03)",
              boxShadow: "0 25px 80px -12px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)",
            }}
          >
            {submitted ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-brand/20 flex items-center justify-center mx-auto mb-6">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <path d="M5 13l4 4L19 7" stroke="#0052CC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h3
                  className="text-2xl font-semibold text-white"
                  style={{ fontFamily: "'Instrument Sans', sans-serif" }}
                >
                  We&apos;ll be in touch
                </h3>
                <p className="mt-3 text-white/60 text-sm" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
                  Our team will reach out within 24 hours to schedule your demo.
                </p>
              </div>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setSubmitting(true);
                  setError("");
                  const form = e.currentTarget;
                  const data = new FormData(form);
                  try {
                    const res = await fetch("/api/demo-request", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        firstName: data.get("firstName"),
                        lastName: data.get("lastName"),
                        email: data.get("email"),
                        company: data.get("company"),
                        phone: data.get("phone"),
                        sdrCount: data.get("sdrCount"),
                      }),
                    });
                    if (!res.ok) throw new Error();
                    setSubmitted(true);
                  } catch {
                    setError("Something went wrong. Please try again.");
                  } finally {
                    setSubmitting(false);
                  }
                }}
                className="space-y-5"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider"
                      style={{ fontFamily: "'Instrument Sans', sans-serif" }}
                    >
                      First Name
                    </label>
                    <input
                      name="firstName"
                      type="text"
                      required
                      maxLength={100}
                      className="w-full px-4 py-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/25 transition-all"
                      placeholder="John"
                      style={{ fontFamily: "'Instrument Sans', sans-serif" }}
                    />
                  </div>
                  <div>
                    <label
                      className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider"
                      style={{ fontFamily: "'Instrument Sans', sans-serif" }}
                    >
                      Last Name
                    </label>
                    <input
                      name="lastName"
                      type="text"
                      required
                      maxLength={100}
                      className="w-full px-4 py-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/25 transition-all"
                      placeholder="Doe"
                      style={{ fontFamily: "'Instrument Sans', sans-serif" }}
                    />
                  </div>
                </div>

                <div>
                  <label
                    className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider"
                    style={{ fontFamily: "'Instrument Sans', sans-serif" }}
                  >
                    Work Email
                  </label>
                  <input
                    name="email"
                    type="email"
                    required
                    maxLength={255}
                    className="w-full px-4 py-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/25 transition-all"
                    placeholder="john@company.com"
                    style={{ fontFamily: "'Instrument Sans', sans-serif" }}
                  />
                </div>

                <div>
                  <label
                    className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider"
                    style={{ fontFamily: "'Instrument Sans', sans-serif" }}
                  >
                    Company
                  </label>
                  <input
                    name="company"
                    type="text"
                    required
                    maxLength={200}
                    className="w-full px-4 py-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/25 transition-all"
                    placeholder="Acme Corp"
                    style={{ fontFamily: "'Instrument Sans', sans-serif" }}
                  />
                </div>

                <div>
                  <label
                    className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider"
                    style={{ fontFamily: "'Instrument Sans', sans-serif" }}
                  >
                    Phone Number
                  </label>
                  <input
                    name="phone"
                    type="tel"
                    maxLength={30}
                    className="w-full px-4 py-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/25 transition-all"
                    placeholder="+1 (555) 000-0000"
                    style={{ fontFamily: "'Instrument Sans', sans-serif" }}
                  />
                </div>

                <div>
                  <label
                    className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider"
                    style={{ fontFamily: "'Instrument Sans', sans-serif" }}
                  >
                    How many SDRs do you have?
                  </label>
                  <select
                    name="sdrCount"
                    className="w-full px-4 py-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/25 transition-all appearance-none"
                    style={{
                      fontFamily: "'Instrument Sans', sans-serif",
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.4)' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "right 14px center",
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled className="bg-[#111] text-white/50">Select...</option>
                    <option value="0" className="bg-[#111]">No SDRs yet</option>
                    <option value="1-5" className="bg-[#111]">1–5</option>
                    <option value="6-20" className="bg-[#111]">6–20</option>
                    <option value="20+" className="bg-[#111]">20+</option>
                  </select>
                </div>

                {error && (
                  <p className="text-center text-sm text-red-400" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="group w-full flex items-center justify-center gap-3 pl-6 pr-3 py-3.5 rounded-full bg-white text-[#0a0400] font-semibold text-base hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:scale-[1.02] transition-all duration-300 disabled:opacity-60 disabled:pointer-events-none"
                  style={{ fontFamily: "'Instrument Sans', sans-serif" }}
                >
                  {submitting ? "Submitting..." : "Book Your Demo"}
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#0052CC] group-hover:bg-[#003d99] transition-colors duration-200">
                    <ArrowRight className="w-4 h-4 text-white" />
                  </span>
                </button>

                <p
                  className="text-center text-xs text-white/30 mt-3"
                  style={{ fontFamily: "'Instrument Sans', sans-serif" }}
                >
                  No credit card required. Free 15-minute demo.
                </p>
              </form>
            )}
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
}
