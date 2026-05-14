import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Gauge, Zap, Mic, Brain, Volume2, RefreshCw } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { Button } from "../components/ui/button";

const TARGET_MS = 500;
const WARN_MS = 800;

function getLatencyColor(ms) {
  if (ms == null) return "text-gray-500";
  if (ms <= TARGET_MS) return "text-emerald-400";
  if (ms <= WARN_MS) return "text-amber-400";
  return "text-red-400";
}

function getBarColor(ms) {
  if (ms == null) return "bg-gray-600";
  if (ms <= TARGET_MS) return "bg-emerald-500";
  if (ms <= WARN_MS) return "bg-amber-500";
  return "bg-red-500";
}

function getBadgeVariant(ms) {
  if (ms == null) return "secondary";
  if (ms <= TARGET_MS) return "success";
  if (ms <= WARN_MS) return "warning";
  return "destructive";
}

function LatencyCard({ icon: Icon, label, description, value, unit = "ms", maxValue = 1000, color, bg }) {
  const ms = value;
  const pct = ms != null ? (ms / maxValue) * 100 : 0;

  return (
    <div className="glass-card stat-card rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}>
            <Icon size={15} className={color} />
          </div>
          <h3 className="text-sm font-medium text-white">{label}</h3>
        </div>
        <Badge variant={getBadgeVariant(ms)}>
          {ms != null ? (ms <= TARGET_MS ? "Good" : ms <= WARN_MS ? "Slow" : "Critical") : "N/A"}
        </Badge>
      </div>
      <p className="text-xs text-gray-500 mb-3">{description}</p>

      <div className="flex items-baseline gap-1 mb-3">
        <span className={`text-3xl font-bold ${getLatencyColor(ms)}`}>
          {ms != null ? ms : "—"}
        </span>
        <span className="text-sm text-gray-500">{unit}</span>
      </div>
      <Progress value={pct} color={getBarColor(ms)} />
      <div className="flex justify-between mt-2 text-[10px] text-gray-600">
        <span>0ms</span>
        <span className="text-emerald-600">Target: {TARGET_MS}ms</span>
        <span>{maxValue}ms</span>
      </div>
    </div>
  );
}

export default function Latency() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["latency"],
    queryFn: api.getLatency,
    refetchInterval: 60_000,
  });

  const services = data?.services || {};
  const overall = data?.overall || {};

  const serviceMetrics = [
    {
      key: "stt", icon: Mic, label: "Speech-to-Text",
      description: "Deepgram / Sarvam AI transcription latency",
      value: services.stt_ms ?? services.deepgram_ms,
      color: "text-blue-400", bg: "bg-blue-500/10",
    },
    {
      key: "llm", icon: Brain, label: "LLM (Time to First Token)",
      description: "Groq Llama 3.3 70B response generation",
      value: services.llm_ttft_ms ?? services.groq_ms,
      color: "text-violet-400", bg: "bg-violet-500/10",
    },
    {
      key: "tts", icon: Volume2, label: "Text-to-Speech",
      description: "Smallest AI / Sarvam synthesis",
      value: services.tts_ttfb_ms ?? services.smallest_ms ?? services.tts_ms,
      color: "text-emerald-400", bg: "bg-emerald-500/10",
    },
    {
      key: "total", icon: Zap, label: "Total Round-Trip",
      description: "End-to-end: user stops speaking → agent audio starts",
      value: overall.total_ms ?? services.total_ms,
      maxValue: 1500,
      color: "text-amber-400", bg: "bg-amber-500/10",
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold gradient-text">Latency Monitor</h2>
          <p className="text-sm text-gray-500 mt-1">Target: sub-{TARGET_MS}ms end-to-end response</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
          {isFetching ? "Measuring..." : "Measure Now"}
        </Button>
      </div>

      {isLoading ? (
        <div className="text-gray-500 text-sm text-center py-12">Measuring service latencies...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {serviceMetrics.map((m) => (
              <LatencyCard
                key={m.key}
                icon={m.icon}
                label={m.label}
                description={m.description}
                value={m.value}
                maxValue={m.maxValue || 1000}
                color={m.color}
                bg={m.bg}
              />
            ))}
          </div>

          <div className="glass-card rounded-xl p-6 mb-6">
            <h3 className="text-sm font-medium text-white mb-1.5">Optimization Techniques</h3>
            <p className="text-xs text-gray-500 mb-4">Active latency reduction strategies</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { name: "Semantic EOT", desc: "Multi-signal turn detection", active: true },
                { name: "Speculative Pre-gen", desc: "Start LLM while user speaks", active: true },
                { name: "Sentence Streaming", desc: "TTS per sentence, not full response", active: true },
                { name: "Filler Audio", desc: "Pre-cached phrases during tool calls", active: true },
                { name: "Groq Fast LLM", desc: "~80ms TTFT primary provider", active: !!services.groq_ms },
                { name: "Smallest AI TTS", desc: "Native mulaw output, no conversion", active: !!services.smallest_ms || !!services.tts_ms },
                { name: "Barge-in Detection", desc: "Energy-based interruption handling", active: true },
                { name: "Per-turn Tracing", desc: "Component-level latency measurement", active: true },
                { name: "Context Window Trim", desc: "Keep last 20 messages only", active: true },
              ].map((tech) => (
                <div key={tech.name} className="flex items-start gap-3 p-3.5 rounded-xl bg-gray-800/30 transition-all duration-200 hover:bg-gray-800/50">
                  <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${tech.active ? "bg-emerald-500 shadow-sm shadow-emerald-500/50" : "bg-gray-600"}`} />
                  <div>
                    <p className="text-sm font-medium text-gray-200">{tech.name}</p>
                    <p className="text-xs text-gray-500">{tech.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {data?.per_turn_avg && (
            <div className="glass-card rounded-xl p-6">
              <h3 className="text-sm font-medium text-white mb-5">Per-Turn Averages (Recent Calls)</h3>
              <div className="grid grid-cols-3 gap-6 text-center">
                {[
                  { label: "LLM TTFT (ms)", value: data.per_turn_avg.llm_ttft },
                  { label: "TTS TTFB (ms)", value: data.per_turn_avg.tts_ttfb },
                  { label: "Total (ms)", value: data.per_turn_avg.total },
                ].map(({ label, value }) => (
                  <div key={label} className="p-4 rounded-xl bg-gray-800/30">
                    <p className={`text-2xl font-bold ${getLatencyColor(value)}`}>
                      {value ?? "—"}
                    </p>
                    <p className="text-xs text-gray-500 mt-1.5">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
