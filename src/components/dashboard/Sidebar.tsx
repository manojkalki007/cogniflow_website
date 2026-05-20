"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Phone,
  Radio,
  Bot,
  Megaphone,
  BarChart3,
  Wrench,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Zap,
} from "lucide-react";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/calls", label: "Live Calls", icon: Radio, live: true },
  { href: "/dashboard/telephony", label: "Telephony", icon: Phone },
  { href: "/dashboard/agents", label: "Agents", icon: Bot },
  { href: "/dashboard/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/setup", label: "Setup", icon: Wrench },
];

export default function Sidebar({ onSignOut }: { onSignOut: () => void }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  return (
    <aside
      className="fixed left-0 top-0 bottom-0 z-40 flex flex-col border-r transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
      style={{
        width: collapsed ? 72 : 240,
        background: "var(--d-surface)",
        borderColor: "var(--d-border)",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b" style={{ borderColor: "var(--d-border)" }}>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "var(--d-primary-muted)", border: "1px solid rgba(0,221,179,0.2)" }}
        >
          <Zap size={16} style={{ color: "var(--d-primary)" }} />
        </div>
        {!collapsed && (
          <span className="text-[15px] font-semibold tracking-tight" style={{ color: "var(--d-text)" }}>
            Cogniflow
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group relative ${
                active ? "dash-nav-active" : ""
              }`}
              style={{
                color: active ? "var(--d-text)" : "var(--d-text-2)",
                background: active ? "var(--d-primary-muted)" : "transparent",
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.background = "var(--d-surface-2)";
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.background = "transparent";
              }}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span>{item.label}</span>}
              {item.live && (
                <span className="ml-auto flex items-center gap-1.5">
                  {!collapsed && (
                    <span
                      className="text-[11px] font-bold"
                      style={{ color: "var(--d-accent)", fontFamily: "var(--d-mono)" }}
                    >
                      LIVE
                    </span>
                  )}
                  <span
                    className="w-2 h-2 rounded-full dash-live-dot"
                    style={{ background: "var(--d-accent)" }}
                  />
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-4 space-y-2">
        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
          style={{ color: "var(--d-text-3)" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--d-error)";
            e.currentTarget.style.background = "rgba(248,113,113,0.08)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--d-text-3)";
            e.currentTarget.style.background = "transparent";
          }}
        >
          <LogOut size={18} />
          {!collapsed && <span>Sign Out</span>}
        </button>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center py-2 rounded-lg transition-colors"
          style={{ color: "var(--d-text-3)", border: "1px solid var(--d-border)" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--d-surface-2)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </aside>
  );
}
