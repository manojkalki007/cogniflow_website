"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Phone,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Wifi,
  WifiOff,
  Link2,
  Unlink,
  Trash2,
  Globe,
  Activity,
  Webhook,
  ExternalLink,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Mock data                                                          */
/* ------------------------------------------------------------------ */

interface Provider {
  id: string;
  name: string;
  abbr: string;
  color: string;
  category: string;
  status: "configured" | "click-to-call" | "not_configured";
  streaming: boolean;
  latencyMs: number;
}

const PROVIDERS: Provider[] = [
  { id: "twilio", name: "Twilio", abbr: "Tw", color: "#F22F46", category: "Cloud CPaaS", status: "configured", streaming: true, latencyMs: 45 },
  { id: "exotel", name: "Exotel", abbr: "Ex", color: "#2962FF", category: "India CPaaS", status: "configured", streaming: true, latencyMs: 62 },
  { id: "vobiz", name: "Vobiz", abbr: "Vb", color: "#7C3AED", category: "India Telecom", status: "configured", streaming: true, latencyMs: 58 },
  { id: "mcube", name: "MCube", abbr: "Mc", color: "#FF8B3E", category: "Click-to-Call", status: "click-to-call", streaming: false, latencyMs: 110 },
  { id: "sip", name: "SIP", abbr: "SI", color: "#8B92A5", category: "Self-hosted PBX", status: "configured", streaming: true, latencyMs: 12 },
];

interface PhoneNumber {
  id: string;
  number: string;
  providerId: string;
  country: string;
  countryCode: string;
  status: "active" | "inactive";
  connected: "connected" | "disconnected" | "na" | "configured";
  connectedNote?: string;
  actions: ("verify" | "release" | "connect")[];
}

const PHONE_NUMBERS: PhoneNumber[] = [
  { id: "pn1", number: "+1 (415) 555-0123", providerId: "twilio", country: "United States", countryCode: "US", status: "active", connected: "connected", actions: ["verify", "release"] },
  { id: "pn2", number: "+91 98765 43210", providerId: "exotel", country: "India", countryCode: "IN", status: "active", connected: "connected", actions: ["verify"] },
  { id: "pn3", number: "+91 87654 32109", providerId: "vobiz", country: "India", countryCode: "IN", status: "active", connected: "connected", actions: ["verify"] },
  { id: "pn4", number: "+91 76543 21098", providerId: "mcube", country: "India", countryCode: "IN", status: "active", connected: "na", connectedNote: "No streaming", actions: [] },
  { id: "pn5", number: "+1 (212) 555-0456", providerId: "twilio", country: "United States", countryCode: "US", status: "active", connected: "disconnected", actions: ["connect", "verify"] },
  { id: "pn6", number: "sip:1000@pbx.local", providerId: "sip", country: "-", countryCode: "-", status: "active", connected: "configured", actions: ["verify"] },
];

const BASE_URL = "https://api.cogniflowautomations.com/v1/telephony";

interface WebhookGroup {
  providerId: string;
  providerName: string;
  note?: string;
  urls: { label: string; url: string }[];
}

const WEBHOOKS: WebhookGroup[] = [
  {
    providerId: "twilio",
    providerName: "Twilio",
    urls: [
      { label: "Inbound", url: `${BASE_URL}/twilio/inbound` },
      { label: "Outbound", url: `${BASE_URL}/twilio/outbound` },
      { label: "WebSocket", url: `wss://stream.cogniflowautomations.com/twilio/ws` },
      { label: "Recording Status", url: `${BASE_URL}/twilio/recording_status` },
    ],
  },
  {
    providerId: "exotel",
    providerName: "Exotel",
    urls: [
      { label: "Inbound", url: `${BASE_URL}/exotel/inbound` },
      { label: "Outbound", url: `${BASE_URL}/exotel/outbound` },
      { label: "WebSocket", url: `wss://stream.cogniflowautomations.com/exotel/ws` },
    ],
  },
  {
    providerId: "vobiz",
    providerName: "Vobiz",
    urls: [
      { label: "Inbound", url: `${BASE_URL}/vobiz/inbound` },
      { label: "Outbound", url: `${BASE_URL}/vobiz/outbound` },
      { label: "Hangup", url: `${BASE_URL}/vobiz/hangup` },
      { label: "Ring", url: `${BASE_URL}/vobiz/ring` },
      { label: "Stream Status", url: `${BASE_URL}/vobiz/stream_status` },
      { label: "WebSocket", url: `wss://stream.cogniflowautomations.com/vobiz/ws` },
    ],
  },
  {
    providerId: "mcube",
    providerName: "MCube",
    note: "No WebSocket - click-to-call only",
    urls: [
      { label: "Status Callback", url: `${BASE_URL}/mcube/status_callback` },
    ],
  },
  {
    providerId: "sip",
    providerName: "SIP",
    urls: [
      { label: "WebSocket", url: `wss://stream.cogniflowautomations.com/sip/ws` },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Animation variants                                                 */
/* ------------------------------------------------------------------ */

const containerVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] as const } },
};

const rowVariants = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] as const } },
};

/* ------------------------------------------------------------------ */
/*  Helper: Provider lookup                                            */
/* ------------------------------------------------------------------ */

function getProvider(id: string): Provider {
  return PROVIDERS.find((p) => p.id === id)!;
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function ProviderIcon({ provider, size = 40 }: { provider: Provider; size?: number }) {
  return (
    <div
      className="dash-provider-icon"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.25,
        background: `${provider.color}18`,
        color: provider.color,
        fontSize: size * 0.35,
        border: `1px solid ${provider.color}30`,
      }}
    >
      {provider.abbr}
    </div>
  );
}

function StatusBadge({ status }: { status: Provider["status"] }) {
  if (status === "configured") {
    return <span className="dash-badge dash-badge-ok">Configured</span>;
  }
  if (status === "click-to-call") {
    return <span className="dash-badge dash-badge-warn">Click-to-Call Only</span>;
  }
  return <span className="dash-badge dash-badge-err">Not Configured</span>;
}

function ConnectedDot({ connected, note }: { connected: PhoneNumber["connected"]; note?: string }) {
  const map: Record<string, { color: string; label: string }> = {
    connected: { color: "var(--d-success)", label: "Connected" },
    disconnected: { color: "var(--d-error)", label: "Disconnected" },
    na: { color: "var(--d-warning)", label: note || "N/A" },
    configured: { color: "var(--d-primary)", label: "Configured" },
  };
  const info = map[connected];

  return (
    <div className="flex items-center gap-2">
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ background: info.color, boxShadow: `0 0 6px ${info.color}60` }}
      />
      <span className="text-sm" style={{ color: info.color }}>
        {info.label}
      </span>
    </div>
  );
}

function GhostButton({
  children,
  onClick,
  variant = "default",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "default" | "danger";
}) {
  const colors =
    variant === "danger"
      ? { text: "var(--d-error)", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.2)" }
      : { text: "var(--d-text-2)", bg: "var(--d-surface-2)", border: "var(--d-border)" };

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-150"
      style={{
        color: colors.text,
        background: "transparent",
        border: `1px solid ${colors.border}`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = colors.bg;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      {children}
    </button>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* fallback — ignored in mock */
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="dash-tooltip inline-flex items-center justify-center w-7 h-7 rounded-md transition-all duration-150 shrink-0"
      data-tip={copied ? "Copied!" : "Copy"}
      style={{
        color: copied ? "var(--d-success)" : "var(--d-text-3)",
        background: copied ? "rgba(52,211,153,0.1)" : "transparent",
        border: `1px solid ${copied ? "rgba(52,211,153,0.3)" : "var(--d-border)"}`,
      }}
      onMouseEnter={(e) => {
        if (!copied) e.currentTarget.style.background = "var(--d-surface-2)";
      }}
      onMouseLeave={(e) => {
        if (!copied) e.currentTarget.style.background = "transparent";
      }}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function TelephonyPage() {
  const [webhooksOpen, setWebhooksOpen] = useState(false);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-8"
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <motion.div variants={itemVariants} className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Phone size={22} style={{ color: "var(--d-primary)" }} />
            <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--d-text)" }}>
              Telephony
            </h1>
          </div>
          <p className="text-sm mt-1" style={{ color: "var(--d-text-2)" }}>
            Manage providers and phone numbers
          </p>
        </div>
        <button
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200"
          style={{
            background: "var(--d-primary)",
            color: "var(--d-bg)",
            boxShadow: "0 0 20px var(--d-primary-glow)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = "0 0 32px var(--d-primary-glow), 0 4px 16px rgba(0,221,179,0.3)";
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = "0 0 20px var(--d-primary-glow)";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          <Plus size={16} />
          Add Provider
        </button>
      </motion.div>

      {/* ── Provider Cards ─────────────────────────────────────── */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {PROVIDERS.map((provider, i) => (
          <motion.div
            key={provider.id}
            variants={itemVariants}
            className="dash-card-glow p-5 flex flex-col gap-4 cursor-pointer"
          >
            {/* Top row: icon + status */}
            <div className="flex items-start justify-between">
              <ProviderIcon provider={provider} />
              <StatusBadge status={provider.status} />
            </div>

            {/* Name + category */}
            <div>
              <h3 className="text-sm font-semibold" style={{ color: "var(--d-text)" }}>
                {provider.name}
              </h3>
              <span className="text-xs" style={{ color: "var(--d-text-3)" }}>
                {provider.category}
              </span>
            </div>

            {/* Footer: streaming + latency */}
            <div className="flex items-center justify-between mt-auto pt-3" style={{ borderTop: "1px solid var(--d-border)" }}>
              <div className="flex items-center gap-1.5">
                {provider.streaming ? (
                  <>
                    <Wifi size={13} style={{ color: "var(--d-success)" }} />
                    <span className="text-xs font-medium" style={{ color: "var(--d-success)" }}>
                      Streaming
                    </span>
                  </>
                ) : (
                  <>
                    <WifiOff size={13} style={{ color: "var(--d-text-3)" }} />
                    <span className="text-xs font-medium" style={{ color: "var(--d-text-3)" }}>
                      No Streaming
                    </span>
                  </>
                )}
              </div>
              <span
                className="dash-stat text-xs"
                style={{ color: "var(--d-text-2)", fontFamily: "var(--d-mono)" }}
              >
                {provider.latencyMs}ms
              </span>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* ── Phone Numbers ──────────────────────────────────────── */}
      <motion.div variants={itemVariants} className="dash-card overflow-hidden">
        {/* Section header */}
        <div
          className="flex items-center justify-between gap-4 flex-wrap px-6 py-5"
          style={{ borderBottom: "1px solid var(--d-border)" }}
        >
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold" style={{ color: "var(--d-text)" }}>
              Phone Numbers
            </h2>
            <span className="dash-badge dash-badge-info">{PHONE_NUMBERS.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all duration-200"
              style={{
                background: "var(--d-primary)",
                color: "var(--d-bg)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = "0 0 20px var(--d-primary-glow)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <ShoppingCart size={14} />
              Buy Number
            </button>
            <button
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all duration-200"
              style={{
                color: "var(--d-text-2)",
                background: "var(--d-surface-2)",
                border: "1px solid var(--d-border)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--d-border-bright)";
                e.currentTarget.style.color = "var(--d-text)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--d-border)";
                e.currentTarget.style.color = "var(--d-text-2)";
              }}
            >
              <ShieldCheck size={14} />
              Verify All
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="dash-table">
            <thead>
              <tr>
                <th>Number</th>
                <th>Provider</th>
                <th>Country</th>
                <th>Status</th>
                <th>Connected</th>
                <th>Actions</th>
              </tr>
            </thead>
            <motion.tbody variants={containerVariants} initial="hidden" animate="show">
              {PHONE_NUMBERS.map((pn) => {
                const provider = getProvider(pn.providerId);
                return (
                  <motion.tr key={pn.id} variants={rowVariants}>
                    <td>
                      <span
                        className="text-sm font-medium"
                        style={{ fontFamily: "var(--d-mono)", color: "var(--d-text)", letterSpacing: "0.02em" }}
                      >
                        {pn.number}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <ProviderIcon provider={provider} size={26} />
                        <span className="text-sm" style={{ color: "var(--d-text-2)" }}>
                          {provider.name}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        {pn.countryCode !== "-" && <Globe size={14} style={{ color: "var(--d-text-3)" }} />}
                        <span className="text-sm" style={{ color: "var(--d-text-2)" }}>
                          {pn.countryCode}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="dash-badge dash-badge-ok">Active</span>
                    </td>
                    <td>
                      <ConnectedDot connected={pn.connected} note={pn.connectedNote} />
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        {pn.actions.includes("connect") && (
                          <GhostButton>
                            <Link2 size={12} />
                            Connect
                          </GhostButton>
                        )}
                        {pn.actions.includes("verify") && (
                          <GhostButton>
                            <ShieldCheck size={12} />
                            Verify
                          </GhostButton>
                        )}
                        {pn.actions.includes("release") && (
                          <GhostButton variant="danger">
                            <Trash2 size={12} />
                            Release
                          </GhostButton>
                        )}
                        {pn.actions.length === 0 && (
                          <span className="text-xs" style={{ color: "var(--d-text-3)" }}>
                            --
                          </span>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </motion.tbody>
          </table>
        </div>
      </motion.div>

      {/* ── Webhook Configuration ──────────────────────────────── */}
      <motion.div variants={itemVariants} className="dash-card overflow-hidden">
        {/* Collapsible header */}
        <button
          onClick={() => setWebhooksOpen(!webhooksOpen)}
          className="w-full flex items-center justify-between px-6 py-5 text-left transition-colors duration-150"
          style={{
            borderBottom: webhooksOpen ? "1px solid var(--d-border)" : "none",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--d-surface-2)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          <div className="flex items-center gap-3">
            <Webhook size={18} style={{ color: "var(--d-accent)" }} />
            <h2 className="text-lg font-semibold" style={{ color: "var(--d-text)" }}>
              Webhook Configuration
            </h2>
            <span className="dash-badge dash-badge-info">{WEBHOOKS.length} providers</span>
          </div>
          <motion.div
            animate={{ rotate: webhooksOpen ? 90 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronRight size={18} style={{ color: "var(--d-text-3)" }} />
          </motion.div>
        </button>

        {/* Collapsible body */}
        <motion.div
          initial={false}
          animate={{
            height: webhooksOpen ? "auto" : 0,
            opacity: webhooksOpen ? 1 : 0,
          }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          style={{ overflow: "hidden" }}
        >
          <div className="divide-y" style={{ borderColor: "var(--d-border)" }}>
            {WEBHOOKS.map((group) => {
              const provider = getProvider(group.providerId);
              return (
                <div
                  key={group.providerId}
                  className="px-6 py-5"
                  style={{ borderColor: "var(--d-border)" }}
                >
                  {/* Provider label */}
                  <div className="flex items-center gap-3 mb-4">
                    <ProviderIcon provider={provider} size={28} />
                    <span className="text-sm font-semibold" style={{ color: "var(--d-text)" }}>
                      {group.providerName}
                    </span>
                    {group.note && (
                      <span
                        className="text-xs px-2 py-1 rounded-md"
                        style={{
                          background: "var(--d-accent-muted)",
                          color: "var(--d-accent)",
                          border: "1px solid rgba(255,139,62,0.2)",
                        }}
                      >
                        {group.note}
                      </span>
                    )}
                  </div>

                  {/* URL rows */}
                  <div className="space-y-2">
                    {group.urls.map((entry) => (
                      <div
                        key={entry.label}
                        className="flex items-center gap-3 rounded-lg px-4 py-2.5"
                        style={{
                          background: "var(--d-surface-2)",
                          border: "1px solid var(--d-border)",
                        }}
                      >
                        <span
                          className="text-xs font-semibold uppercase shrink-0 w-28"
                          style={{ color: "var(--d-text-3)", letterSpacing: "0.04em" }}
                        >
                          {entry.label}
                        </span>
                        <span
                          className="flex-1 text-xs truncate"
                          style={{
                            fontFamily: "var(--d-mono)",
                            color: "var(--d-text-2)",
                            letterSpacing: "0.01em",
                          }}
                        >
                          {entry.url}
                        </span>
                        <CopyButton text={entry.url} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
