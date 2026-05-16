"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Phone, Cpu, Zap } from "lucide-react";

const STEPS = [
  {
    number: "01",
    icon: Phone,
    title: "Connect Your Phone Number",
    description: "Buy a number or bring your own. Connect via Twilio, Telnyx, or Exotel.",
    color: "text-brand",
    bg: "bg-brand/10",
    border: "border-brand/20",
  },
  {
    number: "02",
    icon: Cpu,
    title: "Configure Your AI Agent",
    description: "Set your agent's personality, knowledge base, and tools. Or clone your best human agent from recordings.",
    color: "text-cyan-400",
    bg: "bg-cyan-400/10",
    border: "border-cyan-400/20",
  },
  {
    number: "03",
    icon: Zap,
    title: "Go Live in Minutes",
    description: "Your AI starts taking calls immediately. Monitor sentiment, track revenue, and scale to thousands of concurrent calls.",
    color: "text-accent",
    bg: "bg-accent/10",
    border: "border-accent/20",
  },
];

export default function HowItWorks() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="how-it-works" className="relative py-32 px-6" ref={ref}>
      <div className="max-w-6xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-20"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-text-secondary mb-4">
            How It Works
          </p>
          <h2 className="text-4xl md:text-5xl font-semibold tracking-[-0.02em]">
            Live in <span className="gradient-text">three steps</span>
          </h2>
        </motion.div>

        <div className="relative">
          <div className="hidden md:block absolute top-24 left-[16.67%] right-[16.67%] h-px">
            <motion.div
              initial={{ scaleX: 0 }}
              animate={isInView ? { scaleX: 1 } : {}}
              transition={{ duration: 1.2, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="w-full h-full bg-gradient-to-r from-brand via-cyan-400 to-accent origin-left"
            />
          </div>

          <div className="grid md:grid-cols-3 gap-8 md:gap-12">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 40 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{
                  duration: 0.7,
                  delay: 0.3 + i * 0.2,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="text-center relative"
              >
                <div className={`w-14 h-14 rounded-2xl ${step.bg} border ${step.border} flex items-center justify-center mx-auto mb-6 relative z-10`}>
                  <step.icon className={`w-6 h-6 ${step.color}`} />
                </div>

                <span className={`text-xs font-mono ${step.color} mb-3 block`}>
                  Step {step.number}
                </span>

                <h3 className="text-lg font-semibold mb-3">{step.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed max-w-xs mx-auto">
                  {step.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
