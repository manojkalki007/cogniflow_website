"use client";

import { Stethoscope, Scissors, Building2, GraduationCap, Landmark, TrendingUp } from "lucide-react";
import { FadeUp, StaggerChildren, StaggerItem } from "./animations";

const CASES = [
  {
    icon: Stethoscope,
    title: "Healthcare & Clinics",
    desc: "Answer patient calls 24/7. Book appointments automatically. Send reminders via WhatsApp. Handle prescription refill requests.",
    tags: ["Appointment Booking", "Patient Reminders", "Hindi + English"],
  },
  {
    icon: Scissors,
    title: "Salons & Spas",
    desc: "AI receptionist handles scheduling while you focus on clients. Manage walk-ins, rebookings, and seasonal promotions effortlessly.",
    tags: ["Auto Scheduling", "Rebooking", "Promotions"],
  },
  {
    icon: Building2,
    title: "Real Estate",
    desc: "Qualify leads instantly, answer property inquiries, and schedule site visits — all without a human agent picking up the phone.",
    tags: ["Lead Qualification", "Site Visits", "Follow-ups"],
  },
  {
    icon: GraduationCap,
    title: "EdTech & Admissions",
    desc: "Handle course inquiries, walk parents through admission processes, and follow up on incomplete applications automatically.",
    tags: ["Admissions", "Course Info", "Multi-language"],
  },
  {
    icon: Landmark,
    title: "Finance & Insurance",
    desc: "KYC verification calls, premium collection reminders, policy inquiries, and claims status updates — compliant and recorded.",
    tags: ["KYC Calls", "Collections", "Compliance"],
  },
  {
    icon: TrendingUp,
    title: "Sales Teams",
    desc: "Outbound SDR at scale. Warm up leads, qualify interest, and book meetings directly into your sales team's calendar.",
    tags: ["Outbound SDR", "Lead Warm-up", "Meeting Booking"],
  },
];

export default function UseCases() {
  return (
    <section className="py-20 px-4 sm:px-6 bg-[var(--color-bg-subtle)]">
      <div className="max-w-6xl mx-auto">
        <FadeUp>
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl md:text-[40px] font-semibold text-[var(--color-text)] tracking-[-0.01em]">
              Built for every industry
            </h2>
            <p className="mt-4 text-[var(--color-text-muted)] max-w-xl mx-auto">
              From healthcare to real estate, AI agents that understand your business.
            </p>
          </div>
        </FadeUp>

        <StaggerChildren className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {CASES.map(({ icon: Icon, title, desc, tags }) => (
            <StaggerItem key={title}>
              <div className="bento-card h-full group">
                <div className="w-10 h-10 rounded-xl bg-[var(--color-brand-light)] flex items-center justify-center mb-4 group-hover:bg-[var(--color-brand)]/20 transition-colors">
                  <Icon size={20} className="text-[var(--color-brand)]" />
                </div>
                <h3 className="text-base font-semibold text-[var(--color-text)] mb-2">{title}</h3>
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-4">{desc}</p>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </StaggerItem>
          ))}
        </StaggerChildren>
      </div>
    </section>
  );
}
