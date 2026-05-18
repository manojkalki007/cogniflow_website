import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  ArrowLeft, Save, Rocket, MessageSquare, Phone, PhoneCall,
  Mic, Brain, Volume2, Settings2, Wrench, BookOpen,
  BarChart3, Zap, Copy, Trash2, Download, ChevronRight,
  Play, Pause, Check, X, Plus, Upload, Globe, FileText,
  Shield, Clock, PhoneForwarded, AlertTriangle, Loader2,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";

const LLM_MODELS = {
  groq: [
    { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B", cost: 0.12, latency: 80, tier: "Best for complex" },
    { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B", cost: 0.01, latency: 50, tier: "Simple tasks" },
    { id: "mixtral-8x7b-32768", label: "Mixtral 8x7B", cost: 0.05, latency: 70, tier: "Balanced" },
  ],
};

const TTS_VOICES = {
  smallest: {
    female: [
      { id: "emily", label: "Emily", desc: "Clear & warm" },
      { id: "jasmine", label: "Jasmine", desc: "Friendly" },
      { id: "ananya", label: "Ananya", desc: "Indian English" },
      { id: "diya", label: "Diya", desc: "Professional" },
      { id: "nisha", label: "Nisha", desc: "Gentle" },
      { id: "pooja", label: "Pooja", desc: "Energetic" },
    ],
    male: [
      { id: "arman", label: "Arman", desc: "Confident" },
      { id: "james", label: "James", desc: "Professional" },
      { id: "raj", label: "Raj", desc: "Indian English" },
      { id: "george", label: "George", desc: "Warm" },
      { id: "aravind", label: "Aravind", desc: "Casual" },
      { id: "arnav", label: "Arnav", desc: "Energetic" },
    ],
  },
  sarvam: {
    female: [
      { id: "meera", label: "Meera", desc: "Warm Hindi" },
      { id: "kavya", label: "Kavya", desc: "Gentle" },
      { id: "priya", label: "Priya", desc: "Friendly" },
    ],
    male: [
      { id: "amit", label: "Amit", desc: "Confident" },
      { id: "manan", label: "Manan", desc: "Casual" },
      { id: "aditya", label: "Aditya", desc: "Professional" },
    ],
  },
};

const LANGUAGES = [
  { code: "en", label: "English" }, { code: "hi", label: "Hindi" },
  { code: "ta", label: "Tamil" }, { code: "te", label: "Telugu" },
  { code: "kn", label: "Kannada" }, { code: "ml", label: "Malayalam" },
  { code: "bn", label: "Bengali" }, { code: "mr", label: "Marathi" },
  { code: "gu", label: "Gujarati" }, { code: "en-in", label: "English (Indian)" },
];

const EMOTION_PROFILES = [
  { id: "friendly", label: "Friendly & Efficient", desc: "General purpose", icon: "😊" },
  { id: "empathetic", label: "Warm & Empathetic", desc: "Healthcare, support", icon: "🤗" },
  { id: "energetic", label: "Energetic & Persuasive", desc: "Sales, EdTech", icon: "⚡" },
  { id: "professional", label: "Calm & Professional", desc: "Finance, legal", icon: "👔" },
  { id: "hinglish_friendly", label: "Hinglish Natural", desc: "Desi, casual", icon: "🇮🇳" },
];

const AVAILABLE_TOOLS = [
  { id: "book_appointment", label: "Book Appointment", icon: "📅", desc: "Schedule meetings via Cal.com or Google Calendar" },
  { id: "transfer_call", label: "Transfer Call", icon: "📞", desc: "Transfer to human agent when needed" },
  { id: "save_contact_info", label: "Save Contact", icon: "💾", desc: "Create/update contact in CRM" },
  { id: "send_followup", label: "Send Email", icon: "📧", desc: "Send follow-up emails" },
  { id: "send_whatsapp", label: "Send WhatsApp", icon: "💬", desc: "Send WhatsApp messages & templates" },
  { id: "check_availability", label: "Check Calendar", icon: "📆", desc: "Check available time slots" },
  { id: "create_payment_link", label: "Payment Link", icon: "💳", desc: "Generate Razorpay payment links" },
];

const PROVIDER_COSTS = {
  stt: { deepgram: { cost: 0.35, latency: 80, label: "Deepgram Nova-3" }, sarvam: { cost: 0.50, latency: 90, label: "Sarvam Saaras v3" } },
  tts: { smallest: { cost: 0.40, latency: 50, label: "Smallest Lightning" }, sarvam: { cost: 0.90, latency: 40, label: "Sarvam Bulbul v3" } },
  llm: { groq: { cost: 0.12, latency: 80, label: "Groq" } },
  tel: { twilio: { cost: 1.20, latency: 30, label: "Twilio" }, vobiz: { cost: 0.45, latency: 30, label: "Vobiz India" } },
};

function ProviderStack({ form }) {
  const sttProvider = form.language && ["hi","ta","te","kn","ml","bn","mr","gu"].includes(form.language) ? "sarvam" : "deepgram";
  const stt = PROVIDER_COSTS.stt[sttProvider];
  const tts = PROVIDER_COSTS.tts[form.tts_provider] || PROVIDER_COSTS.tts.smallest;
  const llm = PROVIDER_COSTS.llm[form.llm_provider] || PROVIDER_COSTS.llm.groq;
  const tel = PROVIDER_COSTS.tel.vobiz;

  const providers = [
    { label: "STT", ...stt, color: "#EF4444" },
    { label: "LLM", ...llm, color: "#10B981" },
    { label: "TTS", ...tts, color: "#3B82F6" },
    { label: "TEL", ...tel, color: "#F59E0B" },
  ];

  const totalCost = providers.reduce((s, p) => s + p.cost, 0);
  const totalLatency = providers.reduce((s, p) => s + p.latency, 0);

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Provider Stack</h3>
      <div className="space-y-2">
        {providers.map(p => (
          <div key={p.label} className="flex items-center gap-3 p-3 rounded-xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: p.color }}>{p.label}</span>
                <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{p.latency}ms</span>
              </div>
              <div className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{p.label_name || p.label}</div>
              <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>₹{p.cost.toFixed(2)}/min</div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-muted)' }}>
        {providers.map(p => (
          <div key={p.label} style={{ width: `${(p.cost / totalCost) * 100}%`, background: p.color }} />
        ))}
      </div>

      <div className="flex items-center justify-between p-3 rounded-xl border" style={{ background: 'var(--accent-subtle)', borderColor: 'var(--accent)' + '30' }}>
        <div>
          <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>₹{totalCost.toFixed(2)}/min</div>
          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Total cost</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>~{totalLatency}ms</div>
          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Est. latency</div>
        </div>
      </div>
    </div>
  );
}

function SectionNav({ active, onChange }) {
  const sections = [
    { id: "prompt", icon: MessageSquare, label: "Prompt" },
    { id: "model", icon: Brain, label: "Model" },
    { id: "voice", icon: Volume2, label: "Voice" },
    { id: "call", icon: Phone, label: "Call" },
    { id: "tools", icon: Wrench, label: "Tools" },
    { id: "kb", icon: BookOpen, label: "Knowledge" },
    { id: "analytics", icon: BarChart3, label: "Analytics" },
    { id: "advanced", icon: Zap, label: "Advanced" },
  ];

  return (
    <div className="space-y-1">
      {sections.map(s => {
        const Icon = s.icon;
        const isActive = active === s.id;
        return (
          <button key={s.id} onClick={() => onChange(s.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${isActive ? "font-medium" : ""}`}
            style={{
              background: isActive ? 'var(--accent-subtle)' : 'transparent',
              color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
              borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
            }}>
            <Icon size={16} />
            <span>{s.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function PromptSection({ form, set }) {
  const tokenCount = Math.round((form.instructions || "").length / 4);
  return (
    <div className="space-y-6">
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Agent Name</label>
        <input value={form.name} onChange={e => set("name", e.target.value)}
          className="w-full rounded-xl px-4 py-3 border text-lg font-medium focus:border-[var(--accent)] outline-none"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          placeholder="Priya - Admissions Counsellor" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Emotion Profile</label>
          <div className="space-y-2">
            {EMOTION_PROFILES.map(ep => (
              <button key={ep.id} onClick={() => set("emotion_profile", ep.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left text-sm transition-all ${form.emotion_profile === ep.id ? "border-blue-500/50 bg-blue-500/10" : ""}`}
                style={form.emotion_profile !== ep.id ? { borderColor: 'var(--border)', color: 'var(--text-secondary)' } : { color: 'var(--text-primary)' }}>
                <span>{ep.icon}</span>
                <div>
                  <div className="text-xs font-medium">{ep.label}</div>
                  <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{ep.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Voice Gender</label>
          <div className="flex gap-2">
            {["female", "male"].map(g => (
              <button key={g} onClick={() => set("voice_gender", g)}
                className={`flex-1 py-2.5 rounded-xl border text-sm capitalize transition-all ${form.voice_gender === g ? "border-blue-500/50 bg-blue-500/10 font-medium" : ""}`}
                style={form.voice_gender !== g ? { borderColor: 'var(--border)', color: 'var(--text-secondary)' } : { color: 'var(--text-primary)' }}>
                {g === "female" ? "👩" : "👨"} {g}
              </button>
            ))}
          </div>
          <label className="text-xs font-semibold uppercase tracking-wider mb-2 mt-4 block" style={{ color: 'var(--text-muted)' }}>Languages</label>
          <div className="flex flex-wrap gap-1.5">
            {LANGUAGES.map(l => (
              <button key={l.code} onClick={() => set("language", l.code)}
                className={`px-2.5 py-1 rounded-lg text-xs border transition-all ${form.language === l.code ? "border-blue-500/50 bg-blue-500/10 font-medium" : ""}`}
                style={form.language !== l.code ? { borderColor: 'var(--border)', color: 'var(--text-muted)' } : { color: 'var(--text-primary)' }}>
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Greeting Message</label>
        </div>
        <textarea value={form.greeting} onChange={e => set("greeting", e.target.value)}
          rows={2} className="w-full rounded-xl px-4 py-3 border focus:border-[var(--accent)] outline-none resize-none text-sm"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          placeholder="Hi, I'm Priya from T. John College. Am I speaking with {lead_name}?" />
        <div className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>The first thing the agent says when the call connects.</div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>System Prompt</label>
          <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{tokenCount} tokens</span>
        </div>
        <textarea value={form.instructions} onChange={e => set("instructions", e.target.value)}
          rows={14} className="w-full rounded-xl px-4 py-3 border focus:border-[var(--accent)] outline-none resize-none font-mono text-xs leading-relaxed"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          placeholder={"IDENTITY\nYou are Priya, a friendly student counsellor...\n\nOBJECTIVE\n1. Qualify the lead...\n\nRULES\n- Keep responses concise..."} />
      </div>
    </div>
  );
}

function ModelSection({ form, set }) {
  const models = LLM_MODELS[form.llm_provider] || [];
  const current = models.find(m => m.id === form.llm_model) || models[0] || {};

  return (
    <div className="space-y-6">
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider mb-3 block" style={{ color: 'var(--text-muted)' }}>LLM Provider</label>
        <div className="flex gap-2">
          {Object.keys(LLM_MODELS).map(p => (
            <button key={p} onClick={() => { set("llm_provider", p); set("llm_model", LLM_MODELS[p][0]?.id || ""); }}
              className={`px-4 py-2 rounded-xl border text-sm capitalize transition-all ${form.llm_provider === p ? "border-green-500/50 bg-green-500/10 font-medium" : ""}`}
              style={form.llm_provider !== p ? { borderColor: 'var(--border)', color: 'var(--text-secondary)' } : { color: 'var(--text-primary)' }}>
              {p}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wider mb-3 block" style={{ color: 'var(--text-muted)' }}>Model</label>
        <div className="grid grid-cols-3 gap-3">
          {models.map(m => (
            <button key={m.id} onClick={() => set("llm_model", m.id)}
              className={`p-4 rounded-xl border text-left transition-all ${form.llm_model === m.id ? "border-green-500/50 bg-green-500/10 shadow-md shadow-green-500/5" : ""}`}
              style={form.llm_model !== m.id ? { borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-secondary)' } : { color: 'var(--text-primary)' }}>
              <div className="text-sm font-medium mb-1">{m.label}</div>
              <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>₹{m.cost}/min · {m.latency}ms</div>
              <div className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>{m.tier}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Temperature: {form.temperature}</label>
        <input type="range" min="0" max="1.5" step="0.05" value={form.temperature}
          onChange={e => set("temperature", parseFloat(e.target.value))}
          className="w-full accent-green-500" />
        <div className="flex justify-between text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
          <span>Precise (0)</span><span>Balanced</span><span>Creative (1.5)</span>
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Max Call Duration</label>
        <div className="flex items-center gap-3">
          <input type="number" value={form.max_call_duration} onChange={e => set("max_call_duration", parseInt(e.target.value) || 600)}
            className="w-32 rounded-xl px-4 py-2 border focus:border-[var(--accent)] outline-none font-mono text-sm"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>seconds ({Math.round(form.max_call_duration / 60)} min)</span>
        </div>
      </div>
    </div>
  );
}

function VoiceSection({ form, set }) {
  const ttsProvider = form.tts_provider || "smallest";
  const gender = form.voice_gender || "female";
  const voices = TTS_VOICES[ttsProvider]?.[gender] || [];

  return (
    <div className="space-y-6">
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider mb-3 block" style={{ color: 'var(--text-muted)' }}>TTS Provider</label>
        <div className="flex gap-2">
          {["smallest", "sarvam"].map(p => (
            <button key={p} onClick={() => set("tts_provider", p)}
              className={`px-4 py-2 rounded-xl border text-sm capitalize transition-all ${ttsProvider === p ? "border-blue-500/50 bg-blue-500/10 font-medium" : ""}`}
              style={ttsProvider !== p ? { borderColor: 'var(--border)', color: 'var(--text-secondary)' } : { color: 'var(--text-primary)' }}>
              {p === "smallest" ? "Smallest AI" : "Sarvam AI"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wider mb-3 block" style={{ color: 'var(--text-muted)' }}>
          Voice — {gender === "female" ? "Female" : "Male"}
        </label>
        <div className="grid grid-cols-3 gap-3">
          {voices.map(v => (
            <button key={v.id} onClick={() => set("voice_id", v.id)}
              className={`p-3 rounded-xl border text-center transition-all ${form.voice_id === v.id ? "border-blue-500/50 bg-blue-500/10 shadow-md shadow-blue-500/5" : ""}`}
              style={form.voice_id !== v.id ? { borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-secondary)' } : { color: 'var(--text-primary)' }}>
              <div className="text-sm font-medium">{v.label}</div>
              <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{v.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 rounded-xl border space-y-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Emotion Adaptation</label>
          <ToggleSwitch checked={form.enable_emotion} onChange={v => set("enable_emotion", v)} />
        </div>
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Language Auto-Switch</label>
          <ToggleSwitch checked={form.enable_language_switch} onChange={v => set("enable_language_switch", v)} />
        </div>
      </div>
    </div>
  );
}

function CallSection({ form, set }) {
  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl border space-y-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <h4 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Call Behaviour</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Max Duration</label>
            <select value={form.max_call_duration} onChange={e => set("max_call_duration", parseInt(e.target.value))}
              className="w-full rounded-lg px-3 py-2 border text-sm outline-none"
              style={{ background: 'var(--bg-muted)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
              <option value={300}>5 minutes</option>
              <option value={600}>10 minutes</option>
              <option value={900}>15 minutes</option>
              <option value={1800}>30 minutes</option>
            </select>
          </div>
          <div>
            <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Phone Numbers</label>
            <input value={form.phone_numbers} onChange={e => set("phone_numbers", e.target.value)}
              className="w-full rounded-lg px-3 py-2 border text-sm outline-none font-mono"
              style={{ background: 'var(--bg-muted)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              placeholder="+91 98765 43210" />
          </div>
        </div>
      </div>

      <div className="p-4 rounded-xl border space-y-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <h4 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Compliance</h4>
        {[
          { key: "ai_disclosure", label: "AI Disclosure", desc: "\"You're speaking with an AI assistant\"" },
          { key: "recording_consent", label: "Recording Consent", desc: "\"This call may be recorded\"" },
          { key: "pii_redaction", label: "PII Redaction", desc: "Mask credit cards, Aadhaar numbers" },
        ].map(item => (
          <div key={item.key} className="flex items-center justify-between">
            <div>
              <div className="text-sm" style={{ color: 'var(--text-primary)' }}>{item.label}</div>
              <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{item.desc}</div>
            </div>
            <ToggleSwitch checked={form.guardrails?.[item.key] ?? true} onChange={v => set("guardrails", { ...form.guardrails, [item.key]: v })} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ToolsSection({ form, set }) {
  const toggleTool = (id) => {
    const tools = form.tools_enabled.includes(id)
      ? form.tools_enabled.filter(t => t !== id)
      : [...form.tools_enabled, id];
    set("tools_enabled", tools);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Connected Tools</label>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}>
          {form.tools_enabled.length} active
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {AVAILABLE_TOOLS.map(tool => {
          const active = form.tools_enabled.includes(tool.id);
          return (
            <button key={tool.id} onClick={() => toggleTool(tool.id)}
              className={`p-4 rounded-xl border text-left transition-all ${active ? "border-blue-500/50 bg-blue-500/10 shadow-md shadow-blue-500/5" : "hover:border-[var(--text-muted)]/30"}`}
              style={!active ? { borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-secondary)' } : { color: 'var(--text-primary)' }}>
              <div className="flex items-center gap-3 mb-1">
                <span className="text-lg">{tool.icon}</span>
                <span className="text-sm font-medium">{tool.label}</span>
                {active && <Check size={14} className="ml-auto text-blue-400" />}
              </div>
              <div className="text-[10px] pl-8" style={{ color: 'var(--text-muted)' }}>{tool.desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FeaturesSection({ form, set }) {
  const features = [
    { key: "enable_memory", label: "Caller Memory", desc: "Remember callers across sessions", icon: Brain },
    { key: "enable_prediction", label: "Pre-Call Prediction", desc: "Predict caller intent before answering", icon: Zap },
    { key: "enable_emotion", label: "Emotion Adaptation", desc: "Adapt tone based on caller sentiment", icon: Volume2 },
    { key: "enable_language_switch", label: "Language Switching", desc: "Auto-detect and switch languages", icon: Globe },
    { key: "enable_rag", label: "Knowledge Base", desc: "Use uploaded documents during calls", icon: BookOpen },
  ];

  return (
    <div className="space-y-6">
      <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>AI Features</label>
      <div className="space-y-3">
        {features.map(({ key, label, desc, icon: Icon }) => (
          <div key={key} className="flex items-center justify-between p-4 rounded-xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-subtle)' }}>
                <Icon size={16} style={{ color: 'var(--accent)' }} />
              </div>
              <div>
                <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</div>
                <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{desc}</div>
              </div>
            </div>
            <ToggleSwitch checked={form[key]} onChange={v => set(key, v)} />
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalyticsSection({ agentId }) {
  const { data: perf } = useQuery({
    queryKey: ["agent-perf", agentId],
    queryFn: () => api.getAgentPerformance(agentId),
    enabled: !!agentId,
  });

  const stats = perf || {};
  const cards = [
    { label: "Total Calls", value: stats.total_calls || 0 },
    { label: "Avg Duration", value: stats.avg_duration ? `${Math.round(stats.avg_duration)}s` : "—" },
    { label: "Success Rate", value: stats.conversion_rate ? `${stats.conversion_rate}%` : "—" },
    { label: "Avg Sentiment", value: stats.avg_sentiment ? `${(stats.avg_sentiment * 100).toFixed(0)}%` : "—" },
  ];

  return (
    <div className="space-y-6">
      <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Agent Performance</label>
      <div className="grid grid-cols-4 gap-3">
        {cards.map(c => (
          <div key={c.label} className="p-4 rounded-xl border text-center" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{c.value}</div>
            <div className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>{c.label}</div>
          </div>
        ))}
      </div>
      {!agentId && <div className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>Save the agent first to see analytics.</div>}
    </div>
  );
}

function AdvancedSection({ form, set, agentId, onDelete, onClone }) {
  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl border space-y-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <h4 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Latency Optimizations</h4>
        {[
          { key: "enable_prewarm", label: "Pre-warm TTS on connect" },
          { key: "enable_sentence_streaming", label: "Sentence streaming to TTS" },
          { key: "enable_filler", label: "Filler audio for tool calls" },
          { key: "enable_speculative", label: "Speculative LLM generation" },
        ].map(item => (
          <div key={item.key} className="flex items-center justify-between">
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
            <ToggleSwitch checked={form[item.key]} onChange={() => set(item.key, !form[item.key])} />
          </div>
        ))}
      </div>

      {agentId && (
        <div className="p-4 rounded-xl border space-y-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <h4 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Agent ID</h4>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono p-2 rounded-lg" style={{ background: 'var(--bg-muted)', color: 'var(--text-secondary)' }}>{agentId}</code>
            <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(agentId)}>
              <Copy size={14} />
            </Button>
          </div>
        </div>
      )}

      <div className="p-4 rounded-xl border border-red-500/20 space-y-3" style={{ background: 'rgba(239,68,68,0.03)' }}>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-red-400">Danger Zone</h4>
        <div className="flex gap-3">
          {agentId && <Button variant="ghost" onClick={onClone} className="text-sm"><Copy size={14} /> Clone Agent</Button>}
          {agentId && <Button variant="ghost" onClick={onDelete} className="text-sm text-red-400"><Trash2 size={14} /> Delete Agent</Button>}
        </div>
      </div>
    </div>
  );
}

function ToggleSwitch({ checked, onChange }) {
  return (
    <button onClick={() => onChange(!checked)}
      className={`w-11 h-6 rounded-full transition-all duration-200 relative flex-shrink-0 ${checked ? "bg-blue-500 shadow-md shadow-blue-500/30" : "bg-gray-600"}`}>
      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${checked ? "left-6" : "left-1"}`} />
    </button>
  );
}

export default function AgentBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [section, setSection] = useState("prompt");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const isNew = !id || id === "new";

  const { data: agentData, isLoading } = useQuery({
    queryKey: ["agent", id],
    queryFn: () => api.getAgent(id),
    enabled: !isNew,
  });

  const [form, setForm] = useState({
    name: "", instructions: "", greeting: "", language: "en",
    emotion_profile: "friendly", voice_gender: "female", voice_id: "emily",
    phone_numbers: "", llm_provider: "groq", llm_model: "llama-3.3-70b-versatile",
    tts_provider: "smallest", temperature: 0.7, max_call_duration: 600,
    enable_memory: true, enable_prediction: true, enable_emotion: true,
    enable_language_switch: true, enable_rag: false,
    tools_enabled: ["book_appointment", "save_contact_info", "send_whatsapp"],
    guardrails: { ai_disclosure: true, recording_consent: true, pii_redaction: true },
    enable_prewarm: true,
    enable_sentence_streaming: true,
    enable_filler: true,
    enable_speculative: false,
  });

  useEffect(() => {
    if (agentData && !agentData.error) {
      setForm({
        name: agentData.name || "",
        instructions: agentData.instructions || "",
        greeting: agentData.greeting || "",
        language: agentData.language || "en",
        emotion_profile: agentData.emotion_profile || "friendly",
        voice_gender: agentData.voice_gender || "female",
        voice_id: agentData.voice_id || "emily",
        phone_numbers: (agentData.phone_numbers || []).join(", "),
        llm_provider: agentData.llm_provider || "groq",
        llm_model: agentData.llm_model || "llama-3.3-70b-versatile",
        tts_provider: agentData.tts_provider || "smallest",
        temperature: agentData.temperature ?? 0.7,
        max_call_duration: agentData.max_call_duration || 600,
        enable_memory: agentData.enable_memory ?? true,
        enable_prediction: agentData.enable_prediction ?? true,
        enable_emotion: agentData.enable_emotion ?? true,
        enable_language_switch: agentData.enable_language_switch ?? true,
        enable_rag: agentData.enable_rag ?? false,
        tools_enabled: agentData.tools_enabled || ["book_appointment", "save_contact_info"],
        guardrails: agentData.guardrails || { ai_disclosure: true, recording_consent: true, pii_redaction: true },
        enable_prewarm: agentData.enable_prewarm ?? true,
        enable_sentence_streaming: agentData.enable_sentence_streaming ?? true,
        enable_filler: agentData.enable_filler ?? true,
        enable_speculative: agentData.enable_speculative ?? false,
      });
    }
  }, [agentData]);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        phone_numbers: form.phone_numbers.split(",").map(n => n.trim()).filter(Boolean),
        temperature: parseFloat(form.temperature),
        max_call_duration: parseInt(form.max_call_duration),
      };

      let result;
      if (isNew) {
        result = await api.createAgent(payload);
      } else {
        result = await api.updateAgent(id, payload);
      }

      if (result && !result.error) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        queryClient.invalidateQueries(["agents"]);
        queryClient.invalidateQueries(["agent", id]);
        if (isNew && result.id) {
          navigate(`/home/agents/${result.id}`, { replace: true });
        }
      } else {
        setError(result?.error || "Failed to save agent");
      }
    } catch (err) {
      setError(err.message || "Failed to save agent");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this agent? This cannot be undone.")) return;
    setError("");
    try {
      const result = await api.deleteAgent(id);
      if (result?.error) {
        setError(result.error);
        return;
      }
      queryClient.invalidateQueries(["agents"]);
      navigate("/home/agents");
    } catch (err) {
      setError(err.message || "Failed to delete agent");
    }
  };

  const handleClone = async () => {
    setError("");
    try {
      const result = await api.cloneAgent({ source_agent_id: id, name: form.name + " (Copy)" });
      if (result?.error) {
        setError(result.error);
        return;
      }
      queryClient.invalidateQueries(["agents"]);
      navigate("/home/agents");
    } catch (err) {
      setError(err.message || "Failed to clone agent");
    }
  };

  if (isLoading && !isNew) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-60px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/home/agents")} className="p-1.5 rounded-lg hover:bg-[var(--bg-muted)] transition-colors">
            <ArrowLeft size={18} style={{ color: 'var(--text-secondary)' }} />
          </button>
          <div>
            <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              {form.name || "New Agent"}
            </h1>
            <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {isNew ? "Create a new voice agent" : `Agent ID: ${id}`}
            </div>
          </div>
          <Badge className={`text-[10px] ${!isNew ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"}`}>
            {isNew ? "Draft" : "Published"}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={handleSave} disabled={saving || !form.name || !form.instructions}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : <Save size={14} />}
            {saving ? "Saving..." : saved ? "Saved!" : "Save"}
          </Button>
          {!isNew && (
            <Button onClick={() => navigate(`/home/agents`)} className="bg-green-600 hover:bg-green-700">
              <Rocket size={14} /> Published
            </Button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-6 mt-3 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-red-400 flex-shrink-0" />
            <span className="text-sm text-red-400">{error}</span>
          </div>
          <button onClick={() => setError("")} className="p-1 rounded-lg hover:bg-red-500/10 text-red-400">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Three-column layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Section Nav */}
        <div className="w-48 border-r p-4 overflow-y-auto flex-shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
          <SectionNav active={section} onChange={setSection} />
        </div>

        {/* Center: Main Editor */}
        <div className="flex-1 overflow-y-auto p-6" style={{ background: 'var(--bg-primary)' }}>
          <div className="max-w-3xl mx-auto">
            {section === "prompt" && <PromptSection form={form} set={set} />}
            {section === "model" && <ModelSection form={form} set={set} />}
            {section === "voice" && <VoiceSection form={form} set={set} />}
            {section === "call" && <CallSection form={form} set={set} />}
            {section === "tools" && <ToolsSection form={form} set={set} />}
            {section === "kb" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Knowledge Base</h2>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Upload documents or add URLs for your agent to reference during calls.</p>
                </div>
                <div className="border-2 border-dashed rounded-xl p-12 text-center" style={{ borderColor: 'var(--border)' }}>
                  <Upload size={32} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                  <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Coming Soon</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>RAG-powered knowledge base with document upload and URL crawling</p>
                </div>
              </div>
            )}
            {section === "analytics" && <AnalyticsSection agentId={isNew ? null : id} />}
            {section === "advanced" && <AdvancedSection form={form} set={set} agentId={isNew ? null : id} onDelete={handleDelete} onClone={handleClone} />}
          </div>
        </div>

        {/* Right: Provider Stack */}
        <div className="w-64 border-l p-4 overflow-y-auto flex-shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
          <ProviderStack form={form} />

          <div className="mt-6 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Quick Actions</h3>
            <button onClick={() => !isNew && navigate("/home/agents")}
              disabled={isNew}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all hover:bg-[var(--bg-muted)] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
              <PhoneCall size={14} /> {isNew ? "Save first to test" : "Test Voice Call"}
            </button>
            {!isNew && (
              <button onClick={() => navigator.clipboard.writeText(id)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all hover:bg-[var(--bg-muted)]"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                <Copy size={14} /> Copy Agent ID
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
