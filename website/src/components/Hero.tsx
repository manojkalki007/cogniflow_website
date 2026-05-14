"use client";

import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { Sparkles, ArrowRight } from "lucide-react";

const ease = [0.22, 1, 0.36, 1] as const;

function BlurIn({
  children,
  delay = 0,
  duration = 0.6,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, filter: "blur(10px)", y: 20 }}
      animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
      transition={{ delay, duration, ease }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function SplitText({
  text,
  startIndex = 0,
  staggerDelay = 0.08,
  duration = 0.6,
}: {
  text: string;
  startIndex?: number;
  staggerDelay?: number;
  duration?: number;
}) {
  const words = text.split(" ");
  return (
    <>
      {words.map((word, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: (startIndex + i) * staggerDelay,
            duration,
            ease,
          }}
          className="inline-block"
          style={{ marginRight: "0.3em" }}
        >
          {word}
        </motion.span>
      ))}
    </>
  );
}

const HLS_SRC =
  "https://stream.mux.com/s8pMcOvMQXc4GD6AX4e1o01xFogFxipmuKltNfSYza0200.m3u8";

export default function Hero() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hlsInstance: any = null;

    // Safari supports HLS natively
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = HLS_SRC;
      video.play().catch(() => {});
      return;
    }

    // Dynamic import of bundled hls.js (runs client-side only inside useEffect)
    import("hls.js")
      .then((mod) => {
        const Hls = mod.default;
        if (!Hls.isSupported()) return;

        hlsInstance = new Hls();
        hlsInstance.loadSource(HLS_SRC);
        hlsInstance.attachMedia(video);
        hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {});
        });
      })
      .catch(() => {});

    return () => {
      hlsInstance?.destroy();
    };
  }, []);

  return (
    <section
      className="relative w-full h-screen overflow-hidden"
      style={{ backgroundColor: "#070612" }}
    >
      {/* Background Video */}
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 h-full object-cover pointer-events-none"
        style={{
          zIndex: 0,
          marginLeft: "200px",
          width: "calc(100% - 200px)",
          transform: "scale(1.2)",
          transformOrigin: "left center",
        }}
      />

      {/* Bottom fade gradient */}
      <div
        className="absolute bottom-0 left-0 w-full h-40"
        style={{
          zIndex: 10,
          background: "linear-gradient(to top, #070612, transparent)",
        }}
      />

      {/* Content */}
      <div
        className="relative mx-auto max-w-7xl h-full flex flex-col justify-center px-6 lg:px-12"
        style={{ zIndex: 20 }}
      >
        <div className="flex flex-col gap-12">
          <div className="flex flex-col gap-6">
            {/* Badge */}
            <BlurIn delay={0} duration={0.6}>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 backdrop-blur-sm px-4 py-2 w-fit">
                <Sparkles className="w-3 h-3 text-white/80" />
                <span className="text-sm font-medium text-white/80">
                  New AI Automation Ally
                </span>
              </div>
            </BlurIn>

            {/* Heading */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-medium leading-tight lg:leading-[1.2] text-white">
              <span className="block">
                <SplitText text="The AI Employee That" startIndex={0} />
              </span>
              <SplitText text="Outperforms Your Best" startIndex={4} />
              <motion.span
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 7 * 0.08, duration: 0.6, ease }}
                className="inline-block italic"
                style={{ fontFamily: "'Instrument Serif', Georgia, serif" }}
              >
                SDR.
              </motion.span>
            </h1>

            {/* Subtitle */}
            <BlurIn delay={0.4} duration={0.6}>
              <p className="text-white/80 text-lg font-normal leading-relaxed max-w-xl">
                It calls. It writes hyperpersonalized emails. It follows up on
                WhatsApp. In under 500ms. While you sleep.
              </p>
            </BlurIn>
          </div>

          {/* CTA Buttons */}
          <BlurIn delay={0.6} duration={0.6}>
            <div className="flex flex-wrap gap-4">
              <a
                href="/book-call"
                className="inline-flex items-center gap-2 rounded-full bg-[#0018FF] text-white px-5 py-3 font-medium transition-transform hover:scale-105"
              >
                Book A Free Call
                <ArrowRight className="w-4 h-4" />
              </a>
              <a
                href="#"
                className="inline-flex items-center rounded-full bg-white/20 backdrop-blur-sm text-white px-8 py-3 font-medium transition-colors hover:bg-white/30"
              >
                Learn now
              </a>
            </div>
          </BlurIn>
        </div>
      </div>
    </section>
  );
}
