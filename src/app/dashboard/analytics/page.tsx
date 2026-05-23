"use client";

import { BarChart3 } from "lucide-react";
import { motion } from "framer-motion";

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--d-text)" }}>
            Analytics
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--d-text-2)" }}>
            Detailed call analytics, conversion funnels, and agent performance
          </p>
        </div>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="dash-card p-12 text-center"
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: "var(--d-primary-muted)", border: "1px solid rgba(0,221,179,0.2)" }}
        >
          <BarChart3 size={28} style={{ color: "var(--d-primary)" }} />
        </div>
        <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--d-text)" }}>
          Detailed analytics coming soon
        </h2>
        <p className="text-sm max-w-md mx-auto" style={{ color: "var(--d-text-2)" }}>
          Dive into call sentiment, intent distribution, drop-off points, peak hours, and per-agent conversion rates.
        </p>
      </motion.div>
    </div>
  );
}
