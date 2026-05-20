"use client";

import { Phone, Mail, ArrowRight, Bot, Users, Calendar, Headphones, MessageSquare, BarChart3 } from "lucide-react";
import { FadeUp, StaggerChildren, StaggerItem } from "./animations";

const SERVICES = [
  {
    icon: Phone,
    title: "AI Calling Agent",
    description: "Automate inbound & outbound calls with human-like AI agents that never miss a beat.",
    useCases: [
      { icon: Headphones, label: "AI Receptionist" },
      { icon: Calendar, label: "Appointment Booking" },
      { icon: Users, label: "Lead Qualification" },
    ],
    color: "var(--color-brand)",
    lightBg: "var(--color-brand-light)",
    href: "#features",
  },
  {
    icon: Mail,
    title: "AI SDR",
    description: "Qualify leads & book meetings on autopilot with multi-channel AI outreach.",
    useCases: [
      { icon: Bot, label: "Outbound Sales" },
      { icon: MessageSquare, label: "WhatsApp Follow-up" },
      { icon: BarChart3, label: "Revenue Attribution" },
    ],
    color: "#7C3AED",
    lightBg: "#F3E8FF",
    href: "#features",
  },
];

export default function TwoServices() {
  const handleScroll = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    document.querySelector(href)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section id="product" className="py-20 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <FadeUp>
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl md:text-[40px] font-semibold text-[var(--color-text)] tracking-[-0.01em]">
              Two powerful services, one platform
            </h2>
            <p className="mt-4 text-[var(--color-text-muted)] max-w-xl mx-auto">
              Whether it&apos;s voice calls or email outreach, Cogniflow handles your sales pipeline end-to-end.
            </p>
          </div>
        </FadeUp>

        <StaggerChildren className="grid md:grid-cols-2 gap-6">
          {SERVICES.map((service) => (
            <StaggerItem key={service.title}>
              <div className="bento-card group h-full">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-transform group-hover:scale-110"
                  style={{ background: service.lightBg }}
                >
                  <service.icon size={24} style={{ color: service.color }} />
                </div>

                <h3 className="text-xl font-semibold text-[var(--color-text)] mb-2">
                  {service.title}
                </h3>
                <p className="text-[var(--color-text-muted)] text-sm leading-relaxed mb-6">
                  {service.description}
                </p>

                <div className="flex flex-wrap gap-3 mb-6">
                  {service.useCases.map(({ icon: Icon, label }) => (
                    <div
                      key={label}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--color-bg-subtle)] text-sm text-[var(--color-text-muted)]"
                    >
                      <Icon size={14} />
                      {label}
                    </div>
                  ))}
                </div>

                <a
                  href={service.href}
                  onClick={(e) => handleScroll(e, service.href)}
                  className="inline-flex items-center gap-2 text-sm font-medium transition-colors"
                  style={{ color: service.color }}
                >
                  Learn More <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </a>
              </div>
            </StaggerItem>
          ))}
        </StaggerChildren>
      </div>
    </section>
  );
}
