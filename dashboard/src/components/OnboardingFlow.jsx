import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  Bot, Phone, Zap, CheckCircle2, ArrowRight,
  ChevronRight, X, Sparkles,
} from "lucide-react";

const STEPS = [
  {
    id: "agent",
    title: "Create Your First Agent",
    description: "Set up an AI voice agent with a personality, voice, and tools",
    icon: Bot,
    action: "Create Agent",
    path: "/home/agents",
  },
  {
    id: "number",
    title: "Connect a Phone Number",
    description: "Link a Twilio or Exotel number so your agent can take calls",
    icon: Phone,
    action: "Add Number",
    path: "/home/phone-numbers",
  },
  {
    id: "test",
    title: "Make a Test Call",
    description: "Call your agent and hear it in action",
    icon: Zap,
    action: "Test Call",
    path: "/home/phone-numbers",
  },
];

export default function OnboardingFlow() {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem("cogniflow_onboarding_dismissed") === "true"
  );

  const { data: agentsData } = useQuery({
    queryKey: ["onboarding-agents"],
    queryFn: () => api.getAgents(),
    staleTime: 30_000,
  });

  const { data: numbersData } = useQuery({
    queryKey: ["onboarding-numbers"],
    queryFn: () => api.getPhoneNumbers(),
    staleTime: 30_000,
  });

  const { data: callsData } = useQuery({
    queryKey: ["onboarding-calls"],
    queryFn: () => api.getCalls({ limit: 1 }),
    staleTime: 30_000,
  });

  const agents = agentsData?.agents || [];
  const numbers = numbersData?.numbers || numbersData?.phone_numbers || [];
  const calls = callsData?.calls || [];

  const completedSteps = {
    agent: agents.length > 0,
    number: numbers.length > 0,
    test: calls.length > 0,
  };

  const allDone = completedSteps.agent && completedSteps.number && completedSteps.test;

  useEffect(() => {
    if (allDone && !dismissed) {
      localStorage.setItem("cogniflow_onboarding_dismissed", "true");
    }
  }, [allDone, dismissed]);

  if (dismissed || allDone) return null;

  const completedCount = Object.values(completedSteps).filter(Boolean).length;

  return (
    <div
      className="rounded-2xl p-6 mb-6 relative overflow-hidden animate-fade-in-up"
      style={{
        background: "linear-gradient(135deg, rgba(0,188,212,0.06) 0%, rgba(99,102,241,0.04) 100%)",
        border: "1px solid rgba(0,188,212,0.15)",
      }}
    >
      <button
        onClick={() => {
          setDismissed(true);
          localStorage.setItem("cogniflow_onboarding_dismissed", "true");
        }}
        className="absolute top-4 right-4 p-1 rounded-lg transition-colors"
        style={{ color: "var(--text-muted)" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
      >
        <X size={16} />
      </button>

      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: "rgba(0,188,212,0.1)" }}>
          <Sparkles size={20} style={{ color: "var(--accent)" }} />
        </div>
        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            Get Started with Cogniflow
          </h2>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {completedCount} of {STEPS.length} steps completed
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 rounded-full mb-5" style={{ background: "var(--bg-muted)" }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${(completedCount / STEPS.length) * 100}%`, background: "var(--accent)" }}
        />
      </div>

      {/* Steps */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {STEPS.map((step, i) => {
          const done = completedSteps[step.id];
          const Icon = step.icon;
          return (
            <button
              key={step.id}
              onClick={() => !done && navigate(step.path)}
              disabled={done}
              className="flex items-start gap-3 p-4 rounded-xl text-left transition-all"
              style={{
                background: done ? "rgba(16,185,129,0.05)" : "var(--surface)",
                border: `1px solid ${done ? "rgba(16,185,129,0.2)" : "var(--border)"}`,
                opacity: done ? 0.7 : 1,
                cursor: done ? "default" : "pointer",
              }}
              onMouseEnter={(e) => !done && (e.currentTarget.style.borderColor = "var(--accent)")}
              onMouseLeave={(e) => !done && (e.currentTarget.style.borderColor = "var(--border)")}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: done ? "rgba(16,185,129,0.1)" : "var(--accent-subtle)" }}>
                {done ? (
                  <CheckCircle2 size={16} className="text-emerald-400" />
                ) : (
                  <Icon size={16} style={{ color: "var(--accent)" }} />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium" style={{ color: done ? "var(--text-muted)" : "var(--text-primary)" }}>
                  {step.title}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {done ? "Completed" : step.description}
                </p>
                {!done && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium mt-2" style={{ color: "var(--accent)" }}>
                    {step.action} <ArrowRight size={10} />
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
