"use client";

export default function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          {/* Left - Logo */}
          <div className="flex items-center gap-2">
            <svg width="18" height="20" viewBox="0 0 36 40" fill="none">
              <defs>
                <linearGradient id="footerLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#0a2463" />
                  <stop offset="40%" stopColor="#1a6fb5" />
                  <stop offset="100%" stopColor="#22d3ee" />
                </linearGradient>
              </defs>
              <line x1="21" y1="5" x2="32" y2="5" stroke="url(#footerLogoGrad)" strokeWidth="5" strokeLinecap="round" />
              <line x1="21" y1="5" x2="17" y2="20" stroke="url(#footerLogoGrad)" strokeWidth="5" strokeLinecap="round" />
              <line x1="6" y1="20" x2="17" y2="20" stroke="url(#footerLogoGrad)" strokeWidth="5" strokeLinecap="round" />
              <line x1="17" y1="20" x2="28" y2="20" stroke="url(#footerLogoGrad)" strokeWidth="5" strokeLinecap="round" />
              <line x1="6" y1="20" x2="4" y2="35" stroke="url(#footerLogoGrad)" strokeWidth="5" strokeLinecap="round" />
              <line x1="4" y1="35" x2="15" y2="35" stroke="url(#footerLogoGrad)" strokeWidth="5" strokeLinecap="round" />
              <circle cx="21" cy="5" r="3.5" fill="url(#footerLogoGrad)" />
              <circle cx="32" cy="5" r="3.5" fill="url(#footerLogoGrad)" />
              <circle cx="6" cy="20" r="3.5" fill="url(#footerLogoGrad)" />
              <circle cx="17" cy="20" r="4" fill="url(#footerLogoGrad)" />
              <circle cx="28" cy="20" r="3.5" fill="url(#footerLogoGrad)" />
              <circle cx="4" cy="35" r="3.5" fill="url(#footerLogoGrad)" />
              <circle cx="15" cy="35" r="3.5" fill="url(#footerLogoGrad)" />
            </svg>
            <span className="text-sm font-semibold" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
              <span className="text-white">Cogni</span>
              <span className="text-brand">flow</span>
            </span>
          </div>

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
