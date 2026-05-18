import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  PhoneIncoming, PhoneOutgoing, Clock, ChevronDown, ChevronUp,
  Search, MessageSquare, BarChart3, Phone, ArrowUpRight,
  TrendingUp, Activity, Play, Pause, DollarSign, Zap,
} from "lucide-react";
import { Badge } from "../components/ui/badge";
import PageHeader from "../components/PageHeader";

const DISPOSITION_VARIANT = {
  interested: "success",
  not_interested: "destructive",
  callback_requested: "warning",
  escalated: "warning",
  no_answer: "secondary",
  voicemail: "secondary",
};

const SENTIMENT_BADGE = (score) => {
  if (score == null) return null;
  if (score > 0.3) return { label: "Positive", variant: "success" };
  if (score < -0.3) return { label: "Negative", variant: "destructive" };
  return { label: "Neutral", variant: "secondary" };
};

// Per-minute cost rates
const COST_RATES = {
  stt: 0.0043,
  llm: 0.0012,
  tts: 0.015,
  telephony: 0.008,
};
const COST_PER_MIN = COST_RATES.stt + COST_RATES.llm + COST_RATES.tts + COST_RATES.telephony;

function estimateCallCost(durationSeconds, costData) {
  if (costData?.total != null) return costData;
  const minutes = (durationSeconds || 0) / 60;
  return {
    total: +(minutes * COST_PER_MIN).toFixed(4),
    stt: +(minutes * COST_RATES.stt).toFixed(4),
    llm: +(minutes * COST_RATES.llm).toFixed(4),
    tts: +(minutes * COST_RATES.tts).toFixed(4),
    telephony: +(minutes * COST_RATES.telephony).toFixed(4),
    estimated: !costData?.total,
  };
}

function CostBadge({ call }) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const cost = estimateCallCost(
    call.duration_seconds,
    call.cost_breakdown || (call.cost != null ? { total: call.cost } : null)
  );

  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setShowBreakdown(!showBreakdown); }}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-medium transition-all cursor-pointer"
        style={{
          background: "rgba(16,185,129,0.08)",
          color: "var(--success)",
          border: "1px solid rgba(16,185,129,0.15)",
        }}
        title="Click for cost breakdown"
      >
        <DollarSign size={9} />
        {cost.total < 0.01 ? cost.total.toFixed(4) : cost.total.toFixed(2)}
        {cost.estimated && <span className="opacity-60">~</span>}
      </button>
      {showBreakdown && (
        <div
          className="absolute z-50 top-full mt-1 right-0 p-3 rounded-xl text-xs min-w-[180px] animate-fade-in"
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-elevated)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
            Cost Breakdown {cost.estimated && "(estimated)"}
          </p>
          {[
            { label: "STT", value: cost.stt, rate: "$0.0043/min" },
            { label: "LLM", value: cost.llm, rate: "$0.0012/min" },
            { label: "TTS", value: cost.tts, rate: "$0.015/min" },
            { label: "Telephony", value: cost.telephony, rate: "$0.008/min" },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between py-1" style={{ borderBottom: "1px solid var(--border)" }}>
              <span style={{ color: "var(--text-secondary)" }}>{item.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>{item.rate}</span>
                <span className="font-mono font-medium" style={{ color: "var(--text-primary)" }}>${item.value?.toFixed(4)}</span>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between pt-2 mt-1 font-semibold">
            <span style={{ color: "var(--text-primary)" }}>Total</span>
            <span className="font-mono" style={{ color: "var(--success)" }}>${cost.total?.toFixed(4)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function AudioPlayer({ url }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef(null);
  const progressInterval = useRef(null);

  useEffect(() => {
    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const togglePlay = (e) => {
    e.stopPropagation();
    if (!audioRef.current) {
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.addEventListener("loadedmetadata", () => setDuration(audio.duration));
      audio.addEventListener("ended", () => {
        setPlaying(false);
        setProgress(0);
        setCurrentTime(0);
        if (progressInterval.current) clearInterval(progressInterval.current);
      });
    }

    if (playing) {
      audioRef.current.pause();
      if (progressInterval.current) clearInterval(progressInterval.current);
    } else {
      audioRef.current.play();
      progressInterval.current = setInterval(() => {
        if (audioRef.current) {
          const pct = (audioRef.current.currentTime / audioRef.current.duration) * 100;
          setProgress(pct);
          setCurrentTime(audioRef.current.currentTime);
        }
      }, 200);
    }
    setPlaying(!playing);
  };

  const seek = (e) => {
    e.stopPropagation();
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioRef.current.currentTime = pct * duration;
    setProgress(pct * 100);
    setCurrentTime(pct * duration);
  };

  const formatTime = (s) => {
    if (!s || isNaN(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
      style={{ background: "var(--bg-muted)", border: "1px solid var(--border)" }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={togglePlay}
        className="w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer"
        style={{
          background: playing ? "var(--accent)" : "var(--accent-subtle)",
          color: playing ? "white" : "var(--accent)",
        }}
      >
        {playing ? <Pause size={10} /> : <Play size={10} style={{ marginLeft: 1 }} />}
      </button>
      <div
        className="w-20 h-1.5 rounded-full cursor-pointer relative"
        style={{ background: "var(--border)" }}
        onClick={seek}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${progress}%`, background: "var(--accent)" }}
        />
      </div>
      <span className="text-[9px] font-mono tabular-nums" style={{ color: "var(--text-muted)", minWidth: "32px" }}>
        {formatTime(currentTime)}
      </span>
    </div>
  );
}

function LatencyWaterfall({ call }) {
  const turns = call.turns || call.latency_data?.turns;
  if (!turns || turns.length === 0) return null;

  const segColor = (ms, good, ok) =>
    ms < good ? "bg-emerald-500/60" : ms < ok ? "bg-amber-500/60" : "bg-red-500/60";

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.1)" }}
        >
          <Zap size={13} style={{ color: "#F59E0B" }} />
        </div>
        <h4 className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
          Latency Waterfall
        </h4>
      </div>
      <div className="space-y-2">
        {turns.map((turn, i) => {
          const total = (turn.eot_ms || 0) + (turn.llm_ms || 0) + (turn.tts_ms || 0) || 1;
          const totalMs = turn.total_ms || total;
          const totalLabel = totalMs < 600
            ? "text-emerald-400"
            : totalMs < 1000
              ? "text-amber-400"
              : "text-red-400";
          const wrapStyles = totalMs < 600
            ? "bg-emerald-500/5 border-emerald-500/15"
            : totalMs < 1000
              ? "bg-amber-500/5 border-amber-500/15"
              : "bg-red-500/5 border-red-500/15";

          return (
            <div key={i} className={`rounded-lg border px-3 py-2 ${wrapStyles}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[9px] font-medium" style={{ color: "var(--text-muted)" }}>
                  Turn {turn.turn ?? i + 1}
                </span>
                <span className={`text-[10px] font-bold tracking-wider ${totalLabel}`}>
                  {totalMs}ms
                </span>
              </div>
              <div className="flex h-1.5 rounded-full overflow-hidden mb-1.5" style={{ background: "var(--bg-muted)" }}>
                <div className={`${segColor(turn.eot_ms || 0, 80, 150)} transition-all`} style={{ width: `${((turn.eot_ms || 0) / total) * 100}%` }} />
                <div className={`${segColor(turn.llm_ms || 0, 300, 500)} transition-all`} style={{ width: `${((turn.llm_ms || 0) / total) * 100}%` }} />
                <div className={`${segColor(turn.tts_ms || 0, 300, 500)} transition-all`} style={{ width: `${((turn.tts_ms || 0) / total) * 100}%` }} />
              </div>
              <div className="flex gap-3 text-[9px]" style={{ color: "var(--text-muted)" }}>
                <span>EOT <span className="font-mono" style={{ color: "var(--text-secondary)" }}>{turn.eot_ms || 0}ms</span></span>
                <span>LLM <span className="font-mono" style={{ color: "var(--text-secondary)" }}>{turn.llm_ms || 0}ms</span></span>
                <span>TTS <span className="font-mono" style={{ color: "var(--text-secondary)" }}>{turn.tts_ms || 0}ms</span></span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AnimatedNumber({ value, suffix = "" }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    const target = typeof value === "number" ? value : parseInt(value) || 0;
    if (target === 0) { setDisplay(0); return; }

    let start = 0;
    const duration = 800;
    const startTime = performance.now();

    function tick(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      start = Math.round(eased * target);
      setDisplay(start);
      if (progress < 1) ref.current = requestAnimationFrame(tick);
    }
    ref.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(ref.current);
  }, [value]);

  return <>{display}{suffix}</>;
}

function StatCard({ label, value, icon: Icon, accent, trend, className = "" }) {
  return (
    <div className={`stat-card ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <span
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-muted)" }}
        >
          {label}
        </span>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{
            background: `${accent}10`,
            border: `1px solid ${accent}15`,
          }}
        >
          <Icon size={17} style={{ color: accent }} />
        </div>
      </div>
      <div className="flex items-end justify-between">
        <div
          className="text-[1.85rem] font-bold tracking-tight leading-none"
          style={{ color: "var(--text-primary)", animation: "countUp 0.5s ease-out" }}
        >
          {typeof value === "number" ? (
            <AnimatedNumber value={value} />
          ) : typeof value === "string" && value.endsWith("s") ? (
            <AnimatedNumber value={parseInt(value)} suffix="s" />
          ) : (
            value ?? <span className="text-sm font-normal" style={{ color: "var(--text-muted)" }}>—</span>
          )}
        </div>
        {trend && (
          <div
            className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg"
            style={{
              color: trend > 0 ? "var(--success)" : "var(--danger)",
              background: trend > 0 ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
            }}
          >
            <TrendingUp size={11} style={{ transform: trend < 0 ? "scaleY(-1)" : undefined }} />
            {Math.abs(trend)}%
          </div>
        )}
      </div>
    </div>
  );
}

function TranscriptView({ transcript }) {
  if (!transcript || transcript.length === 0) {
    return (
      <p className="text-sm py-4 text-center" style={{ color: "var(--text-muted)" }}>
        No transcript available
      </p>
    );
  }
  return (
    <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
      {transcript.map((t, i) => (
        <div key={i} className="flex gap-3 text-sm">
          <span
            className={`text-[10px] font-semibold uppercase w-12 shrink-0 px-1.5 py-0.5 rounded-md text-center leading-relaxed ${
              t.role === "agent"
                ? "bg-[var(--accent-subtle)] text-[var(--accent-text)]"
                : "bg-[var(--bg-muted)] text-[var(--text-muted)]"
            }`}
          >
            {t.role}
          </span>
          <span style={{ color: "var(--text-secondary)" }}>{t.text}</span>
        </div>
      ))}
    </div>
  );
}

function formatDuration(seconds) {
  if (!seconds) return "0s";
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
  const dispositions = [
    ...new Set(allCalls.map((c) => c.disposition).filter(Boolean)),
  ];

  return (
    <div>
      <PageHeader
        title="Call Log"
        description="Monitor and review all call activity"
        icon={Activity}
      />

      <div className="px-6 lg:px-8 py-6">
        {/* Bento Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Today's Calls"
            value={today.total_calls ?? 0}
            icon={BarChart3}
            accent="var(--accent)"
            trend={12}
            className="stat-card-blue"
          />
          <StatCard
            label="Inbound"
            value={today.inbound ?? 0}
            icon={PhoneIncoming}
            accent="var(--success)"
            trend={8}
            className="stat-card-emerald"
          />
          <StatCard
            label="Outbound"
            value={today.outbound ?? 0}
            icon={PhoneOutgoing}
            accent="#8B5CF6"
            trend={-3}
            className="stat-card-violet"
          />
          <StatCard
            label="Avg Duration"
            value={
              today.avg_duration_seconds
                ? `${today.avg_duration_seconds}s`
                : "0s"
            }
            icon={Clock}
            accent="var(--warning)"
            className="stat-card-amber"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search
              size={14}
              className="absolute left-3.5 top-1/2 -translate-y-1/2"
              style={{ color: "var(--text-muted)" }}
            />
            <input
              type="text"
              placeholder="Search by caller, agent, or summary..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="glass-input w-full pl-10 pr-4 py-2.5 rounded-xl text-sm"
            />
          </div>
          <select
            value={dirFilter}
            onChange={(e) => setDirFilter(e.target.value)}
            className="glass-input rounded-xl px-4 py-2.5 text-sm cursor-pointer"
          >
            <option value="">All directions</option>
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
          </select>
          {dispositions.length > 0 && (
            <select
              value={dispositionFilter}
              onChange={(e) => setDispositionFilter(e.target.value)}
              className="glass-input rounded-xl px-4 py-2.5 text-sm cursor-pointer"
            >
              <option value="">All dispositions</option>
              {dispositions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Table */}
        <div
          className="glass-card rounded-2xl overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 44 }}></th>
                  <th>Caller</th>
                  <th>Agent</th>
                  <th>Duration</th>
                  <th>Cost</th>
                  <th>Disposition</th>
                  <th>Sentiment</th>
                  <th>Summary</th>
                  <th>Date</th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {calls.map((call) => {
                  const sentiment = SENTIMENT_BADGE(call.sentiment_score);
                  const isExpanded = expandedId === call.id;
                  return (
                    <tr key={call.id}>
                      <td>
                        {call.direction === "inbound" ? (
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center"
                            style={{
                              background: "rgba(16,185,129,0.08)",
                              border: "1px solid rgba(16,185,129,0.1)",
                            }}
                          >
                            <PhoneIncoming
                              size={13}
                              style={{ color: "var(--success)" }}
                            />
                          </div>
                        ) : (
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center"
                            style={{
                              background: "var(--accent-subtle)",
                              border: "1px solid rgba(34,211,238,0.1)",
                            }}
                          >
                            <PhoneOutgoing
                              size={13}
                              style={{ color: "var(--accent)" }}
                            />
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="font-mono text-xs">
                          {call.caller_number || "N/A"}
                        </span>
                      </td>
                      <td>
                        <span className="text-xs">
                          {call.agent_name || "Default"}
                        </span>
                      </td>
                      <td>
                        <span className="flex items-center gap-1.5 text-xs">
                          <Clock size={10} />
                          {formatDuration(call.duration_seconds)}
                        </span>
                        {call.recording_url && (
                          <div className="mt-1.5">
                            <AudioPlayer url={call.recording_url} />
                          </div>
                        )}
                      </td>
                      <td>
                        <CostBadge call={call} />
                      </td>
                      <td>
                        {call.disposition ? (
                          <Badge
                            variant={
                              DISPOSITION_VARIANT[call.disposition] || "outline"
                            }
                            className="text-[10px]"
                          >
                            {call.disposition}
                          </Badge>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>—</span>
                        )}
                      </td>
                      <td>
                        {sentiment ? (
                          <Badge
                            variant={sentiment.variant}
                            className="text-[10px]"
                          >
                            {sentiment.label}
                          </Badge>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>—</span>
                        )}
                      </td>
                      <td className="max-w-[200px]">
                        <span className="text-xs truncate block">
                          {call.summary || "—"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap text-xs">
                        {call.created_at
                          ? new Date(call.created_at).toLocaleDateString()
                          : call.started_at
                            ? new Date(call.started_at).toLocaleDateString()
                            : "—"}
                      </td>
                      <td>
                        <button
                          onClick={() =>
                            setExpandedId(isExpanded ? null : call.id)
                          }
                          className="p-1.5 rounded-lg transition-all cursor-pointer"
                          style={{ color: "var(--text-muted)" }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background =
                              "var(--bg-muted)")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background = "transparent")
                          }
                        >
                          {isExpanded ? (
                            <ChevronUp size={14} />
                          ) : (
                            <ChevronDown size={14} />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {/* Empty State */}
                {calls.length === 0 && (
                  <tr>
                    <td colSpan={10} style={{ border: "none" }}>
                      <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <div
                          className="w-14 h-14 rounded-2xl flex items-center justify-center"
                          style={{
                            background: "var(--accent-subtle)",
                            border: "1px solid rgba(34,211,238,0.1)",
                          }}
                        >
                          <Phone
                            size={22}
                            style={{ color: "var(--accent)" }}
                          />
                        </div>
                        <p
                          className="font-semibold text-sm"
                          style={{ color: "var(--text-primary)" }}
                        >
                          No calls yet
                        </p>
                        <p
                          className="text-xs max-w-xs text-center"
                          style={{ color: "var(--text-muted)" }}
                        >
                          Calls will appear here once your agent starts
                          receiving or making them
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Expanded Call Detail */}
        {expandedId && (() => {
          const expandedCall = calls.find((c) => c.id === expandedId);
          return (
            <div className="mt-3 glass-card rounded-2xl p-5 animate-fade-in">
              {/* Call detail header with cost summary */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{
                      background: "rgba(139,92,246,0.08)",
                      border: "1px solid rgba(139,92,246,0.1)",
                    }}
                  >
                    <MessageSquare size={14} style={{ color: "#8B5CF6" }} />
                  </div>
                  <h3
                    className="text-sm font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Call Detail
                  </h3>
                </div>
                {expandedCall?.recording_url && (
                  <AudioPlayer url={expandedCall.recording_url} />
                )}
              </div>

              {/* Transcript */}
              <TranscriptView transcript={expandedCall?.transcript} />

              {/* Latency Waterfall */}
              <LatencyWaterfall call={expandedCall || {}} />

              {/* Cost Detail in expanded view */}
              {expandedCall?.duration_seconds > 0 && (
                <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.1)" }}
                    >
                      <DollarSign size={13} style={{ color: "var(--success)" }} />
                    </div>
                    <h4 className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                      Cost Summary
                    </h4>
                  </div>
                  {(() => {
                    const cost = estimateCallCost(
                      expandedCall.duration_seconds,
                      expandedCall.cost_breakdown || (expandedCall.cost != null ? { total: expandedCall.cost } : null)
                    );
                    return (
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {[
                          { label: "STT", value: cost.stt },
                          { label: "LLM", value: cost.llm },
                          { label: "TTS", value: cost.tts },
                          { label: "Telephony", value: cost.telephony },
                          { label: "Total", value: cost.total, highlight: true },
                        ].map((item) => (
                          <div
                            key={item.label}
                            className="rounded-lg px-3 py-2 text-center"
                            style={{
                              background: item.highlight ? "rgba(16,185,129,0.08)" : "var(--bg-muted)",
                              border: item.highlight ? "1px solid rgba(16,185,129,0.15)" : "1px solid var(--border)",
                            }}
                          >
                            <p className="text-[9px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>{item.label}</p>
                            <p className="text-xs font-mono font-bold mt-0.5" style={{ color: item.highlight ? "var(--success)" : "var(--text-primary)" }}>
                              ${item.value?.toFixed(4)}
                            </p>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  {!expandedCall.cost && !expandedCall.cost_breakdown && (
                    <p className="text-[10px] mt-2" style={{ color: "var(--text-muted)" }}>
                      * Estimated based on duration at standard rates
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* Footer count */}
        <div className="flex items-center justify-between mt-4">
          <p
            className="text-xs font-mono"
            style={{ color: "var(--text-muted)" }}
          >
            {calls.length} of {allCalls.length} calls
          </p>
          {allCalls.length > calls.length && (
            <button
              onClick={() => {
                setSearchQuery("");
                setDirFilter("");
                setDispositionFilter("");
              }}
              className="text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors"
              style={{ color: "var(--accent)" }}
            >
              Clear filters <ArrowUpRight size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
