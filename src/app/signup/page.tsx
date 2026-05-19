"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import CogniflowLogo from "@/components/CogniflowLogo";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [step, setStep] = useState<"email" | "otp">("email");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: otpError } = await supabaseBrowser.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    });

    if (otpError) {
      setError(otpError.message);
      setLoading(false);
      return;
    }

    setStep("otp");
    setLoading(false);
    startCooldown();
  }

  async function handleVerifyOtp() {
    const code = otp.join("");
    if (code.length !== 6) return;

    setError("");
    setLoading(true);

    const { error: verifyError } = await supabaseBrowser.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });

    if (verifyError) {
      setError(verifyError.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  }

  async function handleResend() {
    if (resendCooldown > 0) return;
    setError("");

    const { error: resendError } = await supabaseBrowser.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });

    if (resendError) {
      setError(resendError.message);
      return;
    }

    startCooldown();
  }

  function startCooldown() {
    setResendCooldown(30);
    const interval = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function handleOtpChange(index: number, value: string) {
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newOtp.every((d) => d !== "") && newOtp.join("").length === 6) {
      setTimeout(() => {
        const code = newOtp.join("");
        if (code.length === 6) handleVerifyWithCode(code);
      }, 100);
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;

    const newOtp = [...otp];
    for (let i = 0; i < 6; i++) {
      newOtp[i] = pasted[i] || "";
    }
    setOtp(newOtp);

    const focusIndex = Math.min(pasted.length, 5);
    inputRefs.current[focusIndex]?.focus();

    if (pasted.length === 6) {
      setTimeout(() => handleVerifyWithCode(pasted), 100);
    }
  }

  async function handleVerifyWithCode(code: string) {
    setError("");
    setLoading(true);

    const { error: verifyError } = await supabaseBrowser.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });

    if (verifyError) {
      setError(verifyError.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  }

  async function handleGoogleSignup() {
    setError("");
    const { error: oauthError } = await supabaseBrowser.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/auth/callback",
      },
    });

    if (oauthError) {
      setError(oauthError.message);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ backgroundColor: "#0A0A0C" }}
    >
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-10">
          <a href="/">
            <CogniflowLogo width={160} />
          </a>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-8">
          {step === "email" ? (
            <>
              <h1
                className="text-2xl font-semibold text-white text-center"
                style={{ fontFamily: "'Instrument Sans', sans-serif" }}
              >
                Create your account
              </h1>
              <p
                className="mt-2 text-white/50 text-center text-sm"
                style={{ fontFamily: "'Instrument Sans', sans-serif" }}
              >
                Get started with Cogniflow
              </p>

              <button
                onClick={handleGoogleSignup}
                className="mt-8 w-full flex items-center justify-center gap-3 py-3 rounded-lg border border-white/[0.08] bg-white/[0.04] text-white text-sm font-medium hover:bg-white/[0.08] transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4" />
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853" />
                  <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05" />
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335" />
                </svg>
                Continue with Google
              </button>

              <div className="flex items-center gap-4 my-6">
                <div className="flex-1 h-px bg-white/[0.08]" />
                <span className="text-xs text-white/30 uppercase tracking-wider">or</span>
                <div className="flex-1 h-px bg-white/[0.08]" />
              </div>

              <form onSubmit={handleSendOtp} className="space-y-5">
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#0052CC]/50 focus:ring-1 focus:ring-[#0052CC]/25 transition-all"
                    placeholder="you@company.com"
                  />
                </div>

                {error && (
                  <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-full bg-[#0052CC] text-white font-semibold text-sm hover:bg-[#003d99] transition-colors disabled:opacity-60"
                >
                  {loading ? "Sending code..." : "Continue with Email"}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-white/40">
                Already have an account?{" "}
                <a
                  href="/login"
                  className="text-[#0052CC] hover:text-[#2684FF] transition-colors font-medium"
                >
                  Sign in
                </a>
              </p>
            </>
          ) : (
            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-[#0052CC]/10 border border-[#0052CC]/20 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0052CC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="16" x="2" y="4" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
              </div>
              <h2
                className="text-xl font-semibold text-white"
                style={{ fontFamily: "'Instrument Sans', sans-serif" }}
              >
                Enter verification code
              </h2>
              <p className="mt-3 text-white/50 text-sm leading-relaxed">
                We sent a 6-digit code to{" "}
                <span className="text-white/70 font-medium">{email}</span>
              </p>

              <div className="flex justify-center gap-3 mt-8" onPaste={handleOtpPaste}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    className="w-12 h-14 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-center text-xl font-semibold focus:outline-none focus:border-[#0052CC]/50 focus:ring-1 focus:ring-[#0052CC]/25 transition-all"
                  />
                ))}
              </div>

              {error && (
                <div className="mt-4 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
                  {error}
                </div>
              )}

              <button
                onClick={handleVerifyOtp}
                disabled={loading || otp.join("").length !== 6}
                className="mt-6 w-full py-3.5 rounded-full bg-[#0052CC] text-white font-semibold text-sm hover:bg-[#003d99] transition-colors disabled:opacity-60"
              >
                {loading ? "Verifying..." : "Verify & Create Account"}
              </button>

              <div className="mt-4 flex items-center justify-center gap-1 text-sm">
                <span className="text-white/40">Didn&apos;t get the code?</span>
                {resendCooldown > 0 ? (
                  <span className="text-white/30">Resend in {resendCooldown}s</span>
                ) : (
                  <button
                    onClick={handleResend}
                    className="text-[#0052CC] hover:text-[#2684FF] transition-colors font-medium"
                  >
                    Resend
                  </button>
                )}
              </div>

              <button
                onClick={() => { setStep("email"); setOtp(["", "", "", "", "", ""]); setError(""); }}
                className="mt-3 text-sm text-white/40 hover:text-white/60 transition-colors"
              >
                Use a different email
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
