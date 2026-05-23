import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import supabase from "../lib/supabase";
import OTPInput from "../components/OTPInput";
import {
  Mail, ArrowRight, CheckCircle2, Loader2,
  Zap, Globe, BarChart3, ArrowLeft,
  Building2, Phone, User,
} from "lucide-react";

const INDUSTRIES = [
  { id: "clinic", icon: "🏥", label: "Clinic" },
  { id: "salon", icon: "💇", label: "Salon" },
  { id: "realestate", icon: "🏠", label: "Real Estate" },
  { id: "edtech", icon: "📚", label: "EdTech" },
  { id: "sales", icon: "💼", label: "Sales Team" },
  { id: "other", icon: "🔧", label: "Other" },
];

export default function Login() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [mode, setMode] = useState(
    () => new URLSearchParams(window.location.search).get("mode") === "signup" ? "signup" : "login"
  );
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState([]);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [otpError, setOtpError] = useState(false);
  const [success, setSuccess] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const [profileName, setProfileName] = useState("");
  const [profileCompany, setProfileCompany] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileIndustry, setProfileIndustry] = useState("");

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  useEffect(() => {
    if (!authLoading && user) {
      setSuccess(true);
      setTimeout(() => navigate("/home", { replace: true }), 600);
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleOtpChange = useCallback((val) => {
    setOtp(val);
    setOtpError(false);
    if (val.filter(Boolean).length === 8) {
      verifyOtp(val.join(""));
    }
  }, [email]);

  const sendOtp = async () => {
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      setError("Enter a valid email address");
      return;
    }
    setLoading(true);
    setError("");

    const { error: otpErr } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: mode === "signup" },
    });

    setLoading(false);
    if (otpErr) {
      setError(otpErr.message);
      return;
    }
    setStep("otp");
    setResendCooldown(30);
  };

  const verifyOtp = async (token) => {
    setLoading(true);
    setError("");

    const { data, error: verifyErr } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token,
      type: "email",
    });

    setLoading(false);
    if (verifyErr) {
      setOtpError(true);
      setError(verifyErr.message === "Token has expired or is invalid"
        ? "Invalid or expired code. Try again."
        : verifyErr.message);
      setOtp([]);
      return;
    }

    if (data.user && mode === "signup" && !data.user.user_metadata?.profile_complete) {
      setStep("profile");
      return;
    }

    setSuccess(true);
    setTimeout(() => navigate("/home", { replace: true }), 600);
  };

  const completeProfile = async () => {
    setLoading(true);
    setError("");

    const { error: updateErr } = await supabase.auth.updateUser({
      data: {
        full_name: profileName,
        company: profileCompany,
        phone: profilePhone,
        industry: profileIndustry,
        profile_complete: true,
      },
    });

    setLoading(false);
    if (updateErr) {
      setError(updateErr.message);
      return;
    }
    setSuccess(true);
    setTimeout(() => navigate("/home", { replace: true }), 600);
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError("");
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/auth/callback" },
    });
    if (oauthError) {
      setError(oauthError.message);
      setGoogleLoading(false);
    }
  };

  const handleEmailSubmit = (e) => {
    e.preventDefault();
    sendOtp();
  };

  const switchMode = () => {
    setMode((m) => (m === "login" ? "signup" : "login"));
    setStep("email");
    setError("");
    setOtp([]);
  };

  const fade = (delay) => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? "translateY(0)" : "translateY(16px)",
    transition: `all 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
  });

  return (
    <div className="login-page">
      <div className="login-bg">
        <div className="login-gradient-orb login-gradient-orb--1" />
        <div className="login-gradient-orb login-gradient-orb--2" />
        <div className="login-gradient-orb login-gradient-orb--3" />
        <div className="login-noise" />
      </div>

      <div className="login-container">
        {/* ──── Left: Brand Panel ──── */}
        <div className="login-brand" style={fade(0)}>
          <div className="login-brand-inner">
            <img src="/cogniflow-logo.png" alt="Cogniflow" className="login-logo" style={{ height: 56 }} />

            <h1 className="login-headline">
              AI agents that
              <br />
              <span className="login-headline-accent">handle your calls.</span>
            </h1>

            <p className="login-subtext">
              Deploy intelligent voice agents that qualify leads, book meetings,
              and close deals — 24/7, without missing a beat.
            </p>

            <div className="login-stats">
              {[
                { icon: <Zap size={18} />, text: "Sub-500ms response time" },
                { icon: <Globe size={18} />, text: "10+ Indian languages" },
                { icon: <BarChart3 size={18} />, text: "Real-time call analytics" },
              ].map(({ icon, text }) => (
                <div key={text} style={{ display: "flex", alignItems: "center", gap: 10, color: "#64748B", fontSize: "0.875rem" }}>
                  <span style={{ color: "#06B6D4" }}>{icon}</span>
                  {text}
                </div>
              ))}
            </div>

            <div className="login-trust">
              <span className="login-trust-text">
                1,000+ calls handled across Bangalore
              </span>
            </div>
          </div>
        </div>

        {/* ──── Right: Form ──── */}
        <div className="login-form-wrapper" style={fade(150)}>
          <div className={`login-card ${success ? "login-card--success" : ""}`}>
            {success && (
              <div className="login-success-overlay">
                <CheckCircle2 size={52} strokeWidth={1.5} className="text-emerald-400" />
                <p className="login-success-title">Welcome!</p>
                <p className="login-success-sub">Redirecting to dashboard...</p>
              </div>
            )}

            <div className="login-mobile-logo">
              <img src="/cogniflow-logo.png" alt="Cogniflow" style={{ height: 40 }} />
            </div>

            {/* ── Step: Email ── */}
            {step === "email" && (
              <div className="login-step-slide">
                <div style={fade(250)}>
                  <h2 className="login-card-title">
                    {mode === "signup" ? "Create your account" : "Welcome back"}
                  </h2>
                  <p className="login-card-subtitle">
                    {mode === "signup"
                      ? "Start your 7-day free trial"
                      : "Log in to your dashboard"}
                  </p>
                </div>

                {error && <div className="login-error">{error}</div>}

                <div style={fade(300)}>
                  <button
                    onClick={handleGoogleLogin}
                    disabled={googleLoading}
                    type="button"
                    className="login-google-btn"
                  >
                    {googleLoading ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 18 18">
                        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4" />
                        <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853" />
                        <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05" />
                        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 2.58 9 2.58Z" fill="#EA4335" />
                      </svg>
                    )}
                    <span>{mode === "signup" ? "Sign up with Google" : "Continue with Google"}</span>
                  </button>
                </div>

                <div className="login-divider" style={fade(350)}>
                  <span>or continue with email</span>
                </div>

                <form onSubmit={handleEmailSubmit} className="login-form" style={fade(400)}>
                  <div className="login-field">
                    <label className="login-label">Work email</label>
                    <div className="login-input-wrap">
                      <Mail size={16} className="login-input-icon" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setError(""); }}
                        placeholder="you@company.com"
                        className="login-input"
                        required
                        autoComplete="email"
                        autoFocus
                      />
                    </div>
                  </div>

                  <button type="submit" disabled={loading} className="login-submit">
                    {loading ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <>Continue with Email <ArrowRight size={16} /></>
                    )}
                  </button>
                </form>

                {mode === "signup" && (
                  <p style={{ fontSize: "0.75rem", color: "#475569", marginTop: 16, textAlign: "center" }}>
                    By continuing, you agree to our{" "}
                    <a href="https://www.cogniflowautomations.com/terms" style={{ color: "#06B6D4" }}>Terms</a> &{" "}
                    <a href="https://www.cogniflowautomations.com/privacy" style={{ color: "#06B6D4" }}>Privacy Policy</a>
                  </p>
                )}

                <p className="login-footer-text">
                  {mode === "signup" ? "Already have an account? " : "Don't have an account? "}
                  <button type="button" onClick={switchMode} className="login-footer-link" style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                    {mode === "signup" ? "Log in" : "Sign up free"}
                  </button>
                </p>
              </div>
            )}

            {/* ── Step: OTP ── */}
            {step === "otp" && (
              <div className="login-step-slide">
                <button
                  type="button"
                  onClick={() => { setStep("email"); setOtp([]); setError(""); }}
                  style={{ background: "none", border: "none", color: "#64748B", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: "0.8125rem", marginBottom: 20, padding: 0 }}
                >
                  <ArrowLeft size={14} /> Back
                </button>

                <h2 className="login-card-title">Check your email</h2>
                <p className="login-card-subtitle">
                  We sent an 8-digit code to{" "}
                  <strong style={{ color: "#CBD5E1" }}>{email}</strong>
                </p>

                {error && <div className="login-error">{error}</div>}

                <OTPInput
                  value={otp}
                  onChange={handleOtpChange}
                  disabled={loading}
                  error={otpError}
                />

                {loading && (
                  <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
                    <Loader2 size={20} className="animate-spin" style={{ color: "#06B6D4" }} />
                  </div>
                )}

                <div style={{ textAlign: "center", marginTop: 20, fontSize: "0.8125rem" }}>
                  <p style={{ color: "#475569", marginBottom: 8 }}>
                    Didn&apos;t receive it?
                  </p>
                  <button
                    type="button"
                    onClick={() => { setOtp([]); setError(""); sendOtp(); }}
                    disabled={resendCooldown > 0}
                    className="login-link"
                    style={{ opacity: resendCooldown > 0 ? 0.4 : 1 }}
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                  </button>
                </div>
              </div>
            )}

            {/* ── Step: Profile Setup (signup only) ── */}
            {step === "profile" && (
              <div className="login-step-slide">
                <h2 className="login-card-title">Almost there!</h2>
                <p className="login-card-subtitle">Tell us about your business</p>

                {error && <div className="login-error">{error}</div>}

                <form
                  onSubmit={(e) => { e.preventDefault(); completeProfile(); }}
                  className="login-form"
                >
                  <div className="login-field">
                    <label className="login-label">Your name</label>
                    <div className="login-input-wrap">
                      <User size={16} className="login-input-icon" />
                      <input
                        type="text"
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        placeholder="Priya Sharma"
                        className="login-input"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="login-field">
                    <label className="login-label">Company / Business name</label>
                    <div className="login-input-wrap">
                      <Building2 size={16} className="login-input-icon" />
                      <input
                        type="text"
                        value={profileCompany}
                        onChange={(e) => setProfileCompany(e.target.value)}
                        placeholder="Acme Healthcare"
                        className="login-input"
                      />
                    </div>
                  </div>

                  <div className="login-field">
                    <label className="login-label">Phone number</label>
                    <div className="login-input-wrap">
                      <Phone size={16} className="login-input-icon" />
                      <input
                        type="tel"
                        value={profilePhone}
                        onChange={(e) => setProfilePhone(e.target.value)}
                        placeholder="+91 98765 43210"
                        className="login-input"
                      />
                    </div>
                  </div>

                  <div className="login-field">
                    <label className="login-label">What describes you best?</label>
                    <div className="login-industry-grid">
                      {INDUSTRIES.map((ind) => (
                        <button
                          key={ind.id}
                          type="button"
                          onClick={() => setProfileIndustry(ind.id)}
                          className={`login-industry-card ${profileIndustry === ind.id ? "login-industry-card--active" : ""}`}
                        >
                          <span className="login-industry-icon">{ind.icon}</span>
                          {ind.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button type="submit" disabled={loading} className="login-submit">
                    {loading ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <>Complete Setup <ArrowRight size={16} /></>
                    )}
                  </button>

                  <div className="login-center">
                    <button
                      type="button"
                      onClick={() => {
                        setSuccess(true);
                        setTimeout(() => navigate("/home", { replace: true }), 600);
                      }}
                      className="login-link"
                      style={{ fontSize: "0.8125rem" }}
                    >
                      Skip for now
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
