"use client";

import Image from "next/image";

interface CogniflowLogoProps {
  width?: number;
  className?: string;
}

export default function CogniflowLogo({
  width = 200,
  className = "",
}: CogniflowLogoProps) {
  const height = Math.round(width * 0.4);

  return (
    <Image
      src="/cogniflow-logo.png"
      alt="Cogniflow"
      width={width}
      height={height}
      className={`h-auto object-contain ${className}`}
      style={{ width, height: "auto" }}
      priority
    />
  );
}
