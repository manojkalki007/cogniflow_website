import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  Phone, PhoneOutgoing, Plus, CheckCircle, XCircle, AlertTriangle, Loader2,
  ExternalLink, ArrowLeft, Copy, PhoneCall, Settings2, Trash2,
  ChevronRight, Clock, Bot, RefreshCw, X, Eye, EyeOff,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent } from "../components/ui/dialog";
import PageHeader from "../components/PageHeader";

const PROVIDERS = [
  {
    id: "vobiz",
    name: "Vobiz",
    flag: "\u{1F1EE}\u{1F1F3}",
    tagline: "Best for India",
    price: "₹0.45/min",
    auto: true,
    kyc: false,
    recommended: true,
    time: "~30 seconds",
    dashboardUrl: "https://console.vobiz.ai",
  },
  {
    id: "twilio",
    name: "Twilio",
    flag: "\u{1F310}",
    tagline: "Best for global",
    price: "$0.0085/min",
    auto: true,
    kyc: false,
    recommended: false,
    time: "~30 seconds",
    dashboardUrl: "https://console.twilio.com",
  },
  {
    id: "exotel",
    name: "Exotel",
    flag: "\u{1F1EE}\u{1F1F3}",
    tagline: "Enterprise India",
    price: "Custom",
    auto: false,
    kyc: true,
    recommended: false,
    time: "1-3 days",
    dashboardUrl: "https://my.exotel.com",
  },
  {
    id: "mcube",
    name: "MCube",
    flag: "\u{1F1EE}\u{1F1F3}",
    tagline: "Enterprise India",
    price: "Custom",
    auto: false,
    kyc: false,
    recommended: false,
    time: "2-5 days",
    dashboardUrl: "https://www.mcube.com",
  },
];

const STATUS_CONFIG = {
  active: { label: "Active", color: "#10b981", bg: "rgba(16,185,129,0.1)" },
  pending_manual: { label: "Pending", color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  provisioning: { label: "Setting up", color: "#3b82f6", bg: "rgba(59,130,246,0.1)" },
  error: { label: "Error", color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.error;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium"
      style={{ color: cfg.color, background: cfg.bg }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.color }} />
      {cfg.label}
    </span>
  );
}

function ProviderBadge({ provider }) {
  const colors = {
    vobiz: { color: "#8b5cf6", bg: "rgba(139,92,246,0.1)" },
    twilio: { color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
    exotel: { color: "#3b82f6", bg: "rgba(59,130,246,0.1)" },
    mcube: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  };
  const c = colors[provider] || colors.twilio;
  return (
    <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase" style={{ color: c.color, background: c.bg }}>
      {provider}
    </span>
  );
}

// ─── Number Card ───

function NumberCard({ num, agents, onAssign, onTest, onRemove, onSettings, onCall }) {
  return (
    <div
      className="p-4 rounded-xl transition-all duration-200 hover:shadow-md"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(0,188,212,0.1)" }}
          >
            <Phone size={18} style={{ color: "var(--accent)" }} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                {num.number}
              </span>
              <ProviderBadge provider={num.provider} />
              <StatusBadge status={num.status} />
            </div>
            <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
              {num.agent_name ? (
                <span className="flex items-center gap-1">
                  <Bot size={12} /> {num.agent_name}
                  <span className="mx-1">·</span>
                  Concurrency: {num.concurrency || 5}
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <AlertTriangle size={12} style={{ color: "#f59e0b" }} /> Not assigned to any agent
                </span>
              )}
              {num.last_call_at && (
                <span className="flex items-center gap-1 mt-0.5">
                  <Clock size={11} /> Last call: {new Date(num.last_call_at).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {num.status === "active" && (
            <Button size="sm" onClick={() => onCall(num)} title="Make outbound call">
              <PhoneOutgoing size={14} className="mr-1" /> Call
            </Button>
          )}
          {!num.agent_id && (
            <Button size="sm" variant="outline" onClick={() => onAssign(num)}>
              Assign
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => onTest(num)} title="Test call">
            <PhoneCall size={14} />
          </Button>
          <Button size="sm" variant="outline" onClick={() => onSettings(num)} title="Settings">
            <Settings2 size={14} />
          </Button>
          <Button size="sm" variant="outline" onClick={() => onRemove(num)} title="Remove" className="text-red-500 hover:text-red-600">
            <Trash2 size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Assign Agent Modal ───

function AssignAgentModal({ open, onClose, number, agents, onAssign }) {
  const [selected, setSelected] = useState(number?.agent_id || "");
  const [concurrency, setConcurrency] = useState(number?.concurrency || 5);

  useEffect(() => {
    if (number) {
      setSelected(number.agent_id || "");
      setConcurrency(number.concurrency || 5);
    }
  }, [number]);

  if (!open || !number) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <h3 className="text-base font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
          Assign Agent to {number.number}
        </h3>
        <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
          Choose which AI agent answers calls on this number.
        </p>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          <label
            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${!selected ? "ring-2 ring-cyan-500" : ""}`}
            style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
          >
            <input type="radio" name="agent" value="" checked={!selected} onChange={() => setSelected("")} className="accent-cyan-500" />
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>Unassign (no agent)</span>
          </label>
          {(agents || []).map((a) => (
            <label
              key={a.id}
              className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${selected === a.id ? "ring-2 ring-cyan-500" : ""}`}
              style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
            >
              <input type="radio" name="agent" value={a.id} checked={selected === a.id} onChange={() => setSelected(a.id)} className="accent-cyan-500" />
              <div>
                <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{a.name}</span>
                {a.phone_numbers?.length > 0 && (
                  <span className="ml-2 text-[10px]" style={{ color: "var(--text-muted)" }}>
                    ({a.phone_numbers.length} number{a.phone_numbers.length > 1 ? "s" : ""})
                  </span>
                )}
              </div>
            </label>
          ))}
        </div>

        <div className="mt-4">
          <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            Concurrent calls on this number
          </label>
          <div className="flex items-center gap-2 mt-1">
            <input
              type="range" min="1" max="20" value={concurrency}
              onChange={(e) => setConcurrency(+e.target.value)}
              className="flex-1 accent-cyan-500"
            />
            <span className="text-sm font-mono w-8 text-center" style={{ color: "var(--text-primary)" }}>
              {concurrency}
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onAssign(number.id, selected || null, concurrency)}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Test Call Modal ───

function TestCallModal({ open, onClose, number, onTest }) {
  const [toNumber, setToNumber] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleTest = async () => {
    setLoading(true);
    setResult(null);
    const res = await onTest(number.id, toNumber);
    setResult(res);
    setLoading(false);
  };

  if (!open || !number) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <h3 className="text-base font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
          Test Call from {number.number}
        </h3>
        <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
          We'll make a real outbound call to verify this number works.
        </p>
        <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Your phone number</label>
        <input
          type="tel" value={toNumber} onChange={(e) => setToNumber(e.target.value)}
          placeholder="+919876543210"
          className="w-full mt-1 px-3 py-2 rounded-lg text-sm"
          style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
        />
        {result && (
          <div className={`mt-3 p-3 rounded-lg text-xs ${result.ok ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
            {result.ok ? (
              <span className="flex items-center gap-2"><CheckCircle size={14} /> {result.message}</span>
            ) : (
              <span className="flex items-center gap-2"><XCircle size={14} /> {result.error}</span>
            )}
          </div>
        )}
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={handleTest} disabled={!toNumber || loading}>
            {loading ? <><Loader2 size={14} className="animate-spin mr-1" /> Calling...</> : "Make Test Call"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Outbound Call Modal ───

function OutboundCallModal({ open, onClose, number, agents, onCall }) {
  const [toNumber, setToNumber] = useState("");
  const [agentId, setAgentId] = useState(number?.agent_id || "");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (number) setAgentId(number.agent_id || "");
  }, [number]);

  const handleCall = async () => {
    setLoading(true);
    setResult(null);
    const res = await onCall(number.id, toNumber, agentId);
    setResult(res);
    setLoading(false);
  };

  if (!open || !number) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <h3 className="text-base font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
          Outbound Call from {number.number}
        </h3>
        <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
          The AI agent will call this person and handle the conversation.
        </p>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Call to</label>
            <input
              type="tel" value={toNumber} onChange={(e) => setToNumber(e.target.value)}
              placeholder="+919876543210"
              className="w-full mt-1 px-3 py-2 rounded-lg text-sm"
              style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />
          </div>
          <div>
            <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Agent</label>
            <select
              value={agentId} onChange={(e) => setAgentId(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg text-sm"
              style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            >
              <option value="">Default agent</option>
              {(agents || []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        </div>
        {result && (
          <div className={`mt-3 p-3 rounded-lg text-xs ${result.ok ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
            {result.ok ? (
              <span className="flex items-center gap-2"><CheckCircle size={14} /> Call initiated to {result.to}</span>
            ) : (
              <span className="flex items-center gap-2"><XCircle size={14} /> {result.error}</span>
            )}
          </div>
        )}
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={handleCall} disabled={!toNumber || loading}>
            {loading ? <><Loader2 size={14} className="animate-spin mr-1" /> Calling...</> : <><PhoneOutgoing size={14} className="mr-1" /> Call Now</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Settings Modal ───

function SettingsModal({ open, onClose, number, onSave }) {
  const [displayName, setDisplayName] = useState("");
  const [concurrency, setConcurrency] = useState(5);

  useEffect(() => {
    if (number) {
      setDisplayName(number.display_name || "");
      setConcurrency(number.concurrency || 5);
    }
  }, [number]);

  if (!open || !number) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <h3 className="text-base font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
          Number Settings
        </h3>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Display Name</label>
            <input
              type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Sales Line, Support Number"
              className="w-full mt-1 px-3 py-2 rounded-lg text-sm"
              style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />
          </div>
          <div>
            <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              Max Concurrent Calls
            </label>
            <div className="flex items-center gap-3 mt-1">
              <input type="range" min="1" max="50" value={concurrency} onChange={(e) => setConcurrency(+e.target.value)} className="flex-1 accent-cyan-500" />
              <span className="text-sm font-mono w-8 text-center" style={{ color: "var(--text-primary)" }}>{concurrency}</span>
            </div>
            <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
              How many simultaneous calls this number can handle
            </p>
          </div>
          <div className="text-xs space-y-1" style={{ color: "var(--text-muted)" }}>
            <p>Provider: <span className="font-medium uppercase">{number.provider}</span></p>
            <p>Number: <span className="font-medium">{number.number}</span></p>
            <p>Status: <span className="font-medium">{number.status}</span></p>
            {number.last_tested_at && <p>Last tested: {new Date(number.last_tested_at).toLocaleString()}</p>}
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(number.id, { display_name: displayName, concurrency })}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Credential Input ───

function CredInput({ label, value, onChange, placeholder, type = "text", helpText }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{label}</label>
      {helpText && <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{helpText}</p>}
      <div className="relative mt-1">
        <input
          type={type === "password" && !show ? "password" : "text"}
          value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 rounded-lg text-sm pr-10"
          style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
        />
        {type === "password" && (
          <button onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1" style={{ color: "var(--text-muted)" }}>
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Wizard Step Indicator ───

function WizardSteps({ current, total }) {
  return (
    <div className="flex items-center gap-1 mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex items-center gap-1">
          <div
            className="w-2.5 h-2.5 rounded-full transition-all"
            style={{
              background: i <= current ? "var(--accent)" : "var(--border)",
              boxShadow: i <= current ? "0 0 6px var(--accent-glow)" : "none",
            }}
          />
          {i < total - 1 && (
            <div className="w-6 h-0.5" style={{ background: i < current ? "var(--accent)" : "var(--border)" }} />
          )}
        </div>
      ))}
      <span className="text-[10px] ml-2" style={{ color: "var(--text-muted)" }}>
        Step {current + 1} of {total}
      </span>
    </div>
  );
}

// ─── Vobiz Wizard ───

function VobizWizard({ onComplete, onBack, agents }) {
  const [step, setStep] = useState(0);
  const [authId, setAuthId] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [numbers, setNumbers] = useState([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [setupResult, setSetupResult] = useState(null);
  const [agentId, setAgentId] = useState("");

  const verifyCreds = async () => {
    setLoading(true);
    setError("");
    const res = await api.verifyPhoneCredentials("vobiz", { auth_id: authId, auth_token: authToken });
    if (res.ok) {
      setNumbers(res.numbers || []);
      setStep(1);
    } else {
      setError(res.error || "Verification failed");
    }
    setLoading(false);
  };

  const connectNumber = async () => {
    if (!selected) return;
    setLoading(true);
    setError("");
    const res = await api.setupPhoneNumber({
      provider: "vobiz",
      credentials: { auth_id: authId, auth_token: authToken },
      phone_number: selected,
      agent_id: agentId || undefined,
    });
    if (res.error) {
      setError(res.error);
    } else {
      setSetupResult(res);
      setStep(2);
    }
    setLoading(false);
  };

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1 text-xs mb-4 hover:underline" style={{ color: "var(--text-muted)" }}>
        <ArrowLeft size={14} /> Back
      </button>
      <WizardSteps current={step} total={3} />

      {step === 0 && (
        <div className="space-y-4">
          <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Connect Vobiz</h3>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            We'll set everything up automatically. You only need two things from your Vobiz dashboard.
          </p>
          <div className="p-3 rounded-lg text-xs space-y-1" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
            <p className="font-medium mb-2" style={{ color: "var(--text-secondary)" }}>How to find your credentials:</p>
            <p style={{ color: "var(--text-muted)" }}>1. Open console.vobiz.ai and log in</p>
            <p style={{ color: "var(--text-muted)" }}>2. On the main dashboard, you'll see your Auth ID and Auth Token</p>
            <a href="https://console.vobiz.ai" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 text-cyan-400 hover:underline">
              Open Vobiz Dashboard <ExternalLink size={11} />
            </a>
          </div>
          <CredInput label="Auth ID" value={authId} onChange={setAuthId} placeholder="AAXXXXXXXXXXXXXXXX" />
          <CredInput label="Auth Token" value={authToken} onChange={setAuthToken} placeholder="Your Vobiz Auth Token" type="password" />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <Button onClick={verifyCreds} disabled={!authId || !authToken || loading} className="w-full">
            {loading ? <><Loader2 size={14} className="animate-spin mr-1" /> Verifying...</> : "Continue"}
          </Button>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Select your phone number</h3>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>These numbers are in your Vobiz account.</p>
          {numbers.length === 0 ? (
            <div className="p-4 text-center rounded-lg" style={{ background: "var(--bg-subtle)" }}>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>No numbers found in your Vobiz account.</p>
              <a href="https://console.vobiz.ai" target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-400 hover:underline mt-1 inline-block">
                Buy a number on Vobiz
              </a>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {numbers.map((n) => (
                <label
                  key={n.number}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${selected === n.number ? "ring-2 ring-cyan-500" : ""}`}
                  style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
                >
                  <input type="radio" name="vobiz-number" value={n.number} checked={selected === n.number} onChange={() => setSelected(n.number)} className="accent-cyan-500" />
                  <span className="text-sm font-mono" style={{ color: "var(--text-primary)" }}>{n.number}</span>
                  {n.region && <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{n.region}</span>}
                </label>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <button onClick={() => setStep(0)} className="text-xs hover:underline" style={{ color: "var(--text-muted)" }}>Back</button>
            <div className="flex-1" />
            <Button onClick={connectNumber} disabled={!selected || loading}>
              {loading ? <><Loader2 size={14} className="animate-spin mr-1" /> Connecting...</> : "Connect This Number"}
            </Button>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Number Connected!</h3>
          <div className="space-y-2 text-xs" style={{ color: "var(--text-muted)" }}>
            <p className="flex items-center gap-2"><CheckCircle size={14} className="text-green-400" /> Credentials verified</p>
            <p className="flex items-center gap-2"><CheckCircle size={14} className="text-green-400" /> Created XML Application in Vobiz</p>
            <p className="flex items-center gap-2"><CheckCircle size={14} className="text-green-400" /> Set webhook to Cogniflow</p>
            {setupResult?.warning ? (
              <div className="p-3 rounded-lg mt-2" style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)" }}>
                <p className="flex items-center gap-2 text-yellow-400 font-medium"><AlertTriangle size={14} /> Manual step needed</p>
                <p className="mt-1" style={{ color: "var(--text-muted)" }}>{setupResult.warning}</p>
                <a href="https://console.vobiz.ai" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 text-cyan-400 hover:underline">
                  Open Vobiz Console <ExternalLink size={11} />
                </a>
              </div>
            ) : (
              <p className="flex items-center gap-2"><CheckCircle size={14} className="text-green-400" /> Assigned {selected} to application</p>
            )}
          </div>
          <div>
            <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Assign to agent (optional)</label>
            <select
              value={agentId} onChange={(e) => setAgentId(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg text-sm"
              style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            >
              <option value="">Assign later</option>
              {(agents || []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <Button onClick={() => onComplete(setupResult)} className="w-full">Done</Button>
        </div>
      )}
    </div>
  );
}

// ─── Twilio Wizard ───

function TwilioWizard({ onComplete, onBack, agents }) {
  const [step, setStep] = useState(0);
  const [accountSid, setAccountSid] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [numbers, setNumbers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [setupResult, setSetupResult] = useState(null);
  const [agentId, setAgentId] = useState("");

  const verifyCreds = async () => {
    setLoading(true);
    setError("");
    const res = await api.verifyPhoneCredentials("twilio", { account_sid: accountSid, auth_token: authToken });
    if (res.ok) {
      setNumbers(res.numbers || []);
      if (!phoneNumber && res.numbers?.length > 0) setPhoneNumber(res.numbers[0].number);
      setStep(1);
    } else {
      setError(res.error || "Verification failed");
    }
    setLoading(false);
  };

  const connectNumber = async () => {
    if (!phoneNumber) return;
    setLoading(true);
    setError("");
    const matchedSid = numbers.find((n) => n.number === phoneNumber)?.sid || "";
    const res = await api.setupPhoneNumber({
      provider: "twilio",
      credentials: { account_sid: accountSid, auth_token: authToken, number_sid: matchedSid },
      phone_number: phoneNumber,
      agent_id: agentId || undefined,
    });
    if (res.error) {
      setError(res.error);
    } else {
      setSetupResult(res);
      setStep(2);
    }
    setLoading(false);
  };

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1 text-xs mb-4 hover:underline" style={{ color: "var(--text-muted)" }}>
        <ArrowLeft size={14} /> Back
      </button>
      <WizardSteps current={step} total={3} />

      {step === 0 && (
        <div className="space-y-4">
          <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Connect Twilio</h3>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            We'll automatically update the webhook on your Twilio number.
          </p>
          <div className="p-3 rounded-lg text-xs space-y-1" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
            <p className="font-medium mb-2" style={{ color: "var(--text-secondary)" }}>How to find your credentials:</p>
            <p style={{ color: "var(--text-muted)" }}>1. Open console.twilio.com and log in</p>
            <p style={{ color: "var(--text-muted)" }}>2. On the dashboard, find Account SID and Auth Token</p>
            <a href="https://console.twilio.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 text-cyan-400 hover:underline">
              Open Twilio Console <ExternalLink size={11} />
            </a>
          </div>
          <CredInput label="Account SID" value={accountSid} onChange={setAccountSid} placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" helpText='Starts with "AC"' />
          <CredInput label="Auth Token" value={authToken} onChange={setAuthToken} placeholder="Your Twilio Auth Token" type="password" />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <Button onClick={verifyCreds} disabled={!accountSid || !authToken || loading} className="w-full">
            {loading ? <><Loader2 size={14} className="animate-spin mr-1" /> Verifying...</> : "Continue"}
          </Button>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Select your number</h3>
          {numbers.length > 0 ? (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {numbers.map((n) => (
                <label
                  key={n.number}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${phoneNumber === n.number ? "ring-2 ring-cyan-500" : ""}`}
                  style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
                >
                  <input type="radio" name="twilio-number" value={n.number} checked={phoneNumber === n.number} onChange={() => setPhoneNumber(n.number)} className="accent-cyan-500" />
                  <span className="text-sm font-mono" style={{ color: "var(--text-primary)" }}>{n.number}</span>
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{n.friendly_name}</span>
                </label>
              ))}
            </div>
          ) : (
            <div>
              <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>Enter your Twilio phone number:</p>
              <input
                type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+919876543210"
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              />
            </div>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex items-center gap-2">
            <button onClick={() => setStep(0)} className="text-xs hover:underline" style={{ color: "var(--text-muted)" }}>Back</button>
            <div className="flex-1" />
            <Button onClick={connectNumber} disabled={!phoneNumber || loading}>
              {loading ? <><Loader2 size={14} className="animate-spin mr-1" /> Configuring...</> : "Connect This Number"}
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Number Connected!</h3>
          <div className="space-y-2 text-xs" style={{ color: "var(--text-muted)" }}>
            <p className="flex items-center gap-2"><CheckCircle size={14} className="text-green-400" /> Credentials verified</p>
            <p className="flex items-center gap-2"><CheckCircle size={14} className="text-green-400" /> Found {phoneNumber} in your account</p>
            <p className="flex items-center gap-2"><CheckCircle size={14} className="text-green-400" /> Updated webhook URL</p>
            <p className="flex items-center gap-2"><CheckCircle size={14} className="text-green-400" /> Configured status callback</p>
          </div>
          <div>
            <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Assign to agent (optional)</label>
            <select
              value={agentId} onChange={(e) => setAgentId(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg text-sm"
              style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            >
              <option value="">Assign later</option>
              {(agents || []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <Button onClick={() => onComplete(setupResult)} className="w-full">Done</Button>
        </div>
      )}
    </div>
  );
}

// ─── Exotel Wizard ───

function ExotelWizard({ onComplete, onBack, agents }) {
  const [step, setStep] = useState(0);
  const [activated, setActivated] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [accountSid, setAccountSid] = useState("");
  const [subdomain, setSubdomain] = useState("api");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [setupResult, setSetupResult] = useState(null);
  const [agentId, setAgentId] = useState("");

  const emailTemplate = `To: hello@exotel.com\nSubject: Voicebot Applet Activation Request\n\nPlease activate the Voicebot Applet on my account.\nI need it for AI voice bot integration.\nAccount SID: ${accountSid || "[your_sid]"}`;

  const verifyCreds = async () => {
    setLoading(true);
    setError("");
    const res = await api.verifyPhoneCredentials("exotel", { api_key: apiKey, api_token: apiToken, account_sid: accountSid, subdomain });
    if (res.ok) {
      if (res.numbers?.length > 0 && !phoneNumber) setPhoneNumber(res.numbers[0].number);
      setStep(2);
    } else {
      setError(res.error || "Verification failed");
    }
    setLoading(false);
  };

  const connectNumber = async () => {
    setLoading(true);
    setError("");
    const res = await api.setupPhoneNumber({
      provider: "exotel",
      credentials: { api_key: apiKey, api_token: apiToken, account_sid: accountSid, subdomain },
      phone_number: phoneNumber,
      agent_id: agentId || undefined,
    });
    if (res.error) {
      setError(res.error);
    } else {
      setSetupResult(res);
      setStep(3);
    }
    setLoading(false);
  };

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1 text-xs mb-4 hover:underline" style={{ color: "var(--text-muted)" }}>
        <ArrowLeft size={14} /> Back
      </button>
      <WizardSteps current={step} total={4} />

      {step === 0 && (
        <div className="space-y-4">
          <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Exotel Requires Activation</h3>
          <div className="p-3 rounded-lg" style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)" }}>
            <p className="text-xs flex items-center gap-2" style={{ color: "#f59e0b" }}>
              <AlertTriangle size={14} /> Exotel must manually activate the "Voicebot Applet" on your account. This takes 1-2 business days.
            </p>
          </div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Have you already requested activation?</p>
          <div className="flex gap-2">
            <Button onClick={() => { setActivated(true); setStep(1); }}>Yes, it's activated</Button>
            <Button variant="outline" onClick={() => setActivated(false)}>No, I need to request it</Button>
          </div>
          {!activated && (
            <div className="p-3 rounded-lg text-xs space-y-2" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
              <p className="font-medium" style={{ color: "var(--text-secondary)" }}>Email Exotel:</p>
              <pre className="p-2 rounded text-[10px] whitespace-pre-wrap" style={{ background: "var(--bg-card)", color: "var(--text-muted)" }}>
                {emailTemplate}
              </pre>
              <button
                onClick={() => navigator.clipboard.writeText(emailTemplate)}
                className="flex items-center gap-1 text-cyan-400 hover:underline"
              >
                <Copy size={11} /> Copy email template
              </button>
            </div>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Enter Exotel Credentials</h3>
          <div className="p-3 rounded-lg text-xs" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
            <p style={{ color: "var(--text-muted)" }}>Find these in Exotel Dashboard &rarr; Settings &rarr; API Settings</p>
            <a href="https://my.exotel.com/apisettings/site#api-credentials" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-1 text-cyan-400 hover:underline">
              Open Exotel API Settings <ExternalLink size={11} />
            </a>
          </div>
          <CredInput label="API Key" value={apiKey} onChange={setApiKey} placeholder="Your Exotel API Key" />
          <CredInput label="API Token" value={apiToken} onChange={setApiToken} placeholder="Your Exotel API Token" type="password" />
          <CredInput label="Account SID" value={accountSid} onChange={setAccountSid} placeholder="Your Exotel Account SID" />
          <div>
            <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Subdomain</label>
            <select
              value={subdomain} onChange={(e) => setSubdomain(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg text-sm"
              style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            >
              <option value="api">api (Singapore)</option>
              <option value="api.in">api.in (Mumbai / India)</option>
            </select>
          </div>
          <CredInput label="ExoPhone Number" value={phoneNumber} onChange={setPhoneNumber} placeholder="08XXXXXXXXXX" />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex items-center gap-2">
            <button onClick={() => setStep(0)} className="text-xs hover:underline" style={{ color: "var(--text-muted)" }}>Back</button>
            <div className="flex-1" />
            <Button onClick={verifyCreds} disabled={!apiKey || !apiToken || !accountSid || loading}>
              {loading ? <><Loader2 size={14} className="animate-spin mr-1" /> Verifying...</> : "Continue"}
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Credentials Verified</h3>
          <div className="space-y-2 text-xs" style={{ color: "var(--text-muted)" }}>
            <p className="flex items-center gap-2"><CheckCircle size={14} className="text-green-400" /> Credentials verified</p>
            <p className="flex items-center gap-2"><CheckCircle size={14} className="text-green-400" /> Voicebot Applet configured</p>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <Button onClick={connectNumber} disabled={!phoneNumber || loading} className="w-full">
            {loading ? <><Loader2 size={14} className="animate-spin mr-1" /> Setting up...</> : "Continue to Final Step"}
          </Button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>One Last Step in Exotel</h3>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            You need to assign the call flow to your phone number. This takes 30 seconds.
          </p>
          <div className="p-3 rounded-lg text-xs space-y-2" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
            <p style={{ color: "var(--text-secondary)" }}>1. Open your Exotel dashboard</p>
            <p style={{ color: "var(--text-secondary)" }}>2. Go to: <span className="font-medium">My Numbers</span></p>
            <p style={{ color: "var(--text-secondary)" }}>3. Click on: <span className="font-mono">{phoneNumber}</span></p>
            <p style={{ color: "var(--text-secondary)" }}>4. Under "Set App", select: <span className="font-medium">Cogniflow AI</span></p>
            <p style={{ color: "var(--text-secondary)" }}>5. Click Save</p>
          </div>
          <a href="https://my.exotel.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:underline">
            Open Exotel Dashboard <ExternalLink size={11} />
          </a>
          <div>
            <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Assign to agent (optional)</label>
            <select
              value={agentId} onChange={(e) => setAgentId(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg text-sm"
              style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            >
              <option value="">Assign later</option>
              {(agents || []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <Button onClick={() => onComplete(setupResult)} className="w-full">I've Completed This</Button>
        </div>
      )}
    </div>
  );
}

// ─── MCube Wizard ───

function McubeWizard({ onComplete, onBack, tenantId }) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const sipEndpoint = `sip:cogniflow-${(tenantId || "tenant").substring(0, 8)}@sip.cogniflowautomations.com`;

  const mcubeMessage = `I need to configure a SIP trunk to forward calls from my number to this URI (for both inbound and outbound):\n${sipEndpoint}`;

  const saveNumber = async () => {
    if (!phoneNumber) return;
    setLoading(true);
    setError("");
    const res = await api.setupPhoneNumber({
      provider: "mcube",
      credentials: {},
      phone_number: phoneNumber,
    });
    if (res.error) {
      setError(res.error);
    } else {
      onComplete(res);
    }
    setLoading(false);
  };

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1 text-xs mb-4 hover:underline" style={{ color: "var(--text-muted)" }}>
        <ArrowLeft size={14} /> Back
      </button>
      <h3 className="text-base font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Connect MCube</h3>
      <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
        MCube doesn't have a public API for automated setup. We'll give you a SIP endpoint — you provide it to MCube support.
      </p>

      <div className="p-3 rounded-lg mb-4" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
        <p className="text-[10px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Your Cogniflow SIP Endpoint</p>
        <div className="flex items-center gap-2">
          <code className="text-xs font-mono flex-1 break-all" style={{ color: "var(--accent)" }}>{sipEndpoint}</code>
          <button onClick={() => navigator.clipboard.writeText(sipEndpoint)} className="p-1.5 rounded hover:bg-white/5" title="Copy">
            <Copy size={14} style={{ color: "var(--text-muted)" }} />
          </button>
        </div>
      </div>

      <div className="p-3 rounded-lg text-xs space-y-2 mb-4" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
        <p className="font-medium" style={{ color: "var(--text-secondary)" }}>What to do:</p>
        <p style={{ color: "var(--text-muted)" }}>1. Contact MCube support: 1800 419 2202 or sales@mcube.com</p>
        <p style={{ color: "var(--text-muted)" }}>2. Tell them to configure a SIP trunk to this URI</p>
        <button
          onClick={() => navigator.clipboard.writeText(mcubeMessage)}
          className="flex items-center gap-1 text-cyan-400 hover:underline"
        >
          <Copy size={11} /> Copy message for MCube
        </button>
        <p style={{ color: "var(--text-muted)" }}>3. Once MCube confirms, enter your number below</p>
      </div>

      <CredInput label="Your MCube Number" value={phoneNumber} onChange={setPhoneNumber} placeholder="+91 XXXXX XXXXX" />
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
      <Button onClick={saveNumber} disabled={!phoneNumber || loading} className="w-full mt-4">
        {loading ? <><Loader2 size={14} className="animate-spin mr-1" /> Saving...</> : "Save & Verify"}
      </Button>
    </div>
  );
}

// ─── Provider Selection Grid ───

function ProviderGrid({ onSelect }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {PROVIDERS.map((p) => (
        <button
          key={p.id}
          onClick={() => onSelect(p.id)}
          className="p-4 rounded-xl text-left transition-all duration-200 hover:shadow-lg group relative"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          {p.recommended && (
            <span className="absolute -top-2 right-3 px-2 py-0.5 rounded-full text-[9px] font-bold" style={{ background: "var(--accent)", color: "#000" }}>
              RECOMMENDED
            </span>
          )}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{p.flag}</span>
            <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{p.name}</span>
          </div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{p.tagline}</p>
          <div className="mt-2 space-y-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
            <p>{p.price}</p>
            {p.auto ? (
              <p className="text-green-400">Auto-configured</p>
            ) : (
              <p className="text-yellow-400">{p.kyc ? "KYC required" : "Manual setup"}</p>
            )}
            <p>{p.time}</p>
          </div>
          <div className="mt-3 flex items-center gap-1 text-xs font-medium" style={{ color: "var(--accent)" }}>
            Connect {p.name} <ChevronRight size={14} />
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── Main Page ───

export default function PhoneNumbers() {
  const queryClient = useQueryClient();
  const [wizard, setWizard] = useState(null); // null | "select" | "vobiz" | "twilio" | "exotel" | "mcube"
  const [assignModal, setAssignModal] = useState(null);
  const [testModal, setTestModal] = useState(null);
  const [settingsModal, setSettingsModal] = useState(null);
  const [callModal, setCallModal] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["phone-numbers"],
    queryFn: () => api.getPhoneNumbers(),
    refetchInterval: 30000,
  });

  const { data: agentsData } = useQuery({
    queryKey: ["agents"],
    queryFn: () => api.getAgents(),
  });

  const agents = agentsData?.agents || agentsData || [];
  const numbers = data?.numbers || [];

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }) => api.updatePhoneNumber(id, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["phone-numbers"] }),
  });

  const removeMutation = useMutation({
    mutationFn: (id) => api.removePhoneNumber(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["phone-numbers"] }),
  });

  const handleAssign = async (numberId, agentId, concurrency) => {
    await updateMutation.mutateAsync({ id: numberId, updates: { agent_id: agentId, concurrency } });
    setAssignModal(null);
  };

  const handleTestCall = async (numberId, toNumber) => {
    return api.testPhoneNumber(numberId, toNumber);
  };

  const handleSettings = async (numberId, updates) => {
    await updateMutation.mutateAsync({ id: numberId, updates });
    setSettingsModal(null);
  };

  const handleRemove = async (num) => {
    if (!confirm(`Remove ${num.number}? This will unassign it from any agent.`)) return;
    await removeMutation.mutateAsync(num.id);
  };

  const handleOutboundCall = async (numberId, toNumber, agentId) => {
    return api.makeOutboundCall(numberId, toNumber, agentId);
  };

  const handleWizardComplete = () => {
    setWizard(null);
    queryClient.invalidateQueries({ queryKey: ["phone-numbers"] });
    queryClient.invalidateQueries({ queryKey: ["agents"] });
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Phone Numbers"
        description="Connect your phone numbers so AI agents can make and receive calls."
      />

      {/* Wizard Modal */}
      <Dialog open={!!wizard} onOpenChange={() => setWizard(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {wizard === "select" && (
            <div>
              <h3 className="text-base font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                Choose your phone number provider
              </h3>
              <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
                Select the provider where you have (or want) a phone number.
              </p>
              <ProviderGrid onSelect={(id) => setWizard(id)} />
              <p className="text-xs mt-4" style={{ color: "var(--text-muted)" }}>
                Don't have a number yet?{" "}
                <a href="https://console.vobiz.ai" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">
                  Buy from Vobiz
                </a>
              </p>
            </div>
          )}
          {wizard === "vobiz" && <VobizWizard onComplete={handleWizardComplete} onBack={() => setWizard("select")} agents={agents} />}
          {wizard === "twilio" && <TwilioWizard onComplete={handleWizardComplete} onBack={() => setWizard("select")} agents={agents} />}
          {wizard === "exotel" && <ExotelWizard onComplete={handleWizardComplete} onBack={() => setWizard("select")} agents={agents} />}
          {wizard === "mcube" && <McubeWizard onComplete={handleWizardComplete} onBack={() => setWizard("select")} tenantId={data?.tenant_id} />}
        </DialogContent>
      </Dialog>

      {/* Assign Agent Modal */}
      <AssignAgentModal
        open={!!assignModal}
        onClose={() => setAssignModal(null)}
        number={assignModal}
        agents={agents}
        onAssign={handleAssign}
      />

      {/* Test Call Modal */}
      <TestCallModal
        open={!!testModal}
        onClose={() => setTestModal(null)}
        number={testModal}
        onTest={handleTestCall}
      />

      {/* Settings Modal */}
      <SettingsModal
        open={!!settingsModal}
        onClose={() => setSettingsModal(null)}
        number={settingsModal}
        onSave={handleSettings}
      />

      {/* Outbound Call Modal */}
      <OutboundCallModal
        open={!!callModal}
        onClose={() => setCallModal(null)}
        number={callModal}
        agents={agents}
        onCall={handleOutboundCall}
      />

      {/* Action Bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs" style={{ color: "var(--text-muted)" }}>
          {numbers.length} number{numbers.length !== 1 ? "s" : ""} connected
        </div>
        <Button onClick={() => setWizard("select")}>
          <Plus size={14} className="mr-1" /> Connect Number
        </Button>
      </div>

      {/* Number List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin" style={{ color: "var(--accent)" }} />
        </div>
      ) : numbers.length === 0 ? (
        <div className="text-center py-16">
          <Phone size={40} className="mx-auto mb-4" style={{ color: "var(--text-muted)", opacity: 0.4 }} />
          <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>No phone numbers connected</h3>
          <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
            Connect a phone number to start making and receiving AI calls.
          </p>
          <Button onClick={() => setWizard("select")}>
            <Plus size={14} className="mr-1" /> Connect Your First Number
          </Button>

          <div className="mt-8">
            <p className="text-[10px] font-medium mb-3 uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Supported providers
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-md mx-auto">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setWizard(p.id)}
                  className="p-3 rounded-lg text-center transition-all hover:shadow-md"
                  style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
                >
                  <span className="text-lg block">{p.flag}</span>
                  <span className="text-xs font-medium block mt-1" style={{ color: "var(--text-primary)" }}>{p.name}</span>
                  <span className="text-[9px] block" style={{ color: "var(--text-muted)" }}>{p.tagline}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {numbers.map((num) => (
            <NumberCard
              key={num.id}
              num={num}
              agents={agents}
              onAssign={(n) => setAssignModal(n)}
              onTest={(n) => setTestModal(n)}
              onSettings={(n) => setSettingsModal(n)}
              onRemove={handleRemove}
              onCall={(n) => setCallModal(n)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
