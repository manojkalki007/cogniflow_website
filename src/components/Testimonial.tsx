"use client";

import { FadeUp } from "./animations";

export default function Testimonial() {
  return (
    <section className="py-20 px-4 sm:px-6 bg-[var(--color-bg-subtle)]">
      <div className="max-w-3xl mx-auto text-center">
        <FadeUp>
          <blockquote className="text-xl sm:text-2xl md:text-3xl font-medium leading-relaxed text-[var(--color-text)]" style={{ lineHeight: 1.5 }}>
            &ldquo;Every missed call is a missed customer. Cogniflow ensures
            you never miss one — in Hindi, English, Tamil, or any of
            10+ Indian languages.&rdquo;
          </blockquote>
          <div className="mt-6 text-sm text-[var(--color-text-muted)]">
            — Built for Indian businesses, by an Indian team
          </div>
        </FadeUp>
      </div>
    </section>
  );
}
