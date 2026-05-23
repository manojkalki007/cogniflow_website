"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Menu,
  X,
  LayoutDashboard,
  Phone,
  Radio,
  Bot,
  Megaphone,
  BarChart3,
  Wrench,
  LogOut,
  Crown,
  Zap,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/calls", label: "Live Calls", icon: Radio },
  { href: "/dashboard/telephony", label: "Telephony", icon: Phone },
  { href: "/dashboard/agents", label: "Agents", icon: Bot },
  { href: "/dashboard/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/setup", label: "Setup", icon: Wrench },
  { href: "/dashboard/billing", label: "Upgrade Plan", icon: Crown },
];

export default function MobileNav({ onSignOut }: { onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="md:hidden inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg"
        style={{ color: "var(--d-text)" }}
        aria-label="Open navigation menu"
      >
        <Menu size={22} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          />
          <aside
            className="absolute left-0 top-0 bottom-0 w-72 flex flex-col"
            style={{ background: "var(--d-surface)", borderRight: "1px solid var(--d-border)" }}
          >
            <div
              className="flex items-center justify-between px-5 h-16 border-b"
              style={{ borderColor: "var(--d-border)" }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{
                    background: "var(--d-primary-muted)",
                    border: "1px solid rgba(0,221,179,0.2)",
                  }}
                >
                  <Zap size={16} style={{ color: "var(--d-primary)" }} />
                </div>
                <span className="font-semibold" style={{ color: "var(--d-text)" }}>
                  Cogniflow
                </span>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg"
                style={{ color: "var(--d-text-3)" }}
              >
                <X size={22} />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium"
                    style={{
                      color: active ? "var(--d-text)" : "var(--d-text-2)",
                      background: active ? "var(--d-primary-muted)" : "transparent",
                    }}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="p-3 border-t" style={{ borderColor: "var(--d-border)" }}>
              <button
                onClick={() => {
                  setOpen(false);
                  onSignOut();
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium"
                style={{ color: "var(--d-text-3)" }}
                aria-label="Sign out"
              >
                <LogOut size={18} />
                <span>Sign Out</span>
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
