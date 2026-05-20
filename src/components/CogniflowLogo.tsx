"use client";

interface CogniflowLogoProps {
  width?: number;
  className?: string;
  variant?: "light" | "dark";
  showText?: boolean;
}

export function CogniflowIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cogni-grad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0A2472" />
          <stop offset="50%" stopColor="#1a3a8f" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      {/* Center node */}
      <circle cx="20" cy="20" r="4.5" fill="url(#cogni-grad)" />
      {/* Top node */}
      <circle cx="20" cy="7" r="3.5" fill="url(#cogni-grad)" />
      {/* Top-right node */}
      <circle cx="31" cy="13" r="3.5" fill="url(#cogni-grad)" />
      {/* Bottom-right node */}
      <circle cx="31" cy="27" r="3.5" fill="url(#cogni-grad)" />
      {/* Bottom node */}
      <circle cx="20" cy="33" r="3.5" fill="url(#cogni-grad)" />
      {/* Left node */}
      <circle cx="9" cy="20" r="3.5" fill="url(#cogni-grad)" />
      {/* Connecting bridges */}
      <line x1="20" y1="10.5" x2="20" y2="15.5" stroke="url(#cogni-grad)" strokeWidth="3" strokeLinecap="round" />
      <line x1="28" y1="15" x2="24" y2="18" stroke="url(#cogni-grad)" strokeWidth="3" strokeLinecap="round" />
      <line x1="28" y1="25" x2="24" y2="22" stroke="url(#cogni-grad)" strokeWidth="3" strokeLinecap="round" />
      <line x1="20" y1="24.5" x2="20" y2="29.5" stroke="url(#cogni-grad)" strokeWidth="3" strokeLinecap="round" />
      <line x1="12.5" y1="20" x2="15.5" y2="20" stroke="url(#cogni-grad)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export default function CogniflowLogo({
  width = 32,
  className = "",
  variant = "dark",
  showText = true,
}: CogniflowLogoProps) {
  const textColor = variant === "light" ? "#FFFFFF" : "#0F172A";

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <CogniflowIcon size={width} />
      {showText && (
        <span
          style={{
            fontSize: Math.max(16, width * 0.55),
            fontWeight: 700,
            color: textColor,
            letterSpacing: "-0.02em",
            lineHeight: 1,
          }}
        >
          Cogniflow
        </span>
      )}
    </span>
  );
}
