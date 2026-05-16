"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

export default function Footer() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <footer ref={ref}>
      <section id="demo" className="relative py-32 px-6">
        <div className="max-w-4xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="text-center glass-card rounded-3xl p-12 md:p-16 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-brand/10 via-transparent to-cyan-500/5" />
            <div className="relative z-10">
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
                Ready to 10x your
                <br />
                <span className="gradient-text">sales pipeline?</span>
              </h2>
              <p className="text-text-secondary text-lg max-w-xl mx-auto mb-10">
                Start your free trial in 2 minutes. No credit card required.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <a
                  href="#pricing"
                  className="px-10 py-4 rounded-xl text-base font-semibold bg-brand text-white hover:bg-brand-light transition-all duration-200 hover:-translate-y-0.5 shadow-[0_0_40px_rgba(37,99,235,0.25)]"
                >
                  Start Free Trial
                </a>
                <a
                  href="mailto:cogniflowautomations@gmail.com"
                  className="px-10 py-4 rounded-xl text-base font-semibold border border-white/[0.08] text-text-primary hover:border-white/[0.15] hover:bg-white/[0.03] transition-all duration-200"
                >
                  Book a Demo
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 pt-8 pb-12 border-t border-white/[0.04] relative z-10">
        <div className="grid md:grid-cols-4 gap-8 mb-12">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-brand/20 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-brand" />
              </div>
              <span className="text-lg font-semibold">Cogniflow</span>
            </div>
            <p className="text-sm text-text-tertiary leading-relaxed">
              AI agents that make and receive calls with human-like conversation.
            </p>
          </div>

          <div>
            <h4 className="text-xs uppercase tracking-wider text-text-tertiary mb-4 font-medium">
              Product
            </h4>
            <ul className="space-y-2.5">
              {["AI Calling Agent", "AI SDR", "Revenue Attribution", "Integrations"].map((link) => (
                <li key={link}>
                  <a href="#product" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs uppercase tracking-wider text-text-tertiary mb-4 font-medium">
              Company
            </h4>
            <ul className="space-y-2.5">
              {["Pricing", "Documentation", "Blog", "Careers"].map((link) => (
                <li key={link}>
                  <a href="#" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs uppercase tracking-wider text-text-tertiary mb-4 font-medium">
              Legal
            </h4>
            <ul className="space-y-2.5">
              {["Privacy Policy", "Terms of Service", "GDPR", "Contact"].map((link) => (
                <li key={link}>
                  <a href="#" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8 border-t border-white/[0.04]">
          <p className="text-xs text-text-tertiary">
            &copy; 2026 Cogniflow Automations. All rights reserved.
          </p>
          <div className="flex items-center gap-1 text-xs text-text-tertiary">
            Made in India
          </div>
        </div>
      </div>
    </footer>
  );
}
