import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { setTenantId } from "../lib/api";
import supabase from "../lib/supabase";
import {
  Mail, Lock, Eye, EyeOff, ArrowRight,
  Zap, BarChart3, Rocket, CheckCircle2, Loader2,
} from "lucide-react";

const FEATURES = [
  { icon: Rocket, text: "Deploy AI voice agents in minutes" },
  { icon: BarChart3, text: "Real-time analytics & call intelligence" },
  { icon: Zap, text: "Automate outbound campaigns at scale" },
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
  const [googleLoading, setGoogleLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [success, setSuccess] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [failCount, setFailCount] = useState(0);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
    document.documentElement.classList.add("dark");
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const validate = () => {
    const errs = {};
    if (!email.trim()) errs.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email)) errs.email = "Invalid email format";
    if (!resetMode) {
      if (!password) errs.password = "Password is required";
      else if (password.length < 6) errs.password = "Minimum 6 characters";
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    if (cooldown > 0) return;

    setLoading(true);
    setError("");

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      const newCount = failCount + 1;
      setFailCount(newCount);
      if (newCount >= 5) {
        setCooldown(30);
        setError("Too many attempts. Please wait 30 seconds.");
      } else {
        setFieldErrors({ password: "Incorrect email or password" });
      }
      setLoading(false);
      return;
    }

    if (orgId.trim()) setTenantId(orgId.trim());
    setSuccess(true);
    setFailCount(0);
    setTimeout(() => navigate("/dashboard"), 600);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      setFieldErrors({ email: "Enter a valid email to reset password" });
      return;
    }
    setLoading(true);
    setError("");
    setFieldErrors({});

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });

    setLoading(false);
    if (resetError) {
      setError(resetError.message);
    } else {
      setResetSent(true);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError("");
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
    });
    if (oauthError) {
      setError(oauthError.message);
      setGoogleLoading(false);
    }
  };

  const stagger = (i) => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? "translateY(0)" : "translateY(20px)",
    transition: `all 0.6s cubic-bezier(0.4, 0, 0.2, 1) ${200 + i * 80}ms`,
  });

  return (
    <div className="min-h-screen flex relative overflow-hidden login-wave-bg">
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
            <div className="mb-14">
              <img
                src="/cogniflow-logo.png"
                alt="Cogniflow"
                style={{ height: 48, width: "auto", objectFit: "contain" }}
              />
            </div>

            <h1 className="text-[2.75rem] font-extrabold text-white leading-[1.12] tracking-tight mb-5">
              Voice AI that works
              <br />
              while you{" "}
              <span
                style={{
                  background: "linear-gradient(135deg, #67E8F9, #22D3EE, #0097A7)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                sleep.
              </span>
            </h1>
            <p className="text-slate-400 text-lg leading-relaxed mb-14 max-w-lg">
              Build, deploy, and scale intelligent voice agents for your business.
            </p>

            <div className="space-y-4">
              {FEATURES.map(({ icon: Icon, text }, i) => (
                <div
                  key={text}
                  className="flex items-center gap-3.5"
                  style={stagger(i + 2)}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{
                      background: "rgba(34, 211, 238, 0.08)",
                      border: "1px solid rgba(34, 211, 238, 0.12)",
                    }}
                  >
                    <Icon size={16} className="text-cyan-400" />
                  </div>
                  <span className="text-slate-300 text-[15px]">{text}</span>
                </div>
              ))}
            </div>

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

      {/* ──── Right: Login Form ──── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 z-10">
        <div
          className={`w-full max-w-[420px] login-glass-card rounded-3xl p-8 sm:p-10 transition-all duration-500 ${success ? "scale-[0.98] opacity-80" : ""}`}
          style={stagger(1)}
        >
          {/* Success overlay */}
          {success && (
            <div className="absolute inset-0 z-20 flex items-center justify-center rounded-3xl" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
              <div className="text-center">
                <CheckCircle2 size={48} className="text-emerald-400 mx-auto mb-3" />
                <p className="text-white font-semibold text-lg">Welcome back!</p>
                <p className="text-slate-400 text-sm mt-1">Redirecting to dashboard...</p>
              </div>
            </div>
          )}

          {/* Mobile logo */}
          <div className="lg:hidden mb-10">
            <img
              src="/cogniflow-logo.png"
              alt="Cogniflow"
              style={{ height: 36, width: "auto", objectFit: "contain" }}
            />
          </div>

          <h2
            className="text-[1.65rem] font-bold tracking-tight mb-1.5 text-white"
            style={stagger(2)}
          >
            {resetMode ? "Reset password" : "Welcome back"}
          </h2>
          <p
            className="text-sm mb-8 text-slate-400"
            style={stagger(3)}
          >
            {resetMode
              ? "Enter your email and we'll send a reset link"
              : "Sign in to your Cogniflow account"}
          </p>

          {error && (
            <div
              className="mb-4 px-4 py-3 rounded-xl text-sm text-red-300 border border-red-500/20"
              style={{ background: "rgba(239,68,68,0.08)" }}
            >
              {error}
            </div>
          )}

          {resetSent ? (
            <div className="text-center py-8">
              <CheckCircle2 size={40} className="text-emerald-400 mx-auto mb-4" />
              <p className="text-white font-semibold mb-2">Check your email</p>
              <p className="text-slate-400 text-sm mb-6">
                We sent a password reset link to <span className="text-white">{email}</span>
              </p>
              <button
                onClick={() => { setResetMode(false); setResetSent(false); }}
                className="text-sm font-medium text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={resetMode ? handleForgotPassword : handleSubmit} className="space-y-4">
              {/* Email */}
              <div style={stagger(4)}>
                <label className="block text-xs font-medium mb-1.5 text-slate-400">
                  Email
                </label>
                <div className="relative">
                  <Mail
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setFieldErrors((p) => ({ ...p, email: undefined })); }}
                    placeholder="you@example.com"
                    className={`login-glass-input w-full pl-11 pr-4 py-3 rounded-xl text-sm ${fieldErrors.email ? "!border-red-500/50" : ""}`}
                    required
                    autoComplete="email"
                  />
                </div>
                {fieldErrors.email && (
                  <p className="text-xs text-red-400 mt-1.5 ml-1">{fieldErrors.email}</p>
                )}
              </div>

              {/* Password */}
              {!resetMode && (
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
                      onChange={(e) => { setPassword(e.target.value); setFieldErrors((p) => ({ ...p, password: undefined })); }}
                      placeholder="Enter your password"
                      className={`login-glass-input w-full pl-11 pr-12 py-3 rounded-xl text-sm ${fieldErrors.password ? "!border-red-500/50" : ""}`}
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
                  {fieldErrors.password && (
                    <p className="text-xs text-red-400 mt-1.5 ml-1">{fieldErrors.password}</p>
                  )}
                  {!fieldErrors.password && password.length > 0 && password.length < 6 && (
                    <p className="text-xs text-slate-500 mt-1.5 ml-1">Minimum 6 characters</p>
                  )}
                </div>
              )}

              {/* Org ID */}
              {!resetMode && (
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
              )}

              {/* Remember / Forgot */}
              {!resetMode && (
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
                    onClick={() => { setResetMode(true); setError(""); setFieldErrors({}); }}
                    className="text-xs font-medium cursor-pointer text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {/* Submit */}
              <div style={stagger(8)}>
                <button
                  type="submit"
                  disabled={loading || cooldown > 0}
                  className="login-glass-btn w-full py-3.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 cursor-pointer mt-2"
                >
                  {loading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : cooldown > 0 ? (
                    `Try again in ${cooldown}s`
                  ) : resetMode ? (
                    <>Send reset link <ArrowRight size={16} /></>
                  ) : (
                    <>Sign in <ArrowRight size={16} /></>
                  )}
                </button>
              </div>

              {resetMode && (
                <div className="text-center" style={stagger(9)}>
                  <button
                    type="button"
                    onClick={() => { setResetMode(false); setError(""); setFieldErrors({}); }}
                    className="text-sm font-medium text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
                  >
                    Back to sign in
                  </button>
                </div>
              )}
            </form>
          )}

          {/* Divider + Google — hidden in reset mode */}
          {!resetMode && !resetSent && (
            <>
              <div className="flex items-center gap-4 my-7" style={stagger(9)}>
                <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
                <span className="text-[11px] text-slate-500">or continue with</span>
                <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
              </div>

              <div style={stagger(10)}>
                <button
                  onClick={handleGoogleLogin}
                  disabled={googleLoading}
                  type="button"
                  className="login-social-glass w-full py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {googleLoading ? (
                    <Loader2 size={18} className="animate-spin text-slate-400" />
                  ) : (
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
                  )}
                  <span className="text-slate-300">Continue with Google</span>
                </button>
              </div>

              <p className="text-center text-xs mt-8 text-slate-500" style={stagger(11)}>
                Don&apos;t have an account?{" "}
                <a
                  href="mailto:cogniflowautomations@gmail.com?subject=Cogniflow%20Account%20Request"
                  className="font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  Get started free
                </a>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
