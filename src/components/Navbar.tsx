"use client";

import { useState, useEffect } from "react";
import CogniflowLogo from "./CogniflowLogo";
import { ChevronDown, Menu, X } from "lucide-react";

const NAV_LINKS = [
  {
    label: "Product",
    href: "#product",
    dropdown: [
      { label: "AI Calling Agent", href: "#calling-agent", desc: "Automate inbound & outbound calls" },
      { label: "AI SDR", href: "#ai-sdr", desc: "Qualify leads & book meetings on autopilot" },
    ],
  },
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  {
    label: "Resources",
    href: "#features",
    dropdown: [
      { label: "Book a Demo", href: "/book-call", desc: "See Cogniflow in action — live call demo" },
      { label: "Contact Us", href: "/contact", desc: "Questions? We're here to help" },
    ],
  },
];

const LOGIN_URL = "/login";
const SIGNUP_URL = "/signup";

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const handleSmoothScroll = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith("#") && href.length > 1) {
      e.preventDefault();
      const el = document.querySelector(href);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      setMobileOpen(false);
    }
  };

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? "bg-white/95 backdrop-blur-md shadow-sm border-b border-[var(--color-border)]" : "bg-transparent"
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <a href="#" className="flex items-center">
            <CogniflowLogo width={44} variant="dark" />
          </a>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <div
                key={link.label}
                className="relative"
                onMouseEnter={() => link.dropdown && setOpenDropdown(link.label)}
                onMouseLeave={() => setOpenDropdown(null)}
              >
                <a
                  href={link.href}
                  onClick={(e) => handleSmoothScroll(e, link.href)}
                  className="flex items-center gap-1 px-3 py-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                >
                  {link.label}
                  {link.dropdown && <ChevronDown size={14} />}
                </a>

                {link.dropdown && openDropdown === link.label && (
                  <div className="absolute top-full left-0 pt-2 w-64">
                    <div className="bg-white rounded-xl border border-[var(--color-border)] shadow-lg p-2">
                      {link.dropdown.map((item) => (
                        <a
                          key={item.label}
                          href={item.href}
                          onClick={(e) => handleSmoothScroll(e, item.href)}
                          className="block px-3 py-2.5 rounded-lg hover:bg-[var(--color-bg-subtle)] transition-colors"
                        >
                          <div className="text-sm font-medium text-[var(--color-text)]">{item.label}</div>
                          <div className="text-xs text-[var(--color-text-light)] mt-0.5">{item.desc}</div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <a
              href={LOGIN_URL}
              className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            >
              Login
            </a>
            <a href={SIGNUP_URL} className="btn-primary text-sm !py-2.5 !px-5">
              Get Started
            </a>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[60] bg-white flex flex-col pt-20 px-6">
          <button
            onClick={() => setMobileOpen(false)}
            className="absolute top-4 right-4 p-2 text-[var(--color-text-muted)]"
            aria-label="Close"
          >
            <X size={24} />
          </button>

          <div className="flex flex-col gap-2">
            {NAV_LINKS.map((link) => (
              <div key={link.label}>
                <a
                  href={link.href}
                  onClick={(e) => { if (!link.dropdown) handleSmoothScroll(e, link.href); }}
                  className="block py-3 text-lg font-medium text-[var(--color-text)]"
                >
                  {link.label}
                </a>
                {link.dropdown && (
                  <div className="pl-4 pb-2">
                    {link.dropdown.map((item) => (
                      <a
                        key={item.label}
                        href={item.href}
                        onClick={(e) => handleSmoothScroll(e, item.href)}
                        className="block py-2 text-sm text-[var(--color-text-muted)]"
                      >
                        {item.label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-3">
            <a href={SIGNUP_URL} className="btn-primary text-center justify-center">
              Get Started
            </a>
            <a href={LOGIN_URL} className="btn-ghost text-center justify-center">
              Login
            </a>
          </div>
        </div>
      )}
    </>
  );
}
