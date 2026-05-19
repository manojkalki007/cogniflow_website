import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  Plus, Bot, Copy, Upload, Loader2, Trash2,
  BarChart3, Sliders, Wrench, Shield, Brain,
  Phone, PhoneOff, PhoneCall, X,
} from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "../components/ui/dialog";
import PageHeader from "../components/PageHeader";
import TestCallPanel from "../components/TestCallPanel";

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

function AgentCard({ agent, onDelete, onClone }) {
  const [showTest, setShowTest] = useState(false);
  const navigate = useNavigate();

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
          <Button variant="ghost" size="sm" onClick={() => navigate(`/home/agents/${agent.id}`)}>Edit</Button>
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
    const payload = {
      name: agentName || `Clone of ${sourceAgent?.name || "Agent"}`,
      recording_urls: recordings.split("\n").map(u => u.trim()).filter(Boolean),
    };
    if (sourceAgent?.id) {
      payload.source_agent_id = sourceAgent.id;
    }
    cloneMut.mutate(payload);
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
  const navigate = useNavigate();
  const [cloneDialog, setCloneDialog] = useState({ open: false, source: null });

  const { data } = useQuery({ queryKey: ["agents"], queryFn: api.getAgents });
  const agents = data?.agents || [];

  const deleteMut = useMutation({
    mutationFn: (id) => api.deleteAgent(id),
    onSuccess: () => queryClient.invalidateQueries(["agents"]),
  });

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
            <Button size="sm" onClick={() => navigate("/home/agents/new")}>
              <Plus size={14} /> New Agent
            </Button>
          </div>
        }
      />

      <div className="px-4 sm:px-6 lg:px-8 py-6">
        <div className="space-y-4">
          {agents.map((a) => (
            <AgentCard key={a.id} agent={a}
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
              <Button size="sm" onClick={() => navigate("/home/agents/new")}>
                <Plus size={14} /> Create Your First Agent
              </Button>
            </div>
          )}
        </div>
      </div>

      <CloneDialog open={cloneDialog.open} onOpenChange={(open) => setCloneDialog({ open, source: cloneDialog.source })}
        sourceAgent={cloneDialog.source} />
    </div>
  );
}
