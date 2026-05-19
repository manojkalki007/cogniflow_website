import { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../lib/supabase";
import { setTenantId } from "../lib/api";

const API_BASE = (import.meta.env.VITE_API_URL || "https://api.cogniflowautomations.com").trim();

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tenantInfo, setTenantInfo] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.access_token) return;
    fetch(`${API_BASE}/api/me`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.tenant_id) {
          setTenantId(data.tenant_id);
          setTenantInfo(data);
        }
      })
      .catch(() => {});
  }, [session?.access_token]);

  const signOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("cogniflow_tenant_id");
    setUser(null);
    setSession(null);
    setTenantInfo(null);
    navigate("/login");
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut, tenantInfo }}>
      {children}
    </AuthContext.Provider>
  );
}
