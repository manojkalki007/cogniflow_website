"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import CogniflowLogo from "./CogniflowLogo";

const NAV_LINKS = [
  { label: "Product", href: "#product" },
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "Resources", href: "#resources" },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <>
      <style>{`
        .liquid-glass {
          background: rgba(255, 255, 255, 0.02);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
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
            rgba(255,255,255,0) 50%, rgba(255,255,255,0) 70%,
            rgba(255,255,255,0.05) 90%, rgba(255,255,255,0.12) 100%);
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }
        .liquid-glass-scrolled {
          background: rgba(0, 0, 0, 0.60);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
        }
      `}</style>

      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="fixed top-5 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-[900px]"
      >
        <div
          className={`liquid-glass rounded-3xl p-2.5 transition-all duration-500 ${
            scrolled ? "liquid-glass-scrolled" : ""
          }`}
        >
          <div className="flex items-center justify-between">
            {/* Left: Logo */}
            <a href="#" className="flex items-center pl-2">
              <CogniflowLogo width={130} />
            </a>

            {/* Center: Nav links (hidden on mobile) */}
            <div className="hidden md:flex items-center gap-1">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="px-3 py-2 text-sm text-white/80 hover:text-white transition-colors duration-200"
                >
                  {link.label}
                </a>
              ))}
            </div>

            {/* Right: Login + Get Started + Hamburger */}
            <div className="flex items-center gap-3">
              <a
                href="https://cogniflowautomations.com/login"
                className="hidden md:block text-sm text-white/80 hover:text-white transition-colors duration-200"
              >
                Login
              </a>
              <a
                href="https://cogniflowautomations.com/login"
                className="hidden sm:block rounded-xl px-5 py-2 bg-[#0052CC] text-white text-sm font-medium hover:bg-[#003d99] transition-colors duration-200"
              >
                Get Started
              </a>

              {/* Hamburger (mobile only) */}
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="md:hidden p-2 text-white/60 hover:text-white transition-colors"
                aria-label="Toggle menu"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  {mobileOpen ? (
                    <path
                      d="M5 5l10 10M15 5L5 15"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                  ) : (
                    <path
                      d="M3 6h14M3 10h14M3 14h14"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Mobile full-screen overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center gap-8"
          >
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-5 right-6 p-2 text-white/60 hover:text-white"
              aria-label="Close menu"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              </svg>
            </button>

            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="text-2xl font-medium text-white/70 hover:text-white transition-colors"
              >
                {link.label}
              </a>
            ))}

            <a
              href="https://cogniflowautomations.com/login"
              onClick={() => setMobileOpen(false)}
              className="text-2xl font-medium text-white/70 hover:text-white transition-colors"
            >
              Login
            </a>

            <a
              href="https://cogniflowautomations.com/login"
              onClick={() => setMobileOpen(false)}
              className="px-8 py-3 rounded-xl text-base font-medium bg-[#0052CC] text-white hover:bg-[#003d99] transition-colors"
            >
              Get Started
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
