import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useRef, useEffect } from "react";
import {
  Plus, Save, Bot, Copy, Upload, Loader2, Trash2,
  PhoneOutgoing, BarChart3, Sliders, Wrench, Shield, Brain,
  Phone, PhoneOff, PhoneCall, X,
} from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "../components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import PageHeader from "../components/PageHeader";

const LLM_MODELS = {
  groq: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
};

const TTS_PROVIDERS = ["smallest", "sarvam"];

const AVAILABLE_TOOLS = [
  { id: "book_appointment", label: "Book Appointment", icon: "📅" },
  { id: "transfer_call", label: "Transfer Call", icon: "📞" },
  { id: "save_contact_info", label: "Save Contact", icon: "💾" },
  { id: "send_followup", label: "Send Follow-up", icon: "📧" },
  { id: "send_whatsapp", label: "Send WhatsApp", icon: "💬" },
  { id: "check_availability", label: "Check Calendar", icon: "📆" },
  { id: "create_payment_link", label: "Payment Link", icon: "💳" },
];

const LANGUAGES = [
  { code: "en", label: "English" }, { code: "hi", label: "Hindi" },
  { code: "ta", label: "Tamil" }, { code: "te", label: "Telugu" },
  { code: "kn", label: "Kannada" }, { code: "ml", label: "Malayalam" },
  { code: "bn", label: "Bengali" }, { code: "mr", label: "Marathi" },
  { code: "gu", label: "Gujarati" }, { code: "en-in", label: "English (Indian)" },
];

function AgentFormDialog({ open, onOpenChange, agent, onSave }) {
  const isEdit = !!agent;
  const [form, setForm] = useState(() => ({
    name: agent?.name || "",
    instructions: agent?.instructions || "",
    greeting: agent?.greeting || "",
    language: agent?.language || "en",
    emotion_profile: agent?.emotion_profile || "friendly",
    voice_gender: agent?.voice_gender || "female",
    voice_id: agent?.voice_id || "",
    phone_numbers: (agent?.phone_numbers || []).join(", "),
    llm_provider: agent?.llm_provider || "groq",
    llm_model: agent?.llm_model || "llama-3.3-70b-versatile",
    tts_provider: agent?.tts_provider || "smallest",
    temperature: agent?.temperature ?? 0.7,
    max_call_duration: agent?.max_call_duration || 600,
    enable_memory: agent?.enable_memory ?? true,
    enable_prediction: agent?.enable_prediction ?? true,
    enable_emotion: agent?.enable_emotion ?? true,
    enable_language_switch: agent?.enable_language_switch ?? true,
    enable_rag: agent?.enable_rag ?? false,
    tools_enabled: agent?.tools_enabled || AVAILABLE_TOOLS.map(t => t.id),
    guardrails: agent?.guardrails || {},
  }));

  const set = (k, v) => setForm({ ...form, [k]: v });

  const handleSave = () => {
    onSave({
      ...form,
      phone_numbers: form.phone_numbers.split(",").map(n => n.trim()).filter(Boolean),
      temperature: parseFloat(form.temperature),
      max_call_duration: parseInt(form.max_call_duration),
    });
  };

  const toggleTool = (toolId) => {
    const tools = form.tools_enabled.includes(toolId)
      ? form.tools_enabled.filter(t => t !== toolId)
      : [...form.tools_enabled, toolId];
    set("tools_enabled", tools);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Agent" : "Create Agent"}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="basic">
          <TabsList>
            <TabsTrigger value="basic">Basic</TabsTrigger>
            <TabsTrigger value="llm">LLM & Voice</TabsTrigger>
            <TabsTrigger value="tools">Tools</TabsTrigger>
            <TabsTrigger value="features">Features</TabsTrigger>
          </TabsList>

          <TabsContent value="basic">
            <div className="space-y-4 text-sm">
              <div>
                <label className="block text-sm mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Agent Name *</label>
                <input value={form.name} onChange={(e) => set("name", e.target.value)}
                  className="w-full rounded-xl px-4 py-3 border focus:border-[var(--accent)]" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} placeholder="Lead Qualifier" />
              </div>
              <div>
                <label className="block text-sm mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>System Prompt *</label>
                <textarea value={form.instructions} onChange={(e) => set("instructions", e.target.value)}
                  rows={6} className="w-full rounded-xl px-4 py-3 border focus:border-[var(--accent)] resize-none font-mono text-xs"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  placeholder="You are a professional sales agent..." />
              </div>
              <div>
                <label className="block text-sm mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Greeting Message</label>
                <input value={form.greeting} onChange={(e) => set("greeting", e.target.value)}
                  className="w-full rounded-xl px-4 py-3 border focus:border-[var(--accent)]"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  placeholder="Hello! Thanks for calling Cogniflow. How can I help you today?" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Language</label>
                  <select value={form.language} onChange={(e) => set("language", e.target.value)}
                    className="w-full rounded-xl px-4 py-3 border outline-none" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                    {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Phone Numbers</label>
                  <input value={form.phone_numbers} onChange={(e) => set("phone_numbers", e.target.value)}
                    className="w-full rounded-xl px-4 py-3 border focus:border-[var(--accent)] font-mono" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} placeholder="+1234, +5678" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Emotion Profile</label>
                  <select value={form.emotion_profile} onChange={(e) => set("emotion_profile", e.target.value)}
                    className="w-full rounded-xl px-4 py-3 border outline-none" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                    <option value="friendly">Friendly & Efficient (General)</option>
                    <option value="empathetic">Warm & Empathetic (Healthcare, Support)</option>
                    <option value="energetic">Energetic & Persuasive (Sales, EdTech)</option>
                    <option value="professional">Calm & Professional (Finance, Legal)</option>
                    <option value="hinglish_friendly">Hinglish Natural (Desi, Casual)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Voice Gender</label>
                  <select value={form.voice_gender} onChange={(e) => set("voice_gender", e.target.value)}
                    className="w-full rounded-xl px-4 py-3 border outline-none" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                  </select>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="llm">
            <div className="space-y-5 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>LLM Provider</label>
                  <select value={form.llm_provider} onChange={(e) => {
                    set("llm_provider", e.target.value);
                    set("llm_model", (LLM_MODELS[e.target.value] || [])[0] || "");
                  }} className="w-full rounded-xl px-4 py-3 border" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                    {Object.keys(LLM_MODELS).map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Model</label>
                  <select value={form.llm_model} onChange={(e) => set("llm_model", e.target.value)}
                    className="w-full rounded-xl px-4 py-3 border" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                    {(LLM_MODELS[form.llm_provider] || []).map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Temperature: {form.temperature}</label>
                <input type="range" min="0" max="2" step="0.1" value={form.temperature}
                  onChange={(e) => set("temperature", e.target.value)}
                  className="w-full accent-blue-500" />
                <div className="flex justify-between text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                  <span>Precise (0)</span><span>Creative (2)</span>
                </div>
              </div>

              <div className="h-px" style={{ background: 'var(--border)' }} />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>TTS Provider</label>
                  <select value={form.tts_provider} onChange={(e) => set("tts_provider", e.target.value)}
                    className="w-full rounded-xl px-4 py-3 border" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                    {TTS_PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Voice ID</label>
                  <input value={form.voice_id} onChange={(e) => set("voice_id", e.target.value)}
                    className="w-full rounded-xl px-4 py-3 border focus:border-[var(--accent)] font-mono" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} placeholder="Voice ID" />
                </div>
              </div>

              <div>
                <label className="block text-sm mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Max Call Duration (seconds)</label>
                <input type="number" value={form.max_call_duration} onChange={(e) => set("max_call_duration", e.target.value)}
                  className="w-32 rounded-xl px-4 py-3 border focus:border-[var(--accent)]" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="tools">
            <div className="space-y-3">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Enable the tools this agent can use during calls:</p>
              <div className="grid grid-cols-2 gap-3">
                {AVAILABLE_TOOLS.map(tool => (
                  <button key={tool.id} onClick={() => toggleTool(tool.id)}
                    className={`flex items-center gap-3 p-4 rounded-xl border text-sm text-left transition-all duration-200 ${
                      form.tools_enabled.includes(tool.id)
                        ? "border-blue-500/50 bg-blue-500/10 shadow-md shadow-blue-500/5"
                        : "hover:border-gray-600/50"
                    }`}
                    style={form.tools_enabled.includes(tool.id)
                      ? { color: 'var(--text-primary)' }
                      : { borderColor: 'var(--border)', background: 'var(--bg-muted)', color: 'var(--text-secondary)' }
                    }>
                    <span className="text-lg">{tool.icon}</span>
                    <span>{tool.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="features">
            <div className="space-y-3">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Toggle AI features for this agent:</p>
              {[
                { key: "enable_memory", label: "Caller Memory", desc: "Remember callers across sessions", icon: Brain },
                { key: "enable_prediction", label: "Pre-Call Prediction", desc: "Predict caller intent before answering", icon: BarChart3 },
                { key: "enable_emotion", label: "Emotional Mirroring", desc: "Adapt tone based on caller sentiment", icon: Sliders },
                { key: "enable_language_switch", label: "Language Switching", desc: "Auto-detect and switch languages mid-call", icon: Wrench },
                { key: "enable_rag", label: "Knowledge Base (RAG)", desc: "Use uploaded documents during calls", icon: Shield },
              ].map(({ key, label, desc, icon: Icon }) => (
                <div key={key} className="flex items-center justify-between p-4 rounded-xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-subtle)' }}>
                      <Icon size={15} style={{ color: 'var(--accent)' }} />
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{desc}</p>
                    </div>
                  </div>
                  <button onClick={() => set(key, !form[key])}
                    className={`w-11 h-6 rounded-full transition-all duration-200 relative ${form[key] ? "bg-blue-500 shadow-md shadow-blue-500/30" : "bg-gray-700"}`}>
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${form[key] ? "left-6" : "left-1"}`} />
                  </button>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex gap-3 pt-3">
          <Button onClick={handleSave} disabled={!form.name || !form.instructions}>
            <Save size={14} /> {isEdit ? "Save Changes" : "Create Agent"}
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LatencyBar({ eot_ms, llm_ms, tts_ms, total_ms }) {
  const wrapStyles = total_ms < 600
    ? "bg-emerald-500/5 border-emerald-500/15"
    : total_ms < 1000
      ? "bg-amber-500/5 border-amber-500/15"
      : "bg-red-500/5 border-red-500/15";
  const totalLabel = total_ms < 600
    ? "text-emerald-400"
    : total_ms < 1000
      ? "text-amber-400"
      : "text-red-400";
  const segColor = (ms, good, ok) =>
    ms < good ? "bg-emerald-500/60" : ms < ok ? "bg-amber-500/60" : "bg-red-500/60";
  const total = eot_ms + llm_ms + tts_ms || 1;

  return (
    <div className="w-full px-2 py-1.5">
      <div className={`rounded-lg border px-3 py-2 ${wrapStyles}`}>
        <div className="flex items-center justify-between mb-1.5">
          <span className={`text-[10px] font-bold tracking-wider uppercase ${totalLabel}`}>
            {total_ms}ms
          </span>
          <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Turn latency</span>
        </div>
        <div className="flex h-1.5 rounded-full overflow-hidden mb-1.5" style={{ background: 'var(--bg-muted)' }}>
          <div className={`${segColor(eot_ms, 80, 150)} transition-all`} style={{ width: `${(eot_ms / total) * 100}%` }} />
          <div className={`${segColor(llm_ms, 300, 500)} transition-all`} style={{ width: `${(llm_ms / total) * 100}%` }} />
          <div className={`${segColor(tts_ms, 300, 500)} transition-all`} style={{ width: `${(tts_ms / total) * 100}%` }} />
        </div>
        <div className="flex gap-3 text-[9px]" style={{ color: 'var(--text-muted)' }}>
          <span>EOT <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>{eot_ms}ms</span></span>
          <span>LLM <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>{llm_ms}ms</span></span>
          <span>TTS <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>{tts_ms}ms</span></span>
        </div>
      </div>
    </div>
  );
}

function TestCallPanel({ agent, onClose }) {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [duration, setDuration] = useState(0);
  const [transcript, setTranscript] = useState([]);
  const wsRef = useRef(null);
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const timerRef = useRef(null);
  const nextPlayTimeRef = useRef(0);
  const gainNodeRef = useRef(null);
  const transcriptEndRef = useRef(null);

  useEffect(() => {
    return () => cleanup();
  }, []);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (wsRef.current && wsRef.current.readyState <= 1) {
      try { wsRef.current.send(JSON.stringify({ event: "stop" })); } catch {}
      wsRef.current.close();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    wsRef.current = null;
    nextPlayTimeRef.current = 0;
    gainNodeRef.current = null;
  };

  const scheduleAudioChunk = (pcm16Bytes) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const float32 = new Float32Array(pcm16Bytes.length / 2);
    const view = new DataView(pcm16Bytes.buffer, pcm16Bytes.byteOffset, pcm16Bytes.byteLength);
    for (let i = 0; i < float32.length; i++) {
      float32[i] = view.getInt16(i * 2, true) / 32768;
    }
    const buf = ctx.createBuffer(1, float32.length, 16000);
    buf.copyToChannel(float32, 0);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(gainNodeRef.current || ctx.destination);
    const now = ctx.currentTime;
    const startAt = Math.max(now + 0.005, nextPlayTimeRef.current);
    src.start(startAt);
    nextPlayTimeRef.current = startAt + buf.duration;
  };

  const startCall = async () => {
    setError("");
    setDuration(0);
    setTranscript([]);
    setStatus("connecting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      audioCtxRef.current = audioCtx;
      const gain = audioCtx.createGain();
      gain.gain.value = 1.0;
      gain.connect(audioCtx.destination);
      gainNodeRef.current = gain;
      nextPlayTimeRef.current = 0;

      const wsBase = (import.meta.env.VITE_API_URL || "https://api.cogniflowautomations.com").trim();
      const wsUrl = wsBase.replace(/^http/, "ws") + `/voice/browser/test?agent_id=${agent.id}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ event: "start", call_sid: crypto.randomUUID() }));
        setStatus("active");
        timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);

        const source = audioCtx.createMediaStreamSource(stream);
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        processor.onaudioprocess = (e) => {
          if (ws.readyState !== 1) return;
          const input = e.inputBuffer.getChannelData(0);
          const pcm16 = new Int16Array(input.length);
          for (let i = 0; i < input.length; i++) {
            pcm16[i] = Math.max(-32768, Math.min(32767, Math.round(input[i] * 32768)));
          }
          const b64 = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));
          ws.send(JSON.stringify({ event: "audio", data: b64 }));
        };
        source.connect(processor);
        processor.connect(audioCtx.destination);
      };

      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.event === "audio") {
          const raw = atob(msg.data);
          const bytes = new Uint8Array(raw.length);
          for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
          scheduleAudioChunk(bytes);
        } else if (msg.event === "transcript") {
          setTranscript(prev => [...prev, { role: msg.role, text: msg.text }]);
        } else if (msg.event === "latency") {
          setTranscript(prev => [...prev, {
            role: "latency",
            turn: msg.turn,
            eot_ms: msg.eot_ms,
            llm_ms: msg.llm_ms,
            tts_ms: msg.tts_ms,
            total_ms: msg.total_ms,
          }]);
        } else if (msg.event === "clear") {
          nextPlayTimeRef.current = 0;
        } else if (msg.event === "error") {
          setError(msg.message || "Agent error");
          cleanup();
          setStatus("idle");
        }
      };

      ws.onerror = () => { setError("WebSocket connection failed"); setStatus("idle"); cleanup(); };
      ws.onclose = () => {
        if (status !== "idle") setStatus("ended");
        if (timerRef.current) clearInterval(timerRef.current);
      };
    } catch (err) {
      setError(err.message || "Microphone access denied");
      setStatus("idle");
    }
  };

  const endCall = () => {
    cleanup();
    setStatus("ended");
  };

  const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="mt-4 pt-4 border-t animate-fade-in" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <PhoneCall size={12} className="text-emerald-400" />
          </div>
          <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Voice Test</span>
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>with {agent.name}</span>
        </div>
        <button onClick={() => { cleanup(); onClose(); }} className="p-1 rounded-lg transition-all" style={{ color: 'var(--text-muted)' }}>
          <X size={14} />
        </button>
      </div>

      {status === "idle" || status === "ended" ? (
        <div className="space-y-3">
          {status === "ended" && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <PhoneOff size={13} className="text-emerald-400" />
              <span className="text-xs text-emerald-400">Call ended — {formatTime(duration)}</span>
            </div>
          )}
          {error && (
            <div className="px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">{error}</div>
          )}
          {status === "ended" && transcript.length > 0 && (
            <div className="max-h-48 overflow-y-auto rounded-xl border p-3 space-y-2" style={{ background: 'var(--bg-muted)', borderColor: 'var(--border)' }}>
              {transcript.map((t, i) =>
                t.role === "latency" ? (
                  <LatencyBar key={i} eot_ms={t.eot_ms} llm_ms={t.llm_ms} tts_ms={t.tts_ms} total_ms={t.total_ms} />
                ) : (
                  <div key={i} className={`flex gap-2 text-xs ${t.role === "user" ? "justify-end" : ""}`}>
                    <div className={`max-w-[85%] px-3 py-1.5 rounded-xl ${
                      t.role === "user"
                        ? "bg-blue-500/15 text-blue-300 border border-blue-500/20"
                        : "border"
                    }`} style={t.role === "user" ? {} : { background: 'var(--bg-muted)', color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
                      <span className="font-medium text-[10px] uppercase tracking-wider opacity-60 block mb-0.5">
                        {t.role === "user" ? "You" : agent.name}
                      </span>
                      {t.text}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Talk to this agent in real-time using your microphone. The agent will respond with voice.</p>
          <Button size="sm" onClick={startCall} className="w-full gap-1.5">
            <Phone size={14} /> {status === "ended" ? "Call Again" : "Start Voice Conversation"}
          </Button>
        </div>
      ) : status === "connecting" ? (
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center bg-amber-500/10 animate-pulse">
            <Loader2 size={24} className="text-amber-400 animate-spin" />
          </div>
          <p className="text-sm mt-4" style={{ color: 'var(--text-secondary)' }}>Connecting to agent...</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center bg-emerald-500/10 relative">
                <Phone size={20} className="text-emerald-400" />
                <span className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-emerald-400">Live — Speak now</p>
                <p className="text-lg font-bold font-mono" style={{ color: 'var(--text-primary)' }}>{formatTime(duration)}</p>
              </div>
            </div>
            <Button variant="destructive" size="sm" onClick={endCall} className="gap-1.5">
              <PhoneOff size={14} /> End
            </Button>
          </div>

          {transcript.length > 0 && (
            <div className="max-h-48 overflow-y-auto rounded-xl border p-3 space-y-2" style={{ background: 'var(--bg-muted)', borderColor: 'var(--border)' }}>
              {transcript.map((t, i) =>
                t.role === "latency" ? (
                  <LatencyBar key={i} eot_ms={t.eot_ms} llm_ms={t.llm_ms} tts_ms={t.tts_ms} total_ms={t.total_ms} />
                ) : (
                  <div key={i} className={`flex gap-2 text-xs ${t.role === "user" ? "justify-end" : ""}`}>
                    <div className={`max-w-[85%] px-3 py-1.5 rounded-xl ${
                      t.role === "user"
                        ? "bg-blue-500/15 text-blue-300 border border-blue-500/20"
                        : "border"
                    }`} style={t.role === "user" ? {} : { background: 'var(--bg-muted)', color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
                      <span className="font-medium text-[10px] uppercase tracking-wider opacity-60 block mb-0.5">
                        {t.role === "user" ? "You" : agent.name}
                      </span>
                      {t.text}
                    </div>
                  </div>
                )
              )}
              <div ref={transcriptEndRef} />
            </div>
          )}

          <p className="text-[10px] text-center" style={{ color: 'var(--text-muted)' }}>Your mic is active. The agent will respond by voice.</p>
        </div>
      )}
    </div>
  );
}

function AgentPerformance({ agentId }) {
  const { data } = useQuery({
    queryKey: ["agent-perf", agentId],
    queryFn: () => api.getAgentPerformance(agentId),
    enabled: !!agentId,
  });

  if (!data || data.total_calls === 0) return null;

  return (
    <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
      {[
        { label: "Calls", value: data.total_calls },
        { label: "Avg Duration", value: `${data.avg_duration}s` },
        { label: "Sentiment", value: data.avg_sentiment },
        { label: "Conversion", value: `${data.conversion_rate}%` },
      ].map(({ label, value }, i) => (
        <div key={label} className="rounded-xl p-3 text-center" style={{ background: 'var(--bg-muted)' }}>
          <p className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--text-muted)' }}>{label}</p>
          <p className={`text-sm font-bold ${i === 0 ? "" : ["", "text-emerald-400", "text-violet-400", "text-amber-400"][i]}`}
            style={i === 0 ? { color: 'var(--accent)' } : {}}>{value}</p>
        </div>
      ))}
    </div>
  );
}

function AgentCard({ agent, onEdit, onDelete, onClone }) {
  const [showTest, setShowTest] = useState(false);

  return (
    <div className="rounded-xl border p-5 transition-all duration-200" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-subtle)' }}>
            <Bot size={16} style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{agent.name}</h3>
            <div className="flex gap-2 mt-1">
              <Badge variant={agent.is_active ? "success" : "secondary"}>
                {agent.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => onEdit(agent)}>Edit</Button>
          <Button variant="ghost" size="sm" onClick={() => onClone(agent)}><Copy size={12} /></Button>
          <Button variant={showTest ? "outline" : "ghost"} size="sm" onClick={() => setShowTest(!showTest)}>
            <Phone size={12} /> Talk
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { if (confirm("Delete this agent?")) onDelete(agent.id); }}>
            <Trash2 size={12} />
          </Button>
        </div>
      </div>

      <p className="text-sm line-clamp-2 mb-3" style={{ color: 'var(--text-secondary)' }}>{agent.instructions}</p>

      <div className="flex gap-3 text-xs flex-wrap mb-3" style={{ color: 'var(--text-muted)' }}>
        <span className="px-2 py-1 rounded-lg" style={{ background: 'var(--bg-muted)' }}>{agent.llm_provider || "groq"} / {agent.llm_model || "llama-3.3-70b"}</span>
        <span className="px-2 py-1 rounded-lg" style={{ background: 'var(--bg-muted)' }}>TTS: {agent.tts_provider || "smallest"}</span>
        <span className="px-2 py-1 rounded-lg" style={{ background: 'var(--bg-muted)' }}>Lang: {agent.language || "en"}</span>
        <span className="px-2 py-1 rounded-lg" style={{ background: 'var(--bg-muted)' }}>Numbers: {(agent.phone_numbers || []).length}</span>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {agent.enable_memory && <Badge variant="outline" className="text-[10px]">Memory</Badge>}
        {agent.enable_prediction && <Badge variant="outline" className="text-[10px]">Prediction</Badge>}
        {agent.enable_emotion && <Badge variant="outline" className="text-[10px]">Emotion</Badge>}
        {agent.enable_language_switch && <Badge variant="outline" className="text-[10px]">Lang Switch</Badge>}
        {agent.enable_rag && <Badge variant="outline" className="text-[10px]">RAG</Badge>}
      </div>

      <AgentPerformance agentId={agent.id} />
      {showTest && <TestCallPanel agent={agent} onClose={() => setShowTest(false)} />}
    </div>
  );
}

function CloneDialog({ open, onOpenChange, sourceAgent }) {
  const queryClient = useQueryClient();
  const [recordings, setRecordings] = useState("");
  const [agentName, setAgentName] = useState("");
  const [cloneResult, setCloneResult] = useState(null);

  const cloneMut = useMutation({
    mutationFn: (data) => api.cloneAgent(data),
    onSuccess: (result) => { setCloneResult(result); queryClient.invalidateQueries(["agents"]); },
  });

  const handleClone = () => {
    cloneMut.mutate({
      agent_name: agentName || `Clone of ${sourceAgent?.name || "Agent"}`,
      recording_urls: recordings.split("\n").map(u => u.trim()).filter(Boolean),
    });
  };

  const handleClose = () => { setRecordings(""); setAgentName(""); setCloneResult(null); onOpenChange(false); };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Clone Agent from Recordings</DialogTitle>
          <DialogDescription>Upload call recordings to generate a new agent that mimics the style.</DialogDescription>
        </DialogHeader>
        {cloneResult ? (
          <div className="space-y-4">
            <Badge variant="success">Clone Generated</Badge>
            <div className="rounded-xl border p-4 text-sm max-h-48 overflow-auto whitespace-pre-wrap" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
              {cloneResult.instructions || "Agent cloned successfully"}
            </div>
            <Button onClick={handleClose} className="w-full">Done</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>New Agent Name</label>
              <input value={agentName} onChange={(e) => setAgentName(e.target.value)}
                placeholder={`Clone of ${sourceAgent?.name || "Agent"}`}
                className="w-full rounded-xl px-4 py-3 border focus:border-[var(--accent)] text-sm" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label className="block text-sm mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Recording URLs (one per line)</label>
              <textarea value={recordings} onChange={(e) => setRecordings(e.target.value)}
                rows={4} placeholder="https://storage.example.com/call-1.mp3"
                className="w-full rounded-xl px-4 py-3 border focus:border-[var(--accent)] text-sm resize-none font-mono" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
            </div>
            <Button onClick={handleClone} disabled={cloneMut.isPending || !recordings.trim()} className="w-full">
              {cloneMut.isPending ? <><Loader2 size={14} className="animate-spin" /> Analyzing...</> : <><Upload size={14} /> Clone Agent</>}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function Agents() {
  const queryClient = useQueryClient();
  const [formDialog, setFormDialog] = useState({ open: false, agent: null });
  const [cloneDialog, setCloneDialog] = useState({ open: false, source: null });

  const { data } = useQuery({ queryKey: ["agents"], queryFn: api.getAgents });
  const agents = data?.agents || [];

  const createMut = useMutation({
    mutationFn: (data) => api.createAgent(data),
    onSuccess: () => { queryClient.invalidateQueries(["agents"]); setFormDialog({ open: false, agent: null }); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => api.updateAgent(id, data),
    onSuccess: () => { queryClient.invalidateQueries(["agents"]); setFormDialog({ open: false, agent: null }); },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.deleteAgent(id),
    onSuccess: () => queryClient.invalidateQueries(["agents"]),
  });

  const handleSave = (data) => {
    if (formDialog.agent) {
      updateMut.mutate({ id: formDialog.agent.id, data });
    } else {
      createMut.mutate(data);
    }
  };

  return (
    <div>
      <PageHeader
        title="Agents"
        description="Configure and manage your AI voice agents"
        action={
          <div className="flex gap-3">
            <Button variant="outline" size="sm" onClick={() => setCloneDialog({ open: true, source: null })}>
              <Copy size={14} /> Clone from Recordings
            </Button>
            <Button size="sm" onClick={() => setFormDialog({ open: true, agent: null })}>
              <Plus size={14} /> New Agent
            </Button>
          </div>
        }
      />

      <div className="px-8 py-6">
        <div className="space-y-4">
          {agents.map((a) => (
            <AgentCard key={a.id} agent={a}
              onEdit={(agent) => setFormDialog({ open: true, agent })}
              onDelete={(id) => deleteMut.mutate(id)}
              onClone={(agent) => setCloneDialog({ open: true, source: agent })} />
          ))}
          {agents.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-3 rounded-xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-subtle)' }}>
                <Bot size={20} style={{ color: 'var(--accent)' }} />
              </div>
              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>No agents configured</p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Using default agent. Create one to get started.</p>
              <Button size="sm" onClick={() => setFormDialog({ open: true, agent: null })}>
                <Plus size={14} /> Create Your First Agent
              </Button>
            </div>
          )}
        </div>
      </div>

      <AgentFormDialog open={formDialog.open} onOpenChange={(open) => setFormDialog({ open, agent: formDialog.agent })}
        agent={formDialog.agent} onSave={handleSave} />
      <CloneDialog open={cloneDialog.open} onOpenChange={(open) => setCloneDialog({ open, source: cloneDialog.source })}
        sourceAgent={cloneDialog.source} />
    </div>
  );
}
