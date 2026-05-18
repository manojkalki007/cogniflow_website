"use client";

interface CogniflowLogoProps {
  width?: number;
  className?: string;
  variant?: "light" | "dark";
}

export default function CogniflowLogo({
  width = 160,
  className = "",
  variant = "light",
}: CogniflowLogoProps) {
  const textColor = variant === "light" ? "#FAFAFA" : "#0F172A";

  return (
    <svg
      width={width}
      height={width * 0.28}
      viewBox="0 0 200 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="logo-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1a3a8f" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>

      {/* Mark: connected nodes */}
      <circle cx="12" cy="20" r="4" fill="url(#logo-grad)" />
      <circle cx="28" cy="12" r="3.5" fill="url(#logo-grad)" />
      <circle cx="28" cy="30" r="3.5" fill="url(#logo-grad)" />
      <circle cx="42" cy="18" r="4" fill="url(#logo-grad)" />
      <circle cx="36" cy="38" r="3" fill="url(#logo-grad)" />

      <line x1="12" y1="20" x2="28" y2="12" stroke="url(#logo-grad)" strokeWidth="1.5" opacity="0.6" />
      <line x1="12" y1="20" x2="28" y2="30" stroke="url(#logo-grad)" strokeWidth="1.5" opacity="0.6" />
      <line x1="28" y1="12" x2="42" y2="18" stroke="url(#logo-grad)" strokeWidth="1.5" opacity="0.6" />
      <line x1="28" y1="30" x2="42" y2="18" stroke="url(#logo-grad)" strokeWidth="1.5" opacity="0.6" />
      <line x1="28" y1="30" x2="36" y2="38" stroke="url(#logo-grad)" strokeWidth="1.5" opacity="0.6" />

      {/* Wordmark */}
      <text
        x="54"
        y="32"
        fontFamily="'Inter', 'Poppins', system-ui, sans-serif"
        fontWeight="600"
        fontSize="24"
        fill={textColor}
        letterSpacing="-0.02em"
      >
        Cogniflow
      </text>
    </svg>
  );
}
