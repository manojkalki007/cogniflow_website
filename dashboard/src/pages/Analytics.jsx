import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  BarChart3, TrendingUp, Clock, PhoneIncoming, PhoneOutgoing,
  Users, Target, Bot, Activity,
} from "lucide-react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];
const DISPOSITION_COLORS = {
  interested: "#10b981", not_interested: "#ef4444", callback_requested: "#f59e0b",
  escalated: "#f97316", no_answer: "#6b7280", voicemail: "#8b5cf6", unknown: "#374151",
};

const GRADIENT_COLORS = [
  { from: "from-blue-500/10", icon: "text-blue-400", border: "border-blue-500/10" },
  { from: "from-emerald-500/10", icon: "text-emerald-400", border: "border-emerald-500/10" },
  { from: "from-violet-500/10", icon: "text-violet-400", border: "border-violet-500/10" },
  { from: "from-amber-500/10", icon: "text-amber-400", border: "border-amber-500/10" },
];

function Stat({ icon: Icon, label, value, sub, idx = 0 }) {
  const c = GRADIENT_COLORS[idx % GRADIENT_COLORS.length];
  return (
    <div className={`glass-card stat-card rounded-xl p-5 ${c.border}`}>
      <div className="flex items-center gap-2.5 mb-3">
        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${c.from} to-transparent flex items-center justify-center`}>
          <Icon size={15} className={c.icon} />
        </div>
        <span className="text-xs text-gray-500 uppercase tracking-wider font-medium">{label}</span>
      </div>
      <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
      {sub && <p className="text-xs text-gray-600 mt-1.5">{sub}</p>}
    </div>
  );
}

function ChartCard({ title, children, className = "" }) {
  return (
    <div className={`glass-card rounded-xl p-5 ${className}`}>
      <h3 className="text-sm font-medium text-gray-300 mb-4">{title}</h3>
      {children}
    </div>
  );
}

const chartTooltipStyle = {
  contentStyle: {
    backgroundColor: "rgba(17, 24, 39, 0.95)",
    border: "1px solid rgba(75, 85, 99, 0.3)",
    borderRadius: "12px",
    fontSize: "12px",
    backdropFilter: "blur(12px)",
    boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
  },
  labelStyle: { color: "#9ca3af" },
};

export default function Analytics() {
  const [period, setPeriod] = useState(30);

  const { data: stats } = useQuery({ queryKey: ["stats"], queryFn: api.getStats, refetchInterval: 30_000 });
  const { data: trendsData } = useQuery({
    queryKey: ["analytics-trends", period],
    queryFn: () => api.getAnalyticsTrends(period),
  });
  const { data: agentsData } = useQuery({
    queryKey: ["analytics-agents"],
    queryFn: api.getAgentComparison,
  });
  const { data: callsData } = useQuery({
    queryKey: ["calls-analytics"],
    queryFn: () => api.getCalls({ limit: 500 }),
  });

  const today = stats?.today || {};
  const trends = trendsData?.trends || [];
  const agentStats = agentsData?.agents || [];
  const calls = callsData?.calls || [];

  const dispositions = {};
  let totalSentimentScore = 0;
  let sentimentCount = 0;
  let totalQuality = 0;
  let qualityCount = 0;

  calls.forEach((c) => {
    if (c.disposition) dispositions[c.disposition] = (dispositions[c.disposition] || 0) + 1;
    if (c.sentiment_score != null) { totalSentimentScore += c.sentiment_score; sentimentCount++; }
    if (c.quality_score != null) { totalQuality += c.quality_score; qualityCount++; }
  });

  const avgSentiment = sentimentCount > 0 ? (totalSentimentScore / sentimentCount).toFixed(2) : "—";
  const avgQuality = qualityCount > 0 ? Math.round((totalQuality / qualityCount) * 100) + "%" : "—";

  const pieData = Object.entries(dispositions).map(([name, value]) => ({ name, value }));
  const totalDispositions = pieData.reduce((sum, d) => sum + d.value, 0);

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold gradient-text">Analytics</h2>
          <p className="text-sm text-gray-500 mt-1">Real-time performance insights</p>
        </div>
        <div className="flex gap-1 glass-card rounded-xl p-1">
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => setPeriod(d)}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                period === d ? "btn-gradient text-white shadow-md" : "text-gray-400 hover:text-white"
              }`}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat icon={BarChart3} label="Today's Calls" value={today.total_calls ?? "—"} idx={0} />
        <Stat icon={PhoneIncoming} label="Inbound" value={today.inbound ?? "—"} idx={1} />
        <Stat icon={PhoneOutgoing} label="Outbound" value={today.outbound ?? "—"} idx={2} />
        <Stat icon={Clock} label="Avg Duration" value={today.avg_duration_seconds ? `${today.avg_duration_seconds}s` : "—"} idx={3} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        <Stat icon={TrendingUp} label="Avg Sentiment" value={avgSentiment} sub="Scale: -1.0 to 1.0" idx={0} />
        <Stat icon={Target} label="Avg Quality" value={avgQuality} sub="Agent performance" idx={1} />
        <Stat icon={Activity} label="Active Calls" value={stats?.active_calls ?? 0} idx={2} />
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Calls Trend">
              {trends.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={trends}>
                    <defs>
                      <linearGradient id="inboundGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="outboundGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(75,85,99,0.15)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7280" }} tickFormatter={d => d.slice(5)} />
                    <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} />
                    <Tooltip {...chartTooltipStyle} />
                    <Area type="monotone" dataKey="inbound" stackId="1" stroke="#10b981" fill="url(#inboundGrad)" strokeWidth={2} name="Inbound" />
                    <Area type="monotone" dataKey="outbound" stackId="1" stroke="#3b82f6" fill="url(#outboundGrad)" strokeWidth={2} name="Outbound" />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <p className="text-gray-600 text-sm text-center py-12">No data for this period</p>}
            </ChartCard>

            <ChartCard title="Disposition Breakdown">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={65} outerRadius={95}
                      paddingAngle={3} dataKey="value" strokeWidth={0}
                      label={({ name, value }) => `${name} (${Math.round(value / totalDispositions * 100)}%)`}>
                      {pieData.map((entry, i) => (
                        <Cell key={entry.name} fill={DISPOSITION_COLORS[entry.name] || COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip {...chartTooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-gray-600 text-sm text-center py-12">No disposition data yet</p>}
            </ChartCard>

            <ChartCard title="Average Duration (seconds)">
              {trends.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={trends}>
                    <defs>
                      <linearGradient id="durationGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#f59e0b" />
                        <stop offset="100%" stopColor="#f97316" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(75,85,99,0.15)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7280" }} tickFormatter={d => d.slice(5)} />
                    <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} />
                    <Tooltip {...chartTooltipStyle} />
                    <Line type="monotone" dataKey="avg_duration" stroke="url(#durationGrad)" strokeWidth={2.5} dot={false} name="Avg Duration" />
                  </LineChart>
                </ResponsiveContainer>
              ) : <p className="text-gray-600 text-sm text-center py-12">No data</p>}
            </ChartCard>

            <ChartCard title="Conversion Rate (%)">
              {trends.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={trends}>
                    <defs>
                      <linearGradient id="convGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="100%" stopColor="#06b6d4" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(75,85,99,0.15)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7280" }} tickFormatter={d => d.slice(5)} />
                    <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} />
                    <Tooltip {...chartTooltipStyle} />
                    <Line type="monotone" dataKey="conversion_rate" stroke="url(#convGrad)" strokeWidth={2.5} dot={false} name="Conversion %" />
                  </LineChart>
                </ResponsiveContainer>
              ) : <p className="text-gray-600 text-sm text-center py-12">No data</p>}
            </ChartCard>
          </div>
        </TabsContent>

        <TabsContent value="agents">
          {agentStats.length > 0 ? (
            <div className="space-y-4">
              <ChartCard title="Agent Comparison — Total Calls">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={agentStats} layout="vertical">
                    <defs>
                      <linearGradient id="barGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#6366f1" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(75,85,99,0.15)" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: "#6b7280" }} />
                    <YAxis type="category" dataKey="agent_name" tick={{ fontSize: 11, fill: "#9ca3af" }} width={120} />
                    <Tooltip {...chartTooltipStyle} />
                    <Bar dataKey="total_calls" fill="url(#barGrad)" radius={[0, 6, 6, 0]} name="Total Calls" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ChartCard title="Conversion Rate by Agent">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={agentStats}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(75,85,99,0.15)" />
                      <XAxis dataKey="agent_name" tick={{ fontSize: 10, fill: "#6b7280" }} />
                      <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} />
                      <Tooltip {...chartTooltipStyle} />
                      <Bar dataKey="conversion_rate" fill="#10b981" radius={[6, 6, 0, 0]} name="Conversion %" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Avg Sentiment by Agent">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={agentStats}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(75,85,99,0.15)" />
                      <XAxis dataKey="agent_name" tick={{ fontSize: 10, fill: "#6b7280" }} />
                      <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} domain={[-1, 1]} />
                      <Tooltip {...chartTooltipStyle} />
                      <Bar dataKey="avg_sentiment" radius={[6, 6, 0, 0]} name="Avg Sentiment">
                        {agentStats.map((entry, i) => (
                          <Cell key={i} fill={entry.avg_sentiment >= 0 ? "#10b981" : "#ef4444"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              <div className="glass-card rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800/50 text-gray-500 text-xs uppercase tracking-wider">
                      <th className="text-left p-4">Agent</th>
                      <th className="text-left p-4">Calls</th>
                      <th className="text-left p-4">Avg Duration</th>
                      <th className="text-left p-4">Conversion</th>
                      <th className="text-left p-4">Avg Sentiment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentStats.map(a => (
                      <tr key={a.agent_id} className="border-b border-gray-800/30 table-row-hover">
                        <td className="p-4 flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                            <Bot size={13} className="text-blue-400" />
                          </div>
                          <span className="font-medium">{a.agent_name}</span>
                        </td>
                        <td className="p-4 font-mono text-sm">{a.total_calls}</td>
                        <td className="p-4 text-gray-400">{a.avg_duration}s</td>
                        <td className="p-4">
                          <span className={a.conversion_rate > 20 ? "text-emerald-400 font-medium" : "text-gray-400"}>{a.conversion_rate}%</span>
                        </td>
                        <td className="p-4">
                          <span className={a.avg_sentiment >= 0 ? "text-emerald-400" : "text-red-400"}>{a.avg_sentiment}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-gray-800/50 flex items-center justify-center mx-auto mb-4">
                <Bot size={28} className="text-gray-600" />
              </div>
              <p className="text-gray-500">No agent data yet. Create agents and start making calls.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
