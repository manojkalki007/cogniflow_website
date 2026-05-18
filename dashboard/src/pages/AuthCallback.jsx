import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../lib/supabase";

export default function AuthCallback() {
  const navigate = useNavigate();
  const captured = useRef({
    code: new URLSearchParams(window.location.search).get("code"),
    hash: window.location.hash.substring(1),
  });

  useEffect(() => {
    let cancelled = false;

    const handle = async () => {
      const { code, hash } = captured.current;

      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error && data.session && !cancelled) {
          navigate("/home", { replace: true });
          return;
        }
      }

      if (hash) {
        const hp = new URLSearchParams(hash);
        const accessToken = hp.get("access_token");
        const refreshToken = hp.get("refresh_token");
        if (accessToken && refreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (!error && data.session && !cancelled) {
            navigate("/home", { replace: true });
            return;
          }
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session && !cancelled) {
        navigate("/home", { replace: true });
        return;
      }

      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (_event, session) => {
          if (session && !cancelled) {
            subscription.unsubscribe();
            navigate("/home", { replace: true });
          }
        }
      );

      setTimeout(() => {
        if (!cancelled) {
          subscription.unsubscribe();
          navigate("/login", { replace: true });
        }
      }, 5000);
    };

    handle();
    return () => { cancelled = true; };
  }, [navigate]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "#050810",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            width: 32,
            height: 32,
            border: "2px solid rgba(34,211,238,0.3)",
            borderTopColor: "rgb(34,211,238)",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
            margin: "0 auto 16px",
          }}
        />
        <p style={{ color: "#94a3b8", fontSize: 14 }}>Completing sign in...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>
  );
}
