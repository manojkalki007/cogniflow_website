"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  ChevronRight,
  ChevronLeft,
  Eye,
  EyeOff,
  Check,
  AlertTriangle,
  Loader2,
  ExternalLink,
  RotateCcw,
  Phone,
  Globe,
  Shield,
  Webhook,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

/* ═══════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════ */

type ProviderKey = "twilio" | "exotel" | "vobiz" | "mcube" | "sip";

interface ProviderDef {
  key: ProviderKey;
  name: string;
  abbr: string;
  color: string;
  description: string;
  capabilities: string[];
  note?: string;
  fields: FieldDef[];
}

interface FieldDef {
  key: string;
  label: string;
  placeholder: string;
  type: "text" | "password" | "select";
  options?: { value: string; label: string }[];
  defaultValue?: string;
}

interface WizardState {
  step: number;
  selectedProvider: ProviderKey | null;
  credentials: Record<string, string>;
  visibleFields: Record<string, boolean>;
  testing: boolean;
  testResults: TestResult[];
  testDone: boolean;
}

interface TestResult {
  label: string;
  status: "success" | "warning" | "info";
  detail: string;
}

/* ═══════════════════════════════════════════════════════════
   Provider definitions
   ═══════════════════════════════════════════════════════════ */

const PROVIDERS: ProviderDef[] = [
  {
    key: "twilio",
    name: "Twilio",
    abbr: "TW",
    color: "#F22F46",
    description: "Global telephony. US, EU, APAC numbers.",
    capabilities: ["Voice", "SMS", "Streaming"],
    fields: [
      { key: "account_sid", label: "Account SID", placeholder: "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", type: "text" },
      { key: "auth_token", label: "Auth Token", placeholder: "Your Twilio auth token", type: "password" },
      { key: "phone_number", label: "Phone Number", placeholder: "+1234567890", type: "text" },
    ],
  },
  {
    key: "exotel",
    name: "Exotel",
    abbr: "EX",
    color: "#2962FF",
    description: "India telephony with WebSocket streaming.",
    capabilities: ["Voice", "Streaming", "IVR"],
    fields: [
      { key: "api_key", label: "API Key", placeholder: "Your Exotel API key", type: "text" },
      { key: "api_token", label: "API Token", placeholder: "Your Exotel API token", type: "password" },
      { key: "account_sid", label: "Account SID", placeholder: "Your Exotel account SID", type: "text" },
      {
        key: "subdomain",
        label: "Subdomain",
        placeholder: "Select region",
        type: "select",
        options: [
          { value: "api", label: "api — Singapore" },
          { value: "api.in", label: "api.in — Mumbai" },
        ],
        defaultValue: "api",
      },
      { key: "caller_id", label: "Caller ID", placeholder: "+91XXXXXXXXXX", type: "text" },
    ],
  },
  {
    key: "vobiz",
    name: "Vobiz",
    abbr: "VB",
    color: "#7C3AED",
    description: "India-first. TRAI compliant. ₹0.45/min.",
    capabilities: ["Voice", "Streaming", "DTMF"],
    fields: [
      { key: "auth_id", label: "Auth ID", placeholder: "Your Vobiz auth ID", type: "text" },
      { key: "auth_token", label: "Auth Token", placeholder: "Your Vobiz auth token", type: "password" },
      { key: "phone_number", label: "Phone Number", placeholder: "+91XXXXXXXXXX", type: "text" },
    ],
  },
  {
    key: "mcube",
    name: "MCube",
    abbr: "MC",
    color: "#FF8B3E",
    description: "India cloud telephony. Click-to-call only.",
    capabilities: ["Voice", "IVR"],
    note: "No real-time streaming",
    fields: [
      { key: "api_key", label: "API Key", placeholder: "Your MCube API key", type: "password" },
      { key: "phone_number", label: "Phone Number / Extension", placeholder: "Extension or phone number", type: "text" },
    ],
  },
  {
    key: "sip",
    name: "SIP",
    abbr: "SI",
    color: "#8B92A5",
    description: "Bring your own carrier via SIP trunk.",
    capabilities: ["Voice", "Streaming", "BYOC"],
    fields: [
      { key: "trunk_host", label: "Trunk Host", placeholder: "sip.yourcarrier.com", type: "text" },
      { key: "port", label: "Port", placeholder: "5060", type: "text", defaultValue: "5060" },
      { key: "username", label: "Username", placeholder: "SIP username", type: "text" },
      { key: "password", label: "Password", placeholder: "SIP password", type: "password" },
      {
        key: "transport",
        label: "Transport",
        placeholder: "Select transport",
        type: "select",
        options: [
          { value: "UDP", label: "UDP" },
          { value: "TCP", label: "TCP" },
          { value: "TLS", label: "TLS" },
        ],
        defaultValue: "UDP",
      },
    ],
  },
];

const STEP_LABELS = ["Select Provider", "Configure", "Test Connection", "Complete"];

/* ═══════════════════════════════════════════════════════════
   Animation variants
   ═══════════════════════════════════════════════════════════ */

const slideVariants: Variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 240 : -240,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -240 : 240,
    opacity: 0,
  }),
};

const resultVariants: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.96 },
  visible: { opacity: 1, y: 0, scale: 1 },
};

const checkmarkVariants: Variants = {
  hidden: { scale: 0, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: { type: "spring", stiffness: 200, damping: 12, delay: 0.15 },
  },
};

/* ═══════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════ */

export default function SetupWizardPage() {
  const [state, setState] = useState<WizardState>({
    step: 1,
    selectedProvider: null,
    credentials: {},
    visibleFields: {},
    testing: false,
    testResults: [],
    testDone: false,
  });

  const [direction, setDirection] = useState(1);

  const provider = PROVIDERS.find((p) => p.key === state.selectedProvider) ?? null;

  /* ── Step navigation ────────────────────────────────── */

  function goNext() {
    setDirection(1);
    setState((s) => ({ ...s, step: s.step + 1 }));
  }

  function goBack() {
    setDirection(-1);
    setState((s) => ({ ...s, step: s.step - 1, testing: false, testResults: [], testDone: false }));
  }

  function selectProvider(key: ProviderKey) {
    const prov = PROVIDERS.find((p) => p.key === key)!;
    const defaults: Record<string, string> = {};
    prov.fields.forEach((f) => {
      if (f.defaultValue) defaults[f.key] = f.defaultValue;
    });
    setState((s) => ({ ...s, selectedProvider: key, credentials: defaults }));
  }

  function setField(key: string, value: string) {
    setState((s) => ({ ...s, credentials: { ...s.credentials, [key]: value } }));
  }

  function toggleVisible(key: string) {
    setState((s) => ({
      ...s,
      visibleFields: { ...s.visibleFields, [key]: !s.visibleFields[key] },
    }));
  }

  function resetWizard() {
    setDirection(1);
    setState({
      step: 1,
      selectedProvider: null,
      credentials: {},
      visibleFields: {},
      testing: false,
      testResults: [],
      testDone: false,
    });
  }

  /* ── Simulated test ─────────────────────────────────── */

  useEffect(() => {
    if (state.step !== 3 || state.testDone) return;

    setState((s) => ({ ...s, testing: true, testResults: [] }));

    const isMCube = state.selectedProvider === "mcube";
    const results: TestResult[] = [
      { label: "Connection", status: "success", detail: "TCP handshake OK" },
      { label: "Authentication", status: "success", detail: "Credentials verified" },
      {
        label: "Number Verification",
        status: isMCube ? "warning" : "success",
        detail: isMCube ? "No streaming support" : "Number active and reachable",
      },
      {
        label: "Webhook Configuration",
        status: "info",
        detail: `https://api.cogniflow.ai/v1/webhooks/${state.selectedProvider}/inbound`,
      },
    ];

    const timer = setTimeout(() => {
      setState((s) => ({ ...s, testing: false }));

      results.forEach((r, i) => {
        setTimeout(() => {
          setState((s) => {
            const next = [...s.testResults, r];
            return { ...s, testResults: next, testDone: next.length === results.length };
          });
        }, i * 300);
      });
    }, 2000);

    return () => clearTimeout(timer);
  }, [state.step, state.selectedProvider, state.testDone]);

  /* ── Validation ─────────────────────────────────────── */

  const canContinueStep1 = state.selectedProvider !== null;
  const canContinueStep2 =
    provider !== null &&
    provider.fields.every((f) => {
      if (f.defaultValue) return true;
      return (state.credentials[f.key] ?? "").trim().length > 0;
    });

  /* ── Render ─────────────────────────────────────────── */

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1
          className="text-2xl font-bold tracking-tight mb-1"
          style={{ color: "var(--d-text)" }}
        >
          Provider Setup
        </h1>
        <p className="text-sm" style={{ color: "var(--d-text-2)" }}>
          Connect a telephony provider to start handling calls
        </p>
      </div>

      {/* ── Step indicator ──────────────────────────────── */}
      <div className="flex items-center justify-between mb-10 px-2">
        {STEP_LABELS.map((label, i) => {
          const stepNum = i + 1;
          const done = state.step > stepNum;
          const active = state.step === stepNum;
          return (
            <div key={label} className="flex items-center" style={{ flex: i < STEP_LABELS.length - 1 ? 1 : "none" }}>
              {/* Circle + label */}
              <div className="flex flex-col items-center gap-2 min-w-[80px]">
                <div
                  className={`dash-step ${done ? "dash-step-done" : ""} ${active ? "dash-step-active" : ""}`}
                >
                  {done ? <Check size={16} /> : stepNum}
                </div>
                <span
                  className="text-[11px] font-medium text-center whitespace-nowrap"
                  style={{
                    color: active ? "var(--d-primary)" : done ? "var(--d-success)" : "var(--d-text-3)",
                    fontFamily: "var(--d-mono)",
                  }}
                >
                  {label}
                </span>
              </div>

              {/* Connecting line */}
              {i < STEP_LABELS.length - 1 && (
                <div className="flex-1 mx-3 mt-[-20px]">
                  <div
                    className="h-[2px] w-full rounded-full"
                    style={{
                      background: done ? "var(--d-success)" : "var(--d-border)",
                      borderStyle: done ? "solid" : undefined,
                      ...(done
                        ? {}
                        : {
                            backgroundImage:
                              "repeating-linear-gradient(90deg, var(--d-border) 0, var(--d-border) 6px, transparent 6px, transparent 12px)",
                            background: undefined,
                          }),
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Step content with transitions ───────────────── */}
      <div className="relative overflow-hidden" style={{ minHeight: 420 }}>
        <AnimatePresence mode="wait" custom={direction}>
          {state.step === 1 && (
            <motion.div
              key="step1"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <Step1
                selectedProvider={state.selectedProvider}
                onSelect={selectProvider}
                canContinue={canContinueStep1}
                onContinue={goNext}
              />
            </motion.div>
          )}

          {state.step === 2 && provider && (
            <motion.div
              key="step2"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <Step2
                provider={provider}
                credentials={state.credentials}
                visibleFields={state.visibleFields}
                onFieldChange={setField}
                onToggleVisible={toggleVisible}
                canContinue={canContinueStep2}
                onBack={goBack}
                onContinue={goNext}
              />
            </motion.div>
          )}

          {state.step === 3 && provider && (
            <motion.div
              key="step3"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <Step3
                provider={provider}
                testing={state.testing}
                results={state.testResults}
                testDone={state.testDone}
                onBack={goBack}
                onComplete={goNext}
              />
            </motion.div>
          )}

          {state.step === 4 && provider && (
            <motion.div
              key="step4"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <Step4
                provider={provider}
                credentials={state.credentials}
                onReset={resetWizard}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Step 1 — Select Provider
   ═══════════════════════════════════════════════════════════ */

function Step1({
  selectedProvider,
  onSelect,
  canContinue,
  onContinue,
}: {
  selectedProvider: ProviderKey | null;
  onSelect: (key: ProviderKey) => void;
  canContinue: boolean;
  onContinue: () => void;
}) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-4">
        {PROVIDERS.map((p, i) => {
          const selected = selectedProvider === p.key;
          const isLast = i === PROVIDERS.length - 1;
          return (
            <button
              key={p.key}
              onClick={() => onSelect(p.key)}
              className={`dash-card-glow text-left p-5 cursor-pointer transition-all ${isLast ? "col-span-2 sm:col-span-1" : ""}`}
              style={{
                borderColor: selected ? p.color : undefined,
                boxShadow: selected ? `0 0 24px ${p.color}20, 0 0 0 1px ${p.color}40` : undefined,
              }}
            >
              {/* Icon + name */}
              <div className="flex items-start justify-between mb-3">
                <div
                  className="dash-provider-icon"
                  style={{
                    background: `${p.color}18`,
                    color: p.color,
                    border: `1px solid ${p.color}30`,
                  }}
                >
                  {p.abbr}
                </div>
                {selected && (
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ background: p.color }}
                  >
                    <Check size={14} color="#fff" strokeWidth={3} />
                  </div>
                )}
              </div>

              <h3 className="font-semibold text-[15px] mb-1" style={{ color: "var(--d-text)" }}>
                {p.name}
              </h3>
              <p className="text-xs mb-3" style={{ color: "var(--d-text-2)" }}>
                {p.description}
              </p>

              {/* Capabilities */}
              <div className="flex flex-wrap gap-1.5">
                {p.capabilities.map((cap) => (
                  <span key={cap} className="dash-badge dash-badge-info" style={{ fontSize: 10, padding: "2px 7px" }}>
                    {cap}
                  </span>
                ))}
              </div>

              {/* Warning note */}
              {p.note && (
                <div
                  className="flex items-center gap-1.5 mt-3 text-[11px]"
                  style={{ color: "var(--d-warning)" }}
                >
                  <AlertTriangle size={12} />
                  {p.note}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Continue */}
      <div className="flex justify-end mt-6">
        <button
          onClick={onContinue}
          disabled={!canContinue}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all"
          style={{
            background: canContinue ? "var(--d-primary)" : "var(--d-surface-2)",
            color: canContinue ? "#06070B" : "var(--d-text-3)",
            cursor: canContinue ? "pointer" : "not-allowed",
            boxShadow: canContinue ? "0 0 20px var(--d-primary-glow)" : "none",
          }}
        >
          Continue
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Step 2 — Configure Credentials
   ═══════════════════════════════════════════════════════════ */

function Step2({
  provider,
  credentials,
  visibleFields,
  onFieldChange,
  onToggleVisible,
  canContinue,
  onBack,
  onContinue,
}: {
  provider: ProviderDef;
  credentials: Record<string, string>;
  visibleFields: Record<string, boolean>;
  onFieldChange: (key: string, value: string) => void;
  onToggleVisible: (key: string) => void;
  canContinue: boolean;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <div>
      {/* Provider badge */}
      <div className="flex items-center gap-3 mb-6">
        <div
          className="dash-provider-icon"
          style={{
            background: `${provider.color}18`,
            color: provider.color,
            border: `1px solid ${provider.color}30`,
          }}
        >
          {provider.abbr}
        </div>
        <div>
          <h3 className="font-semibold text-[15px]" style={{ color: "var(--d-text)" }}>
            {provider.name} Credentials
          </h3>
          <p className="text-xs" style={{ color: "var(--d-text-2)" }}>
            Enter your {provider.name} API credentials below
          </p>
        </div>
      </div>

      {/* Fields */}
      <div className="dash-card p-6 space-y-5">
        {provider.fields.map((field) => (
          <div key={field.key}>
            <label
              className="block text-xs font-medium mb-1.5"
              style={{ color: "var(--d-text-2)", fontFamily: "var(--d-mono)" }}
            >
              {field.label}
            </label>

            {field.type === "select" ? (
              <select
                value={credentials[field.key] ?? field.defaultValue ?? ""}
                onChange={(e) => onFieldChange(field.key, e.target.value)}
                className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none transition-colors"
                style={{
                  background: "var(--d-surface-2)",
                  border: "1px solid var(--d-border)",
                  color: "var(--d-text)",
                  fontFamily: "var(--d-mono)",
                }}
              >
                {field.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <div className="relative">
                <input
                  type={field.type === "password" && !visibleFields[field.key] ? "password" : "text"}
                  value={credentials[field.key] ?? ""}
                  onChange={(e) => onFieldChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none transition-colors"
                  style={{
                    background: "var(--d-surface-2)",
                    border: "1px solid var(--d-border)",
                    color: "var(--d-text)",
                    fontFamily: "var(--d-mono)",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "var(--d-primary)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "var(--d-border)")}
                />
                {field.type === "password" && (
                  <button
                    type="button"
                    onClick={() => onToggleVisible(field.key)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded transition-colors"
                    style={{ color: "var(--d-text-3)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--d-text-2)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--d-text-3)")}
                  >
                    {visibleFields[field.key] ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer"
          style={{
            background: "var(--d-surface-2)",
            color: "var(--d-text-2)",
            border: "1px solid var(--d-border)",
          }}
        >
          <ChevronLeft size={16} />
          Back
        </button>
        <button
          onClick={onContinue}
          disabled={!canContinue}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all"
          style={{
            background: canContinue ? "var(--d-primary)" : "var(--d-surface-2)",
            color: canContinue ? "#06070B" : "var(--d-text-3)",
            cursor: canContinue ? "pointer" : "not-allowed",
            boxShadow: canContinue ? "0 0 20px var(--d-primary-glow)" : "none",
          }}
        >
          Continue
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Step 3 — Test Connection
   ═══════════════════════════════════════════════════════════ */

function Step3({
  provider,
  testing,
  results,
  testDone,
  onBack,
  onComplete,
}: {
  provider: ProviderDef;
  testing: boolean;
  results: TestResult[];
  testDone: boolean;
  onBack: () => void;
  onComplete: () => void;
}) {
  const iconMap: Record<string, typeof Phone> = {
    Connection: Globe,
    Authentication: Shield,
    "Number Verification": Phone,
    "Webhook Configuration": Webhook,
  };

  const statusColor: Record<string, string> = {
    success: "var(--d-success)",
    warning: "var(--d-warning)",
    info: "var(--d-primary)",
  };

  const statusBadge: Record<string, string> = {
    success: "dash-badge-ok",
    warning: "dash-badge-warn",
    info: "dash-badge-info",
  };

  const statusLabel: Record<string, string> = {
    success: "Passed",
    warning: "Warning",
    info: "Configure",
  };

  return (
    <div>
      {/* Testing header */}
      <div className="dash-card p-6 mb-5">
        <div className="flex items-center gap-3">
          <div
            className="dash-provider-icon"
            style={{
              background: `${provider.color}18`,
              color: provider.color,
              border: `1px solid ${provider.color}30`,
            }}
          >
            {provider.abbr}
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-[15px]" style={{ color: "var(--d-text)" }}>
              {testing ? `Testing connection to ${provider.name}...` : `Connection Test Results`}
            </h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--d-text-2)" }}>
              {testing
                ? "Verifying credentials and endpoint connectivity"
                : `${results.filter((r) => r.status === "success").length}/${results.length} checks passed`}
            </p>
          </div>
          {testing && (
            <Loader2
              size={24}
              className="animate-spin"
              style={{ color: "var(--d-primary)" }}
            />
          )}
        </div>
      </div>

      {/* Results */}
      <div className="space-y-3">
        {results.map((r, i) => {
          const Icon = iconMap[r.label] ?? Globe;
          return (
            <motion.div
              key={r.label}
              variants={resultVariants}
              initial="hidden"
              animate="visible"
              transition={{ duration: 0.35, delay: i * 0.05, ease: "easeOut" }}
              className="dash-card p-4 flex items-center gap-4"
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{
                  background: `${statusColor[r.status]}14`,
                  border: `1px solid ${statusColor[r.status]}30`,
                }}
              >
                {r.status === "success" ? (
                  <Check size={16} style={{ color: statusColor[r.status] }} />
                ) : r.status === "warning" ? (
                  <AlertTriangle size={16} style={{ color: statusColor[r.status] }} />
                ) : (
                  <Icon size={16} style={{ color: statusColor[r.status] }} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium" style={{ color: "var(--d-text)" }}>
                    {r.label}
                  </span>
                  <span className={`dash-badge ${statusBadge[r.status]}`} style={{ fontSize: 10, padding: "1px 6px" }}>
                    {statusLabel[r.status]}
                  </span>
                </div>
                <p
                  className="text-xs truncate"
                  style={{
                    color: "var(--d-text-2)",
                    fontFamily: r.status === "info" ? "var(--d-mono)" : undefined,
                  }}
                >
                  {r.detail}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Skeleton placeholders while testing */}
      {testing && (
        <div className="space-y-3 mt-3">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="dash-shimmer h-[68px]" />
          ))}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer"
          style={{
            background: "var(--d-surface-2)",
            color: "var(--d-text-2)",
            border: "1px solid var(--d-border)",
          }}
        >
          <ChevronLeft size={16} />
          Back
        </button>
        <button
          onClick={onComplete}
          disabled={!testDone}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all"
          style={{
            background: testDone ? "var(--d-primary)" : "var(--d-surface-2)",
            color: testDone ? "#06070B" : "var(--d-text-3)",
            cursor: testDone ? "pointer" : "not-allowed",
            boxShadow: testDone ? "0 0 20px var(--d-primary-glow)" : "none",
          }}
        >
          Complete Setup
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Step 4 — Complete
   ═══════════════════════════════════════════════════════════ */

function Step4({
  provider,
  credentials,
  onReset,
}: {
  provider: ProviderDef;
  credentials: Record<string, string>;
  onReset: () => void;
}) {
  const phoneField = provider.fields.find(
    (f) => f.key === "phone_number" || f.key === "caller_id" || f.key === "trunk_host"
  );
  const displayNumber = phoneField ? credentials[phoneField.key] || "---" : "---";

  return (
    <div className="flex flex-col items-center text-center pt-8">
      {/* Checkmark */}
      <motion.div
        variants={checkmarkVariants}
        initial="hidden"
        animate="visible"
        className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
        style={{
          background: "var(--d-primary-muted)",
          border: "2px solid var(--d-primary)",
          boxShadow: "0 0 40px var(--d-primary-glow), 0 0 80px rgba(0, 221, 179, 0.1)",
        }}
      >
        <Check size={36} strokeWidth={3} style={{ color: "var(--d-primary)" }} />
      </motion.div>

      {/* Heading */}
      <motion.h2
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-2xl font-bold mb-2"
        style={{ color: "var(--d-text)" }}
      >
        Provider Connected!
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="text-sm mb-8"
        style={{ color: "var(--d-text-2)" }}
      >
        Your {provider.name} integration is live and ready to handle calls
      </motion.p>

      {/* Summary card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="dash-card p-6 w-full max-w-sm text-left"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: "var(--d-text-3)", fontFamily: "var(--d-mono)" }}>
              PROVIDER
            </span>
            <div className="flex items-center gap-2">
              <div
                className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold"
                style={{
                  background: `${provider.color}18`,
                  color: provider.color,
                  fontFamily: "var(--d-mono)",
                }}
              >
                {provider.abbr}
              </div>
              <span className="text-sm font-medium" style={{ color: "var(--d-text)" }}>
                {provider.name}
              </span>
            </div>
          </div>
          <div
            className="h-px w-full"
            style={{ background: "var(--d-border)" }}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: "var(--d-text-3)", fontFamily: "var(--d-mono)" }}>
              {provider.key === "sip" ? "TRUNK" : "NUMBER"}
            </span>
            <span className="text-sm font-medium" style={{ color: "var(--d-text)", fontFamily: "var(--d-mono)" }}>
              {displayNumber}
            </span>
          </div>
          <div
            className="h-px w-full"
            style={{ background: "var(--d-border)" }}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: "var(--d-text-3)", fontFamily: "var(--d-mono)" }}>
              STATUS
            </span>
            <span className="dash-badge dash-badge-ok">
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "var(--d-success)" }} />
              Active
            </span>
          </div>
        </div>
      </motion.div>

      {/* Action buttons */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.65 }}
        className="flex items-center gap-3 mt-8"
      >
        <Link
          href="/dashboard/telephony"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all"
          style={{
            background: "var(--d-primary)",
            color: "#06070B",
            boxShadow: "0 0 20px var(--d-primary-glow)",
          }}
        >
          Go to Telephony Dashboard
          <ExternalLink size={14} />
        </Link>
        <button
          onClick={onReset}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer"
          style={{
            background: "var(--d-surface-2)",
            color: "var(--d-text-2)",
            border: "1px solid var(--d-border)",
          }}
        >
          <RotateCcw size={14} />
          Setup Another Provider
        </button>
      </motion.div>

      {/* Sparkle decoration */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="mt-10"
        style={{ color: "var(--d-text-3)" }}
      >
        <Sparkles size={16} />
      </motion.div>
    </div>
  );
}
