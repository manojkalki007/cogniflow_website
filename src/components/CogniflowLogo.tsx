"use client";

import Image from "next/image";

interface CogniflowLogoProps {
  width?: number;
  className?: string;
  variant?: "light" | "dark";
  showText?: boolean;
}

export default function CogniflowLogo({
  width = 36,
  className = "",
  variant = "dark",
  showText = true,
}: CogniflowLogoProps) {
  const textColor = variant === "light" ? "#FFFFFF" : "#0F172A";
  const height = Math.round(width * (842 / 1264));

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Image
        src="/cogniflow-logo.png"
        alt="Cogniflow"
        width={width}
        height={height}
        style={{ objectFit: "contain" }}
        priority
      />
      {showText && (
        <span
          style={{
            fontSize: width * 0.5,
            fontWeight: 700,
            color: textColor,
            letterSpacing: "-0.02em",
            fontFamily: "'Instrument Sans', system-ui, sans-serif",
            lineHeight: 1,
          }}
        >
          Cogniflow
        </span>
      )}
    </span>
  );
}
