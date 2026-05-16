"use client";

import { useInView, useMotionValue, useSpring, useTransform, motion } from "framer-motion";
import { useEffect, useRef } from "react";

export default function AnimatedCounter({
  target,
  suffix = "",
  prefix = "",
  duration = 1.5,
}: {
  target: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const count = useMotionValue(0);
  const spring = useSpring(count, { duration: duration * 1000 });
  const display = useTransform(spring, (v) => `${prefix}${Math.round(v)}${suffix}`);

  useEffect(() => {
    if (isInView) count.set(target);
  }, [isInView, count, target]);

  return <motion.span ref={ref}>{display}</motion.span>;
}
