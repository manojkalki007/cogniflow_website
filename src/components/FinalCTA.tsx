"use client";

import { ArrowRight } from "lucide-react";
import { FadeUp } from "./animations";

const SIGNUP_URL = "/signup";
const CAL_LINK = "https://cal.com/kalki-111/book-a-call";

export default function FinalCTA() {
  return (
    <section className="py-20 px-4 sm:px-6 dark-section">
      <div className="max-w-3xl mx-auto text-center">
        <FadeUp>
          <h2 className="text-2xl sm:text-3xl md:text-[40px] font-semibold tracking-[-0.01em]">
            Ready to automate your calls?
          </h2>
          <p className="mt-4 text-white/60 max-w-lg mx-auto">
            Deploy your AI calling agent in 10 minutes. No credit card required. 7-day free trial.
          </p>

          <div className="flex items-center justify-center gap-4 mt-8 flex-wrap">
            <a
              href={SIGNUP_URL}
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-[var(--color-brand)] text-white font-medium text-base hover:bg-[var(--color-brand-dark)] transition-all hover:shadow-lg hover:shadow-[var(--color-brand)]/25"
            >
              Get Started — Free for 7 days <ArrowRight size={16} />
            </a>
            <a
              href={CAL_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl border border-white/20 text-white/80 font-medium text-base hover:bg-white/5 transition-all"
            >
              Book a Demo
            </a>
          </div>
        </FadeUp>
      </div>
    </section>
  );
}
