"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import CogniflowLogo from "@/components/CogniflowLogo";
import type { Session } from "@supabase/supabase-js";

export default function DashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabaseBrowser.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push("/login");
        return;
      }
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabaseBrowser.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push("/login");
        return;
      }
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, [router]);

  async function handleSignOut() {
    await supabaseBrowser.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "#0A0A0C" }}
      >
        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A0A0C" }}>
      {/* Top bar */}
      <header className="border-b border-white/[0.06] bg-black/40 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/">
            <CogniflowLogo width={130} />
          </a>
          <div className="flex items-center gap-4">
            <span className="text-sm text-white/50 hidden sm:block">
              {session?.user?.email}
            </span>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white/70 border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-6 py-16">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-10 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-[#0052CC]/10 border border-[#0052CC]/20 flex items-center justify-center">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#0052CC"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <h1
            className="text-3xl font-semibold text-white"
            style={{ fontFamily: "'Instrument Sans', sans-serif" }}
          >
            Welcome to Cogniflow
          </h1>
          <p className="mt-3 text-white/50 text-base leading-relaxed max-w-lg mx-auto">
            You are signed in as{" "}
            <span className="text-white/70 font-medium">{session?.user?.email}</span>.
            Your AI calling agent dashboard is being set up.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="/book-call"
              className="px-6 py-3 rounded-full bg-[#0052CC] text-white font-semibold text-sm hover:bg-[#003d99] transition-colors"
            >
              Book a Call with Our Team
            </a>
            <a
              href="/"
              className="px-6 py-3 rounded-full border border-white/[0.08] text-white/70 font-medium text-sm hover:bg-white/[0.04] transition-colors"
            >
              Back to Homepage
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
