"use client";

import { motion } from "framer-motion";
import {
  Zap,
  Brain,
  MessageSquare,
  Clock,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import ScrollReveal from "./ScrollReveal";

const FEATURES = [
  {
    icon: Zap,
    title: "<500ms Response",
    copy: "Faster than your best rep's first breath.",
  },
  {
    icon: Brain,
    title: "Sentiment Analysis",
    copy: "Reads the room. Adjusts in real time.",
  },
  {
    icon: MessageSquare,
    title: "Multi-Channel",
    copy: "Calls. Emails. WhatsApp. One agent.",
  },
  {
    icon: Clock,
    title: "Always On",
    copy: "No sick days. No missed shifts. No dropped leads.",
  },
  {
    icon: TrendingUp,
    title: "Scales Instantly",
    copy: "Handle 10 calls or 10,000. Same quality.",
  },
  {
    icon: Sparkles,
    title: "Agent Intelligence",
    copy: "Not a script reader. A thinker.",
  },
];

export default function FeatureGrid() {
  return (
    <section className="max-w-7xl mx-auto py-32 px-6">
      <ScrollReveal>
        <h2 className="text-4xl md:text-5xl font-bold text-text-primary text-center mb-16">
          Built different
        </h2>
      </ScrollReveal>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {FEATURES.map((feature, i) => (
          <ScrollReveal key={feature.title} delay={i * 0.1}>
            <motion.div
              whileHover={{ y: -2 }}
              transition={{ duration: 0.2 }}
              className="bg-glass border border-glass-border rounded-2xl p-8 hover:border-brand-glow transition-colors duration-300 h-full"
            >
              <feature.icon size={24} className="text-brand/60" />
              <h3 className="text-lg font-semibold text-text-primary mt-4">
                {feature.title}
              </h3>
              <p className="text-sm text-text-secondary mt-2">
                {feature.copy}
              </p>
            </motion.div>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
