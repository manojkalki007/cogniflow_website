import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Gauge, Zap, Mic, Brain, Volume2, RefreshCw } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { Button } from "../components/ui/button";
import PageHeader from "../components/PageHeader";

const TARGET_MS = 500;
const WARN_MS = 800;

function getLatencyColor(ms) {
  if (ms == null) return "var(--text-muted)";
  if (ms <= TARGET_MS) return "var(--success)";
  if (ms <= WARN_MS) return "var(--warning)";
  return "var(--danger)";
}

function getBarColor(ms) {
  if (ms == null) return "var(--text-muted)";
  if (ms <= TARGET_MS) return "var(--accent)";
  if (ms <= WARN_MS) return "var(--warning)";
  return "var(--danger)";
}

function getBadgeVariant(ms) {
  if (ms == null) return "secondary";
  if (ms <= TARGET_MS) return "success";
  if (ms <= WARN_MS) return "warning";
  return "destructive";
}

function LatencyCard({ icon: Icon, label, description, value, unit = "ms", maxValue = 1000 }) {
  const ms = value;
  const pct = ms != null ? (ms / maxValue) * 100 : 0;

  return (
    <div className="rounded-xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-subtle)' }}>
            <Icon size={15} style={{ color: 'var(--accent)' }} />
          </div>
          <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</h3>
        </div>
        <Badge variant={getBadgeVariant(ms)}>
          {ms != null ? (ms <= TARGET_MS ? "Good" : ms <= WARN_MS ? "Slow" : "Critical") : "N/A"}
        </Badge>
      </div>
      <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>{description}</p>

      <div className="flex items-baseline gap-1 mb-3">
        <span className="text-3xl font-bold" style={{ color: getLatencyColor(ms) }}>
          {ms != null ? ms : "—"}
        </span>
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{unit}</span>
      </div>
      <Progress value={pct} color={getBarColor(ms)} />
      <div className="flex justify-between mt-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>
        <span>0ms</span>
        <span style={{ color: 'var(--success)' }}>Target: {TARGET_MS}ms</span>
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
    },
    {
      key: "llm", icon: Brain, label: "LLM (Time to First Token)",
      description: "Groq Llama 3.3 70B response generation",
      value: services.llm_ttft_ms ?? services.groq_ms,
    },
    {
      key: "tts", icon: Volume2, label: "Text-to-Speech",
      description: "Smallest AI / Sarvam synthesis",
      value: services.tts_ttfb_ms ?? services.smallest_ms ?? services.tts_ms,
    },
    {
      key: "total", icon: Zap, label: "Total Round-Trip",
      description: "End-to-end: user stops speaking → agent audio starts",
      value: overall.total_ms ?? services.total_ms,
      maxValue: 1500,
    },
  ];

  return (
    <div>
      <PageHeader title="Latency" description="Pipeline latency breakdown and monitoring" />

      <div className="px-8 py-6">
        <div className="flex justify-end items-center mb-8">
          <Button className="text-white" style={{ background: 'var(--accent)' }} size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
            {isFetching ? "Measuring..." : "Measure Now"}
          </Button>
        </div>

        {isLoading ? (
          <div className="text-sm text-center py-12" style={{ color: 'var(--text-muted)' }}>Measuring service latencies...</div>
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
                />
              ))}
            </div>

            <div className="rounded-xl border p-6 mb-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <h3 className="text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>Optimization Techniques</h3>
              <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Active latency reduction strategies</p>

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
                  <div key={tech.name} className="flex items-start gap-3 p-3.5 rounded-xl transition-all duration-200" style={{ background: 'var(--bg-muted)' }}>
                    <div className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0" style={{ background: tech.active ? 'var(--success)' : 'var(--text-muted)', boxShadow: tech.active ? '0 1px 2px color-mix(in srgb, var(--success) 50%, transparent)' : 'none' }} />
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{tech.name}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{tech.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {data?.per_turn_avg && (
              <div className="rounded-xl border p-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <h3 className="text-sm font-medium mb-5" style={{ color: 'var(--text-primary)' }}>Per-Turn Averages (Recent Calls)</h3>
                <div className="grid grid-cols-3 gap-6 text-center">
                  {[
                    { label: "LLM TTFT (ms)", value: data.per_turn_avg.llm_ttft },
                    { label: "TTS TTFB (ms)", value: data.per_turn_avg.tts_ttfb },
                    { label: "Total (ms)", value: data.per_turn_avg.total },
                  ].map(({ label, value }) => (
                    <div key={label} className="p-4 rounded-xl" style={{ background: 'var(--bg-muted)' }}>
                      <p className="text-2xl font-bold" style={{ color: getLatencyColor(value) }}>
                        {value ?? "—"}
                      </p>
                      <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
