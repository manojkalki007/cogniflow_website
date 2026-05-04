"use client";

import CogniflowLogo from "./CogniflowLogo";

export default function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          {/* Left - Logo */}
          <CogniflowLogo width={120} />

          {/* Center - Links */}
          <nav className="flex items-center gap-6">
            {["Privacy", "Terms", "Contact"].map((link) => (
              <a
                key={link}
                href="#"
                className="text-sm text-text-tertiary hover:text-text-primary transition-colors duration-200"
              >
                {link}
              </a>
            ))}
          </nav>

          {/* Right - Copyright */}
          <p className="text-xs text-text-tertiary">
            &copy; 2026 Cogniflow Automations
          </p>
        </div>
      </div>
    </footer>
  );
}
