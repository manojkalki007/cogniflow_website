import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import TestCallPanel from "../components/TestCallPanel";
import {
  ArrowLeft, Save, Trash2, Copy, Loader2, Check, X,
  AlertTriangle, PhoneCall, Brain, Volume2, Mic, Settings2,
  Wrench, Sparkles, Code2, MessageSquare, Play, Phone,
  ChevronDown, Info, Calendar, PhoneForwarded, UserPlus,
  Mail, MessageCircle, CreditCard, Clock, Shield,
  Zap, Globe, BookOpen, Radio, Waves, SlidersHorizontal,
  ToggleLeft, Link, RotateCcw, Users, Eye,
} from "lucide-react";

/* ─────────────────────────────────────────────
   DATA CONSTANTS
   ───────────────────────────────────────────── */

const LLM_MODELS = {
  groq: [
    { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B", cost: 0.0012, latency: 120, tier: "best", tierLabel: "Best" },
    { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B", cost: 0.0003, latency: 60, tier: "fast", tierLabel: "Fast" },
    { id: "mixtral-8x7b-32768", label: "Mixtral 8x7B", cost: 0.0008, latency: 90, tier: "balanced", tierLabel: "Balanced" },
  ],
};

const TTS_VOICES = {
  smallest: {
    female: [
      { id: "emily", label: "Emily", desc: "Clear & warm, natural American" },
      { id: "jasmine", label: "Jasmine", desc: "Friendly & approachable" },
      { id: "ananya", label: "Ananya", desc: "Professional Indian English" },
      { id: "diya", label: "Diya", desc: "Calm & professional" },
      { id: "nisha", label: "Nisha", desc: "Gentle & empathetic" },
      { id: "pooja", label: "Pooja", desc: "Energetic & persuasive" },
    ],
    male: [
      { id: "arman", label: "Arman", desc: "Confident & authoritative" },
      { id: "james", label: "James", desc: "Professional American" },
      { id: "raj", label: "Raj", desc: "Natural Indian English" },
      { id: "george", label: "George", desc: "Warm & trustworthy" },
      { id: "aravind", label: "Aravind", desc: "Casual & friendly" },
      { id: "arnav", label: "Arnav", desc: "Energetic & dynamic" },
    ],
  },
  sarvam: {
    female: [
      { id: "meera", label: "Meera", desc: "Warm Hindi, natural" },
      { id: "kavya", label: "Kavya", desc: "Gentle & soothing" },
      { id: "priya", label: "Priya", desc: "Friendly & engaging" },
    ],
    male: [
      { id: "amit", label: "Amit", desc: "Confident & clear" },
      { id: "manan", label: "Manan", desc: "Casual & relatable" },
      { id: "aditya", label: "Aditya", desc: "Professional & composed" },
    ],
  },
};

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "ta", label: "Tamil" },
  { code: "te", label: "Telugu" },
  { code: "kn", label: "Kannada" },
  { code: "ml", label: "Malayalam" },
  { code: "bn", label: "Bengali" },
  { code: "mr", label: "Marathi" },
  { code: "gu", label: "Gujarati" },
  { code: "en-in", label: "English (Indian)" },
];

const EMOTION_PROFILES = [
  { id: "friendly", label: "Friendly & Efficient", desc: "General purpose — sales, support" },
  { id: "empathetic", label: "Warm & Empathetic", desc: "Healthcare, customer care" },
  { id: "energetic", label: "Energetic & Persuasive", desc: "Sales, EdTech, outbound" },
  { id: "professional", label: "Calm & Professional", desc: "Finance, legal, enterprise" },
  { id: "hinglish_friendly", label: "Hinglish Natural", desc: "Indian market, casual" },
];

const AVAILABLE_TOOLS = [
  { id: "book_appointment", label: "Book Appointment", icon: Calendar, desc: "Schedule meetings via Cal.com or Google Calendar" },
  { id: "transfer_call", label: "Transfer Call", icon: PhoneForwarded, desc: "Transfer to human agent when needed" },
  { id: "save_contact_info", label: "Save Contact", icon: UserPlus, desc: "Create or update contact in CRM" },
  { id: "send_followup", label: "Send Follow-up", icon: Mail, desc: "Send follow-up emails automatically" },
  { id: "send_whatsapp", label: "Send WhatsApp", icon: MessageCircle, desc: "Send WhatsApp messages & templates" },
  { id: "check_availability", label: "Check Calendar", icon: Clock, desc: "Check available time slots in real-time" },
  { id: "create_payment_link", label: "Payment Link", icon: CreditCard, desc: "Generate Razorpay payment links" },
];

const FEATURE_TOGGLES = [
  { key: "enable_memory", label: "Caller Memory", desc: "Remember callers across sessions", icon: Brain },
  { key: "enable_speculative", label: "Speculative Generation", desc: "Pre-generate likely responses for lower latency", icon: Zap },
  { key: "enable_filler", label: "Filler Audio", desc: "Natural filler sounds during tool calls", icon: Waves },
  { key: "enable_emotion", label: "Emotion Mirroring", desc: "Adapt tone based on caller sentiment", icon: Radio },
  { key: "enable_language_switch", label: "Language Switching", desc: "Auto-detect and switch languages mid-call", icon: Globe },
  { key: "enable_rag", label: "RAG Knowledge Base", desc: "Use uploaded documents during calls", icon: BookOpen },
  { key: "enable_prediction", label: "Pre-call Prediction", desc: "Predict caller intent before answering", icon: Eye },
];

const PROVIDER_COSTS = {
  stt: {
    deepgram: { cost: 0.0043, latency: 80, label: "Deepgram Nova-3" },
    sarvam: { cost: 0.0060, latency: 90, label: "Sarvam Saaras v3" },
  },
  tts: {
    smallest: { cost: 0.015, latency: 150, label: "Smallest AI" },
    sarvam: { cost: 0.020, latency: 130, label: "Sarvam Bulbul v3" },
  },
  llm: {
    groq: { cost: 0.0012, latency: 120, label: "Groq" },
  },
};

const NAV_SECTIONS = [
  { id: "model", icon: Brain, label: "Model" },
  { id: "voice", icon: Volume2, label: "Voice" },
  { id: "transcriber", icon: Mic, label: "Transcriber" },
  { id: "agent", icon: MessageSquare, label: "Agent" },
  { id: "call", icon: Phone, label: "Call Settings" },
  { id: "tools", icon: Wrench, label: "Tools" },
  { id: "features", icon: Sparkles, label: "Features" },
  { id: "advanced", icon: Code2, label: "Advanced" },
];

const defaultForm = {
  name: "",
  instructions: "",
  greeting: "",
  language: "en",
  emotion_profile: "friendly",
  voice_gender: "female",
  voice_id: "emily",
  llm_provider: "groq",
  llm_model: "llama-3.3-70b-versatile",
  tts_provider: "smallest",
  stt_language: "en",
  endpointing_ms: 300,
  smart_format: true,
  temperature: 0.7,
  max_tokens: 80,
  max_call_duration: 600,
  silence_timeout: 10,
  enable_recording: true,
  enable_barge_in: true,
  enable_memory: true,
  enable_prediction: true,
  enable_emotion: true,
  enable_language_switch: true,
  enable_rag: false,
  enable_speculative: true,
  enable_filler: true,
  tools_enabled: [
    "book_appointment", "transfer_call", "save_contact_info",
    "send_followup", "send_whatsapp", "check_availability", "create_payment_link",
  ],
  webhook_url: "",
  fallback_message: "I'm sorry, I'm having trouble right now. Could you repeat that?",
  max_retries: 3,
  concurrent_call_limit: 5,
};

/* ─────────────────────────────────────────────
   SHARED INPUT STYLE
   ───────────────────────────────────────────── */

const inputClass = "w-full rounded-lg px-3 py-2.5 border text-sm outline-none focus:border-[var(--accent)] transition-colors duration-200";
const inputStyle = { background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-primary)" };

/* ─────────────────────────────────────────────
   TOGGLE SWITCH
   ───────────────────────────────────────────── */

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative w-11 h-6 rounded-full transition-all duration-200 flex-shrink-0 cursor-pointer"
      style={{
        background: checked ? "var(--accent)" : "var(--bg-muted)",
        boxShadow: checked ? "0 0 12px var(--accent-glow, rgba(99,102,241,0.25))" : "none",
      }}
    >
      <span
        className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200"
        style={{ left: checked ? "1.375rem" : "0.25rem" }}
      />
    </button>
  );
}

/* ─────────────────────────────────────────────
   SECTION LABEL
   ───────────────────────────────────────────── */

function SectionLabel({ children, className = "" }) {
  return (
    <label
      className={`text-[11px] font-semibold uppercase tracking-wider block ${className}`}
      style={{ color: "var(--text-muted)" }}
    >
      {children}
    </label>
  );
}

function SectionTitle({ title, subtitle }) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h2>
      {subtitle && <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>{subtitle}</p>}
    </div>
  );
}

/* ─────────────────────────────────────────────
   TIER BADGE
   ───────────────────────────────────────────── */

function TierBadge({ tier }) {
  const styles = {
    best: { bg: "rgba(16,185,129,0.1)", color: "#10B981", border: "rgba(16,185,129,0.2)" },
    fast: { bg: "rgba(245,158,11,0.1)", color: "#F59E0B", border: "rgba(245,158,11,0.2)" },
    balanced: { bg: "rgba(59,130,246,0.1)", color: "#3B82F6", border: "rgba(59,130,246,0.2)" },
  };
  const s = styles[tier] || styles.balanced;
  return (
    <span
      className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
      style={{ background: s.bg, color: s.color, borderColor: s.border }}
    >
      {tier === "best" ? "Best" : tier === "fast" ? "Fast" : "Balanced"}
    </span>
  );
}

/* ─────────────────────────────────────────────
   TOOLTIP (minimal)
   ───────────────────────────────────────────── */

function Tooltip({ text, children }) {
  const [show, setShow] = useState(false);
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap pointer-events-none"
          style={{
            background: "var(--text-primary)",
            color: "var(--bg-primary, #0f0f13)",
          }}
        >
          {text}
          <span
            className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0"
            style={{
              borderLeft: "4px solid transparent",
              borderRight: "4px solid transparent",
              borderTop: "4px solid var(--text-primary)",
            }}
          />
        </span>
      )}
    </span>
  );
}

/* ─────────────────────────────────────────────
   LOADING SKELETON
   ───────────────────────────────────────────── */

function Skeleton() {
  const bar = (w, h = "h-4") => (
    <div
      className={`${h} rounded-lg animate-pulse`}
      style={{ background: "var(--bg-muted)", width: w }}
    />
  );

  return (
    <div className="h-[calc(100vh-60px)] flex">
      {/* Left nav skeleton */}
      <div className="w-56 border-r p-4 space-y-3 flex-shrink-0" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
        {bar("60%", "h-5")}
        <div className="mt-6 space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5">
              {bar("20px", "h-5")}
              {bar("70%", "h-4")}
            </div>
          ))}
        </div>
      </div>
      {/* Center skeleton */}
      <div className="flex-1 p-8 space-y-6" style={{ background: "var(--bg-primary)" }}>
        {bar("40%", "h-6")}
        {bar("60%", "h-4")}
        <div className="mt-6 space-y-4">
          {bar("100%", "h-12")}
          {bar("100%", "h-32")}
          {bar("80%", "h-12")}
        </div>
      </div>
      {/* Right panel skeleton */}
      <div className="w-72 border-l p-4 space-y-4 flex-shrink-0" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
        {bar("50%", "h-3")}
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="p-3 rounded-xl space-y-2" style={{ background: "var(--surface)" }}>
            {bar("40%", "h-3")}
            {bar("70%", "h-4")}
            {bar("50%", "h-3")}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   LEFT NAV
   ───────────────────────────────────────────── */

function LeftNav({ agentName, active, onChange, onBack }) {
  return (
    <div
      className="w-56 border-r flex flex-col flex-shrink-0"
      style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
    >
      {/* Agent identity */}
      <div className="p-4 border-b" style={{ borderColor: "var(--border)" }}>
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs mb-3 transition-colors duration-200 hover:opacity-80"
          style={{ color: "var(--text-muted)" }}
        >
          <ArrowLeft size={14} />
          <span>Back to Agents</span>
        </button>
        <p
          className="text-sm font-semibold truncate"
          style={{ color: "var(--text-primary)" }}
          title={agentName || "New Agent"}
        >
          {agentName || "New Agent"}
        </p>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {NAV_SECTIONS.map((s) => {
          const Icon = s.icon;
          const isActive = active === s.id;
          return (
            <button
              key={s.id}
              onClick={() => onChange(s.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200"
              style={{
                background: isActive ? "var(--accent-subtle)" : "transparent",
                color: isActive ? "var(--accent)" : "var(--text-secondary)",
                fontWeight: isActive ? 600 : 400,
              }}
            >
              <Icon size={16} style={{ opacity: isActive ? 1 : 0.7 }} />
              <span>{s.label}</span>
              {isActive && (
                <div
                  className="ml-auto w-1.5 h-1.5 rounded-full"
                  style={{ background: "var(--accent)" }}
                />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

/* ─────────────────────────────────────────────
   RIGHT PANEL — PROVIDER STACK
   ───────────────────────────────────────────── */

function ProviderStack({ form }) {
  const sttKey = form.stt_language && ["hi", "ta", "te", "kn", "ml", "bn", "mr", "gu"].includes(form.stt_language) ? "sarvam" : "deepgram";
  const stt = PROVIDER_COSTS.stt[sttKey];
  const llmModel = (LLM_MODELS[form.llm_provider] || []).find((m) => m.id === form.llm_model);
  const llm = {
    cost: llmModel?.cost || PROVIDER_COSTS.llm.groq.cost,
    latency: llmModel?.latency || PROVIDER_COSTS.llm.groq.latency,
    label: llmModel ? `${llmModel.label} (Groq)` : PROVIDER_COSTS.llm.groq.label,
  };
  const tts = PROVIDER_COSTS.tts[form.tts_provider] || PROVIDER_COSTS.tts.smallest;

  const providers = [
    { key: "STT", ...stt, color: "#EF4444" },
    { key: "LLM", ...llm, color: "#10B981" },
    { key: "TTS", ...tts, color: "#3B82F6" },
  ];

  const totalCost = providers.reduce((s, p) => s + p.cost, 0);
  const totalLatency = providers.reduce((s, p) => s + p.latency, 0);
  const latencyColor = totalLatency < 500 ? "#10B981" : totalLatency < 800 ? "#F59E0B" : "#EF4444";

  return (
    <div className="space-y-3">
      <SectionLabel>Provider Stack</SectionLabel>

      <div className="space-y-2">
        {providers.map((p) => (
          <div
            key={p.key}
            className="p-3 rounded-xl border transition-all duration-200"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: p.color }}
              >
                {p.key}
              </span>
              <span
                className="text-[10px] font-mono tabular-nums"
                style={{ color: "var(--text-muted)" }}
              >
                ~{p.latency}ms
              </span>
            </div>
            <div className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>
              {p.label}
            </div>
            <div className="text-[10px] mt-0.5 font-mono" style={{ color: "var(--text-muted)" }}>
              ${p.cost.toFixed(4)}/min
            </div>
          </div>
        ))}
      </div>

      {/* Cost bar */}
      <div className="flex h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-muted)" }}>
        {providers.map((p) => (
          <Tooltip key={p.key} text={`${p.key}: $${p.cost.toFixed(4)}/min`}>
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${(p.latency / totalLatency) * 100}%`,
                background: p.color,
              }}
            />
          </Tooltip>
        ))}
      </div>

      <div className="flex items-center justify-between text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
        <span>STT</span>
        <span>LLM</span>
        <span>TTS</span>
      </div>

      {/* Totals */}
      <div
        className="p-3 rounded-xl border"
        style={{
          background: "var(--accent-subtle)",
          borderColor: `${latencyColor}25`,
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
              ${totalCost.toFixed(4)}/min
            </div>
            <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              Estimated cost
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold tabular-nums" style={{ color: latencyColor }}>
              ~{totalLatency}ms
            </div>
            <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              Turn latency
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OutboundCallSection({ agentId, isNew }) {
  const [expanded, setExpanded] = useState(false);
  const [toNumber, setToNumber] = useState("");
  const [fromNumberId, setFromNumberId] = useState("");
  const [calling, setCalling] = useState(false);
  const [result, setResult] = useState(null);

  const { data: phoneNumbers } = useQuery({
    queryKey: ["phone-numbers"],
    queryFn: () => api.getPhoneNumbers(),
    enabled: expanded && !isNew,
  });

  const activeNumbers = (phoneNumbers?.numbers || []).filter(
    (n) => n.status === "active" && !n.error
  );

  const handleCall = async () => {
    if (!toNumber.trim() || !fromNumberId) return;
    setCalling(true);
    setResult(null);
    const res = await api.makeOutboundCall(fromNumberId, toNumber.trim(), agentId);
    setResult(res);
    setCalling(false);
  };

  if (isNew) return null;

  return (
    <div className="space-y-3">
      <SectionLabel>Outbound Call</SectionLabel>
      {!expanded ? (
        <button
          onClick={() => setExpanded(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200"
          style={{
            background: "var(--surface)",
            color: "var(--text-secondary)",
            border: "1px solid",
            borderColor: "var(--border)",
          }}
        >
          <Phone size={15} />
          Make a Call
        </button>
      ) : (
        <div
          className="rounded-xl border p-3 space-y-3"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div>
            <label className="text-[10px] font-medium uppercase tracking-wider mb-1 block" style={{ color: "var(--text-muted)" }}>
              From Number
            </label>
            <select
              value={fromNumberId}
              onChange={(e) => setFromNumberId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-xs border outline-none"
              style={{ background: "var(--bg-muted)", borderColor: "var(--border)", color: "var(--text-primary)" }}
            >
              <option value="">Select phone number</option>
              {activeNumbers.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.number} ({n.provider})
                </option>
              ))}
            </select>
            {activeNumbers.length === 0 && (
              <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                No active numbers. Connect one in Phone Numbers.
              </p>
            )}
          </div>
          <div>
            <label className="text-[10px] font-medium uppercase tracking-wider mb-1 block" style={{ color: "var(--text-muted)" }}>
              To Number
            </label>
            <input
              type="tel"
              value={toNumber}
              onChange={(e) => setToNumber(e.target.value)}
              placeholder="+91XXXXXXXXXX"
              className="w-full px-3 py-2 rounded-lg text-xs border outline-none"
              style={{ background: "var(--bg-muted)", borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
          </div>
          {result && (
            <div
              className={`px-3 py-2 rounded-lg text-[11px] ${
                result.error
                  ? "bg-red-500/10 border border-red-500/20 text-red-500"
                  : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-600"
              }`}
            >
              {result.error || "Call initiated!"}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => { setExpanded(false); setResult(null); }}
              className="flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors"
              style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
            >
              Cancel
            </button>
            <button
              onClick={handleCall}
              disabled={calling || !toNumber.trim() || !fromNumberId}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white transition-colors disabled:opacity-40"
              style={{ background: "#10B981" }}
            >
              {calling ? <Loader2 size={13} className="animate-spin" /> : <Phone size={13} />}
              {calling ? "Calling..." : "Call"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RightPanel({ form, isNew, id, showTestCall, onTestCall, onCloseTestCall }) {
  return (
    <div
      className="w-72 border-l flex flex-col flex-shrink-0 overflow-y-auto"
      style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
    >
      <div className="p-4 space-y-6 flex-1">
        <ProviderStack form={form} />

        {/* Agent status */}
        <div className="space-y-3">
          <SectionLabel>Agent Status</SectionLabel>
          <div
            className="p-3 rounded-xl border"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: isNew ? "#F59E0B" : "#10B981" }}
              />
              <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                {isNew ? "Draft" : "Active"}
              </span>
            </div>
            {!isNew && id && (
              <div className="text-[10px] font-mono truncate" style={{ color: "var(--text-muted)" }}>
                {id}
              </div>
            )}
          </div>
        </div>

        {/* Test call — browser voice */}
        <div className="space-y-3">
          <SectionLabel>Browser Test</SectionLabel>
          {showTestCall && !isNew ? (
            <TestCallPanel agent={{ id, name: form.name || "Agent" }} onClose={onCloseTestCall} />
          ) : (
            <button
              onClick={onTestCall}
              disabled={isNew}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: isNew ? "var(--bg-muted)" : "var(--accent-subtle)",
                color: isNew ? "var(--text-muted)" : "var(--accent)",
                border: "1px solid",
                borderColor: isNew ? "var(--border)" : "var(--accent)",
              }}
            >
              <PhoneCall size={15} />
              {isNew ? "Save to test" : "Test Call"}
            </button>
          )}
        </div>

        {/* Outbound call — via phone number */}
        <OutboundCallSection agentId={id} isNew={isNew} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   SECTION: MODEL
   ───────────────────────────────────────────── */

function ModelSection({ form, set }) {
  const models = LLM_MODELS[form.llm_provider] || [];

  const tempLabel = form.temperature <= 0.3 ? "Precise" : form.temperature <= 0.8 ? "Balanced" : "Creative";
  const tempColor = form.temperature <= 0.3 ? "#3B82F6" : form.temperature <= 0.8 ? "#10B981" : "#F59E0B";

  return (
    <div className="space-y-8">
      <SectionTitle title="Model" subtitle="Choose the LLM provider, model, and generation parameters." />

      {/* Provider selector */}
      <div>
        <SectionLabel className="mb-3">LLM Provider</SectionLabel>
        <div className="flex gap-2">
          {Object.keys(LLM_MODELS).map((p) => (
            <button
              key={p}
              onClick={() => { set("llm_provider", p); set("llm_model", LLM_MODELS[p][0]?.id || ""); }}
              className="px-5 py-2.5 rounded-xl border text-sm capitalize transition-all duration-200"
              style={{
                background: form.llm_provider === p ? "var(--accent-subtle)" : "var(--surface)",
                borderColor: form.llm_provider === p ? "var(--accent)" : "var(--border)",
                color: form.llm_provider === p ? "var(--accent)" : "var(--text-secondary)",
                fontWeight: form.llm_provider === p ? 600 : 400,
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Model picker */}
      <div>
        <SectionLabel className="mb-3">Model</SectionLabel>
        <div className="grid grid-cols-3 gap-3">
          {models.map((m) => {
            const selected = form.llm_model === m.id;
            return (
              <button
                key={m.id}
                onClick={() => set("llm_model", m.id)}
                className="p-4 rounded-xl border text-left transition-all duration-200 group"
                style={{
                  background: selected ? "var(--accent-subtle)" : "var(--surface)",
                  borderColor: selected ? "var(--accent)" : "var(--border)",
                  boxShadow: selected ? "0 4px 16px var(--accent-glow, rgba(99,102,241,0.12))" : "none",
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="text-sm font-medium"
                    style={{ color: selected ? "var(--accent)" : "var(--text-primary)" }}
                  >
                    {m.label}
                  </span>
                  <TierBadge tier={m.tier} />
                </div>
                <div className="flex items-center gap-3 text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
                  <span>${m.cost.toFixed(4)}/min</span>
                  <span>~{m.latency}ms</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Temperature */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <SectionLabel>Temperature</SectionLabel>
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: `${tempColor}18`, color: tempColor }}
            >
              {tempLabel}
            </span>
            <span className="text-sm font-mono tabular-nums" style={{ color: "var(--text-primary)" }}>
              {form.temperature.toFixed(2)}
            </span>
          </div>
        </div>
        <div className="relative">
          <input
            type="range" min="0" max="1.5" step="0.05"
            value={form.temperature}
            onChange={(e) => set("temperature", parseFloat(e.target.value))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #3B82F6, #10B981 53%, #F59E0B 100%)`,
            }}
          />
          <div className="flex justify-between text-[10px] mt-2" style={{ color: "var(--text-muted)" }}>
            <span>0 — Precise</span>
            <span>0.75 — Balanced</span>
            <span>1.5 — Creative</span>
          </div>
        </div>
      </div>

      {/* Max tokens */}
      <div>
        <SectionLabel className="mb-3">Max Tokens</SectionLabel>
        <div className="flex items-center gap-4">
          <input
            type="number"
            value={form.max_tokens}
            onChange={(e) => set("max_tokens", Math.max(1, parseInt(e.target.value) || 80))}
            className={inputClass + " w-32 font-mono tabular-nums"}
            style={inputStyle}
          />
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            tokens per response (recommended: 80-200 for voice)
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   SECTION: VOICE
   ───────────────────────────────────────────── */

function VoiceSection({ form, set }) {
  const voices = TTS_VOICES[form.tts_provider]?.[form.voice_gender] || [];
  const [previewingVoice, setPreviewingVoice] = useState(null);

  const playVoicePreview = async (voiceId, provider) => {
    setPreviewingVoice(voiceId);
    try {
      const apiBase = (import.meta.env.VITE_API_URL || "https://api.cogniflowautomations.com").trim();
      const res = await fetch(`${apiBase}/api/voice/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voice_id: voiceId,
          provider: provider,
          text: "Hi there! I'm your AI voice assistant. How can I help you today?",
        }),
      });
      if (!res.ok) throw new Error("Preview failed");
      const audioBlob = await res.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        setPreviewingVoice(null);
      };
      await audio.play();
    } catch {
      setPreviewingVoice(null);
    }
  };

  return (
    <div className="space-y-8">
      <SectionTitle title="Voice" subtitle="Select a text-to-speech provider and voice for your agent." />

      {/* TTS Provider */}
      <div>
        <SectionLabel className="mb-3">TTS Provider</SectionLabel>
        <div className="flex gap-2">
          {["smallest", "sarvam"].map((p) => (
            <button
              key={p}
              onClick={() => set("tts_provider", p)}
              className="px-5 py-2.5 rounded-xl border text-sm transition-all duration-200"
              style={{
                background: form.tts_provider === p ? "var(--accent-subtle)" : "var(--surface)",
                borderColor: form.tts_provider === p ? "var(--accent)" : "var(--border)",
                color: form.tts_provider === p ? "var(--accent)" : "var(--text-secondary)",
                fontWeight: form.tts_provider === p ? 600 : 400,
              }}
            >
              {p === "smallest" ? "Smallest AI" : "Sarvam AI"}
            </button>
          ))}
        </div>
      </div>

      {/* Voice gender toggle */}
      <div>
        <SectionLabel className="mb-3">Voice Gender</SectionLabel>
        <div
          className="inline-flex rounded-xl border overflow-hidden"
          style={{ borderColor: "var(--border)" }}
        >
          {["female", "male"].map((g) => (
            <button
              key={g}
              onClick={() => set("voice_gender", g)}
              className="px-6 py-2.5 text-sm capitalize transition-all duration-200"
              style={{
                background: form.voice_gender === g ? "var(--accent-subtle)" : "var(--surface)",
                color: form.voice_gender === g ? "var(--accent)" : "var(--text-secondary)",
                fontWeight: form.voice_gender === g ? 600 : 400,
              }}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Voice grid */}
      <div>
        <SectionLabel className="mb-3">
          Select Voice ({form.voice_gender === "female" ? "Female" : "Male"})
        </SectionLabel>
        <div className="grid grid-cols-3 gap-3">
          {voices.map((v) => {
            const selected = form.voice_id === v.id;
            return (
              <button
                key={v.id}
                onClick={() => set("voice_id", v.id)}
                className="relative p-4 rounded-xl border text-left transition-all duration-200 group"
                style={{
                  background: selected ? "var(--accent-subtle)" : "var(--surface)",
                  borderColor: selected ? "var(--accent)" : "var(--border)",
                  boxShadow: selected ? "0 4px 16px var(--accent-glow, rgba(99,102,241,0.12))" : "none",
                }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="text-sm font-medium"
                    style={{ color: selected ? "var(--accent)" : "var(--text-primary)" }}
                  >
                    {v.label}
                  </span>
                  {/* Preview button */}
                  <span
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer ${
                      previewingVoice === v.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    }`}
                    style={{
                      background: previewingVoice === v.id ? "var(--accent-subtle)" : "var(--bg-muted)",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!previewingVoice) {
                        playVoicePreview(v.id, form.tts_provider);
                      }
                    }}
                  >
                    {previewingVoice === v.id ? (
                      <Loader2
                        size={12}
                        className="animate-spin"
                        style={{ color: "var(--accent)" }}
                      />
                    ) : (
                      <Play size={12} style={{ color: "var(--text-muted)" }} />
                    )}
                  </span>
                </div>
                <div className="text-[11px] mt-1.5" style={{ color: "var(--text-muted)" }}>
                  {v.desc}
                </div>
                {selected && (
                  <div
                    className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: "var(--accent)" }}
                  >
                    <Check size={10} className="text-white" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Speed — placeholder for future use */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <SectionLabel>Voice Speed</SectionLabel>
          <span className="text-sm font-mono tabular-nums" style={{ color: "var(--text-primary)" }}>
            1.0x
          </span>
        </div>
        <input
          type="range" min="0.5" max="2.0" step="0.1" defaultValue="1.0"
          className="w-full h-2 rounded-full appearance-none cursor-pointer"
          style={{ background: "var(--bg-muted)" }}
        />
        <div className="flex justify-between text-[10px] mt-2" style={{ color: "var(--text-muted)" }}>
          <span>0.5x Slow</span>
          <span>1.0x Normal</span>
          <span>2.0x Fast</span>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   SECTION: TRANSCRIBER
   ───────────────────────────────────────────── */

function TranscriberSection({ form, set }) {
  return (
    <div className="space-y-8">
      <SectionTitle title="Transcriber" subtitle="Configure speech-to-text settings for real-time transcription." />

      {/* Language */}
      <div>
        <SectionLabel className="mb-3">Language</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => set("stt_language", l.code)}
              className="px-3.5 py-2 rounded-xl border text-xs transition-all duration-200"
              style={{
                background: form.stt_language === l.code ? "var(--accent-subtle)" : "var(--surface)",
                borderColor: form.stt_language === l.code ? "var(--accent)" : "var(--border)",
                color: form.stt_language === l.code ? "var(--accent)" : "var(--text-secondary)",
                fontWeight: form.stt_language === l.code ? 600 : 400,
              }}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* Endpointing */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <SectionLabel>Endpointing</SectionLabel>
          <span className="text-sm font-mono tabular-nums" style={{ color: "var(--text-primary)" }}>
            {form.endpointing_ms}ms
          </span>
        </div>
        <input
          type="range" min="100" max="500" step="10"
          value={form.endpointing_ms}
          onChange={(e) => set("endpointing_ms", parseInt(e.target.value))}
          className="w-full h-2 rounded-full appearance-none cursor-pointer"
          style={{ background: "var(--bg-muted)" }}
        />
        <div className="flex justify-between text-[10px] mt-2" style={{ color: "var(--text-muted)" }}>
          <span>100ms — Fast (may cut off)</span>
          <span>300ms — Default</span>
          <span>500ms — Patient</span>
        </div>
        <p className="text-[11px] mt-2" style={{ color: "var(--text-muted)" }}>
          Time of silence before the agent considers the user done speaking.
        </p>
      </div>

      {/* Smart format */}
      <div
        className="flex items-center justify-between p-4 rounded-xl border"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div>
          <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            Smart Formatting
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            Automatically format numbers, dates, and currencies in transcripts.
          </div>
        </div>
        <Toggle checked={form.smart_format} onChange={(v) => set("smart_format", v)} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   SECTION: AGENT
   ───────────────────────────────────────────── */

function AgentSection({ form, set }) {
  const charCount = (form.instructions || "").length;
  const tokenEstimate = Math.round(charCount / 4);

  return (
    <div className="space-y-8">
      <SectionTitle title="Agent" subtitle="Define the agent's identity, personality, and conversation behavior." />

      {/* Agent name */}
      <div>
        <SectionLabel className="mb-2">Agent Name</SectionLabel>
        <input
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          className={inputClass + " text-base font-medium"}
          style={inputStyle}
          placeholder="e.g. Priya — Admissions Counsellor"
        />
      </div>

      {/* Emotion profile */}
      <div>
        <SectionLabel className="mb-3">Emotion Profile</SectionLabel>
        <div className="grid grid-cols-1 gap-2">
          {EMOTION_PROFILES.map((ep) => {
            const selected = form.emotion_profile === ep.id;
            return (
              <button
                key={ep.id}
                onClick={() => set("emotion_profile", ep.id)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all duration-200"
                style={{
                  background: selected ? "var(--accent-subtle)" : "var(--surface)",
                  borderColor: selected ? "var(--accent)" : "var(--border)",
                }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    background: selected ? "var(--accent)" : "var(--bg-muted)",
                  }}
                >
                  {selected && <Check size={14} className="text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className="text-sm font-medium"
                    style={{ color: selected ? "var(--accent)" : "var(--text-primary)" }}
                  >
                    {ep.label}
                  </div>
                  <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                    {ep.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Greeting */}
      <div>
        <SectionLabel className="mb-2">Greeting Message</SectionLabel>
        <textarea
          value={form.greeting}
          onChange={(e) => set("greeting", e.target.value)}
          rows={3}
          className={inputClass + " resize-none"}
          style={inputStyle}
          placeholder="Hi, I'm Priya from T. John College. Am I speaking with {lead_name}?"
        />
        <p className="text-[10px] mt-1.5" style={{ color: "var(--text-muted)" }}>
          The first thing the agent says when the call connects. Use &#123;lead_name&#125; for personalization.
        </p>
      </div>

      {/* System prompt */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <SectionLabel>System Prompt</SectionLabel>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono tabular-nums" style={{ color: "var(--text-muted)" }}>
              {charCount.toLocaleString()} chars
            </span>
            <span className="text-[10px] font-mono tabular-nums px-2 py-0.5 rounded-full" style={{ background: "var(--bg-muted)", color: "var(--text-muted)" }}>
              ~{tokenEstimate.toLocaleString()} tokens
            </span>
          </div>
        </div>
        <textarea
          value={form.instructions}
          onChange={(e) => set("instructions", e.target.value)}
          rows={16}
          className={inputClass + " resize-none font-mono text-xs leading-relaxed"}
          style={inputStyle}
          placeholder={`IDENTITY\nYou are Priya, a friendly student counsellor at T. John College.\n\nOBJECTIVE\n1. Qualify the lead by asking about their education background\n2. Answer questions about courses, fees, and campus life\n3. Book a campus visit if interested\n\nRULES\n- Keep responses under 2 sentences\n- Be warm but professional\n- If unsure, offer to transfer to a human counsellor`}
        />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   SECTION: CALL SETTINGS
   ───────────────────────────────────────────── */

function CallSettingsSection({ form, set }) {
  return (
    <div className="space-y-8">
      <SectionTitle title="Call Settings" subtitle="Configure call behavior, timeouts, and recording preferences." />

      {/* Duration */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <SectionLabel className="mb-2">Max Call Duration</SectionLabel>
          <select
            value={form.max_call_duration}
            onChange={(e) => set("max_call_duration", parseInt(e.target.value))}
            className={inputClass}
            style={inputStyle}
          >
            <option value={180}>3 minutes</option>
            <option value={300}>5 minutes</option>
            <option value={600}>10 minutes</option>
            <option value={900}>15 minutes</option>
            <option value={1800}>30 minutes</option>
          </select>
        </div>
        <div>
          <SectionLabel className="mb-2">Silence Timeout</SectionLabel>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={form.silence_timeout}
              onChange={(e) => set("silence_timeout", Math.max(1, parseInt(e.target.value) || 10))}
              className={inputClass + " w-24 font-mono tabular-nums"}
              style={inputStyle}
            />
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>seconds</span>
          </div>
          <p className="text-[10px] mt-1.5" style={{ color: "var(--text-muted)" }}>
            Hang up after this much silence.
          </p>
        </div>
      </div>

      {/* Toggles */}
      <div className="space-y-0.5">
        {[
          {
            key: "enable_barge_in",
            label: "Enable Barge-in",
            desc: "Allow the caller to interrupt the agent while it's speaking.",
          },
          {
            key: "enable_recording",
            label: "Call Recording",
            desc: "Record all calls for quality assurance and compliance.",
          },
        ].map((item) => (
          <div
            key={item.key}
            className="flex items-center justify-between p-4 rounded-xl border transition-all duration-200"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          >
            <div>
              <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{item.label}</div>
              <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{item.desc}</div>
            </div>
            <Toggle checked={form[item.key]} onChange={(v) => set(item.key, v)} />
          </div>
        ))}
      </div>

      {/* Background audio placeholder */}
      <div
        className="flex items-center justify-between p-4 rounded-xl border transition-all duration-200"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Background Audio</span>
            <Badge variant="secondary" className="text-[9px]">Coming soon</Badge>
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            Play ambient office sounds to make the call feel more natural.
          </div>
        </div>
        <Toggle checked={false} onChange={() => {}} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   SECTION: TOOLS
   ───────────────────────────────────────────── */

function ToolsSection({ form, set }) {
  const toggleTool = useCallback((toolId) => {
    const tools = form.tools_enabled.includes(toolId)
      ? form.tools_enabled.filter((t) => t !== toolId)
      : [...form.tools_enabled, toolId];
    set("tools_enabled", tools);
  }, [form.tools_enabled, set]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <SectionTitle title="Tools" subtitle="Enable tools your agent can use during calls." />
        <span
          className="text-xs font-mono px-2.5 py-1 rounded-full"
          style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}
        >
          {form.tools_enabled.length} / {AVAILABLE_TOOLS.length} active
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {AVAILABLE_TOOLS.map((tool) => {
          const Icon = tool.icon;
          const active = form.tools_enabled.includes(tool.id);
          return (
            <div
              key={tool.id}
              className="p-4 rounded-xl border transition-all duration-200 cursor-pointer group"
              style={{
                background: active ? "var(--accent-subtle)" : "var(--surface)",
                borderColor: active ? "var(--accent)" : "var(--border)",
                boxShadow: active ? "0 4px 16px var(--accent-glow, rgba(99,102,241,0.08))" : "none",
              }}
              onClick={() => toggleTool(tool.id)}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      background: active ? "var(--accent)" : "var(--bg-muted)",
                    }}
                  >
                    <Icon
                      size={16}
                      style={{ color: active ? "#fff" : "var(--text-muted)" }}
                    />
                  </div>
                  <span
                    className="text-sm font-medium"
                    style={{ color: active ? "var(--accent)" : "var(--text-primary)" }}
                  >
                    {tool.label}
                  </span>
                </div>
                <Toggle checked={active} onChange={() => toggleTool(tool.id)} />
              </div>
              <p className="text-[11px] pl-12" style={{ color: "var(--text-muted)" }}>
                {tool.desc}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   SECTION: FEATURES
   ───────────────────────────────────────────── */

function FeaturesSection({ form, set }) {
  return (
    <div className="space-y-8">
      <SectionTitle title="Features" subtitle="Toggle AI capabilities to customize agent behavior." />

      <div className="space-y-2">
        {FEATURE_TOGGLES.map(({ key, label, desc, icon: Icon }) => {
          const enabled = !!form[key];
          return (
            <div
              key={key}
              className="flex items-center justify-between p-4 rounded-xl border transition-all duration-200"
              style={{
                background: enabled ? "var(--accent-subtle)" : "var(--surface)",
                borderColor: enabled ? `var(--accent)` : "var(--border)",
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: enabled ? "var(--accent)" : "var(--bg-muted)",
                  }}
                >
                  <Icon size={18} style={{ color: enabled ? "#fff" : "var(--text-muted)" }} />
                </div>
                <div>
                  <div
                    className="text-sm font-medium"
                    style={{ color: enabled ? "var(--accent)" : "var(--text-primary)" }}
                  >
                    {label}
                  </div>
                  <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {desc}
                  </div>
                </div>
              </div>
              <Toggle checked={enabled} onChange={(v) => set(key, v)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   SECTION: ADVANCED
   ───────────────────────────────────────────── */

function AdvancedSection({ form, set }) {
  return (
    <div className="space-y-8">
      <SectionTitle title="Advanced" subtitle="Webhook integrations, fallback behavior, and concurrency limits." />

      {/* Webhook URL */}
      <div>
        <SectionLabel className="mb-2">Webhook URL</SectionLabel>
        <input
          value={form.webhook_url}
          onChange={(e) => set("webhook_url", e.target.value)}
          className={inputClass + " font-mono text-xs"}
          style={inputStyle}
          placeholder="https://your-server.com/webhook/agent-events"
        />
        <p className="text-[10px] mt-1.5" style={{ color: "var(--text-muted)" }}>
          Receive real-time events (call.started, call.ended, tool.called) via POST requests.
        </p>
      </div>

      {/* Fallback message */}
      <div>
        <SectionLabel className="mb-2">Fallback Message</SectionLabel>
        <textarea
          value={form.fallback_message}
          onChange={(e) => set("fallback_message", e.target.value)}
          rows={3}
          className={inputClass + " resize-none"}
          style={inputStyle}
          placeholder="I'm sorry, I'm having trouble right now. Could you repeat that?"
        />
        <p className="text-[10px] mt-1.5" style={{ color: "var(--text-muted)" }}>
          Spoken when the LLM fails or times out.
        </p>
      </div>

      {/* Numeric controls */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <SectionLabel className="mb-2">Max Retries</SectionLabel>
          <input
            type="number"
            value={form.max_retries}
            onChange={(e) => set("max_retries", Math.max(0, parseInt(e.target.value) || 0))}
            className={inputClass + " w-28 font-mono tabular-nums"}
            style={inputStyle}
          />
          <p className="text-[10px] mt-1.5" style={{ color: "var(--text-muted)" }}>
            Retry count on LLM/TTS failure before fallback.
          </p>
        </div>
        <div>
          <SectionLabel className="mb-2">Concurrent Call Limit</SectionLabel>
          <input
            type="number"
            value={form.concurrent_call_limit}
            onChange={(e) => set("concurrent_call_limit", Math.max(1, parseInt(e.target.value) || 1))}
            className={inputClass + " w-28 font-mono tabular-nums"}
            style={inputStyle}
          />
          <p className="text-[10px] mt-1.5" style={{ color: "var(--text-muted)" }}>
            Max simultaneous calls for this agent.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   HEADER
   ───────────────────────────────────────────── */

function Header({
  form, set, isNew, isDirty, saving, onSave, onDelete, onClone, saveError,
}) {
  const [editingName, setEditingName] = useState(false);
  const nameRef = useRef(null);

  useEffect(() => {
    if (editingName && nameRef.current) {
      nameRef.current.focus();
      nameRef.current.select();
    }
  }, [editingName]);

  return (
    <div
      className="flex items-center justify-between px-5 py-3 border-b flex-shrink-0"
      style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
    >
      <div className="flex items-center gap-3 min-w-0">
        {/* Agent name — inline edit */}
        <div className="min-w-0">
          {editingName ? (
            <input
              ref={nameRef}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              onBlur={() => setEditingName(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "Escape") setEditingName(false);
              }}
              className="text-base font-semibold bg-transparent border-b-2 outline-none px-0 py-0.5 w-64"
              style={{
                color: "var(--text-primary)",
                borderColor: "var(--accent)",
              }}
            />
          ) : (
            <button
              onClick={() => setEditingName(true)}
              className="text-base font-semibold truncate max-w-[300px] text-left hover:opacity-80 transition-opacity"
              style={{ color: "var(--text-primary)" }}
              title="Click to edit name"
            >
              {form.name || "Untitled Agent"}
            </button>
          )}
        </div>

        {/* Status badge */}
        <Badge variant={isNew ? "warning" : "success"} className="text-[10px] flex-shrink-0">
          {isNew ? "Draft" : "Active"}
        </Badge>

        {/* Unsaved indicator */}
        {isDirty && (
          <span className="text-[10px] font-medium flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Unsaved
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {!isNew && (
          <>
            <Button variant="ghost" size="sm" onClick={onClone} title="Clone agent">
              <Copy size={14} />
              <span className="hidden sm:inline">Clone</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={onDelete} title="Delete agent" className="text-red-400 hover:text-red-300">
              <Trash2 size={14} />
              <span className="hidden sm:inline">Delete</span>
            </Button>
          </>
        )}

        <div className="relative">
          <Button
            size="sm"
            onClick={onSave}
            disabled={saving}
            className="relative"
          >
            {saving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            {saving ? "Saving..." : "Save"}
            {isDirty && !saving && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 border-2" style={{ borderColor: "var(--bg-card)" }} />
            )}
          </Button>
          {saveError && (
            <div
              className="absolute top-full right-0 mt-2 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap z-50 animate-fade-in"
              style={{ background: "rgba(239,68,68,0.95)", color: "#fff" }}
            >
              {saveError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MAIN — AgentBuilder
   ───────────────────────────────────────────── */

export default function AgentBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isNew = !id || id === "new";

  const [section, setSection] = useState("model");
  const [form, setForm] = useState({ ...defaultForm });
  const [initialForm, setInitialForm] = useState({ ...defaultForm });
  const [error, setError] = useState("");
  const [showTestCall, setShowTestCall] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");

  /* ── Fetch existing agent ── */
  const { data: agentData, isLoading } = useQuery({
    queryKey: ["agent", id],
    queryFn: () => api.getAgent(id),
    enabled: !isNew,
  });

  /* ── Populate form from fetched data ── */
  useEffect(() => {
    if (agentData && !agentData.error) {
      const populated = {
        ...defaultForm,
        name: agentData.name || "",
        instructions: agentData.instructions || "",
        greeting: agentData.greeting || "",
        language: agentData.language || "en",
        emotion_profile: agentData.emotion_profile || "friendly",
        voice_gender: agentData.voice_gender || "female",
        voice_id: agentData.voice_id || "emily",
        llm_provider: agentData.llm_provider || "groq",
        llm_model: agentData.llm_model || "llama-3.3-70b-versatile",
        tts_provider: agentData.tts_provider || "smallest",
        stt_language: agentData.stt_language || agentData.language || "en",
        endpointing_ms: agentData.endpointing_ms ?? 300,
        smart_format: agentData.smart_format ?? true,
        temperature: agentData.temperature ?? 0.7,
        max_tokens: agentData.max_tokens ?? 80,
        max_call_duration: agentData.max_call_duration || 600,
        silence_timeout: agentData.silence_timeout ?? 10,
        enable_recording: agentData.enable_recording ?? true,
        enable_barge_in: agentData.enable_barge_in ?? true,
        enable_memory: agentData.enable_memory ?? true,
        enable_prediction: agentData.enable_prediction ?? true,
        enable_emotion: agentData.enable_emotion ?? true,
        enable_language_switch: agentData.enable_language_switch ?? true,
        enable_rag: agentData.enable_rag ?? false,
        enable_speculative: agentData.enable_speculative ?? true,
        enable_filler: agentData.enable_filler ?? true,
        tools_enabled: agentData.tools_enabled || defaultForm.tools_enabled,
        webhook_url: agentData.webhook_url || "",
        fallback_message: agentData.fallback_message || defaultForm.fallback_message,
        max_retries: agentData.max_retries ?? 3,
        concurrent_call_limit: agentData.concurrent_call_limit ?? 5,
      };
      setForm(populated);
      setInitialForm(populated);
    }
  }, [agentData]);

  /* ── Dirty tracking ── */
  const isDirty = useMemo(() => {
    return JSON.stringify(form) !== JSON.stringify(initialForm);
  }, [form, initialForm]);

  /* ── Setter ── */
  const set = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  /* ── Save mutation ── */
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...form };
      if (isNew) {
        return api.createAgent(payload);
      }
      return api.updateAgent(id, payload);
    },
    onSuccess: (result) => {
      if (result && !result.error) {
        setInitialForm({ ...form });
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
        queryClient.invalidateQueries({ queryKey: ["agents"] });
        queryClient.invalidateQueries({ queryKey: ["agent", id] });
        if (isNew && result.id) {
          navigate(`/home/agents/${result.id}`, { replace: true });
        }
      } else {
        setError(result?.error || "Failed to save agent");
      }
    },
    onError: (err) => {
      setError(err.message || "Failed to save agent");
    },
  });

  /* ── Delete mutation ── */
  const deleteMutation = useMutation({
    mutationFn: () => api.deleteAgent(id),
    onSuccess: (result) => {
      if (result?.error) {
        setError(result.error);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      navigate("/home/agents");
    },
    onError: (err) => {
      setError(err.message || "Failed to delete agent");
    },
  });

  /* ── Clone ── */
  const cloneMutation = useMutation({
    mutationFn: () => api.cloneAgent({ source_agent_id: id, name: form.name + " (Copy)" }),
    onSuccess: (result) => {
      if (result?.error) {
        setError(result.error);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      if (result.id) {
        navigate(`/home/agents/${result.id}`);
      } else {
        navigate("/home/agents");
      }
    },
    onError: (err) => {
      setError(err.message || "Failed to clone agent");
    },
  });

  const handleSave = () => {
    setSaveError("");
    if (!form.name && !form.instructions) {
      setSaveError("Agent name and system prompt are required");
      setSection("agent");
      setTimeout(() => setSaveError(""), 3000);
      return;
    }
    if (!form.name) {
      setSaveError("Agent name is required");
      setSection("agent");
      setTimeout(() => setSaveError(""), 3000);
      return;
    }
    if (!form.instructions) {
      setSaveError("System prompt is required");
      setSection("agent");
      setTimeout(() => setSaveError(""), 3000);
      return;
    }
    saveMutation.mutate();
  };

  const handleDelete = () => {
    if (!confirm("Delete this agent? This action cannot be undone.")) return;
    deleteMutation.mutate();
  };

  const handleClone = () => cloneMutation.mutate();

  const handleTestCall = () => setShowTestCall(true);

  /* ── Loading state ── */
  if (isLoading && !isNew) {
    return <Skeleton />;
  }

  /* ── Section renderer ── */
  const renderSection = () => {
    switch (section) {
      case "model":
        return <ModelSection form={form} set={set} />;
      case "voice":
        return <VoiceSection form={form} set={set} />;
      case "transcriber":
        return <TranscriberSection form={form} set={set} />;
      case "agent":
        return <AgentSection form={form} set={set} />;
      case "call":
        return <CallSettingsSection form={form} set={set} />;
      case "tools":
        return <ToolsSection form={form} set={set} />;
      case "features":
        return <FeaturesSection form={form} set={set} />;
      case "advanced":
        return <AdvancedSection form={form} set={set} />;
      default:
        return <ModelSection form={form} set={set} />;
    }
  };

  return (
    <div className="h-[calc(100vh-60px)] flex flex-col">
      {/* Header */}
      <Header
        form={form}
        set={set}
        isNew={isNew}
        isDirty={isDirty}
        saving={saveMutation.isPending}
        onSave={handleSave}
        onDelete={handleDelete}
        onClone={handleClone}
        saveError={saveError}
      />

      {/* Success banner */}
      {saveSuccess && (
        <div
          className="mx-4 mt-3 px-4 py-3 rounded-xl flex items-center gap-2 animate-fade-in"
          style={{
            background: "rgba(16,185,129,0.08)",
            border: "1px solid rgba(16,185,129,0.2)",
          }}
        >
          <Check size={14} className="text-emerald-500 flex-shrink-0" />
          <span className="text-sm text-emerald-600">Agent saved successfully</span>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div
          className="mx-4 mt-3 px-4 py-3 rounded-xl flex items-center justify-between"
          style={{
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.2)",
          }}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-red-400 flex-shrink-0" />
            <span className="text-sm text-red-400">{error}</span>
          </div>
          <button
            onClick={() => setError("")}
            className="p-1 rounded-lg hover:bg-red-500/10 text-red-400 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Three-column layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left nav */}
        <LeftNav
          agentName={form.name}
          active={section}
          onChange={setSection}
          onBack={() => navigate("/home/agents")}
        />

        {/* Center editor */}
        <div className="flex-1 overflow-y-auto" style={{ background: "var(--bg-primary)" }}>
          <div className="max-w-2xl mx-auto px-8 py-8">
            {renderSection()}
          </div>
        </div>

        {/* Right panel */}
        <RightPanel
          form={form}
          isNew={isNew}
          id={id}
          showTestCall={showTestCall}
          onTestCall={handleTestCall}
          onCloseTestCall={() => setShowTestCall(false)}
        />
      </div>
    </div>
  );
}
