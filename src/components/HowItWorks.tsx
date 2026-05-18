"use client";

import { Plug, Settings, Rocket } from "lucide-react";

const STEPS = [
  {
    icon: Plug,
    step: "01",
    title: "Connect",
    description: "Plug in your phone number and CRM. We support Twilio, Exotel, HubSpot, and Salesforce out of the box.",
  },
  {
    icon: Settings,
    step: "02",
    title: "Configure",
    description: "Choose a pre-built template or build a custom agent with your scripts, objection handling, and booking logic.",
  },
  {
    icon: Rocket,
    step: "03",
    title: "Go Live",
    description: "Your AI agent starts handling calls in minutes. Monitor performance, sentiment, and bookings in real-time.",
  },
];

export default function HowItWorks() {
  return (
    <section className="py-20 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-2xl sm:text-3xl md:text-[40px] font-semibold text-[var(--color-text)] tracking-[-0.01em]">
            Live in 10 minutes
          </h2>
          <p className="mt-4 text-[var(--color-text-muted)] max-w-xl mx-auto">
            Three steps to deploy your AI calling agent.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {STEPS.map(({ icon: Icon, step, title, description }, i) => (
            <div key={step} className="relative text-center">
              {i < 2 && (
                <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-px bg-[var(--color-border)]" />
              )}

              <div className="w-16 h-16 rounded-2xl bg-[var(--color-brand-light)] flex items-center justify-center mx-auto mb-5 relative">
                <Icon size={28} className="text-[var(--color-brand)]" />
                <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[var(--color-brand)] text-white text-xs font-bold flex items-center justify-center">
                  {step}
                </span>
              </div>

              <h3 className="text-lg font-semibold text-[var(--color-text)] mb-2">{title}</h3>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed max-w-xs mx-auto">
                {description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
