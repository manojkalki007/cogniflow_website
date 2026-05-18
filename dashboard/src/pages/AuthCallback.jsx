import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../lib/supabase";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handle = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          navigate("/home", { replace: true });
          return;
        }
      }

      const hash = window.location.hash;
      if (hash && hash.includes("access_token")) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          navigate("/home", { replace: true });
          return;
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/home", { replace: true });
        return;
      }

      navigate("/login", { replace: true });
    };

    handle();
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
