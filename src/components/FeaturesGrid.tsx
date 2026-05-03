"use client";

import ScrollReveal from "./ScrollReveal";
import TiltCard from "./TiltCard";
import { Activity, Globe, MessageCircle, Database, Shield, Copy } from "lucide-react";

const FEATURES = [
  {
    icon: Activity,
    title: "Sub-500ms Latency",
    description: "Semantic turn detection, speculative pre-generation, and co-located inference.",
    color: "text-brand",
    bg: "bg-brand/10",
  },
  {
    icon: Globe,
    title: "30+ Languages",
    description: "English, Hindi, Tamil, Telugu, and 26 more. Mid-conversation language switching.",
    color: "text-cyan-400",
    bg: "bg-cyan-400/10",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp Handoff",
    description: "Send documents, payment links, and confirmations to WhatsApp mid-call.",
    color: "text-green-400",
    bg: "bg-green-400/10",
  },
  {
    icon: Database,
    title: "CRM Integration",
    description: "Salesforce, HubSpot, Zoho. Auto-log calls, update deals, sync contacts.",
    color: "text-purple-400",
    bg: "bg-purple-400/10",
  },
  {
    icon: Shield,
    title: "Compliance Guardrails",
    description: "PCI, HIPAA, GDPR. Auto-redact PII. Block prompt injection.",
    color: "text-accent",
    bg: "bg-accent/10",
  },
  {
    icon: Copy,
    title: "Agent Cloning",
    description: "Clone your best agent's style from 20 call recordings. No fine-tuning needed.",
    color: "text-pink-400",
    bg: "bg-pink-400/10",
  },
];

export default function FeaturesGrid() {
  return (
    <section id="features" className="relative py-32 px-6">
      <div className="max-w-6xl mx-auto relative z-10">
        <ScrollReveal className="text-center mb-16">
          <p className="text-xs uppercase tracking-[0.2em] text-text-secondary mb-4">
            Everything You Need
          </p>
          <h2 className="text-4xl md:text-5xl font-semibold tracking-[-0.02em]">
            Built for <span className="gradient-text">enterprise scale</span>
          </h2>
        </ScrollReveal>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((feature, i) => (
            <ScrollReveal key={feature.title} delay={0.1 * i}>
              <TiltCard className="rounded-2xl p-8 hover:-translate-y-1 transition-transform duration-300 h-full">
                <div className={`w-12 h-12 rounded-xl ${feature.bg} flex items-center justify-center mb-5`}>
                  <feature.icon className={`w-5 h-5 ${feature.color}`} />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {feature.description}
                </p>
              </TiltCard>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
