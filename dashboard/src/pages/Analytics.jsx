import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  BarChart3, TrendingUp, Clock, PhoneIncoming, PhoneOutgoing,
  Target, Bot, Activity, DollarSign,
} from "lucide-react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import PageHeader from "../components/PageHeader";

const COLORS = ["#00BCD4", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];
const DISPOSITION_COLORS = {
  interested: "#10b981", not_interested: "#ef4444", callback_requested: "#f59e0b",
  escalated: "#f97316", no_answer: "#6b7280", voicemail: "#8b5cf6", unknown: "#94a3b8",
};

function StatCard({ label, value, icon: Icon, iconColor, sub }) {
  return (
    <div className="rounded-xl border p-5 transition-shadow hover:shadow-md"
         style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{label}</span>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-subtle)' }}>
          <Icon size={14} style={{ color: iconColor || 'var(--accent)' }} />
        </div>
      </div>
      <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
        {value ?? <span className="text-base font-normal" style={{ color: 'var(--text-muted)' }}>No data</span>}
      </div>
      {sub && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
    </div>
  );
}

function ChartCard({ title, children, className = "" }) {
  return (
    <div className={`rounded-xl border p-5 ${className}`}
         style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>{title}</h3>
      {children}
    </div>
  );
}

function EmptyChart({ message }) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="h-32 w-full rounded-lg animate-pulse" style={{ background: 'var(--bg-muted)' }} />
    </div>
  );
}

const tooltipStyle = {
  contentStyle: {
    background: 'var(--surface-raised)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    fontSize: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  },
  labelStyle: { color: 'var(--text-muted)' },
};

export default function Analytics() {
  const [period, setPeriod] = useState(30);

  const { data: stats } = useQuery({ queryKey: ["stats"], queryFn: api.getStats, refetchInterval: 30_000 });
  const { data: trendsData } = useQuery({ queryKey: ["analytics-trends", period], queryFn: () => api.getAnalyticsTrends(period) });
  const { data: agentsData } = useQuery({ queryKey: ["analytics-agents"], queryFn: api.getAgentComparison });
  const { data: callsData } = useQuery({ queryKey: ["calls-analytics"], queryFn: () => api.getCalls({ limit: 500 }) });

  const today = stats?.today || {};
  const trends = trendsData?.trends || [];
  const agentStats = agentsData?.agents || [];
  const calls = callsData?.calls || [];

  const COST_PER_MIN = 0.0283; // STT + LLM + TTS + Telephony

  const dispositions = {};
  let totalSentimentScore = 0, sentimentCount = 0, totalQuality = 0, qualityCount = 0;
  let totalCost = 0, costCallCount = 0;
  calls.forEach((c) => {
    if (c.disposition) dispositions[c.disposition] = (dispositions[c.disposition] || 0) + 1;
    if (c.sentiment_score != null) { totalSentimentScore += c.sentiment_score; sentimentCount++; }
    if (c.quality_score != null) { totalQuality += c.quality_score; qualityCount++; }
    // Cost: use actual if available, otherwise estimate from duration
    if (c.cost != null) {
      totalCost += c.cost;
      costCallCount++;
    } else if (c.cost_breakdown?.total != null) {
      totalCost += c.cost_breakdown.total;
      costCallCount++;
    } else if (c.duration_seconds) {
      totalCost += (c.duration_seconds / 60) * COST_PER_MIN;
      costCallCount++;
    }
  });

  const avgCostPerCall = costCallCount > 0 ? (totalCost / costCallCount) : 0;
  const costIsEstimated = calls.length > 0 && calls.every((c) => c.cost == null && c.cost_breakdown == null);

  // Build cost trend data from daily trends
  const costTrends = trends.map((t) => ({
    ...t,
    estimated_cost: +((((t.inbound || 0) + (t.outbound || 0)) * (t.avg_duration || 0) / 60) * COST_PER_MIN).toFixed(2),
  }));

  const avgSentiment = sentimentCount > 0 ? (totalSentimentScore / sentimentCount).toFixed(2) : "0";
  const avgQuality = qualityCount > 0 ? Math.round((totalQuality / qualityCount) * 100) + "%" : "0%";

  const pieData = Object.entries(dispositions).map(([name, value]) => ({ name, value }));
  const totalDispositions = pieData.reduce((sum, d) => sum + d.value, 0);

  const periodAction = (
    <div className="flex gap-1 rounded-xl p-1 border" style={{ borderColor: 'var(--border)', background: 'var(--bg-muted)' }}>
      {[7, 30, 90].map(d => (
        <button key={d} onClick={() => setPeriod(d)}
          className="px-4 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={period === d
            ? { background: 'var(--accent)', color: 'white' }
            : { color: 'var(--text-muted)' }}>
          {d}d
        </button>
      ))}
    </div>
  );

  return (
    <div>
      <PageHeader title="Analytics" description="Real-time performance insights" action={periodAction} />

      <div className="px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard icon={BarChart3} label="Today's Calls" value={today.total_calls ?? 0} iconColor="var(--accent)" />
          <StatCard icon={PhoneIncoming} label="Inbound" value={today.inbound ?? 0} iconColor="var(--success)" />
          <StatCard icon={PhoneOutgoing} label="Outbound" value={today.outbound ?? 0} iconColor="#8b5cf6" />
          <StatCard icon={Clock} label="Avg Duration" value={today.avg_duration_seconds ? `${today.avg_duration_seconds}s` : "0s"} iconColor="var(--warning)" />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <StatCard icon={TrendingUp} label="Avg Sentiment" value={avgSentiment} sub="Scale: -1.0 to 1.0" iconColor="var(--info)" />
          <StatCard icon={Target} label="Avg Quality" value={avgQuality} sub="Agent performance" iconColor="#8b5cf6" />
          <StatCard icon={Activity} label="Active Calls" value={stats?.active_calls ?? 0} iconColor="var(--accent)" />
        </div>

        {/* Cost Analytics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <StatCard
            icon={DollarSign}
            label="Total Cost"
            value={totalCost > 0 ? `$${totalCost.toFixed(2)}` : "$0.00"}
            sub={costIsEstimated ? "Estimated from duration" : `${costCallCount} calls this period`}
            iconColor="var(--success)"
          />
          <StatCard
            icon={DollarSign}
            label="Avg Cost / Call"
            value={avgCostPerCall > 0 ? `$${avgCostPerCall.toFixed(4)}` : "$0.00"}
            sub="Per-call average"
            iconColor="#f59e0b"
          />
          <div className="rounded-xl border p-5 transition-shadow hover:shadow-md"
               style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Cost Trend</span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-subtle)' }}>
                <TrendingUp size={14} style={{ color: 'var(--accent)' }} />
              </div>
            </div>
            {costTrends.length > 0 ? (
              <ResponsiveContainer width="100%" height={60}>
                <AreaChart data={costTrends}>
                  <defs>
                    <linearGradient id="costG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="estimated_cost" stroke="#10b981" fill="url(#costG)" strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[60px] rounded-lg animate-pulse" style={{ background: 'var(--bg-muted)' }} />
            )}
            <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
              {costIsEstimated ? "Estimated daily cost" : "Actual daily cost"}
            </p>
          </div>
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
                        <linearGradient id="inG" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
                          <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="outG" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#00BCD4" stopOpacity={0.2} />
                          <stop offset="100%" stopColor="#00BCD4" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={d => d.slice(5)} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                      <Tooltip {...tooltipStyle} />
                      <Area type="monotone" dataKey="inbound" stackId="1" stroke="#10b981" fill="url(#inG)" strokeWidth={2} name="Inbound" />
                      <Area type="monotone" dataKey="outbound" stackId="1" stroke="#00BCD4" fill="url(#outG)" strokeWidth={2} name="Outbound" />
                      <Legend wrapperStyle={{ fontSize: "11px" }} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
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
                      <Tooltip {...tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </ChartCard>

              <ChartCard title="Average Duration (seconds)">
                {trends.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={trends}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={d => d.slice(5)} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                      <Tooltip {...tooltipStyle} />
                      <Line type="monotone" dataKey="avg_duration" stroke="#f59e0b" strokeWidth={2.5} dot={false} name="Avg Duration" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </ChartCard>

              <ChartCard title="Conversion Rate (%)">
                {trends.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={trends}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={d => d.slice(5)} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                      <Tooltip {...tooltipStyle} />
                      <Line type="monotone" dataKey="conversion_rate" stroke="#00BCD4" strokeWidth={2.5} dot={false} name="Conversion %" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </ChartCard>
            </div>
          </TabsContent>

          <TabsContent value="agents">
            {agentStats.length > 0 ? (
              <div className="space-y-4">
                <ChartCard title="Agent Comparison — Total Calls">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={agentStats} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                      <YAxis type="category" dataKey="agent_name" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} width={120} />
                      <Tooltip {...tooltipStyle} />
                      <Bar dataKey="total_calls" fill="#00BCD4" radius={[0, 6, 6, 0]} name="Total Calls" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-subtle)' }}>
                        <th className="text-left p-4 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Agent</th>
                        <th className="text-left p-4 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Calls</th>
                        <th className="text-left p-4 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Avg Duration</th>
                        <th className="text-left p-4 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Conversion</th>
                        <th className="text-left p-4 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Sentiment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agentStats.map(a => (
                        <tr key={a.agent_id} className="border-b transition-colors hover:bg-[var(--bg-muted)]" style={{ borderColor: 'var(--border)' }}>
                          <td className="p-4 flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-subtle)' }}>
                              <Bot size={13} style={{ color: 'var(--accent)' }} />
                            </div>
                            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{a.agent_name}</span>
                          </td>
                          <td className="p-4 font-mono text-sm" style={{ color: 'var(--text-secondary)' }}>{a.total_calls}</td>
                          <td className="p-4" style={{ color: 'var(--text-muted)' }}>{a.avg_duration}s</td>
                          <td className="p-4">
                            <span style={{ color: a.conversion_rate > 20 ? 'var(--success)' : 'var(--text-muted)', fontWeight: a.conversion_rate > 20 ? 500 : 400 }}>{a.conversion_rate}%</span>
                          </td>
                          <td className="p-4">
                            <span style={{ color: a.avg_sentiment >= 0 ? 'var(--success)' : 'var(--danger)' }}>{a.avg_sentiment}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-subtle)' }}>
                  <Bot size={20} style={{ color: 'var(--accent)' }} />
                </div>
                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>No agent data yet</p>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Create agents and start making calls to see analytics</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
