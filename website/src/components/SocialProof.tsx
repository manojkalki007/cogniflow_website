"use client";

import { motion } from "motion/react";
import { Clock, Globe, ShieldCheck } from "lucide-react";

const stats = [
  { icon: Clock, label: "Sub-600ms Latency" },
  { icon: Globe, label: "10+ Languages Supported" },
  { icon: ShieldCheck, label: "Enterprise-Grade Security" },
];

const companies = [
  "Acme Corp",
  "TechFlow",
  "DataSync",
  "CloudBase",
  "NextGen AI",
  "ScaleUp",
];

export default function SocialProof() {
  return (
    <section className="relative w-full overflow-hidden py-20 px-4">
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 25s linear infinite;
        }
        .liquid-glass {
          background: rgba(255, 255, 255, 0.02);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: inset 0 1px 1px rgba(255,255,255,0.06);
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
            rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 30%,
            rgba(255,255,255,0) 50%,
            rgba(255,255,255,0.05) 90%, rgba(255,255,255,0.12) 100%);
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }
      `}</style>

      <div className="relative z-10 flex flex-col items-center">
        {/* Stats row */}
        <motion.div
          className="flex items-center gap-8 md:gap-12 flex-wrap justify-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="flex items-center gap-3">
                <div className="liquid-glass w-10 h-10 rounded-xl flex items-center justify-center">
                  <Icon className="w-4 h-4 text-white/60" />
                </div>
                <span className="text-sm text-white/70 font-medium">
                  {stat.label}
                </span>
              </div>
            );
          })}
        </motion.div>

        {/* Spacer */}
        <div className="h-16" />

        {/* Logo marquee */}
        <div className="w-full max-w-5xl mx-auto">
          <div className="flex items-center gap-12">
            {/* Left text */}
            <span className="text-white/40 text-sm whitespace-nowrap shrink-0">
              Trusted by teams across India &amp; Europe
            </span>

            {/* Right marquee */}
            <div className="relative overflow-hidden flex-1">
              <div className="flex animate-marquee gap-16 items-center">
                {/* First set */}
                {companies.map((company) => (
                  <div
                    key={company}
                    className="shrink-0 flex items-center gap-2"
                  >
                    <div className="liquid-glass w-7 h-7 rounded-lg flex items-center justify-center">
                      <span className="text-xs font-bold text-white/60">
                        {company[0]}
                      </span>
                    </div>
                    <span className="text-sm font-medium whitespace-nowrap text-white/50">
                      {company}
                    </span>
                  </div>
                ))}
                {/* Duplicated set for seamless loop */}
                {companies.map((company) => (
                  <div
                    key={`dup-${company}`}
                    className="shrink-0 flex items-center gap-2"
                  >
                    <div className="liquid-glass w-7 h-7 rounded-lg flex items-center justify-center">
                      <span className="text-xs font-bold text-white/60">
                        {company[0]}
                      </span>
                    </div>
                    <span className="text-sm font-medium whitespace-nowrap text-white/50">
                      {company}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
