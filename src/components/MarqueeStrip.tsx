"use client";

const badges = [
  "Sub-500ms",
  "30+ Languages",
  "WhatsApp Handoff",
  "Salesforce",
  "HubSpot",
  "Sentiment Analysis",
  "Voice Cloning",
  "24/7 Autonomous",
  "GDPR Compliant",
  "Real-Time Transcription",
  "CRM Sync",
  "Hyperpersonalized Email",
];

function MarqueeContent() {
  return (
    <>
      {badges.map((badge, i) => (
        <span key={i} className="flex items-center gap-6 shrink-0">
          <span className="font-mono text-xs uppercase tracking-widest text-text-tertiary whitespace-nowrap">
            {badge}
          </span>
          <span className="w-1 h-1 rounded-full bg-text-tertiary/50 shrink-0" />
        </span>
      ))}
    </>
  );
}

export default function MarqueeStrip() {
  return (
    <section className="border-y border-border py-4 overflow-hidden">
      <div
        className="flex items-center gap-6"
        style={{
          animation: "marquee 30s linear infinite",
          width: "max-content",
        }}
      >
        <MarqueeContent />
        <MarqueeContent />
      </div>

      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  );
}
