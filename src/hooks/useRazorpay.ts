"use client";

import { getSupabaseBrowser } from "@/lib/supabase-browser";

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface RazorpayOptions {
  key: string;
  subscription_id: string;
  name: string;
  description: string;
  handler: (response: RazorpayResponse) => void;
  prefill?: { email?: string; contact?: string };
  theme?: { color: string };
}

interface RazorpayInstance {
  open: () => void;
  close: () => void;
}

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
}

export async function openCheckout(plan: "starter" | "growth"): Promise<RazorpayResponse> {
  const { data: { session } } = await getSupabaseBrowser().auth.getSession();
  if (!session) throw new Error("Not signed in. Please log in and try again.");

  const res = await fetch("/api/billing/subscribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ plan }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.error || "Failed to create subscription");
  }

  const { subscription_id } = await res.json();

  return new Promise((resolve, reject) => {
    if (!window.Razorpay) {
      reject(new Error("Razorpay SDK not loaded. Please refresh and try again."));
      return;
    }

    const rzpKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "";
    if (!rzpKey) {
      reject(new Error("Razorpay is not configured. Contact support."));
      return;
    }

    const rzp = new window.Razorpay({
      key: rzpKey,
      subscription_id,
      name: "Cogniflow",
      description: `${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan`,
      handler: (response) => resolve(response),
      prefill: { email: session.user.email },
      theme: { color: "#00BCD4" },
    });

    rzp.open();
  });
}
