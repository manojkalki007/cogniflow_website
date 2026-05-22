"use client";

import Image from "next/image";

interface CogniflowLogoProps {
  width?: number;
  className?: string;
  variant?: "light" | "dark";
  showText?: boolean;
}

export function CogniflowIcon({ size = 28 }: { size?: number }) {
  return (
    <Image
      src="/cogniflow-logo.svg"
      alt="Cogniflow"
      width={size}
      height={Math.round(size * 0.67)}
      className="object-contain"
    />
  );
}

export function CogniflowIconLight({ size = 28 }: { size?: number }) {
  return (
    <Image
      src="/cogniflow-logo.svg"
      alt="Cogniflow"
      width={size}
      height={Math.round(size * 0.67)}
      className="object-contain brightness-0 invert"
    />
  );
}

export default function CogniflowLogo({
  width = 32,
  className = "",
  variant = "dark",
  showText = true,
}: CogniflowLogoProps) {
  const textColor = variant === "light" ? "#FFFFFF" : "#0F172A";
  const Icon = variant === "light" ? CogniflowIconLight : CogniflowIcon;

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Icon size={width} />
      {showText && (
        <span
          style={{
            fontSize: Math.max(16, width * 0.45),
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
