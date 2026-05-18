"use client";

import CogniflowLogo from "./CogniflowLogo";

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:3000";

const PRODUCT_LINKS = [
  { label: "AI Calling Agent", href: "#product" },
  { label: "AI SDR", href: "#product" },
  { label: "Integrations", href: "#features" },
  { label: "Pricing", href: "#pricing" },
];

const COMPANY_LINKS = [
  { label: "About", href: "mailto:cogniflowautomations@gmail.com" },
  { label: "Blog", href: "#" },
  { label: "Careers", href: "mailto:cogniflowautomations@gmail.com" },
  { label: "Contact", href: "mailto:cogniflowautomations@gmail.com" },
];

const LEGAL_LINKS = [
  { label: "Privacy Policy", href: "#" },
  { label: "Terms of Service", href: "#" },
  { label: "GDPR", href: "#" },
];

export default function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 sm:gap-10 mb-10 sm:mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <CogniflowLogo width={120} />
            <p className="text-sm text-text-tertiary leading-relaxed mt-4 max-w-xs">
              AI agents that make and receive calls with human-like conversation. Sub-500ms. 30+ languages.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4
              className="text-xs uppercase tracking-wider text-text-tertiary mb-4 font-semibold"
              style={{ fontFamily: "'Instrument Sans', sans-serif" }}
            >
              Product
            </h4>
            <ul className="space-y-3">
              {PRODUCT_LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-text-secondary hover:text-text-primary transition-colors duration-200"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4
              className="text-xs uppercase tracking-wider text-text-tertiary mb-4 font-semibold"
              style={{ fontFamily: "'Instrument Sans', sans-serif" }}
            >
              Company
            </h4>
            <ul className="space-y-3">
              {COMPANY_LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-text-secondary hover:text-text-primary transition-colors duration-200"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal + CTA */}
          <div>
            <h4
              className="text-xs uppercase tracking-wider text-text-tertiary mb-4 font-semibold"
              style={{ fontFamily: "'Instrument Sans', sans-serif" }}
            >
              Legal
            </h4>
            <ul className="space-y-3 mb-6">
              {LEGAL_LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-text-secondary hover:text-text-primary transition-colors duration-200"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
            <a
              href={`${DASHBOARD_URL}/login`}
              className="inline-flex px-5 py-2.5 min-h-[44px] items-center rounded-full text-sm font-semibold bg-brand text-white hover:bg-brand/90 transition-colors"
            >
              Get Started
            </a>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8 border-t border-border">
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
