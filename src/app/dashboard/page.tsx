"use client";

import { motion } from "framer-motion";
import {
  Phone,
  Users,
  Clock,
  TrendingUp,
  PhoneCall,
  Hash,
  Settings,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import Link from "next/link";

const stats = [
  {
    label: "Total Calls Today",
    value: "1,247",
    change: "+12%",
    up: true,
    icon: Phone,
  },
  {
    label: "Active Now",
    value: "23",
    change: "+3",
    up: true,
    icon: Users,
    live: true,
  },
  {
    label: "Avg Duration",
    value: "3:42",
    change: "-8s",
    up: true,
    icon: Clock,
  },
  {
    label: "Success Rate",
    value: "94.2%",
    change: "+1.8%",
    up: true,
    icon: TrendingUp,
  },
];

const hourlyData = [
  { hour: 0, today: 12, yesterday: 8 },
  { hour: 1, today: 8, yesterday: 5 },
  { hour: 2, today: 5, yesterday: 3 },
  { hour: 3, today: 3, yesterday: 4 },
  { hour: 4, today: 4, yesterday: 6 },
  { hour: 5, today: 10, yesterday: 9 },
  { hour: 6, today: 28, yesterday: 22 },
  { hour: 7, today: 52, yesterday: 48 },
  { hour: 8, today: 78, yesterday: 65 },
  { hour: 9, today: 95, yesterday: 88 },
  { hour: 10, today: 100, yesterday: 92 },
  { hour: 11, today: 88, yesterday: 85 },
  { hour: 12, today: 72, yesterday: 70 },
  { hour: 13, today: 82, yesterday: 78 },
  { hour: 14, today: 90, yesterday: 82 },
  { hour: 15, today: 85, yesterday: 80 },
  { hour: 16, today: 75, yesterday: 72 },
  { hour: 17, today: 60, yesterday: 58 },
  { hour: 18, today: 45, yesterday: 42 },
  { hour: 19, today: 35, yesterday: 30 },
  { hour: 20, today: 25, yesterday: 22 },
  { hour: 21, today: 18, yesterday: 15 },
  { hour: 22, today: 14, yesterday: 12 },
  { hour: 23, today: 10, yesterday: 8 },
];

const providers = [
  { name: "Twilio", status: "ok" as const, latency: "42ms" },
  { name: "Exotel", status: "ok" as const, latency: "68ms" },
  { name: "Vobiz", status: "ok" as const, latency: "55ms" },
  { name: "MCube", status: "degraded" as const, latency: "320ms" },
  { name: "SIP Trunk", status: "offline" as const, latency: "---" },
];

const recentCalls = [
  { caller: "+91 98765 43210", duration: "4:12", provider: "Twilio", status: "completed" as const, time: "2m ago" },
  { caller: "+91 87654 32109", duration: "1:38", provider: "Exotel", status: "completed" as const, time: "5m ago" },
  { caller: "+1 (555) 012-3456", duration: "6:05", provider: "Twilio", status: "completed" as const, time: "8m ago" },
  { caller: "+91 76543 21098", duration: "0:45", provider: "Vobiz", status: "failed" as const, time: "12m ago" },
  { caller: "+91 65432 10987", duration: "3:22", provider: "Exotel", status: "completed" as const, time: "15m ago" },
  { caller: "+44 7700 900123", duration: "2:58", provider: "Twilio", status: "no-answer" as const, time: "18m ago" },
];

const quickActions = [
  { label: "Make Test Call", icon: PhoneCall, href: "/dashboard/calls" },
  { label: "Buy Number", icon: Hash, href: "/dashboard/telephony" },
  { label: "Setup Provider", icon: Settings, href: "/dashboard/setup" },
  { label: "View Analytics", icon: BarChart3, href: "/dashboard/calls" },
];

const statusDotColor: Record<string, string> = {
  ok: "var(--d-success)",
  degraded: "var(--d-warning)",
  offline: "var(--d-error)",
};

const callStatusBadge: Record<string, { cls: string; label: string }> = {
  completed: { cls: "dash-badge dash-badge-ok", label: "Completed" },
  failed: { cls: "dash-badge dash-badge-err", label: "Failed" },
  "no-answer": { cls: "dash-badge dash-badge-warn", label: "No Answer" },
};

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const } },
};

const maxVolume = Math.max(...hourlyData.map((d) => d.today));

export default function DashboardPage() {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <motion.div variants={container} initial="hidden" animate="show">
      {/* Header */}
      <motion.div variants={item} className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--d-text)" }}>
            Mission Control
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--d-text-3)" }}>
            {dateStr}
          </p>
        </div>
        <div className="dash-badge dash-badge-ok">
          <span
            className="w-2 h-2 rounded-full dash-live-dot"
            style={{ background: "var(--d-success)" }}
          />
          System Status: Online
        </div>
      </motion.div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((s, i) => {
          const Icon = s.icon;
          const isLive = s.live;
          return (
            <motion.div
              key={s.label}
              variants={item}
              className={isLive ? "dash-card-glow" : "dash-card"}
              style={
                isLive
                  ? {
                      borderColor: "rgba(255, 139, 62, 0.4)",
                      boxShadow: "0 0 24px rgba(255, 139, 62, 0.08)",
                    }
                  : undefined
              }
            >
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{
                      background: isLive ? "var(--d-accent-muted)" : "var(--d-primary-muted)",
                    }}
                  >
                    <Icon
                      size={18}
                      style={{ color: isLive ? "var(--d-accent)" : "var(--d-primary)" }}
                    />
                  </div>
                  {isLive && (
                    <span
                      className="w-2.5 h-2.5 rounded-full dash-live-dot"
                      style={{ background: "var(--d-accent)" }}
                    />
                  )}
                </div>
                <p className="text-xs font-medium mb-1" style={{ color: "var(--d-text-2)" }}>
                  {s.label}
                </p>
                <div className="flex items-end justify-between">
                  <span
                    className="dash-stat text-3xl font-bold"
                    style={{ color: isLive ? "var(--d-accent)" : "var(--d-text)" }}
                  >
                    {s.value}
                  </span>
                  <span
                    className="flex items-center gap-0.5 text-xs font-medium"
                    style={{ color: s.up ? "var(--d-success)" : "var(--d-error)" }}
                  >
                    {s.up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                    {s.change}
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Middle Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Call Volume Chart */}
        <motion.div variants={item} className="dash-card lg:col-span-2">
          <div className="p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold" style={{ color: "var(--d-text)" }}>
                Call Volume
              </h2>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-1.5 rounded-sm"
                    style={{ background: "var(--d-primary)" }}
                  />
                  <span className="text-xs" style={{ color: "var(--d-text-3)" }}>
                    Today
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-1.5 rounded-sm"
                    style={{ background: "var(--d-border-bright)" }}
                  />
                  <span className="text-xs" style={{ color: "var(--d-text-3)" }}>
                    Yesterday
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-end gap-[3px] h-36">
              {hourlyData.map((d) => (
                <div key={d.hour} className="flex-1 flex items-end gap-[1px] h-full">
                  <div
                    className="flex-1 rounded-t-sm transition-all duration-300"
                    style={{
                      height: `${(d.yesterday / maxVolume) * 100}%`,
                      background: "var(--d-border-bright)",
                      minHeight: 2,
                    }}
                  />
                  <div
                    className="flex-1 rounded-t-sm transition-all duration-300"
                    style={{
                      height: `${(d.today / maxVolume) * 100}%`,
                      background: "var(--d-primary)",
                      minHeight: 2,
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2 px-0.5">
              {[0, 6, 12, 18, 23].map((h) => (
                <span
                  key={h}
                  className="text-[10px]"
                  style={{ color: "var(--d-text-3)", fontFamily: "var(--d-mono)" }}
                >
                  {h.toString().padStart(2, "0")}
                </span>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Provider Health */}
        <motion.div variants={item} className="dash-card">
          <div className="p-5">
            <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--d-text)" }}>
              Provider Health
            </h2>
            <div className="flex flex-col gap-2.5">
              {providers.map((p) => (
                <div
                  key={p.name}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg"
                  style={{ background: "var(--d-surface-2)" }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: statusDotColor[p.status] }}
                    />
                    <span className="text-sm font-medium" style={{ color: "var(--d-text)" }}>
                      {p.name}
                    </span>
                  </div>
                  <span
                    className="dash-stat text-xs"
                    style={{
                      color:
                        p.status === "ok"
                          ? "var(--d-text-2)"
                          : p.status === "degraded"
                            ? "var(--d-warning)"
                            : "var(--d-error)",
                    }}
                  >
                    {p.latency}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Calls */}
        <motion.div variants={item} className="dash-card lg:col-span-2 overflow-hidden">
          <div className="p-5 pb-0">
            <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--d-text)" }}>
              Recent Calls
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Caller</th>
                  <th>Duration</th>
                  <th>Provider</th>
                  <th>Status</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {recentCalls.map((c, i) => {
                  const badge = callStatusBadge[c.status];
                  return (
                    <tr key={i}>
                      <td>
                        <span
                          className="dash-stat text-sm"
                          style={{ color: "var(--d-text)" }}
                        >
                          {c.caller}
                        </span>
                      </td>
                      <td>
                        <span className="dash-stat text-sm" style={{ color: "var(--d-text-2)" }}>
                          {c.duration}
                        </span>
                      </td>
                      <td>
                        <span className="text-sm" style={{ color: "var(--d-text-2)" }}>
                          {c.provider}
                        </span>
                      </td>
                      <td>
                        <span className={badge.cls}>{badge.label}</span>
                      </td>
                      <td>
                        <span className="text-sm" style={{ color: "var(--d-text-3)" }}>
                          {c.time}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div variants={item} className="dash-card">
          <div className="p-5">
            <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--d-text)" }}>
              Quick Actions
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((a) => {
                const Icon = a.icon;
                return (
                  <Link
                    key={a.label}
                    href={a.href}
                    className="dash-card-glow flex flex-col items-center justify-center gap-2.5 p-4 text-center"
                    style={{ cursor: "pointer" }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: "var(--d-primary-muted)" }}
                    >
                      <Icon size={20} style={{ color: "var(--d-primary)" }} />
                    </div>
                    <span
                      className="text-xs font-medium leading-tight"
                      style={{ color: "var(--d-text-2)" }}
                    >
                      {a.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
