"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const NAV_LINKS = [
  { label: "Product", href: "#product" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "FAQ", href: "#faq" },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  return (
    <>
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled
            ? "bg-[#0A0A0C]/80 backdrop-blur-xl border-b border-white/[0.06]"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="#" className="flex items-center gap-2.5">
            <svg width="30" height="34" viewBox="0 0 36 40" fill="none">
              <defs>
                <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#0a2463" />
                  <stop offset="40%" stopColor="#1a6fb5" />
                  <stop offset="100%" stopColor="#22d3ee" />
                </linearGradient>
              </defs>
              <line x1="21" y1="5" x2="32" y2="5" stroke="url(#logoGrad)" strokeWidth="5" strokeLinecap="round" />
              <line x1="21" y1="5" x2="17" y2="20" stroke="url(#logoGrad)" strokeWidth="5" strokeLinecap="round" />
              <line x1="6" y1="20" x2="17" y2="20" stroke="url(#logoGrad)" strokeWidth="5" strokeLinecap="round" />
              <line x1="17" y1="20" x2="28" y2="20" stroke="url(#logoGrad)" strokeWidth="5" strokeLinecap="round" />
              <line x1="6" y1="20" x2="4" y2="35" stroke="url(#logoGrad)" strokeWidth="5" strokeLinecap="round" />
              <line x1="4" y1="35" x2="15" y2="35" stroke="url(#logoGrad)" strokeWidth="5" strokeLinecap="round" />
              <circle cx="21" cy="5" r="3.5" fill="url(#logoGrad)" />
              <circle cx="32" cy="5" r="3.5" fill="url(#logoGrad)" />
              <circle cx="6" cy="20" r="3.5" fill="url(#logoGrad)" />
              <circle cx="17" cy="20" r="4" fill="url(#logoGrad)" />
              <circle cx="28" cy="20" r="3.5" fill="url(#logoGrad)" />
              <circle cx="4" cy="35" r="3.5" fill="url(#logoGrad)" />
              <circle cx="15" cy="35" r="3.5" fill="url(#logoGrad)" />
            </svg>
            <span
              className="text-lg font-semibold tracking-tight"
              style={{ fontFamily: "'Instrument Sans', sans-serif" }}
            >
              <span className="text-white">Cogni</span>
              <span className="text-brand">flow</span>
            </span>
          </a>

          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm font-medium text-white/80 hover:text-white transition-colors duration-300"
                style={{ fontFamily: "'Instrument Sans', sans-serif" }}
              >
                {link.label}
              </a>
            ))}
          </div>

          <a
            href="#book-demo"
            className="hidden md:inline-flex px-5 py-2.5 rounded-full text-sm font-semibold bg-white text-black hover:shadow-[0_0_15px_rgba(255,255,255,0.3)] transition-all duration-200"
            style={{ fontFamily: "'Instrument Sans', sans-serif" }}
          >
            Book a Demo
          </a>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-text-tertiary hover:text-text-primary transition-colors"
            aria-label="Toggle menu"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              {mobileOpen ? (
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" />
              ) : (
                <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.5" />
              )}
            </svg>
          </button>
        </div>
      </motion.nav>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[60] bg-bg-primary/95 backdrop-blur-xl flex flex-col items-center justify-center gap-8"
          >
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-5 right-6 p-2 text-text-tertiary hover:text-text-primary"
              aria-label="Close menu"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="text-2xl font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                {link.label}
              </a>
            ))}
            <a
              href="#book-demo"
              onClick={() => setMobileOpen(false)}
              className="px-8 py-3 rounded-lg text-base font-medium bg-brand text-white"
            >
              Book a Demo
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
