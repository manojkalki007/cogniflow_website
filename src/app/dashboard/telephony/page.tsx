"use client";

import { useState, useEffect } from "react";
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
/*  Providers Data (Static)                                            */
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

const PROVIDERS_BASE: Omit<Provider, "status">[] = [
  { id: "twilio", name: "Twilio", abbr: "Tw", color: "#F22F46", category: "Cloud CPaaS", streaming: true, latencyMs: 45 },
  { id: "exotel", name: "Exotel", abbr: "Ex", color: "#2962FF", category: "India CPaaS", streaming: true, latencyMs: 62 },
  { id: "vobiz", name: "Vobiz", abbr: "Vb", color: "#7C3AED", category: "India Telecom", streaming: true, latencyMs: 58 },
  { id: "mcube", name: "MCube", abbr: "Mc", color: "#FF8B3E", category: "Click-to-Call", streaming: false, latencyMs: 110 },
  { id: "sip", name: "SIP", abbr: "SI", color: "#8B92A5", category: "Self-hosted PBX", streaming: true, latencyMs: 12 },
];

function getProviderInfo(id: string): Provider {
  const base = PROVIDERS_BASE.find((p) => p.id === id) || {
    id, name: id, abbr: id.slice(0,2), color: "#8B92A5", category: "Unknown", streaming: true, latencyMs: 0,
  };
  return { ...base, status: "configured" }; // Status overridden by API
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
      style={{ color: colors.text, background: "transparent", border: `1px solid ${colors.border}` }}
      onMouseEnter={(e) => (e.currentTarget.style.background = colors.bg)}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
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
    } catch {}
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
  
  const [numbers, setNumbers] = useState<any[]>([]);
  const [configuredProviders, setConfiguredProviders] = useState<string[]>([]);
  const [webhookData, setWebhookData] = useState<any>(null);
  
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [numRes, agentRes, webRes] = await Promise.all([
        fetch("/api/proxy/api/numbers"),
        fetch("/api/proxy/api/agents"),
        fetch("/api/proxy/api/numbers/webhooks")
      ]);
      const numData = await numRes.json();
      const agentData = await agentRes.json();
      const webData = await webRes.json();
      
      setNumbers(numData.numbers || []);
      setConfiguredProviders(numData.configured_providers || []);
      setAgents(agentData.agents || []);
      setWebhookData(webData);
    } catch (e) {
      console.error("Error fetching data", e);
    } finally {
      setLoading(false);
    }
  };

  const getAssignedAgent = (numberString: string) => {
    return agents.find(a => a.phone_numbers && a.phone_numbers.includes(numberString));
  };

  const handleAssignAgent = async (numberString: string, agentId: string) => {
    try {
      // Find the current assigned agent (if any) and remove it
      const currentAgent = getAssignedAgent(numberString);
      if (currentAgent && currentAgent.id !== agentId) {
        await fetch(`/api/proxy/api/agents/${currentAgent.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone_numbers: currentAgent.phone_numbers.filter((n: string) => n !== numberString)
          })
        });
      }

      // Add to new agent
      if (agentId) {
        const newAgent = agents.find(a => a.id === agentId);
        if (newAgent) {
          const updatedNumbers = [...(newAgent.phone_numbers || []).filter((n: string) => n !== numberString), numberString];
          await fetch(`/api/proxy/api/agents/${agentId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone_numbers: updatedNumbers })
          });
        }
      }
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const providersList = PROVIDERS_BASE.map(p => ({
    ...p,
    status: configuredProviders.includes(p.id) ? (p.id === 'mcube' ? 'click-to-call' : 'configured') : 'not_configured'
  })) as Provider[];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Phone size={22} style={{ color: "var(--d-primary)" }} />
            <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--d-text)" }}>
              Telephony
            </h1>
          </div>
          <p className="text-sm mt-1" style={{ color: "var(--d-text-2)" }}>Manage providers and phone numbers</p>
        </div>
      </div>

      {/* ── Provider Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {providersList.map((provider) => (
          <div key={provider.id} className="dash-card-glow p-5 flex flex-col gap-4 cursor-pointer">
            <div className="flex items-start justify-between">
              <ProviderIcon provider={provider} />
              <StatusBadge status={provider.status} />
            </div>
            <div>
              <h3 className="text-sm font-semibold" style={{ color: "var(--d-text)" }}>{provider.name}</h3>
              <span className="text-xs" style={{ color: "var(--d-text-3)" }}>{provider.category}</span>
            </div>
            <div className="flex items-center justify-between mt-auto pt-3" style={{ borderTop: "1px solid var(--d-border)" }}>
              <div className="flex items-center gap-1.5">
                {provider.streaming ? (
                  <><Wifi size={13} style={{ color: "var(--d-success)" }} /><span className="text-xs font-medium" style={{ color: "var(--d-success)" }}>Streaming</span></>
                ) : (
                  <><WifiOff size={13} style={{ color: "var(--d-text-3)" }} /><span className="text-xs font-medium" style={{ color: "var(--d-text-3)" }}>No Streaming</span></>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Phone Numbers ──────────────────────────────────────── */}
      <div className="dash-card overflow-hidden">
        <div className="flex items-center justify-between gap-4 flex-wrap px-6 py-5" style={{ borderBottom: "1px solid var(--d-border)" }}>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold" style={{ color: "var(--d-text)" }}>Phone Numbers</h2>
            <span className="dash-badge dash-badge-info">{numbers.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all duration-200" style={{ background: "var(--d-primary)", color: "var(--d-bg)" }}>
              <ShoppingCart size={14} /> Buy Number
            </button>
            <button className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold" style={{ color: "var(--d-text-2)", background: "var(--d-surface-2)", border: "1px solid var(--d-border)" }}>
              <Link2 size={14} /> Connect Existing
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="dash-table">
            <thead>
              <tr>
                <th>Number</th>
                <th>Provider</th>
                <th>Assigned Agent</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="text-center py-8 text-sm" style={{ color: "var(--d-text-3)" }}>Loading...</td></tr>
              ) : numbers.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-8 text-sm" style={{ color: "var(--d-text-3)" }}>No phone numbers found. Connect one to get started.</td></tr>
              ) : numbers.map((pn) => {
                const provider = getProviderInfo(pn.provider || "twilio");
                const assignedAgent = getAssignedAgent(pn.number);
                return (
                  <tr key={pn.number || pn.id}>
                    <td>
                      <span className="text-sm font-medium" style={{ fontFamily: "var(--d-mono)", color: "var(--d-text)" }}>{pn.number}</span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <ProviderIcon provider={provider} size={26} />
                        <span className="text-sm" style={{ color: "var(--d-text-2)" }}>{provider.name}</span>
                      </div>
                    </td>
                    <td>
                      <select
                        className="text-xs py-1.5 px-2 rounded border focus:outline-none"
                        style={{ background: "var(--d-surface-2)", color: "var(--d-text)", borderColor: "var(--d-border)" }}
                        value={assignedAgent ? assignedAgent.id : ""}
                        onChange={(e) => handleAssignAgent(pn.number, e.target.value)}
                      >
                        <option value="">-- Unassigned --</option>
                        {agents.map(a => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <GhostButton variant="danger"><Trash2 size={12} /> Release</GhostButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Webhook Configuration ──────────────────────────────── */}
      <div className="dash-card overflow-hidden">
        <button
          onClick={() => setWebhooksOpen(!webhooksOpen)}
          className="w-full flex items-center justify-between px-6 py-5 text-left transition-colors duration-150 hover:bg-white/5"
          style={{ borderBottom: webhooksOpen ? "1px solid var(--d-border)" : "none" }}
        >
          <div className="flex items-center gap-3">
            <Webhook size={18} style={{ color: "var(--d-accent)" }} />
            <h2 className="text-lg font-semibold" style={{ color: "var(--d-text)" }}>Webhook Configuration</h2>
          </div>
          <motion.div animate={{ rotate: webhooksOpen ? 90 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronRight size={18} style={{ color: "var(--d-text-3)" }} />
          </motion.div>
        </button>

        <motion.div
          initial={false}
          animate={{ height: webhooksOpen ? "auto" : 0, opacity: webhooksOpen ? 1 : 0 }}
          style={{ overflow: "hidden" }}
        >
          <div className="divide-y p-6 text-sm" style={{ borderColor: "var(--d-border)", color: "var(--d-text-2)" }}>
            {webhookData ? (
              <pre style={{ fontFamily: "var(--d-mono)", fontSize: "11px", whiteSpace: "pre-wrap" }}>
                {JSON.stringify(webhookData, null, 2)}
              </pre>
            ) : (
              <div>Loading webhooks...</div>
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
