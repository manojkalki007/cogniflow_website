import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  Activity, Zap, Brain, Mic, Shield, BarChart3, Loader2,
  CheckCircle2, AlertTriangle, XCircle, Play, UserCheck,
  TrendingDown, TrendingUp,
} from "lucide-react";
import { Button } from "../components/ui/button";

const PILLAR_CONFIG = {
  orchestration: { label: "Orchestration", icon: Activity, color: "blue", weight: "30%" },
  voice: { label: "Voice Quality", icon: Mic, color: "violet", weight: "20%" },
  intelligence: { label: "Intelligence", icon: Brain, color: "emerald", weight: "25%" },
  behaviour: { label: "Behaviour", icon: UserCheck, color: "amber", weight: "25%" },
};

const METRIC_LABELS = {
  turn_gap_p50_ms: "Turn Gap P50",
  turn_gap_p95_ms: "Turn Gap P95",
  false_endpoint_rate: "False Endpoint Rate",
  barge_in_audio_stop_ms: "Barge-In Audio Stop",
  barge_in_recovery_ms: "Barge-In Recovery",
  tts_ttfb_ms: "TTS Time-to-First-Byte",
  emotion_score: "Emotion Expressiveness",
  task_success_rate: "Task Success Rate",
  prompt_injection_resist: "Prompt Injection Resist",
  edge_case_handling: "Edge Case Handling",
  persona_consistency: "Persona Consistency",
  conversational_discipline: "Conversational Discipline",
  pacing_quality: "Pacing & Flow",
  boundary_compliance: "Boundary Compliance",
  adaptation_score: "Adaptive Behaviour",
};

function GradeIcon({ grade }) {
  if (grade === "pass") return <CheckCircle2 size={14} className="text-emerald-400" />;
  if (grade === "warn") return <AlertTriangle size={14} className="text-amber-400" />;
  return <XCircle size={14} className="text-red-400" />;
}

function GradeBadge({ grade }) {
  const styles = {
    A: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    B: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    C: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    D: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    F: "bg-red-500/15 text-red-400 border-red-500/30",
  };
  return (
    <span className={`text-3xl font-bold px-5 py-2 rounded-2xl border ${styles[grade] || styles.F}`}>
      {grade}
    </span>
  );
}

function MetricRow({ name, value, target, grade, unit = "" }) {
  const label = METRIC_LABELS[name] || name;
  const lowerMetrics = ["turn_gap_p50_ms", "turn_gap_p95_ms", "false_endpoint_rate", "barge_in_audio_stop_ms", "barge_in_recovery_ms", "tts_ttfb_ms"];
  const isLower = lowerMetrics.includes(name);
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-800/20 last:border-0">
      <div className="flex items-center gap-2">
        <GradeIcon grade={grade} />
        <span className="text-sm text-gray-300">{label}</span>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm font-mono font-medium text-white">
          {typeof value === "number" ? value.toFixed(1) : value}{unit}
        </span>
        <span className="text-xs text-gray-600">
          {isLower ? "<" : ">"}{target}{unit}
        </span>
      </div>
    </div>
  );
}

function PillarCard({ pillar, data }) {
  const config = PILLAR_CONFIG[pillar];
  if (!config || !data || Object.keys(data).length === 0) return null;

  const Icon = config.icon;
  const entries = Object.entries(data).filter(
    ([k, v]) => !k.startsWith("_") && typeof v === "object" && v.value !== undefined
  );
  const passed = entries.filter(([, v]) => v.grade === "pass").length;

  const breakdown = data._discipline_breakdown || data._pacing_breakdown;

  return (
    <div className="glass-card rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg bg-${config.color}-500/10 flex items-center justify-center`}>
            <Icon size={16} className={`text-${config.color}-400`} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">{config.label}</h3>
            <span className="text-[10px] text-gray-500">{config.weight} of score</span>
          </div>
        </div>
        <span className="text-xs text-gray-400">{passed}/{entries.length} passing</span>
      </div>
      <div>
        {entries.map(([key, item]) => (
          <MetricRow key={key} name={key} value={item.value} target={item.target} grade={item.grade} />
        ))}
      </div>

      {data._discipline_breakdown && (
        <div className="mt-3 pt-3 border-t border-gray-800/20">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Discipline Breakdown</p>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(data._discipline_breakdown).map(([k, v]) => (
              <div key={k} className="flex justify-between text-xs">
                <span className="text-gray-500">{k.replace(/_/g, " ")}</span>
                <span className="text-gray-300 font-mono">
                  {typeof v === "number" ? (k.includes("rate") ? `${v}%` : v) : v}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data._pacing_breakdown && (
        <div className="mt-3 pt-3 border-t border-gray-800/20">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Pacing Breakdown</p>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(data._pacing_breakdown).map(([k, v]) => (
              <div key={k} className="flex justify-between text-xs">
                <span className="text-gray-500">{k.replace(/_/g, " ")}</span>
                <span className="text-gray-300 font-mono">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PipelineMetrics() {
  const { data } = useQuery({
    queryKey: ["pipeline-metrics"],
    queryFn: api.getPipelineMetrics,
    refetchInterval: 5000,
  });

  if (!data || data.error) return null;

  return (
    <div className="glass-card rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
          <Zap size={16} className="text-cyan-400" />
        </div>
        <h3 className="text-sm font-semibold text-white">Live Pipeline</h3>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-xl bg-gray-800/30 p-3">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Memory</p>
          <p className="text-sm font-bold text-white">{data.memory?.total_rss_mb || 0} MB</p>
        </div>
        <div className="rounded-xl bg-gray-800/30 p-3">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">State Isolation</p>
          <p className={`text-sm font-bold ${data.state_isolation?.isolated ? "text-emerald-400" : "text-red-400"}`}>
            {data.state_isolation?.isolated ? "OK" : "FAIL"}
          </p>
        </div>
      </div>

      {Object.entries(data.active_calls || {}).length > 0 ? (
        <div className="space-y-2">
          {Object.entries(data.active_calls).map(([callId, metrics]) => (
            <div key={callId} className="rounded-xl bg-gray-800/20 p-3 text-xs">
              <div className="flex justify-between mb-1">
                <span className="text-gray-400 font-mono">{callId.slice(0, 8)}...</span>
                <span className="text-gray-500">{metrics.duration}s</span>
              </div>
              <div className="flex gap-3 text-gray-500">
                <span>Emotion: <span className="text-white">{metrics.emotion_state}</span></span>
                {metrics.turns?.total_turns > 0 && (
                  <span>Gap: <span className="text-white">{metrics.turns.turn_gap_p50_ms?.toFixed(0)}ms</span></span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-600">No active calls</p>
      )}
    </div>
  );
}

function DriftCard() {
  const { data } = useQuery({
    queryKey: ["behaviour-drift"],
    queryFn: api.getBehaviourDrift,
    refetchInterval: 60000,
  });

  if (!data || data.status === "insufficient_data") return null;

  const hasAlerts = data.alerts && data.alerts.length > 0;

  return (
    <div className="glass-card rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg ${hasAlerts ? "bg-red-500/10" : "bg-emerald-500/10"} flex items-center justify-center`}>
            {hasAlerts ? (
              <TrendingDown size={16} className="text-red-400" />
            ) : (
              <TrendingUp size={16} className="text-emerald-400" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Behaviour Drift</h3>
            <span className="text-[10px] text-gray-500">7-day vs 30-day baseline</span>
          </div>
        </div>
        <span className={`text-xs px-2 py-1 rounded-lg ${
          hasAlerts
            ? "bg-red-500/15 text-red-400 border border-red-500/30"
            : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
        }`}>
          {data.status === "drifting" ? "Drifting" : "Stable"}
        </span>
      </div>

      {data.dimensions && Object.entries(data.dimensions).map(([dim, info]) => (
        <div key={dim} className="flex items-center justify-between py-2 border-b border-gray-800/20 last:border-0">
          <span className="text-sm text-gray-400">{dim.replace(/_/g, " ")}</span>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-gray-500">
              {info.baseline.toFixed(1)} → {info.current.toFixed(1)}
            </span>
            <span className={`text-xs font-mono font-medium ${
              info.change_pct < -10 ? "text-red-400" : info.change_pct > 5 ? "text-emerald-400" : "text-gray-400"
            }`}>
              {info.change_pct > 0 ? "+" : ""}{info.change_pct.toFixed(1)}%
            </span>
          </div>
        </div>
      ))}

      {hasAlerts && (
        <div className="mt-3 space-y-2">
          {data.alerts.map((alert, i) => (
            <div key={i} className={`px-3 py-2 rounded-lg text-xs ${
              alert.severity === "critical"
                ? "bg-red-500/10 border border-red-500/20 text-red-400"
                : "bg-amber-500/10 border border-amber-500/20 text-amber-400"
            }`}>
              {alert.dimension.replace(/_/g, " ")}: dropped {alert.drop} ({alert.baseline} → {alert.current})
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Benchmarks() {
  const { data: latest } = useQuery({
    queryKey: ["benchmark-latest"],
    queryFn: api.getLatestBenchmark,
  });

  const runMut = useMutation({
    mutationFn: api.runBenchmarks,
    onSuccess: (data) => setResult(data),
  });

  const [result, setResult] = useState(null);
  const scorecard = result || latest?.scorecard || latest;
  const hasScorecard = scorecard && scorecard.overall_score !== undefined;

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold gradient-text">Benchmarks</h2>
          <p className="text-sm text-gray-500 mt-1">
            Quality scorecard — orchestration, voice, intelligence, and behaviour
          </p>
        </div>
        <Button size="sm" onClick={() => runMut.mutate()} disabled={runMut.isPending}>
          {runMut.isPending ? (
            <><Loader2 size={14} className="animate-spin" /> Running...</>
          ) : (
            <><Play size={14} /> Run Benchmark</>
          )}
        </Button>
      </div>

      {hasScorecard && (
        <div className="glass-card rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Overall Score</p>
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-bold text-white">{scorecard.overall_score}</span>
                <span className="text-gray-500">/100</span>
              </div>
              {scorecard.generated_at && (
                <p className="text-[10px] text-gray-600 mt-2">
                  {new Date(scorecard.generated_at).toLocaleString()}
                </p>
              )}
            </div>
            <GradeBadge grade={scorecard.grade} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {hasScorecard && (
          <>
            <PillarCard pillar="orchestration" data={scorecard.orchestration} />
            <PillarCard pillar="voice" data={scorecard.voice} />
            <PillarCard pillar="intelligence" data={scorecard.intelligence} />
            <PillarCard pillar="behaviour" data={scorecard.behaviour} />
          </>
        )}
        <PipelineMetrics />
        <DriftCard />
      </div>

      {!hasScorecard && !runMut.isPending && (
        <div className="text-center py-16 glass-card rounded-xl">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
            <BarChart3 size={24} className="text-blue-400" />
          </div>
          <p className="text-gray-400 mb-1">No benchmark results yet</p>
          <p className="text-gray-600 text-sm mb-4">
            Run a benchmark to measure orchestration, voice quality, intelligence, and agent behaviour against industry targets.
          </p>
          <Button size="sm" onClick={() => runMut.mutate()} disabled={runMut.isPending}>
            <Play size={14} /> Run First Benchmark
          </Button>
        </div>
      )}

      {runMut.isError && (
        <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400 mt-4">
          Benchmark failed: {runMut.error?.message || "Unknown error"}
        </div>
      )}
    </div>
  );
}
