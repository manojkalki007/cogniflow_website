import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { setTenantId } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import supabase from "../lib/supabase";
import {
  Mail, Lock, Eye, EyeOff, ArrowRight,
  CheckCircle2, Loader2, Building2,
} from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [orgId, setOrgId] = useState("");
  const [showOrg, setShowOrg] = useState(false);
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
    if (!authLoading && user) {
      setSuccess(true);
      setTimeout(() => navigate("/home", { replace: true }), 600);
    }
  }, [user, authLoading, navigate]);

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
    setTimeout(() => navigate("/home"), 600);
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
      options: {
        redirectTo: window.location.origin + "/login",
      },
    });
    if (oauthError) {
      setError(oauthError.message);
      setGoogleLoading(false);
    }
  };

  const fade = (delay) => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? "translateY(0)" : "translateY(16px)",
    transition: `all 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
  });

  return (
    <div className="login-page">
      {/* Animated gradient background */}
      <div className="login-bg">
        <div className="login-gradient-orb login-gradient-orb--1" />
        <div className="login-gradient-orb login-gradient-orb--2" />
        <div className="login-gradient-orb login-gradient-orb--3" />
        <div className="login-noise" />
      </div>

      <div className="login-container">
        {/* ──── Left: Brand ──── */}
        <div className="login-brand" style={fade(0)}>
          <div className="login-brand-inner">
            <img
              src="/cogniflow-logo.png"
              alt="Cogniflow"
              className="login-logo"
            />

            <h1 className="login-headline">
              Your AI workforce,
              <br />
              <span className="login-headline-accent">always on.</span>
            </h1>

            <p className="login-subtext">
              Deploy intelligent voice agents that qualify leads, book meetings,
              and close deals — 24/7, without missing a beat.
            </p>

            <div className="login-stats">
              {[
                { value: "10x", label: "More conversations" },
                { value: "85%", label: "Cost reduction" },
                { value: "<1s", label: "Response time" },
              ].map(({ value, label }) => (
                <div key={label} className="login-stat">
                  <span className="login-stat-value">{value}</span>
                  <span className="login-stat-label">{label}</span>
                </div>
              ))}
            </div>

            <div className="login-trust">
              <div className="login-trust-avatars">
                {["#6366F1", "#06B6D4", "#10B981", "#F59E0B"].map((bg, i) => (
                  <div
                    key={i}
                    className="login-trust-avatar"
                    style={{ background: bg, zIndex: 4 - i }}
                  />
                ))}
              </div>
              <span className="login-trust-text">
                Trusted by 200+ sales teams worldwide
              </span>
            </div>
          </div>
        </div>

        {/* ──── Right: Form Card ──── */}
        <div className="login-form-wrapper" style={fade(150)}>
          <div className={`login-card ${success ? "login-card--success" : ""}`}>
            {/* Success overlay */}
            {success && (
              <div className="login-success-overlay">
                <CheckCircle2 size={52} strokeWidth={1.5} className="text-emerald-400" />
                <p className="login-success-title">Welcome back!</p>
                <p className="login-success-sub">Redirecting to dashboard...</p>
              </div>
            )}

            {/* Mobile logo */}
            <div className="login-mobile-logo">
              <img src="/cogniflow-logo.png" alt="Cogniflow" style={{ height: 32 }} />
            </div>

            <div style={fade(250)}>
              <h2 className="login-card-title">
                {resetMode ? "Reset password" : "Welcome back"}
              </h2>
              <p className="login-card-subtitle">
                {resetMode
                  ? "We'll send a reset link to your email"
                  : "Sign in to your Cogniflow account"}
              </p>
            </div>

            {error && (
              <div className="login-error">
                {error}
              </div>
            )}

            {resetSent ? (
              <div className="login-reset-done" style={fade(200)}>
                <div className="login-reset-icon">
                  <Mail size={28} strokeWidth={1.5} className="text-cyan-400" />
                </div>
                <p className="login-reset-title">Check your inbox</p>
                <p className="login-reset-sub">
                  We sent a reset link to <strong>{email}</strong>
                </p>
                <button
                  onClick={() => { setResetMode(false); setResetSent(false); }}
                  className="login-link"
                >
                  Back to sign in
                </button>
              </div>
            ) : (
              <>
                {/* Google button first */}
                {!resetMode && (
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
                      <span>Continue with Google</span>
                    </button>

                    <div className="login-divider" style={fade(350)}>
                      <span>or sign in with email</span>
                    </div>
                  </div>
                )}

                <form
                  onSubmit={resetMode ? handleForgotPassword : handleSubmit}
                  className="login-form"
                >
                  {/* Email */}
                  <div className="login-field" style={fade(400)}>
                    <label className="login-label">Email address</label>
                    <div className="login-input-wrap">
                      <Mail size={16} className="login-input-icon" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setFieldErrors((p) => ({ ...p, email: undefined })); }}
                        placeholder="you@company.com"
                        className={`login-input ${fieldErrors.email ? "login-input--error" : ""}`}
                        required
                        autoComplete="email"
                      />
                    </div>
                    {fieldErrors.email && (
                      <p className="login-field-error">{fieldErrors.email}</p>
                    )}
                  </div>

                  {/* Password */}
                  {!resetMode && (
                    <div className="login-field" style={fade(450)}>
                      <div className="login-label-row">
                        <label className="login-label">Password</label>
                        <button
                          type="button"
                          onClick={() => { setResetMode(true); setError(""); setFieldErrors({}); }}
                          className="login-forgot"
                        >
                          Forgot?
                        </button>
                      </div>
                      <div className="login-input-wrap">
                        <Lock size={16} className="login-input-icon" />
                        <input
                          type={showPw ? "text" : "password"}
                          value={password}
                          onChange={(e) => { setPassword(e.target.value); setFieldErrors((p) => ({ ...p, password: undefined })); }}
                          placeholder="Enter your password"
                          className={`login-input ${fieldErrors.password ? "login-input--error" : ""}`}
                          required
                          autoComplete="current-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPw(!showPw)}
                          className="login-pw-toggle"
                          aria-label={showPw ? "Hide password" : "Show password"}
                        >
                          {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                      {fieldErrors.password && (
                        <p className="login-field-error">{fieldErrors.password}</p>
                      )}
                      {!fieldErrors.password && password.length > 0 && password.length < 6 && (
                        <p className="login-field-hint">Minimum 6 characters</p>
                      )}
                    </div>
                  )}

                  {/* Organization toggle */}
                  {!resetMode && (
                    <div style={fade(500)}>
                      {!showOrg ? (
                        <button
                          type="button"
                          onClick={() => setShowOrg(true)}
                          className="login-org-toggle"
                        >
                          <Building2 size={14} />
                          Add organization ID
                        </button>
                      ) : (
                        <div className="login-field">
                          <label className="login-label">
                            Organization ID <span className="login-label-opt">(optional)</span>
                          </label>
                          <input
                            type="text"
                            value={orgId}
                            onChange={(e) => setOrgId(e.target.value)}
                            placeholder="org_xxxxxxxx"
                            className="login-input login-input--mono"
                            autoComplete="organization"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Submit */}
                  <div style={fade(550)}>
                    <button
                      type="submit"
                      disabled={loading || cooldown > 0}
                      className="login-submit"
                    >
                      {loading ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : cooldown > 0 ? (
                        `Try again in ${cooldown}s`
                      ) : resetMode ? (
                        <>Send reset link</>
                      ) : (
                        <>Sign in <ArrowRight size={16} /></>
                      )}
                    </button>
                  </div>

                  {resetMode && (
                    <div className="login-center" style={fade(500)}>
                      <button
                        type="button"
                        onClick={() => { setResetMode(false); setError(""); setFieldErrors({}); }}
                        className="login-link"
                      >
                        Back to sign in
                      </button>
                    </div>
                  )}
                </form>
              </>
            )}

            {!resetMode && !resetSent && (
              <p className="login-footer-text" style={fade(600)}>
                Don&apos;t have an account?{" "}
                <a
                  href="https://www.cogniflowautomations.com/#pricing"
                  className="login-footer-link"
                >
                  Get started free
                </a>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
