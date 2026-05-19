"use client";

import Image from "next/image";

interface CogniflowLogoProps {
  width?: number;
  className?: string;
  variant?: "light" | "dark";
}

export default function CogniflowLogo({
  width = 160,
  className = "",
}: CogniflowLogoProps) {
  return (
    <Image
      src="/cogniflow-logo.png"
      alt="Cogniflow"
      width={width}
      height={width}
      className={className}
      style={{ objectFit: "contain" }}
      priority
    />
  );
}
