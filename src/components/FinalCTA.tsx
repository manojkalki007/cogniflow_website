"use client";

import { ArrowRight } from "lucide-react";

const SIGNUP_URL = "https://cogniflowautomations.com/login?mode=signup";

export default function FinalCTA() {
  return (
    <section className="py-20 px-4 sm:px-6 dark-section">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-2xl sm:text-3xl md:text-[40px] font-semibold tracking-[-0.01em]">
          Ready to automate your calls?
        </h2>
        <p className="mt-4 text-white/60 max-w-lg mx-auto">
          Deploy your AI calling agent in 10 minutes. No credit card required. 7-day free trial.
        </p>

        <div className="flex items-center justify-center gap-4 mt-8 flex-wrap">
          <a
            href={SIGNUP_URL}
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-[var(--color-brand)] text-white font-medium text-base hover:bg-[var(--color-brand-dark)] transition-all"
          >
            Get Started — Free for 7 days <ArrowRight size={16} />
          </a>
          <a
            href="#demo"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl border border-white/20 text-white/80 font-medium text-base hover:bg-white/5 transition-all"
          >
            Book a Demo
          </a>
        </div>
      </div>
    </section>
  );
}
