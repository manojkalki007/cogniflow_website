"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import Sidebar from "@/components/dashboard/Sidebar";
import MobileNav from "@/components/dashboard/MobileNav";
import { Settings, LogOut, Bell } from "lucide-react";
import type { Session } from "@supabase/supabase-js";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSupabaseBrowser()
      .auth.getSession()
      .then(({ data: { session } }) => {
        if (!session) {
          router.push("/login");
          return;
        }
        setSession(session);
        setLoading(false);
      });

    const {
      data: { subscription },
    } = getSupabaseBrowser().auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push("/login");
        return;
      }
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, [router]);

  async function handleSignOut() {
    await getSupabaseBrowser().auth.signOut();
    router.push("/login");
  }

  const [profileOpen, setProfileOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    }
    if (profileOpen || bellOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [profileOpen, bellOpen]);

  if (loading) {
    return (
      <div className="dash min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "var(--d-primary-muted)", border: "1px solid rgba(0,221,179,0.2)" }}
          >
            <div
              className="w-5 h-5 border-2 rounded-full animate-spin"
              style={{ borderColor: "var(--d-border)", borderTopColor: "var(--d-primary)" }}
            />
          </div>
          <span className="text-sm" style={{ color: "var(--d-text-3)" }}>
            Loading mission control...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="dash dash-grid">
      <Sidebar onSignOut={handleSignOut} />
      <main className="ml-0 md:ml-[240px] min-h-screen transition-all duration-300">
        {/* Top bar */}
        <header
          className="sticky top-0 z-30 h-14 flex items-center justify-between px-4 md:px-8 border-b backdrop-blur-xl"
          style={{
            background: "rgba(6, 7, 11, 0.8)",
            borderColor: "var(--d-border)",
          }}
        >
          <MobileNav onSignOut={handleSignOut} />
          <div className="flex items-center gap-4">
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
              style={{ background: "var(--d-surface)", border: "1px solid var(--d-border)" }}
            >
              <div className="w-2 h-2 rounded-full" style={{ background: "var(--d-success)" }} />
              <span className="text-xs font-medium" style={{ color: "var(--d-text-2)" }}>
                System Online
              </span>
            </div>
            <div className="relative" ref={bellRef}>
              <button
                onClick={() => { setBellOpen(!bellOpen); setProfileOpen(false); }}
                aria-label="Notifications"
                className="h-8 w-8 rounded-lg flex items-center justify-center cursor-pointer transition-all relative"
                style={{
                  background: bellOpen ? "var(--d-surface-2)" : "transparent",
                  color: "var(--d-text-3)",
                }}
                onMouseEnter={(e) => {
                  if (!bellOpen) e.currentTarget.style.background = "var(--d-surface-2)";
                  e.currentTarget.style.color = "var(--d-text)";
                }}
                onMouseLeave={(e) => {
                  if (!bellOpen) e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--d-text-3)";
                }}
              >
                <Bell size={16} />
              </button>

              {bellOpen && (
                <div
                  className="absolute right-0 top-full mt-2 w-80 rounded-xl shadow-2xl border overflow-hidden"
                  style={{
                    background: "var(--d-surface)",
                    borderColor: "var(--d-border)",
                    boxShadow: "0 16px 48px rgba(0,0,0,0.4)",
                  }}
                >
                  <div
                    className="flex items-center justify-between px-4 py-3 border-b"
                    style={{ borderColor: "var(--d-border)" }}
                  >
                    <span className="text-sm font-semibold" style={{ color: "var(--d-text)" }}>
                      Notifications
                    </span>
                  </div>
                  <div className="flex flex-col items-center justify-center py-10 px-4">
                    <Bell size={28} style={{ color: "var(--d-text-3)", opacity: 0.4 }} />
                    <p className="text-sm mt-3" style={{ color: "var(--d-text-3)" }}>
                      No notifications yet
                    </p>
                    <p className="text-xs mt-1" style={{ color: "var(--d-text-3)", opacity: 0.6 }}>
                      You&apos;re all caught up
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="relative" ref={profileRef}>
              <button
                onClick={() => { setProfileOpen(!profileOpen); setBellOpen(false); }}
                aria-label="Profile menu"
                className="h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold cursor-pointer transition-all"
                style={{
                  background: profileOpen ? "var(--d-primary)" : "var(--d-primary-muted)",
                  color: profileOpen ? "#000" : "var(--d-primary)",
                  fontFamily: "var(--d-mono)",
                }}
              >
                {session?.user?.email?.[0]?.toUpperCase() || "U"}
              </button>

              {profileOpen && (
                <div
                  className="absolute right-0 top-full mt-2 w-64 rounded-xl py-2 shadow-2xl border"
                  style={{
                    background: "var(--d-surface)",
                    borderColor: "var(--d-border)",
                    boxShadow: "0 16px 48px rgba(0,0,0,0.4)",
                  }}
                >
                  <div className="px-4 py-3 border-b" style={{ borderColor: "var(--d-border)" }}>
                    <div className="flex items-center gap-3">
                      <div
                        className="h-9 w-9 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
                        style={{
                          background: "var(--d-primary-muted)",
                          color: "var(--d-primary)",
                          fontFamily: "var(--d-mono)",
                        }}
                      >
                        {session?.user?.email?.[0]?.toUpperCase() || "U"}
                      </div>
                      <div className="min-w-0">
                        <p
                          className="text-sm font-medium truncate"
                          style={{ color: "var(--d-text)" }}
                        >
                          {session?.user?.user_metadata?.full_name || "User"}
                        </p>
                        <p
                          className="text-xs truncate"
                          style={{ color: "var(--d-text-3)" }}
                        >
                          {session?.user?.email}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="py-1">
                    <Link
                      href="/dashboard/setup"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                      style={{ color: "var(--d-text-2)" }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "var(--d-surface-2)";
                        e.currentTarget.style.color = "var(--d-text)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "var(--d-text-2)";
                      }}
                    >
                      <Settings size={16} />
                      <span>Settings</span>
                    </Link>
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        handleSignOut();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                      style={{ color: "var(--d-text-2)" }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(248,113,113,0.08)";
                        e.currentTarget.style.color = "var(--d-error)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "var(--d-text-2)";
                      }}
                    >
                      <LogOut size={16} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
