import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useRef, useEffect } from "react";
import {
  Plus, Save, Bot, Copy, Upload, Loader2, Trash2,
  PhoneOutgoing, BarChart3, Sliders, Wrench, Shield, Brain,
  MessageCircle, Send, X, User,
} from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "../components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";

const LLM_MODELS = {
  groq: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"],
};

const TTS_PROVIDERS = ["cartesia", "smallest", "elevenlabs", "sarvam"];

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
    voice_id: agent?.voice_id || "",
    phone_numbers: (agent?.phone_numbers || []).join(", "),
    llm_provider: agent?.llm_provider || "groq",
    llm_model: agent?.llm_model || "llama-3.3-70b-versatile",
    tts_provider: agent?.tts_provider || "cartesia",
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
                <label className="block text-sm text-gray-400 mb-1.5 font-medium">Agent Name *</label>
                <input value={form.name} onChange={(e) => set("name", e.target.value)}
                  className="w-full glass-card rounded-xl px-4 py-3 input-glow border border-gray-700/30 bg-gray-800/30" placeholder="Lead Qualifier" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5 font-medium">System Prompt *</label>
                <textarea value={form.instructions} onChange={(e) => set("instructions", e.target.value)}
                  rows={6} className="w-full glass-card rounded-xl px-4 py-3 input-glow border border-gray-700/30 bg-gray-800/30 resize-none font-mono text-xs"
                  placeholder="You are a professional sales agent..." />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5 font-medium">Greeting Message</label>
                <input value={form.greeting} onChange={(e) => set("greeting", e.target.value)}
                  className="w-full glass-card rounded-xl px-4 py-3 input-glow border border-gray-700/30 bg-gray-800/30"
                  placeholder="Hello! Thanks for calling Cogniflow. How can I help you today?" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5 font-medium">Language</label>
                  <select value={form.language} onChange={(e) => set("language", e.target.value)}
                    className="w-full glass-card rounded-xl px-4 py-3 border border-gray-700/30 bg-gray-800/30">
                    {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5 font-medium">Phone Numbers</label>
                  <input value={form.phone_numbers} onChange={(e) => set("phone_numbers", e.target.value)}
                    className="w-full glass-card rounded-xl px-4 py-3 input-glow border border-gray-700/30 bg-gray-800/30 font-mono" placeholder="+1234, +5678" />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="llm">
            <div className="space-y-5 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5 font-medium">LLM Provider</label>
                  <select value={form.llm_provider} onChange={(e) => {
                    set("llm_provider", e.target.value);
                    set("llm_model", (LLM_MODELS[e.target.value] || [])[0] || "");
                  }} className="w-full glass-card rounded-xl px-4 py-3 border border-gray-700/30 bg-gray-800/30">
                    {Object.keys(LLM_MODELS).map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5 font-medium">Model</label>
                  <select value={form.llm_model} onChange={(e) => set("llm_model", e.target.value)}
                    className="w-full glass-card rounded-xl px-4 py-3 border border-gray-700/30 bg-gray-800/30">
                    {(LLM_MODELS[form.llm_provider] || []).map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1.5 font-medium">Temperature: {form.temperature}</label>
                <input type="range" min="0" max="2" step="0.1" value={form.temperature}
                  onChange={(e) => set("temperature", e.target.value)}
                  className="w-full accent-blue-500" />
                <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                  <span>Precise (0)</span><span>Creative (2)</span>
                </div>
              </div>

              <div className="h-px bg-gradient-to-r from-transparent via-gray-700/50 to-transparent" />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5 font-medium">TTS Provider</label>
                  <select value={form.tts_provider} onChange={(e) => set("tts_provider", e.target.value)}
                    className="w-full glass-card rounded-xl px-4 py-3 border border-gray-700/30 bg-gray-800/30">
                    {TTS_PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5 font-medium">Voice ID</label>
                  <input value={form.voice_id} onChange={(e) => set("voice_id", e.target.value)}
                    className="w-full glass-card rounded-xl px-4 py-3 input-glow border border-gray-700/30 bg-gray-800/30 font-mono" placeholder="Voice ID" />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1.5 font-medium">Max Call Duration (seconds)</label>
                <input type="number" value={form.max_call_duration} onChange={(e) => set("max_call_duration", e.target.value)}
                  className="w-32 glass-card rounded-xl px-4 py-3 input-glow border border-gray-700/30 bg-gray-800/30" />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="tools">
            <div className="space-y-3">
              <p className="text-sm text-gray-400">Enable the tools this agent can use during calls:</p>
              <div className="grid grid-cols-2 gap-3">
                {AVAILABLE_TOOLS.map(tool => (
                  <button key={tool.id} onClick={() => toggleTool(tool.id)}
                    className={`flex items-center gap-3 p-4 rounded-xl border text-sm text-left transition-all duration-200 ${
                      form.tools_enabled.includes(tool.id)
                        ? "border-blue-500/50 bg-blue-500/10 text-white shadow-md shadow-blue-500/5"
                        : "border-gray-700/30 bg-gray-800/30 text-gray-400 hover:border-gray-600/50"
                    }`}>
                    <span className="text-lg">{tool.icon}</span>
                    <span>{tool.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="features">
            <div className="space-y-3">
              <p className="text-sm text-gray-400">Toggle AI features for this agent:</p>
              {[
                { key: "enable_memory", label: "Caller Memory", desc: "Remember callers across sessions", icon: Brain },
                { key: "enable_prediction", label: "Pre-Call Prediction", desc: "Predict caller intent before answering", icon: BarChart3 },
                { key: "enable_emotion", label: "Emotional Mirroring", desc: "Adapt tone based on caller sentiment", icon: Sliders },
                { key: "enable_language_switch", label: "Language Switching", desc: "Auto-detect and switch languages mid-call", icon: Wrench },
                { key: "enable_rag", label: "Knowledge Base (RAG)", desc: "Use uploaded documents during calls", icon: Shield },
              ].map(({ key, label, desc, icon: Icon }) => (
                <div key={key} className="flex items-center justify-between p-4 glass-card rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Icon size={15} className="text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-gray-500">{desc}</p>
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

function TestChatPanel({ agent, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (agent.greeting) {
      setMessages([{ role: "assistant", content: agent.greeting }]);
    }
  }, [agent.greeting]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg = input.trim();
    setInput("");
    const updated = [...messages, { role: "user", content: userMsg }];
    setMessages(updated);
    setIsLoading(true);
    try {
      const history = updated.map(m => ({ role: m.role, content: m.content }));
      const res = await api.testAgentChat(agent.id, "", history);
      if (res.error) {
        setMessages(prev => [...prev, { role: "system", content: `Error: ${res.error}` }]);
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: res.reply, model: res.model }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: "system", content: "Failed to get response" }]);
    }
    setIsLoading(false);
  };

  return (
    <div className="mt-4 pt-4 border-t border-gray-800/30 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <MessageCircle size={12} className="text-emerald-400" />
          </div>
          <span className="text-xs font-medium text-gray-300">Test Chat</span>
          <span className="text-[10px] text-gray-600">with {agent.name}</span>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white p-1 rounded-lg hover:bg-gray-800/50 transition-all">
          <X size={14} />
        </button>
      </div>

      <div ref={scrollRef} className="h-64 overflow-y-auto rounded-xl bg-gray-900/50 border border-gray-800/30 p-3 space-y-3 mb-3">
        {messages.length === 0 && (
          <p className="text-xs text-gray-600 text-center py-8">Send a message to test the agent</p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role !== "user" && (
              <div className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <Bot size={11} className="text-blue-400" />
              </div>
            )}
            <div className={`max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
              msg.role === "user"
                ? "bg-blue-600/20 text-blue-100 border border-blue-500/20"
                : msg.role === "system"
                ? "bg-red-500/10 text-red-400 border border-red-500/20"
                : "bg-gray-800/60 text-gray-200 border border-gray-700/30"
            }`}>
              {msg.content}
              {msg.model && (
                <span className="block text-[9px] text-gray-600 mt-1 font-mono">{msg.model}</span>
              )}
            </div>
            {msg.role === "user" && (
              <div className="w-6 h-6 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <User size={11} className="text-violet-400" />
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
              <Bot size={11} className="text-blue-400" />
            </div>
            <div className="bg-gray-800/60 border border-gray-700/30 rounded-xl px-3.5 py-2.5">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Type a message to test..."
          className="flex-1 glass-card rounded-xl px-4 py-2.5 text-sm input-glow border border-gray-700/30 bg-gray-800/30"
          disabled={isLoading}
        />
        <Button size="sm" onClick={sendMessage} disabled={!input.trim() || isLoading}>
          {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </Button>
      </div>
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

  const colors = ["text-blue-400", "text-emerald-400", "text-violet-400", "text-amber-400"];
  const bgs = ["bg-blue-500/10", "bg-emerald-500/10", "bg-violet-500/10", "bg-amber-500/10"];

  return (
    <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-800/30">
      {[
        { label: "Calls", value: data.total_calls },
        { label: "Avg Duration", value: `${data.avg_duration}s` },
        { label: "Sentiment", value: data.avg_sentiment },
        { label: "Conversion", value: `${data.conversion_rate}%` },
      ].map(({ label, value }, i) => (
        <div key={label} className="rounded-xl bg-gray-800/30 p-3 text-center">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">{label}</p>
          <p className={`text-sm font-bold ${colors[i]}`}>{value}</p>
        </div>
      ))}
    </div>
  );
}

function AgentCard({ agent, onEdit, onDelete, onClone }) {
  const [showTest, setShowTest] = useState(false);

  return (
    <div className="glass-card rounded-xl p-5 transition-all duration-200">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <Bot size={16} className="text-blue-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">{agent.name}</h3>
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
            <MessageCircle size={12} /> Test
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { if (confirm("Delete this agent?")) onDelete(agent.id); }}>
            <Trash2 size={12} />
          </Button>
        </div>
      </div>

      <p className="text-sm text-gray-400 line-clamp-2 mb-3">{agent.instructions}</p>

      <div className="flex gap-3 text-xs text-gray-500 flex-wrap mb-3">
        <span className="px-2 py-1 rounded-lg bg-gray-800/50">{agent.llm_provider || "groq"} / {agent.llm_model || "llama-3.3-70b"}</span>
        <span className="px-2 py-1 rounded-lg bg-gray-800/50">TTS: {agent.tts_provider || "cartesia"}</span>
        <span className="px-2 py-1 rounded-lg bg-gray-800/50">Lang: {agent.language || "en"}</span>
        <span className="px-2 py-1 rounded-lg bg-gray-800/50">Numbers: {(agent.phone_numbers || []).length}</span>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {agent.enable_memory && <Badge variant="outline" className="text-[10px]">Memory</Badge>}
        {agent.enable_prediction && <Badge variant="outline" className="text-[10px]">Prediction</Badge>}
        {agent.enable_emotion && <Badge variant="outline" className="text-[10px]">Emotion</Badge>}
        {agent.enable_language_switch && <Badge variant="outline" className="text-[10px]">Lang Switch</Badge>}
        {agent.enable_rag && <Badge variant="outline" className="text-[10px]">RAG</Badge>}
      </div>

      <AgentPerformance agentId={agent.id} />
      {showTest && <TestChatPanel agent={agent} onClose={() => setShowTest(false)} />}
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
            <div className="glass-card rounded-xl p-4 text-sm text-gray-300 max-h-48 overflow-auto whitespace-pre-wrap">
              {cloneResult.instructions || "Agent cloned successfully"}
            </div>
            <Button onClick={handleClose} className="w-full">Done</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5 font-medium">New Agent Name</label>
              <input value={agentName} onChange={(e) => setAgentName(e.target.value)}
                placeholder={`Clone of ${sourceAgent?.name || "Agent"}`}
                className="w-full glass-card rounded-xl px-4 py-3 input-glow border border-gray-700/30 bg-gray-800/30 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5 font-medium">Recording URLs (one per line)</label>
              <textarea value={recordings} onChange={(e) => setRecordings(e.target.value)}
                rows={4} placeholder="https://storage.example.com/call-1.mp3"
                className="w-full glass-card rounded-xl px-4 py-3 input-glow border border-gray-700/30 bg-gray-800/30 text-sm resize-none font-mono" />
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
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold gradient-text">Agents</h2>
          <p className="text-sm text-gray-500 mt-1">Configure and manage your AI voice agents</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" onClick={() => setCloneDialog({ open: true, source: null })}>
            <Copy size={14} /> Clone from Recordings
          </Button>
          <Button size="sm" onClick={() => setFormDialog({ open: true, agent: null })}>
            <Plus size={14} /> New Agent
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {agents.map((a) => (
          <AgentCard key={a.id} agent={a}
            onEdit={(agent) => setFormDialog({ open: true, agent })}
            onDelete={(id) => deleteMut.mutate(id)}
            onClone={(agent) => setCloneDialog({ open: true, source: agent })} />
        ))}
        {agents.length === 0 && (
          <div className="text-center py-16 glass-card rounded-xl">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
              <Bot size={24} className="text-blue-400" />
            </div>
            <p className="text-gray-400 mb-1">No agents configured</p>
            <p className="text-gray-600 text-sm mb-4">Using default agent. Create one to get started.</p>
            <Button size="sm" onClick={() => setFormDialog({ open: true, agent: null })}>
              <Plus size={14} /> Create Your First Agent
            </Button>
          </div>
        )}
      </div>

      <AgentFormDialog open={formDialog.open} onOpenChange={(open) => setFormDialog({ open, agent: formDialog.agent })}
        agent={formDialog.agent} onSave={handleSave} />
      <CloneDialog open={cloneDialog.open} onOpenChange={(open) => setCloneDialog({ open, source: cloneDialog.source })}
        sourceAgent={cloneDialog.source} />
    </div>
  );
}
