"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Hls from "hls.js";

const VIDEO_SRC =
  "https://stream.mux.com/T6oQJQ02cQ6N01TR6iHwZkKFkbepS34dkkIc9iukgy400g.m3u8";
const POSTER =
  "https://images.unsplash.com/photo-1647356191320-d7a1f80ca777?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMGRhcmslMjB0ZWNobm9sb2d5JTIwbmV1cmFsJTIwbmV0d29ya3xlbnwxfHx8fDE3Njg5NzIyNTV8MA&ixlib=rb-4.1.0&q=80&w=1080";

function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(VIDEO_SRC);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });
      return () => hls.destroy();
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = VIDEO_SRC;
      video.addEventListener("loadedmetadata", () => {
        video.play().catch(() => {});
      });
    }
  }, []);

  return (
    <video
      ref={videoRef}
      className="absolute inset-0 w-full h-full object-cover opacity-60"
      muted
      loop
      playsInline
      poster={POSTER}
    />
  );
}

export default function Hero() {
  return (
    <section className="relative w-full min-h-screen bg-black text-white overflow-hidden">
      {/* Background video */}
      <HeroVideo />

      {/* Video overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />

      {/* Decorative gradients */}
      <div
        className="absolute rounded-full mix-blend-screen pointer-events-none"
        style={{
          top: "-20%",
          left: "20%",
          width: "600px",
          height: "600px",
          background: "rgba(30, 58, 138, 0.2)",
          filter: "blur(120px)",
        }}
      />
      <div
        className="absolute rounded-full mix-blend-screen pointer-events-none"
        style={{
          bottom: "-10%",
          right: "20%",
          width: "500px",
          height: "500px",
          background: "rgba(49, 46, 129, 0.2)",
          filter: "blur(120px)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-5xl mx-auto px-6 mt-20 space-y-12 min-h-screen justify-center">
        {/* Pre-headline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-3xl sm:text-5xl lg:text-[48px] leading-[1.1] text-white"
          style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic" }}
        >
          The future of sales, automated
        </motion.p>

        {/* Main headline */}
        <motion.h1
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="text-6xl sm:text-8xl lg:text-[136px] font-semibold leading-[0.9] tracking-tighter bg-gradient-to-b from-white via-white to-[#7dd3fc] bg-clip-text text-transparent"
          style={{ fontFamily: "'Instrument Sans', sans-serif" }}
        >
          Outperform
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.7 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="text-lg sm:text-[20px] leading-[1.65] text-white max-w-xl"
          style={{ fontFamily: "'Instrument Sans', sans-serif" }}
        >
          The autonomous AI SDR that calls, writes hyperpersonalized emails,
          and follows up on WhatsApp — in under 500ms. While you sleep.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="flex flex-col sm:flex-row items-center gap-6"
        >
          {/* Primary button */}
          <a
            href="#book-demo"
            className="group flex items-center gap-3 pl-6 pr-2 py-2 rounded-full bg-white text-[#0a0400] font-medium text-lg hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:scale-105 transition-all duration-300"
            style={{ fontFamily: "'Instrument Sans', sans-serif" }}
          >
            Book a Demo
            <span className="flex items-center justify-center w-10 h-10 rounded-full bg-[#22d3ee] group-hover:bg-[#06b6d4] transition-colors duration-200">
              <ArrowRight className="w-5 h-5 text-white" />
            </span>
          </a>

          {/* Secondary button */}
          <a
            href="#product"
            className="group flex items-center gap-2 px-4 py-2 rounded-lg text-white/70 hover:text-white backdrop-blur-sm hover:bg-white/5 transition-all duration-300"
            style={{ fontFamily: "'Instrument Sans', sans-serif" }}
          >
            See How It Works
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
          </a>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1 }}
        >
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
            className="w-5 h-8 rounded-full border border-white/[0.15] flex items-start justify-center p-1.5"
          >
            <div className="w-1 h-1.5 rounded-full bg-white/40" />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
