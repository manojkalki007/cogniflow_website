"use client";

import { useState, useEffect } from "react";
import { ArrowRight, X } from "lucide-react";

export default function MobileCTA() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 600);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (dismissed || !visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 border-t"
        style={{
          background: "rgba(15, 23, 42, 0.97)",
          backdropFilter: "blur(12px)",
          borderColor: "rgba(255,255,255,0.08)",
        }}
      >
        <a
          href="/signup"
          className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm text-white"
          style={{
            background: "linear-gradient(135deg, #00BCD4, #0097A7)",
          }}
        >
          Get Started Free <ArrowRight size={15} />
        </a>
        <a
          href="/book-call"
          className="inline-flex items-center justify-center py-3 px-4 rounded-xl font-medium text-sm text-white/70 border border-white/15"
        >
          Demo
        </a>
        <button
          onClick={() => setDismissed(true)}
          className="p-1.5 text-white/40"
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
