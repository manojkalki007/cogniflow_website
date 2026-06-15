import { useNavigate } from "react-router-dom";
import {
  Phone, Bot, Zap, Shield, Globe, BarChart3,
  ArrowRight, CheckCircle2, Play, Star,
  MessageSquare, Mail, Calendar, Users,
} from "lucide-react";

const FEATURES = [
  {
    icon: Bot,
    title: "AI Voice Agents",
    description: "Create intelligent phone agents that handle calls 24/7 with natural conversation",
  },
  {
    icon: Zap,
    title: "Sub-Second Latency",
    description: "Lightning-fast responses powered by Groq LLMs and Smallest AI TTS",
  },
  {
    icon: Globe,
    title: "15+ Languages",
    description: "Support for English, Hindi, Tamil, Telugu, and 12 more Indian languages",
  },
  {
    icon: MessageSquare,
    title: "WhatsApp Integration",
    description: "Connect WhatsApp for multi-channel customer engagement",
  },
  {
    icon: Calendar,
    title: "Smart Scheduling",
    description: "Auto-book appointments, check availability, and send confirmations",
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    description: "SOC2-ready with encrypted calls, tenant isolation, and audit logs",
  },
];

const PRICING = [
  {
    name: "Starter",
    price: "Free",
    period: "500 min/month",
    features: ["1 AI Agent", "500 call minutes", "Basic analytics", "Email support"],
    cta: "Get Started",
    highlighted: false,
  },
  {
    name: "Professional",
    price: "₹4,999",
    period: "/month",
    features: ["5 AI Agents", "5,000 call minutes", "Advanced analytics", "WhatsApp + Email", "Priority support", "Custom voices"],
    cta: "Start Free Trial",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "contact us",
    features: ["Unlimited agents", "Unlimited minutes", "Dedicated support", "SLA guarantee", "Custom integrations", "On-premise option"],
    cta: "Contact Sales",
    highlighted: false,
  },
];

const STATS = [
  { value: "500K+", label: "Calls Handled" },
  { value: "<400ms", label: "Avg Latency" },
  { value: "99.9%", label: "Uptime" },
  { value: "15+", label: "Languages" },
];

function FeatureCard({ icon: Icon, title, description }) {
  return (
    <div
      className="p-6 rounded-2xl transition-all duration-300 group"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "rgba(0,188,212,0.2)";
        e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,188,212,0.08)";
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
        style={{ background: "rgba(0,188,212,0.08)", border: "1px solid rgba(0,188,212,0.15)" }}>
        <Icon size={22} style={{ color: "#00BCD4" }} />
      </div>
      <h3 className="text-base font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm leading-relaxed" style={{ color: "#94A3B8" }}>{description}</p>
    </div>
  );
}

function PricingCard({ plan, onAction }) {
  return (
    <div
      className="p-6 rounded-2xl relative"
      style={{
        background: plan.highlighted ? "rgba(0,188,212,0.05)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${plan.highlighted ? "rgba(0,188,212,0.3)" : "rgba(255,255,255,0.06)"}`,
        boxShadow: plan.highlighted ? "0 8px 40px rgba(0,188,212,0.1)" : "none",
      }}
    >
      {plan.highlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[11px] font-semibold"
          style={{ background: "linear-gradient(135deg, #0891B2, #0E7490)", color: "white" }}>
          Most Popular
        </div>
      )}
      <h3 className="text-lg font-semibold text-white mb-1">{plan.name}</h3>
      <div className="flex items-baseline gap-1 mb-1">
        <span className="text-3xl font-bold text-white">{plan.price}</span>
        <span className="text-sm" style={{ color: "#64748B" }}>{plan.period}</span>
      </div>
      <ul className="space-y-2.5 my-6">
        {plan.features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-sm" style={{ color: "#CBD5E1" }}>
            <CheckCircle2 size={14} style={{ color: "#10B981" }} />
            {f}
          </li>
        ))}
      </ul>
      <button
        onClick={onAction}
        className="w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200"
        style={{
          background: plan.highlighted ? "linear-gradient(135deg, #0891B2, #0E7490)" : "rgba(255,255,255,0.05)",
          color: "white",
          border: plan.highlighted ? "none" : "1px solid rgba(255,255,255,0.1)",
          boxShadow: plan.highlighted ? "0 4px 16px rgba(0,188,212,0.25)" : "none",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
      >
        {plan.cta}
      </button>
    </div>
  );
}

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen" style={{ background: "#050A18" }}>
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 md:px-12 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="flex items-center gap-2">
          <img src="/cogniflow-logo.png" alt="Cogniflow" className="h-8" />
          <span className="text-white font-bold text-lg tracking-wide">COGNIFLOW</span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm transition-colors" style={{ color: "#94A3B8" }} onMouseEnter={(e) => (e.target.style.color = "white")} onMouseLeave={(e) => (e.target.style.color = "#94A3B8")}>Features</a>
          <a href="#pricing" className="text-sm transition-colors" style={{ color: "#94A3B8" }} onMouseEnter={(e) => (e.target.style.color = "white")} onMouseLeave={(e) => (e.target.style.color = "#94A3B8")}>Pricing</a>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/login")}
            className="text-sm font-medium px-4 py-2 rounded-xl transition-colors"
            style={{ color: "#CBD5E1" }}
          >
            Log in
          </button>
          <button
            onClick={() => navigate("/login?mode=signup")}
            className="text-sm font-semibold px-5 py-2 rounded-xl text-white transition-all"
            style={{
              background: "linear-gradient(135deg, #0891B2, #0E7490)",
              boxShadow: "0 4px 16px rgba(0,188,212,0.25)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 6px 24px rgba(0,188,212,0.35)")}
            onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,188,212,0.25)")}
          >
            Get Started
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative px-6 md:px-12 pt-20 pb-24 text-center max-w-4xl mx-auto">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute w-[600px] h-[600px] rounded-full -top-40 left-1/2 -translate-x-1/2"
            style={{ background: "radial-gradient(circle, rgba(0,188,212,0.08) 0%, transparent 70%)", filter: "blur(60px)" }} />
        </div>
        <div className="relative">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6 text-xs font-medium"
            style={{ background: "rgba(0,188,212,0.08)", color: "#22D3EE", border: "1px solid rgba(0,188,212,0.15)" }}>
            <Zap size={12} /> Powered by Groq + Smallest AI
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight tracking-tight mb-6">
            AI Voice Agents<br />
            <span style={{
              background: "linear-gradient(135deg, #22D3EE 0%, #06B6D4 40%, #6366F1 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>
              That Actually Work
            </span>
          </h1>
          <p className="text-lg md:text-xl max-w-2xl mx-auto mb-10" style={{ color: "#94A3B8", lineHeight: 1.7 }}>
            Build AI phone agents that handle calls, book appointments, and close deals.
            Sub-second latency. 15+ languages. No code required.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate("/login?mode=signup")}
              className="flex items-center gap-2 px-8 py-3.5 rounded-xl text-white font-semibold text-base transition-all"
              style={{
                background: "linear-gradient(135deg, #0891B2, #0E7490)",
                boxShadow: "0 8px 32px rgba(0,188,212,0.3)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
            >
              Start Free <ArrowRight size={16} />
            </button>
            <button
              className="flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-medium transition-colors"
              style={{ color: "#CBD5E1", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <Play size={14} /> Watch Demo
            </button>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="px-6 md:px-12 py-12" style={{ borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-2xl md:text-3xl font-bold mb-1"
                style={{ background: "linear-gradient(135deg, #E2E8F0, #94A3B8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                {s.value}
              </div>
              <div className="text-xs" style={{ color: "#64748B" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-6 md:px-12 py-20 max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Everything You Need</h2>
          <p className="text-base max-w-xl mx-auto" style={{ color: "#94A3B8" }}>
            A complete platform for building, deploying, and managing AI voice agents
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <FeatureCard key={f.title} {...f} />
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 md:px-12 py-20 max-w-4xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">How It Works</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { step: "1", title: "Create Agent", desc: "Define personality, choose a voice, and configure tools" },
            { step: "2", title: "Connect Number", desc: "Link your Twilio or Exotel phone number" },
            { step: "3", title: "Go Live", desc: "Your agent starts handling calls immediately" },
          ].map((s) => (
            <div key={s.step} className="text-center">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-lg font-bold"
                style={{ background: "rgba(0,188,212,0.1)", color: "#22D3EE", border: "1px solid rgba(0,188,212,0.2)" }}>
                {s.step}
              </div>
              <h3 className="text-base font-semibold text-white mb-2">{s.title}</h3>
              <p className="text-sm" style={{ color: "#94A3B8" }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-6 md:px-12 py-20 max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Simple Pricing</h2>
          <p className="text-base" style={{ color: "#94A3B8" }}>Start free, scale as you grow</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PRICING.map((p) => (
            <PricingCard key={p.name} plan={p} onAction={() => navigate("/login?mode=signup")} />
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 md:px-12 py-20 text-center">
        <div className="max-w-2xl mx-auto p-10 rounded-3xl"
          style={{ background: "rgba(0,188,212,0.04)", border: "1px solid rgba(0,188,212,0.15)" }}>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">Ready to Automate Your Calls?</h2>
          <p className="text-base mb-8" style={{ color: "#94A3B8" }}>
            Join businesses using Cogniflow to handle thousands of calls with AI
          </p>
          <button
            onClick={() => navigate("/login?mode=signup")}
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-white font-semibold text-base transition-all"
            style={{
              background: "linear-gradient(135deg, #0891B2, #0E7490)",
              boxShadow: "0 8px 32px rgba(0,188,212,0.3)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
          >
            Get Started Free <ArrowRight size={16} />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 md:px-12 py-8" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/cogniflow-logo.png" alt="Cogniflow" className="h-6" />
            <span className="text-sm font-semibold" style={{ color: "#64748B" }}>Cogniflow Automations</span>
          </div>
          <div className="flex items-center gap-6 text-xs" style={{ color: "#475569" }}>
            <span>&copy; {new Date().getFullYear()} Cogniflow Automations</span>
            <a href="mailto:support@cogniflowautomations.com" className="hover:text-white transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
