"use client";

import ScrollReveal from "./ScrollReveal";

const callData = [
  { name: "Sarah Chen", company: "Acme Corp", duration: "4:32", sentiment: "positive", status: "Converted" },
  { name: "Marcus Reid", company: "Initech", duration: "2:18", sentiment: "positive", status: "Follow-up" },
  { name: "Elena Voss", company: "Globex", duration: "6:04", sentiment: "neutral", status: "Qualified" },
  { name: "James Park", company: "Soylent", duration: "1:47", sentiment: "negative", status: "Dropped" },
  { name: "Priya Sharma", company: "Umbrella", duration: "3:55", sentiment: "positive", status: "Converted" },
];

const sentimentColors: Record<string, string> = {
  positive: "bg-green-400",
  neutral: "bg-yellow-400",
  negative: "bg-red-400",
};

const statusColors: Record<string, string> = {
  Converted: "bg-green-500/20 text-green-400",
  "Follow-up": "bg-brand/20 text-brand",
  Qualified: "bg-blue-500/20 text-blue-400",
  Dropped: "bg-red-500/20 text-red-400",
};

function WaveformBars() {
  return (
    <div className="flex items-end gap-[2px] h-8">
      {Array.from({ length: 24 }).map((_, i) => (
        <div
          key={i}
          className="w-[3px] rounded-full bg-brand/40"
          style={{
            height: `${Math.random() * 60 + 20}%`,
            animation: `waveform ${0.4 + Math.random() * 0.6}s ease-in-out infinite alternate`,
            animationDelay: `${i * 0.05}s`,
          }}
        />
      ))}
    </div>
  );
}

export default function DashboardScreenshot() {
  return (
    <section className="relative px-6 pb-32 -mt-12">
      <ScrollReveal>
        <div className="max-w-5xl mx-auto relative">
          <div
            className="relative rounded-xl overflow-hidden border border-glass-border bg-bg-secondary shadow-2xl"
            style={{
              transform: "perspective(1200px) rotateX(3deg)",
              boxShadow:
                "0 -20px 60px rgba(150,180,255,0.12), 0 -5px 25px rgba(200,220,255,0.08), 0 25px 50px rgba(0,0,0,0.4)",
            }}
          >
            {/* Browser chrome */}
            <div
              className="flex items-center gap-3 px-4 py-3 border-b bg-[#0d0d10]"
              style={{
                borderBottomColor: "rgba(255,255,255,0.06)",
              }}
            >
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="bg-glass border border-glass-border rounded-md px-4 py-1 text-[10px] text-text-tertiary font-mono">
                  app.cogniflowautomations.com
                </div>
              </div>
              <div className="w-[52px]" />
            </div>

            {/* Dashboard content */}
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text-primary">Dashboard</span>
                <div className="flex items-center gap-3">
                  <div className="bg-glass border border-glass-border rounded-md px-3 py-1 text-[10px] text-text-tertiary w-40">
                    Search...
                  </div>
                  <div className="relative">
                    <div className="w-5 h-5 rounded-md bg-glass border border-glass-border flex items-center justify-center">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-tertiary">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                      </svg>
                    </div>
                    <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-brand rounded-full" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { label: "Active Calls", value: "12", accent: true },
                  { label: "Leads Today", value: "847", accent: false },
                  { label: "Meetings Booked", value: "34", accent: false },
                  { label: "Avg Response", value: "380ms", accent: true },
                ].map((stat) => (
                  <div key={stat.label} className="bg-glass border border-glass-border rounded-lg p-3">
                    <div className="text-[10px] text-text-tertiary">{stat.label}</div>
                    <div className={`text-sm font-bold font-mono mt-0.5 ${stat.accent ? "text-brand" : "text-text-primary"}`}>
                      {stat.value}
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden md:grid grid-cols-5 gap-2">
                <div className="col-span-3 bg-glass border border-glass-border rounded-lg p-3">
                  <div className="text-[10px] font-semibold text-text-primary mb-2">Recent Calls</div>
                  <table className="w-full">
                    <thead>
                      <tr className="text-[9px] uppercase tracking-wider text-text-tertiary border-b border-border">
                        <th className="text-left pb-1.5 font-medium">Name</th>
                        <th className="text-left pb-1.5 font-medium">Company</th>
                        <th className="text-left pb-1.5 font-medium">Duration</th>
                        <th className="text-left pb-1.5 font-medium">Sentiment</th>
                        <th className="text-left pb-1.5 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {callData.map((row) => (
                        <tr key={row.name} className="border-b border-border/50 last:border-0">
                          <td className="text-[10px] text-text-primary py-1.5">{row.name}</td>
                          <td className="text-[10px] text-text-secondary py-1.5">{row.company}</td>
                          <td className="text-[10px] text-text-secondary font-mono py-1.5">{row.duration}</td>
                          <td className="py-1.5"><div className={`w-2 h-2 rounded-full ${sentimentColors[row.sentiment]}`} /></td>
                          <td className="py-1.5">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${statusColors[row.status]}`}>{row.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="col-span-2 bg-glass border border-glass-border rounded-lg p-3 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-semibold text-text-primary">Live Agent</div>
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                      <span className="text-[9px] text-green-400">Active</span>
                    </div>
                  </div>
                  <div className="bg-bg-secondary/60 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-text-primary">Sarah Chen</span>
                      <span className="text-[10px] text-text-tertiary font-mono">04:32</span>
                    </div>
                    <WaveformBars />
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                      <span className="text-[9px] text-green-400">Positive</span>
                    </div>
                  </div>
                  <div className="bg-bg-secondary/60 rounded-lg p-2 space-y-1">
                    <div className="text-[9px] text-text-tertiary uppercase tracking-wider mb-1">Queue</div>
                    {["Marcus Reid", "Elena Voss"].map((name) => (
                      <div key={name} className="flex items-center justify-between">
                        <span className="text-[10px] text-text-secondary">{name}</span>
                        <span className="text-[9px] text-text-tertiary">Waiting</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScrollReveal>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-bg-primary to-transparent pointer-events-none" />

      <style>{`
        @keyframes waveform {
          0% { height: 20%; }
          100% { height: 80%; }
        }
      `}</style>
    </section>
  );
}
