"use client";

import CogniflowLogo from "./CogniflowLogo";

const FOOTER_LINKS = {
  Product: [
    { label: "AI Calling Agent", href: "#calling-agent" },
    { label: "AI SDR", href: "#ai-sdr" },
    { label: "Pricing", href: "#pricing" },
    { label: "Features", href: "#features" },
  ],
  Company: [
    { label: "About", href: "#" },
    { label: "Blog", href: "#" },
    { label: "Contact", href: "mailto:cogniflowautomations@gmail.com" },
  ],
  Legal: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
  ],
};

export default function Footer() {
  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="col-span-2">
            <CogniflowLogo width={130} variant="dark" />
            <p className="mt-4 text-sm text-[var(--color-text-muted)] max-w-xs leading-relaxed">
              AI voice agents for appointment booking, lead qualification, and sales outreach. Made in India.
            </p>
          </div>

          {/* Link groups */}
          {Object.entries(FOOTER_LINKS).map(([group, links]) => (
            <div key={group}>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-light)] mb-4">
                {group}
              </h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-[var(--color-border)] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-[var(--color-text-light)]">
            &copy; 2026 Cogniflow Automations. All rights reserved.
          </p>
          <p className="text-xs text-[var(--color-text-light)]">
            Made in India
          </p>
        </div>
      </div>
    </footer>
  );
}
