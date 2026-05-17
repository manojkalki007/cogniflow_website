"use client";

import ScrollReveal from "./ScrollReveal";

const STEPS = [
  {
    number: "01",
    title: "Connect",
    description:
      "Plug in your phone number, CRM, and contacts.",
  },
  {
    number: "02",
    title: "Train",
    description:
      "Tell your agent what to say, who to call, and how to qualify.",
  },
  {
    number: "03",
    title: "Watch",
    description:
      "Your AI agent calls, emails, and follows up. You book the meetings it sets.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="max-w-5xl mx-auto py-32 px-6">
      <ScrollReveal>
        <div className="text-center mb-16">
          <p className="text-xs uppercase tracking-widest text-brand font-mono mb-4">
            Setup
          </p>
          <h2 className="text-4xl md:text-5xl font-bold text-text-primary">
            Live in under 10 minutes
          </h2>
        </div>
      </ScrollReveal>

      <div className="relative">
        {/* Connecting line on desktop */}
        <div className="hidden md:block absolute top-16 left-[calc(16.67%+32px)] right-[calc(16.67%+32px)] z-0">
          <div className="relative h-px w-full">
            <div className="absolute inset-0 bg-border" />
            {/* Dots at connection points */}
            <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-border" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-border" />
            <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-border" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
          {STEPS.map((step, i) => (
            <ScrollReveal key={step.number} delay={i * 0.15}>
              <div className="bg-glass border border-glass-border rounded-2xl p-8">
                <span className="text-5xl font-bold font-mono text-brand/20">
                  {step.number}
                </span>
                <h3 className="text-xl font-semibold text-text-primary mt-4">
                  {step.title}
                </h3>
                <p className="text-sm text-text-secondary mt-2 leading-relaxed">
                  {step.description}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
