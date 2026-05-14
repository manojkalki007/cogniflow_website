import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { setTenantId } from "../lib/api";
import {
  Phone, Mail, Lock, Eye, EyeOff, ArrowRight,
  Zap, Shield, Globe,
} from "lucide-react";

const FEATURES = [
  { icon: Zap, text: "Sub-600ms voice response latency", color: "#F59E0B" },
  { icon: Shield, text: "Enterprise-grade compliance & DNC", color: "#10B981" },
  { icon: Globe, text: "10+ Indian & European languages", color: "#3B82F6" },
];

function AbstractWaves() {
  return (
    <svg
      className="absolute bottom-0 left-0 w-full"
      viewBox="0 0 1920 320"
      preserveAspectRatio="none"
      style={{ height: "45%" }}
    >
      <defs>
        <linearGradient id="wave1-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(0,188,212,0.12)" />
          <stop offset="50%" stopColor="rgba(59,130,246,0.08)" />
          <stop offset="100%" stopColor="rgba(139,92,246,0.1)" />
        </linearGradient>
        <linearGradient id="wave2-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(34,211,238,0.08)" />
          <stop offset="50%" stopColor="rgba(139,92,246,0.06)" />
          <stop offset="100%" stopColor="rgba(16,185,129,0.08)" />
        </linearGradient>
        <linearGradient id="wave3-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(0,188,212,0.05)" />
          <stop offset="50%" stopColor="rgba(59,130,246,0.04)" />
          <stop offset="100%" stopColor="rgba(139,92,246,0.06)" />
        </linearGradient>
      </defs>
      <path
        fill="url(#wave1-grad)"
        style={{ animation: "waveFlow 12s ease-in-out infinite" }}
        d="M0,160 C320,220 640,100 960,180 C1280,260 1600,120 1920,160 L1920,320 L0,320 Z"
      />
      <path
        fill="url(#wave2-grad)"
        style={{ animation: "waveFlow2 15s ease-in-out infinite" }}
        d="M0,200 C320,140 640,260 960,160 C1280,220 1600,140 1920,200 L1920,320 L0,320 Z"
      />
      <path
        fill="url(#wave3-grad)"
        style={{ animation: "waveFlow3 18s ease-in-out infinite" }}
        d="M0,240 C320,180 640,280 960,200 C1280,260 1600,180 1920,240 L1920,320 L0,320 Z"
      />
    </svg>
  );
}

function GridPattern() {
  return (
    <div
      className="absolute inset-0 opacity-[0.02]"
      style={{
        backgroundImage:
          "linear-gradient(rgba(255,255,255,.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.2) 1px, transparent 1px)",
        backgroundSize: "80px 80px",
      }}
    />
  );
}

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [orgId, setOrgId] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
    document.documentElement.classList.add("dark");
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    if (orgId.trim()) setTenantId(orgId.trim());
    await new Promise((r) => setTimeout(r, 600));
    navigate("/dashboard");
  };

  const stagger = (i) => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? "translateY(0)" : "translateY(20px)",
    transition: `all 0.6s cubic-bezier(0.4, 0, 0.2, 1) ${200 + i * 80}ms`,
  });

  return (
    <div className="min-h-screen flex relative overflow-hidden login-wave-bg">
      {/* Background layers */}
      <div className="login-orb login-orb-1" />
      <div className="login-orb login-orb-2" />
      <div className="login-orb login-orb-3" />
      <div className="login-orb login-orb-4" />
      <AbstractWaves />
      <GridPattern />

      {/* ──── Left: Brand Panel ──── */}
      <div className="hidden lg:flex lg:w-[50%] relative items-center justify-center z-10">
        <div className="relative z-10 px-14 xl:px-20 max-w-2xl">
          <div style={stagger(0)}>
            {/* Logo */}
            <div className="flex items-center gap-3.5 mb-14">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg, rgba(0,188,212,0.9), rgba(0,151,167,0.9))",
                  boxShadow: "0 8px 24px rgba(0,188,212,0.3), 0 0 1px rgba(255,255,255,0.2) inset",
                  border: "1px solid rgba(34,211,238,0.2)",
                }}
              >
                <Phone size={21} className="text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  Cogniflow
                </h2>
                <p className="text-[11px] text-slate-500 font-medium tracking-wide uppercase">
                  AI Voice Agent Platform
                </p>
              </div>
            </div>

            {/* Headline */}
            <h1 className="text-[2.75rem] font-extrabold text-white leading-[1.12] tracking-tight mb-5">
              Intelligent Voice
              <br />
              Agents That{" "}
              <span
                style={{
                  background: "linear-gradient(135deg, #67E8F9, #22D3EE, #0097A7)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Convert.
              </span>
            </h1>
            <p className="text-slate-400 text-lg leading-relaxed mb-14 max-w-lg">
              Deploy AI calling agents that handle inbound & outbound
              conversations with human-like precision across any language.
            </p>

            {/* Feature Pills */}
            <div className="space-y-4">
              {FEATURES.map(({ icon: Icon, text, color }, i) => (
                <div
                  key={text}
                  className="flex items-center gap-3.5"
                  style={stagger(i + 2)}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{
                      background: `${color}12`,
                      border: `1px solid ${color}18`,
                      boxShadow: `0 0 20px ${color}08`,
                    }}
                  >
                    <Icon size={16} style={{ color }} />
                  </div>
                  <span className="text-slate-300 text-[15px]">{text}</span>
                </div>
              ))}
            </div>

            {/* Social proof */}
            <div
              className="mt-16 pt-8"
              style={{
                borderTop: "1px solid rgba(255,255,255,0.06)",
                ...stagger(6),
              }}
            >
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2.5">
                  {["#3B82F6", "#10B981", "#F59E0B", "#EF4444"].map((bg, i) => (
                    <div
                      key={i}
                      className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-[10px] font-bold text-white"
                      style={{
                        background: bg,
                        borderColor: "rgba(5,8,16,0.8)",
                      }}
                    >
                      {["AK", "SP", "RJ", "MV"][i]}
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-sm text-white font-medium">
                    Trusted by 200+ businesses
                  </p>
                  <p className="text-xs text-slate-500">
                    across India & Europe
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ──── Right: Login Form (Liquid Glass Card) ──── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 z-10">
        <div
          className="w-full max-w-[420px] login-glass-card rounded-3xl p-8 sm:p-10"
          style={stagger(1)}
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, rgba(0,188,212,0.9), rgba(0,151,167,0.9))",
                border: "1px solid rgba(34,211,238,0.2)",
              }}
            >
              <Phone size={18} className="text-white" />
            </div>
            <span className="text-xl font-bold text-white">Cogniflow</span>
          </div>

          <h2
            className="text-[1.65rem] font-bold tracking-tight mb-1.5 text-white"
            style={stagger(2)}
          >
            Welcome back
          </h2>
          <p
            className="text-sm mb-8 text-slate-400"
            style={stagger(3)}
          >
            Sign in to access your voice agent dashboard
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div style={stagger(4)}>
              <label className="block text-xs font-medium mb-1.5 text-slate-400">
                Email address
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="login-glass-input w-full pl-11 pr-4 py-3 rounded-xl text-sm"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div style={stagger(5)}>
              <label className="block text-xs font-medium mb-1.5 text-slate-400">
                Password
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
                />
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="login-glass-input w-full pl-11 pr-12 py-3 rounded-xl text-sm"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-0.5 rounded cursor-pointer text-slate-500 hover:text-slate-300 transition-colors"
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Org ID */}
            <div style={stagger(6)}>
              <label className="block text-xs font-medium mb-1.5 text-slate-400">
                Organization ID{" "}
                <span className="text-slate-600 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
                placeholder="org_xxxxxxxx"
                className="login-glass-input w-full px-4 py-3 rounded-xl text-sm font-mono"
                autoComplete="organization"
              />
            </div>

            {/* Remember / Forgot */}
            <div className="flex items-center justify-between pt-1" style={stagger(7)}>
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="w-3.5 h-3.5 rounded accent-[#22D3EE]"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    borderColor: "rgba(255,255,255,0.1)",
                  }}
                />
                <span className="text-xs text-slate-400">Remember me</span>
              </label>
              <button
                type="button"
                className="text-xs font-medium cursor-pointer text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                Forgot password?
              </button>
            </div>

            {/* Submit */}
            <div style={stagger(8)}>
              <button
                type="submit"
                disabled={loading}
                className="login-glass-btn w-full py-3.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    Sign in <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-7" style={stagger(9)}>
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
            <span className="text-[11px] text-slate-500">or continue with</span>
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
          </div>

          {/* Google */}
          <div style={stagger(10)}>
            <button className="login-social-glass w-full py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-3 cursor-pointer">
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path
                  d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
                  fill="#4285F4"
                />
                <path
                  d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
                  fill="#34A853"
                />
                <path
                  d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
                  fill="#FBBC05"
                />
                <path
                  d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 2.58 9 2.58Z"
                  fill="#EA4335"
                />
              </svg>
              <span className="text-slate-300">Continue with Google</span>
            </button>
          </div>

          <p className="text-center text-xs mt-8 text-slate-500" style={stagger(11)}>
            Don&apos;t have an account?{" "}
            <button className="font-semibold cursor-pointer text-cyan-400 hover:text-cyan-300 transition-colors">
              Get started free
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
