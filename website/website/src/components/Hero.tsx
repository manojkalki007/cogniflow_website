"use client";

import { motion } from "framer-motion";

const ease = [0.16, 1, 0.3, 1] as const;

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center px-6">
      <div className="max-w-5xl mx-auto text-center relative z-10">
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease }}
          className="text-xs uppercase tracking-[0.2em] text-text-secondary mb-8 font-medium"
        >
          AI Calling Agent & AI SDR Platform
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.35, ease }}
          className="text-5xl md:text-7xl lg:text-[5.5rem] font-bold tracking-[-0.03em] leading-[1.05] mb-6"
        >
          Your AI Sales Team
          <br />
          <span className="gradient-text">That Never Sleeps</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5, ease }}
          className="text-lg md:text-xl text-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          Cogniflow makes and receives calls, qualifies leads, books meetings,
          and closes deals — with sub-500ms response time across 30+ languages.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.65, ease }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
        >
          <a
            href="#pricing"
            className="px-8 py-3.5 rounded-xl text-sm font-semibold bg-brand text-white hover:bg-brand-light transition-all duration-200 hover:-translate-y-0.5 shadow-[0_0_30px_rgba(37,99,235,0.2)]"
          >
            Start Free Trial
          </a>
          <a
            href="#demo"
            className="px-8 py-3.5 rounded-xl text-sm font-semibold border border-white/[0.08] text-text-primary hover:border-white/[0.15] hover:bg-white/[0.03] transition-all duration-200 flex items-center gap-2"
          >
            Watch Demo
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8, ease }}
          className="flex flex-col items-center gap-4"
        >
          <p className="text-xs text-text-tertiary uppercase tracking-wider">
            Trusted by 200+ companies
          </p>
          <div className="flex items-center gap-8 opacity-40">
            {["Freshworks", "Zoho", "Razorpay", "Chargebee", "Leadsquared"].map((name) => (
              <span key={name} className="text-sm font-medium text-text-secondary tracking-wide">
                {name}
              </span>
            ))}
          </div>
        </motion.div>
      </div>

      <div className="absolute bottom-12 left-1/2 -translate-x-1/2">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1 }}
          className="flex flex-col items-center gap-2"
        >
          <span className="text-xs text-text-tertiary tracking-widest uppercase">Scroll</span>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
            className="w-5 h-8 rounded-full border border-white/[0.1] flex items-start justify-center p-1.5"
          >
            <div className="w-1 h-1.5 rounded-full bg-brand/60" />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
