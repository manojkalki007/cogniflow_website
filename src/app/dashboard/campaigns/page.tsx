"use client";

import { Megaphone, Plus } from "lucide-react";
import { motion } from "framer-motion";

export default function CampaignsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--d-text)" }}>
            Campaigns
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--d-text-2)" }}>
            Run outbound calling campaigns at scale
          </p>
        </div>
        <button
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold"
          style={{
            background: "var(--d-primary)",
            color: "#06070B",
            boxShadow: "0 0 20px var(--d-primary-glow)",
          }}
          aria-label="Create new campaign"
        >
          <Plus size={16} /> New Campaign
        </button>
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
          <Megaphone size={28} style={{ color: "var(--d-primary)" }} />
        </div>
        <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--d-text)" }}>
          Campaign management coming soon
        </h2>
        <p className="text-sm max-w-md mx-auto" style={{ color: "var(--d-text-2)" }}>
          Launch outbound campaigns, schedule batches, manage DNC lists, and track conversion in real time.
        </p>
      </motion.div>
    </div>
  );
}
