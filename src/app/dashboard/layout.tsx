"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import Sidebar from "@/components/dashboard/Sidebar";
import MobileNav from "@/components/dashboard/MobileNav";
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
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold"
              style={{
                background: "var(--d-primary-muted)",
                color: "var(--d-primary)",
                fontFamily: "var(--d-mono)",
              }}
            >
              {session?.user?.email?.[0]?.toUpperCase() || "U"}
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
