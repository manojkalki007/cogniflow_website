"use client";

import { motion } from "motion/react";
import Link from "next/link";

const ease = [0.16, 1, 0.3, 1] as const;

export default function Hero() {
  return (
    <>
      <style>{`
        .liquid-glass {
          background: rgba(255, 255, 255, 0.02);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.06);
          position: relative;
          overflow: hidden;
        }
        .liquid-glass::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 1.4px;
          background: linear-gradient(180deg,
            rgba(255, 255, 255, 0.15) 0%,
            rgba(255, 255, 255, 0.05) 30%,
            rgba(255, 255, 255, 0) 50%,
            rgba(255, 255, 255, 0.05) 90%,
            rgba(255, 255, 255, 0.12) 100%);
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }
      `}</style>

      <section
        className="relative w-full min-h-screen flex flex-col items-center justify-center overflow-hidden"
        style={{ backgroundColor: "#050510" }}
      >
        {/* Gradient orbs */}
        <div
          className="absolute top-[-100px] right-[-100px] w-[600px] h-[600px] rounded-full bg-[#0052CC]/20 pointer-events-none"
          style={{ filter: "blur(120px)" }}
        />
        <div
          className="absolute bottom-[-80px] left-[-80px] w-[500px] h-[500px] rounded-full bg-[#00B4D8]/15 pointer-events-none"
          style={{ filter: "blur(100px)" }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center px-6">
          {/* Badge pill */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0, duration: 0.6, ease }}
            className="mb-8"
          >
            <div className="liquid-glass rounded-full px-4 py-1.5">
              <span className="text-xs text-white/70">
                ✨ Now with Multi-Language AI Agents
              </span>
            </div>
          </motion.div>

          {/* Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.6, ease }}
            className="text-5xl md:text-6xl lg:text-7xl font-semibold text-white text-center leading-[1.05] tracking-tight max-w-4xl"
          >
            AI Voice Agents That
            <br />
            <span className="italic text-[#00B4D8]">Close</span> Deals For You
          </motion.h1>

          {/* Subheading */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6, ease }}
            className="text-lg text-white/60 text-center max-w-xl mt-5 leading-relaxed"
          >
            Deploy autonomous AI calling agents that qualify leads, handle
            objections, and book meetings 24/7 — with sub-600ms response time.
          </motion.p>

          {/* CTA buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6, ease }}
            className="flex items-center gap-4 mt-8"
          >
            <a
              href="https://cogniflowautomations.com/login"
              className="rounded-full px-7 py-3.5 bg-[#0052CC] text-white text-sm font-medium hover:bg-[#003d99] transition-colors"
            >
              Start Free Trial
            </a>
            <Link
              href="/book-call"
              className="liquid-glass rounded-full px-7 py-3.5 text-white/90 text-sm hover:bg-white/5 transition-colors"
            >
              Book a Demo
            </Link>
          </motion.div>

          {/* Dashboard preview */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.8, ease }}
            className="mt-16 w-full max-w-5xl mx-auto px-4"
          >
            <div className="liquid-glass rounded-2xl p-3 md:p-4">
              <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] aspect-[16/9] flex items-center justify-center">
                <span className="text-white/20 text-lg">
                  Dashboard Preview
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  );
}
