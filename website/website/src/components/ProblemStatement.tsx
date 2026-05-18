"use client";

import ScrollReveal from "./ScrollReveal";

export default function ProblemStatement() {
  return (
    <section className="py-20 sm:py-32 px-4 sm:px-6">
      <ScrollReveal>
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight">
            Your leads aren&apos;t waiting.
            <br />
            Neither should you.
          </h2>
          <p className="text-text-secondary text-base sm:text-lg leading-relaxed mt-6 sm:mt-8 max-w-2xl mx-auto">
            Every minute a lead waits, your close rate drops. Your team can&apos;t
            call fast enough. Your outsourced center doesn&apos;t care enough. And
            the leads you worked so hard to generate? They&apos;re going cold.
            Right now.
          </p>
        </div>
      </ScrollReveal>
    </section>
  );
}
