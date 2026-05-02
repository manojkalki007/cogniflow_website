import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  PhoneIncoming, PhoneOutgoing, Clock, ChevronDown, ChevronUp,
  Search, User, MessageSquare, BarChart3, Activity,
} from "lucide-react";
import { Badge } from "../components/ui/badge";

const DISPOSITION_VARIANT = {
  interested: "success", not_interested: "destructive", callback_requested: "warning",
  escalated: "warning", no_answer: "secondary", voicemail: "secondary",
};

const SENTIMENT_BADGE = (score) => {
  if (score == null) return null;
  if (score > 0.3) return { label: "Positive", variant: "success" };
  if (score < -0.3) return { label: "Negative", variant: "destructive" };
  return { label: "Neutral", variant: "secondary" };
};

function StatCard({ label, value, icon: Icon, idx = 0 }) {
  const colors = ["text-blue-400", "text-emerald-400", "text-violet-400", "text-amber-400"];
  const bgs = ["bg-blue-500/10", "bg-emerald-500/10", "bg-violet-500/10", "bg-amber-500/10"];
  return (
    <div className="glass-card stat-card rounded-xl p-4">
      <div className="flex items-center gap-2.5 mb-2">
        <div className={`w-7 h-7 rounded-lg ${bgs[idx]} flex items-center justify-center`}>
          <Icon size={14} className={colors[idx]} />
        </div>
        <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">{label}</p>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function TranscriptView({ transcript }) {
  if (!transcript || transcript.length === 0) return <p className="text-gray-500 text-sm">No transcript available</p>;
  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {transcript.map((t, i) => (
        <div key={i} className={`text-sm flex gap-3 ${t.role === "agent" ? "text-blue-300" : "text-gray-300"}`}>
          <span className={`font-medium text-xs uppercase w-12 shrink-0 px-1.5 py-0.5 rounded text-center ${t.role === "agent" ? "bg-blue-500/10 text-blue-400" : "bg-gray-700/50 text-gray-400"}`}>
            {t.role}
          </span>
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}

function formatDuration(seconds) {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function CallLog() {
  const [expandedId, setExpandedId] = useState(null);
  const [dirFilter, setDirFilter] = useState("");
  const [dispositionFilter, setDispositionFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: api.getStats,
    refetchInterval: 15_000,
  });

  const { data: callsData } = useQuery({
    queryKey: ["calls", dirFilter],
    queryFn: () => api.getCalls(dirFilter ? { direction: dirFilter } : {}),
    refetchInterval: 10_000,
  });

  const allCalls = callsData?.calls || [];

  const calls = allCalls.filter((c) => {
    if (dispositionFilter && c.disposition !== dispositionFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (c.caller_number || "").includes(q) ||
      (c.summary || "").toLowerCase().includes(q) ||
      (c.agent_name || "").toLowerCase().includes(q)
    );
  });

  const today = stats?.today || {};
  const dispositions = [...new Set(allCalls.map(c => c.disposition).filter(Boolean))];

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold gradient-text">Call Log</h2>
        <p className="text-sm text-gray-500 mt-1">Monitor and review all call activity</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Today's Calls" value={today.total_calls ?? "—"} icon={BarChart3} idx={0} />
        <StatCard label="Inbound" value={today.inbound ?? "—"} icon={PhoneIncoming} idx={1} />
        <StatCard label="Outbound" value={today.outbound ?? "—"} icon={PhoneOutgoing} idx={2} />
        <StatCard label="Avg Duration" value={today.avg_duration_seconds ? `${today.avg_duration_seconds}s` : "—"} icon={Clock} idx={3} />
      </div>

      <div className="flex gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-2.5 text-gray-500" />
          <input type="text" placeholder="Search by caller, agent, or summary..."
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full glass-card rounded-xl pl-10 pr-4 py-2.5 text-sm input-glow border border-gray-700/30 bg-gray-900/50" />
        </div>
        <select value={dirFilter} onChange={(e) => setDirFilter(e.target.value)}
          className="glass-card rounded-xl px-4 py-2.5 text-sm border border-gray-700/30 bg-gray-900/50">
          <option value="">All directions</option>
          <option value="inbound">Inbound</option>
          <option value="outbound">Outbound</option>
        </select>
        {dispositions.length > 0 && (
          <select value={dispositionFilter} onChange={(e) => setDispositionFilter(e.target.value)}
            className="glass-card rounded-xl px-4 py-2.5 text-sm border border-gray-700/30 bg-gray-900/50">
            <option value="">All dispositions</option>
            {dispositions.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800/50 text-gray-500 text-xs uppercase tracking-wider">
              <th className="text-left p-4 w-10"></th>
              <th className="text-left p-4">Caller</th>
              <th className="text-left p-4">Agent</th>
              <th className="text-left p-4">Duration</th>
              <th className="text-left p-4">Disposition</th>
              <th className="text-left p-4">Sentiment</th>
              <th className="text-left p-4">Summary</th>
              <th className="text-left p-4">Date</th>
              <th className="p-4 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {calls.map((call) => {
              const sentiment = SENTIMENT_BADGE(call.sentiment_score);
              const isExpanded = expandedId === call.id;
              return (
                <tr key={call.id} className="border-b border-gray-800/30 table-row-hover group">
                  <td className="p-4">
                    {call.direction === "inbound" ? (
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                        <PhoneIncoming size={13} className="text-emerald-400" />
                      </div>
                    ) : (
                      <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <PhoneOutgoing size={13} className="text-blue-400" />
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    <span className="font-mono text-xs text-gray-300">{call.caller_number || "—"}</span>
                  </td>
                  <td className="p-4 text-gray-400 text-xs">{call.agent_name || "Default"}</td>
                  <td className="p-4">
                    <span className="flex items-center gap-1.5 text-gray-400">
                      <Clock size={10} />
                      {formatDuration(call.duration_seconds)}
                    </span>
                  </td>
                  <td className="p-4">
                    {call.disposition ? (
                      <Badge variant={DISPOSITION_VARIANT[call.disposition] || "outline"} className="text-[10px]">
                        {call.disposition}
                      </Badge>
                    ) : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="p-4">
                    {sentiment ? (
                      <Badge variant={sentiment.variant} className="text-[10px]">{sentiment.label}</Badge>
                    ) : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="p-4 text-gray-400 max-w-xs truncate text-xs">{call.summary || "—"}</td>
                  <td className="p-4 text-gray-500 text-xs whitespace-nowrap">
                    {call.created_at ? new Date(call.created_at).toLocaleString() : call.started_at ? new Date(call.started_at).toLocaleString() : "—"}
                  </td>
                  <td className="p-4">
                    <button onClick={() => setExpandedId(isExpanded ? null : call.id)}
                      className="text-gray-500 hover:text-white p-1 rounded-lg hover:bg-gray-800/50 transition-all">
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </td>
                </tr>
              );
            })}
            {calls.length === 0 && (
              <tr>
                <td colSpan={9} className="p-12 text-center text-gray-600">No calls match your filters</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {expandedId && (
        <div className="mt-3 glass-card rounded-xl p-5 animate-fade-in">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <MessageSquare size={13} className="text-violet-400" />
            </div>
            <h3 className="text-sm font-medium">Transcript</h3>
          </div>
          <TranscriptView transcript={calls.find(c => c.id === expandedId)?.transcript} />
        </div>
      )}

      <p className="text-xs text-gray-600 mt-4 text-right font-mono">
        Showing {calls.length} of {allCalls.length} calls
      </p>
    </div>
  );
}
