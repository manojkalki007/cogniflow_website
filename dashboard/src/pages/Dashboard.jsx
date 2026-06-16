import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  Phone, Bot, TrendingUp, Clock, Plus, PhoneOutgoing,
  BarChart3, ArrowUpRight, Activity, Zap, Users,
  Megaphone, IndianRupee, AlertTriangle,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import OnboardingFlow from "../components/OnboardingFlow";

function MetricCard({ icon: Icon, label, value, sub, trend, color = "blue" }) {
  const colorMap = {
    blue: { bg: "rgba(34,211,238,0.08)", text: "text-cyan-400", glow: "stat-card-blue" },
    green: { bg: "rgba(16,185,129,0.08)", text: "text-emerald-400", glow: "stat-card-emerald" },
    violet: { bg: "rgba(139,92,246,0.08)", text: "text-violet-400", glow: "stat-card-violet" },
    amber: { bg: "rgba(245,158,11,0.08)", text: "text-amber-400", glow: "stat-card-amber" },
  };
  const c = colorMap[color] || colorMap.blue;

  return (
    <div className={`stat-card ${c.glow}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: c.bg }}>
          <Icon size={18} className={c.text} />
        </div>
        {trend != null && (
          <span className={`flex items-center gap-1 text-xs font-medium ${trend >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            <TrendingUp size={12} className={trend < 0 ? "rotate-180" : ""} />
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-3xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>{value}</p>
      <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{sub || label}</p>
    </div>
  );
}

function UsageMeter({ used, limit }) {
  const pct = Math.min((used / Math.max(limit, 1)) * 100, 100);
  const remaining = Math.max(0, limit - used);

  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Usage This Month</h3>
        {pct >= 80 && (
          <span className="flex items-center gap-1 text-xs text-amber-400">
            <AlertTriangle size={12} />
            {pct >= 95 ? "Almost full" : "High usage"}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-4xl font-bold" style={{ color: "var(--text-primary)" }}>{Math.round(used)}</span>
        <span className="text-sm" style={{ color: "var(--text-muted)" }}>/ {limit} min</span>
      </div>
      <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-muted)" }}>
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${pct}%`,
            background: pct >= 90 ? "var(--danger)" : pct >= 70 ? "var(--warning)" : "var(--accent)",
          }}
        />
      </div>
      <div className="flex justify-between text-xs mt-2" style={{ color: "var(--text-muted)" }}>
        <span>{pct.toFixed(0)}% used</span>
        <span>{remaining} min remaining</span>
      </div>
    </div>
  );
}

function QuickAction({ icon: Icon, label, description, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-4 p-4 rounded-xl text-left transition-all duration-200 w-full group"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--accent)";
        e.currentTarget.style.boxShadow = "0 0 20px var(--accent-glow)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors"
        style={{ background: "var(--accent-subtle)" }}>
        <Icon size={18} style={{ color: "var(--accent)" }} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{label}</p>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>{description}</p>
      </div>
      <ArrowUpRight size={14} className="ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--accent)" }} />
    </button>
  );
}

function RecentCallRow({ call }) {
  const statusColors = {
    completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    active: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    failed: "bg-red-500/10 text-red-400 border-red-500/20",
    missed: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  };

  return (
    <div
      className="flex items-center justify-between py-3 px-1 transition-colors rounded-lg"
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-muted)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--accent-subtle)" }}>
          <Phone size={14} style={{ color: "var(--accent)" }} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
            {call.phone_number || "Unknown"}
          </p>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {call.agent_name || "Default Agent"} &middot; {call.created_at ? new Date(call.created_at).toLocaleString("en-IN", { hour: "numeric", minute: "2-digit", month: "short", day: "numeric" }) : ""}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {call.duration_seconds != null && (
          <span className="flex items-center gap-1 text-xs font-mono" style={{ color: "var(--text-muted)" }}>
            <Clock size={10} />
            {Math.floor(call.duration_seconds / 60)}:{String(call.duration_seconds % 60).padStart(2, "0")}
          </span>
        )}
        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusColors[call.status] || "bg-gray-500/10 text-gray-400 border-gray-500/20"}`}>
          {call.status || "unknown"}
        </span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();

  const { data: usage } = useQuery({
    queryKey: ["dashboard-usage"],
    queryFn: () => api.getUsage(),
    refetchInterval: 30_000,
  });

  const { data: live } = useQuery({
    queryKey: ["dashboard-live"],
    queryFn: () => api.getLiveUsage(),
    refetchInterval: 10_000,
  });

  const { data: callsData } = useQuery({
    queryKey: ["dashboard-calls"],
    queryFn: () => api.getCalls({ limit: 8 }),
  });

  const { data: agentsData } = useQuery({
    queryKey: ["dashboard-agents"],
    queryFn: () => api.getAgents(),
  });

  const { data: trends } = useQuery({
    queryKey: ["dashboard-trends"],
    queryFn: () => api.getAnalyticsTrends(7),
    staleTime: 60_000,
  });

  const calls = callsData?.calls || [];
  const agents = agentsData?.agents || [];

  const trendData = (trends?.trends || []).map((d) => ({
    date: d.date,
    value: d.total || 0,
  }));

  const avgDuration = calls.length > 0
    ? Math.round(calls.reduce((s, c) => s + (c.duration_seconds || 0), 0) / calls.length)
    : 0;

  return (
    <div className="px-6 md:px-8 py-6 space-y-6 max-w-[1400px] mx-auto animate-fade-in">
      {/* Onboarding */}
      <OnboardingFlow />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Dashboard
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            Overview of your AI voice agents
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(live?.active_calls || 0) > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
              style={{ background: "rgba(16,185,129,0.1)", color: "#10B981", border: "1px solid rgba(16,185,129,0.2)" }}>
              <Activity size={12} className="animate-pulse" />
              {live.active_calls} active call{live.active_calls !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={Phone}
          label="Total Calls"
          value={usage?.total_calls || 0}
          sub="this month"
          color="blue"
        />
        <MetricCard
          icon={Bot}
          label="Active Agents"
          value={agents.length}
          sub={`${agents.filter(a => a.status === "active").length || agents.length} deployed`}
          color="green"
        />
        <MetricCard
          icon={Clock}
          label="Avg Duration"
          value={avgDuration > 0 ? `${Math.floor(avgDuration / 60)}m ${avgDuration % 60}s` : "0s"}
          sub="per call"
          color="violet"
        />
        <MetricCard
          icon={IndianRupee}
          label="Estimated Cost"
          value={`₹${((usage?.total_bill_paise || 0) / 100).toFixed(2)}`}
          sub="this month"
          color="amber"
        />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Usage + Trend */}
        <div className="lg:col-span-2 space-y-6">
          {/* Call Volume Trend */}
          <div className="stat-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Call Volume (7 days)</h3>
              <button
                onClick={() => navigate("/home/analytics")}
                className="text-xs flex items-center gap-1 transition-colors"
                style={{ color: "var(--accent)" }}
              >
                View all <ArrowUpRight size={12} />
              </button>
            </div>
            {trendData.length > 0 ? (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="callGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#00BCD4" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#00BCD4" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                      tickFormatter={(d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                    />
                    <Area type="monotone" dataKey="value" stroke="#00BCD4" strokeWidth={2} fill="url(#callGrad)" name="Calls" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center">
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>Make your first call to see trends</p>
              </div>
            )}
          </div>

          {/* Recent Calls */}
          <div className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Recent Calls</h3>
              <button
                onClick={() => navigate("/home/calls")}
                className="text-xs flex items-center gap-1 transition-colors"
                style={{ color: "var(--accent)" }}
              >
                View all <ArrowUpRight size={12} />
              </button>
            </div>
            {calls.length === 0 ? (
              <div className="py-8 text-center">
                <Phone size={32} className="mx-auto mb-3" style={{ color: "var(--text-muted)", opacity: 0.3 }} />
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>No calls yet</p>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Create an agent and make your first call</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                {calls.slice(0, 6).map((call) => (
                  <RecentCallRow key={call.id} call={call} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Usage + Quick Actions */}
        <div className="space-y-6">
          <UsageMeter
            used={usage?.used_minutes || 0}
            limit={usage?.included_minutes || 500}
          />

          {/* Quick Actions */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Quick Actions</h3>
            <QuickAction
              icon={Plus}
              label="Create Agent"
              description="Build a new AI voice agent"
              onClick={() => navigate("/home/agents")}
            />
            <QuickAction
              icon={PhoneOutgoing}
              label="Make a Call"
              description="Test your agent with a call"
              onClick={() => navigate("/home/phone-numbers")}
            />
            <QuickAction
              icon={Megaphone}
              label="Start Campaign"
              description="Launch an outbound campaign"
              onClick={() => navigate("/home/campaigns")}
            />
            <QuickAction
              icon={BarChart3}
              label="View Analytics"
              description="See performance metrics"
              onClick={() => navigate("/home/analytics")}
            />
          </div>

          {/* Agents Summary */}
          {agents.length > 0 && (
            <div className="stat-card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Your Agents</h3>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>{agents.length} total</span>
              </div>
              <div className="space-y-2">
                {agents.slice(0, 4).map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => navigate(`/home/agents/${agent.id}`)}
                    className="flex items-center gap-3 w-full p-2 rounded-lg text-left transition-colors"
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-muted)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                      style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}>
                      {(agent.name || "A")[0].toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{agent.name}</p>
                    </div>
                    <ArrowUpRight size={12} style={{ color: "var(--text-muted)" }} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
