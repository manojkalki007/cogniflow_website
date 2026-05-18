"use client";

import { Stethoscope, Scissors, Building2, GraduationCap, Landmark, TrendingUp } from "lucide-react";

const CASES = [
  { icon: Stethoscope, title: "Healthcare & Clinics", desc: "Appointment booking, reminders, and patient follow-ups" },
  { icon: Scissors, title: "Salons & Spas", desc: "AI receptionist handles scheduling while you focus on clients" },
  { icon: Building2, title: "Real Estate", desc: "Lead qualification, property inquiries, and site visit scheduling" },
  { icon: GraduationCap, title: "EdTech", desc: "Course inquiries, admissions, and student onboarding calls" },
  { icon: Landmark, title: "Finance & NBFC", desc: "KYC verification, collections follow-up, and loan inquiries" },
  { icon: TrendingUp, title: "Sales Teams", desc: "Outbound SDR, lead warm-up, and meeting booking at scale" },
];

export default function UseCases() {
  return (
    <section className="py-20 px-4 sm:px-6 bg-[var(--color-bg-subtle)]">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-2xl sm:text-3xl md:text-[40px] font-semibold text-[var(--color-text)] tracking-[-0.01em]">
            Built for every industry
          </h2>
          <p className="mt-4 text-[var(--color-text-muted)] max-w-xl mx-auto">
            From healthcare to real estate, AI agents that understand your business.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {CASES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bento-card flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-brand-light)] flex items-center justify-center flex-shrink-0">
                <Icon size={20} className="text-[var(--color-brand)]" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-[var(--color-text)] mb-1">{title}</h3>
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
