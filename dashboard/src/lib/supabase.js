import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || "https://afchhffhpszwrtnnzzhw.supabase.co",
  import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmY2hoZmZocHN6d3J0bm56emh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MzA5ODQsImV4cCI6MjA5MzIwNjk4NH0.EUB00CMKhPSnVp2Zs-d9rCpLccow61ey51VvSpgg1_k",
  {
    auth: {
      flowType: "pkce",
      detectSessionInUrl: true,
      autoRefreshToken: true,
      persistSession: true,
    },
  }
);

export default supabase;
