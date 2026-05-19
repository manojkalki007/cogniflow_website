import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  Target, Send, Mail, MessageSquare, Phone, BarChart3,
  Users, Zap, ExternalLink, ArrowRight, CheckCircle,
  Clock, AlertCircle, TrendingUp,
} from "lucide-react";
import { Badge } from "../components/ui/badge";
import PageHeader from "../components/PageHeader";

const SDR_API = import.meta.env.VITE_SDR_API_URL || "https://sdr-api.cogniflowautomations.com";

function StatCard({ label, value, icon: Icon, trend, color = "blue" }) {
  const colors = {
    blue: "bg-blue-500/10 text-blue-500",
    green: "bg-green-500/10 text-green-500",
    purple: "bg-purple-500/10 text-purple-500",
    orange: "bg-orange-500/10 text-orange-500",
  };
  return (
    <div className="rounded-xl border p-4" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</span>
        <div className={`p-1.5 rounded-lg ${colors[color]}`}>
          <Icon size={14} />
        </div>
      </div>
      <div className="text-2xl font-bold" style={{ color: "var(--text)" }}>{value}</div>
      {trend && (
        <div className="flex items-center gap-1 mt-1">
          <TrendingUp size={12} className="text-green-500" />
          <span className="text-xs text-green-500">{trend}</span>
        </div>
      )}
    </div>
  );
}

function PipelineStage({ label, count, icon: Icon, status }) {
  const statusColors = {
    active: "border-blue-500/30 bg-blue-500/5",
    waiting: "border-yellow-500/30 bg-yellow-500/5",
    done: "border-green-500/30 bg-green-500/5",
  };
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border ${statusColors[status] || ""}`}>
      <Icon size={16} style={{ color: "var(--text-muted)" }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{label}</p>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>{count} prospects</p>
      </div>
    </div>
  );
}

export default function AiSdr() {
  const [activeTab, setActiveTab] = useState("overview");

  const { data: agents } = useQuery({
    queryKey: ["sdr-agents"],
    queryFn: async () => {
      try {
        const res = await fetch(`${SDR_API}/api/agents/overview`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        if (!res.ok) return null;
        return res.json();
      } catch {
        return null;
      }
    },
    staleTime: 30_000,
  });

  const { data: voiceAgents } = useQuery({
    queryKey: ["cogniflow-agents-sdr"],
    queryFn: () => api.getAgents(),
    staleTime: 60_000,
  });

  const stats = agents?.stats || {};
  const pipeline = agents?.pipeline || {};
  const agentList = agents?.agents || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI SDR"
        subtitle="Multi-agent sales development — research, personalize, and send across email, WhatsApp, LinkedIn, and voice"
      />

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Active Workflows" value={stats.activeWorkflows || 0} icon={Zap} color="blue" />
        <StatCard label="Emails Sent" value={stats.emailsSent || 0} icon={Send} color="green" trend={stats.emailsTrend} />
        <StatCard label="Replies" value={stats.repliesReceived || 0} icon={Mail} color="purple" />
        <StatCard label="Meetings Booked" value={stats.meetingsBooked || 0} icon={CheckCircle} color="orange" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-lg" style={{ background: "var(--bg-muted)" }}>
        {["overview", "agents", "voice"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab ? "bg-white shadow-sm dark:bg-zinc-800" : ""
            }`}
            style={{ color: activeTab === tab ? "var(--text)" : "var(--text-muted)" }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Pipeline Stages */}
          <div className="rounded-xl border p-4 space-y-3" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
            <h3 className="text-sm font-semibold" style={{ color: "var(--text)" }}>Pipeline Stages</h3>
            <PipelineStage label="Researching" count={pipeline.researching || 0} icon={Users} status="active" />
            <PipelineStage label="Scoring" count={pipeline.scoring || 0} icon={Target} status="active" />
            <PipelineStage label="Writing" count={pipeline.writing || 0} icon={Mail} status="active" />
            <PipelineStage label="In Review" count={pipeline.inReview || 0} icon={Clock} status="waiting" />
            <PipelineStage label="Sending" count={pipeline.sending || 0} icon={Send} status="active" />
            <PipelineStage label="Sent" count={pipeline.sent || 0} icon={CheckCircle} status="done" />
          </div>

          {/* Quick Actions */}
          <div className="rounded-xl border p-4 space-y-3" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
            <h3 className="text-sm font-semibold" style={{ color: "var(--text)" }}>Quick Actions</h3>

            <a
              href={`${SDR_API.replace('/api', '').replace('sdr-api', 'sdr')}/campaigns/new`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-lg border transition-colors hover:bg-blue-500/5"
              style={{ borderColor: "var(--border)" }}
            >
              <Megaphone size={16} className="text-blue-500" />
              <div className="flex-1">
                <p className="text-sm font-medium" style={{ color: "var(--text)" }}>Create Campaign</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Set up a new outreach sequence</p>
              </div>
              <ExternalLink size={14} style={{ color: "var(--text-muted)" }} />
            </a>

            <a
              href={`${SDR_API.replace('/api', '').replace('sdr-api', 'sdr')}/prospects`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-lg border transition-colors hover:bg-green-500/5"
              style={{ borderColor: "var(--border)" }}
            >
              <Users size={16} className="text-green-500" />
              <div className="flex-1">
                <p className="text-sm font-medium" style={{ color: "var(--text)" }}>Import Prospects</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Upload CSV or add manually</p>
              </div>
              <ExternalLink size={14} style={{ color: "var(--text-muted)" }} />
            </a>

            <a
              href={`${SDR_API.replace('/api', '').replace('sdr-api', 'sdr')}/inbox`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-lg border transition-colors hover:bg-purple-500/5"
              style={{ borderColor: "var(--border)" }}
            >
              <MessageSquare size={16} className="text-purple-500" />
              <div className="flex-1">
                <p className="text-sm font-medium" style={{ color: "var(--text)" }}>Reply Inbox</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>View and handle prospect replies</p>
              </div>
              <ExternalLink size={14} style={{ color: "var(--text-muted)" }} />
            </a>
          </div>
        </div>
      )}

      {activeTab === "agents" && (
        <div className="grid md:grid-cols-3 gap-4">
          {(agentList.length > 0 ? agentList : [
            { name: "Researcher", description: "Enrichment + web intel + RAG", status: "ready" },
            { name: "Scorer", description: "ICP fit + signal scoring", status: "ready" },
            { name: "Writer", description: "Personalized email generation", status: "ready" },
            { name: "Reviewer", description: "7-gate quality control", status: "ready" },
            { name: "Sender", description: "Multi-channel dispatch", status: "ready" },
            { name: "Classifier", description: "Reply intent classification", status: "ready" },
            { name: "Objection Handler", description: "RAG-powered rebuttals", status: "ready" },
            { name: "Meeting Booker", description: "Calendar link + scheduling", status: "ready" },
            { name: "Voice Agent", description: "AI-powered sales calls", status: "ready" },
          ]).map((agent, i) => (
            <div
              key={i}
              className="rounded-xl border p-4"
              style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold" style={{ color: "var(--text)" }}>{agent.name}</h4>
                <Badge variant={agent.status === "ready" || agent.status === "active" ? "default" : "secondary"}>
                  {agent.status || "ready"}
                </Badge>
              </div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {agent.description || ""}
              </p>
              {agent.completedToday != null && (
                <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
                  {agent.completedToday} completed today
                  {agent.successRate != null && ` · ${agent.successRate}% success`}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {activeTab === "voice" && (
        <div className="space-y-4">
          <div className="rounded-xl border p-4" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text)" }}>
              Cogniflow Voice Agents for SDR
            </h3>
            <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
              These Cogniflow voice agents can be used for AI SDR outbound calls.
              Configure a campaign with the "voice" channel to use them.
            </p>

            {(voiceAgents || []).length === 0 ? (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                No voice agents configured. Create one in the Agents page.
              </p>
            ) : (
              <div className="space-y-2">
                {(voiceAgents || []).map((agent) => (
                  <div
                    key={agent.id}
                    className="flex items-center gap-3 p-3 rounded-lg border"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <Phone size={16} className="text-blue-500" />
                    <div className="flex-1">
                      <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{agent.name}</p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {agent.language || "en"} · {agent.tts_provider || "default"} · ID: {agent.id}
                      </p>
                    </div>
                    <Badge variant={agent.status === "active" ? "default" : "secondary"}>
                      {agent.status || "active"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border p-4" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
            <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--text)" }}>Integration Setup</h3>
            <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
              To use Cogniflow voice for AI SDR campaigns, add these keys to your AI SDR org settings:
            </p>
            <div className="space-y-2 text-xs font-mono p-3 rounded-lg" style={{ background: "var(--bg-muted)", color: "var(--text)" }}>
              <p>COGNIFLOW_API_URL = {window.location.origin.replace("cogniflowautomations.com", "api.cogniflowautomations.com")}</p>
              <p>cogniflow = &lt;your API key from Settings &gt; API Keys&gt;</p>
              <p>cogniflow_agent_id = &lt;agent ID from above&gt;</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Megaphone(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 16} height={props.size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
      <path d="m3 11 18-5v12L3 13v-2z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </svg>
  );
}
