"use client";

import ScrollReveal from "./ScrollReveal";

const transcriptLines = [
  {
    speaker: "Agent",
    text: "Based on your team size, I'd recommend our Growth plan...",
    isAgent: true,
  },
  {
    speaker: "Sarah",
    text: "That sounds interesting. What about the WhatsApp integration?",
    isAgent: false,
  },
  {
    speaker: "Agent",
    text: "Great question. Let me walk you through how that works.",
    isAgent: true,
  },
];

function SentimentMockup() {
  return (
    <div className="bg-glass border border-glass-border rounded-2xl p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <div className="absolute w-2 h-2 rounded-full bg-green-400 animate-ping" />
          </div>
          <span className="text-xs text-text-primary font-medium">
            Live Call — Sarah Chen, Acme Corp
          </span>
        </div>
        <span className="text-[10px] text-text-tertiary font-mono">04:32</span>
      </div>

      {/* Audio waveform */}
      <div className="flex items-end justify-center gap-[2px] h-10">
        {Array.from({ length: 28 }).map((_, i) => (
          <div
            key={i}
            className="w-[3px] rounded-full bg-brand/40"
            style={{
              height: `${Math.random() * 70 + 15}%`,
              animation: `intelliWave ${0.3 + Math.random() * 0.7}s ease-in-out infinite alternate`,
              animationDelay: `${i * 0.04}s`,
            }}
          />
        ))}
      </div>

      {/* Sentiment bar */}
      <div className="space-y-2">
        <div className="text-[10px] text-text-tertiary uppercase tracking-wider font-mono">
          Sentiment Analysis
        </div>
        <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
          <div className="bg-red-500/30 rounded-l-full" style={{ width: "10%" }} />
          <div className="bg-yellow-500/30" style={{ width: "30%" }} />
          <div className="bg-green-500/60 rounded-r-full" style={{ width: "60%" }} />
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
          <span className="text-[10px] text-green-400 font-medium">
            Positive — High Interest
          </span>
        </div>
      </div>

      {/* Transcript */}
      <div className="space-y-1.5 pt-2 border-t border-border">
        <div className="text-[10px] text-text-tertiary uppercase tracking-wider font-mono mb-2">
          Live Transcript
        </div>
        {transcriptLines.map((line, i) => (
          <p key={i} className="text-xs leading-relaxed">
            <span
              className={
                line.isAgent ? "text-brand font-medium" : "text-text-primary font-medium"
              }
            >
              {line.speaker}:
            </span>{" "}
            <span className="text-text-secondary">{line.text}</span>
          </p>
        ))}
      </div>

      <style>{`
        @keyframes intelliWave {
          0% { height: 15%; }
          100% { height: 85%; }
        }
      `}</style>
    </div>
  );
}

export default function IntelligenceSplit() {
  return (
    <section className="py-32 px-6">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
        {/* Left: text */}
        <ScrollReveal>
          <div>
            <span className="text-xs uppercase tracking-widest text-brand font-mono">
              Intelligence
            </span>
            <h2 className="text-4xl md:text-5xl font-bold text-text-primary mt-4 leading-tight">
              Knows how the caller feels
            </h2>
            <p className="text-text-secondary text-lg leading-relaxed mt-6 max-w-lg">
              Your AI agent doesn&apos;t just listen — it reads. Real-time
              sentiment analysis detects hesitation, interest, frustration, and
              buying signals. It adapts tone, pacing, and responses
              mid-conversation. Not a script. A conversation.
            </p>
          </div>
        </ScrollReveal>

        {/* Right: mockup */}
        <ScrollReveal delay={0.2}>
          <SentimentMockup />
        </ScrollReveal>
      </div>
    </section>
  );
}
