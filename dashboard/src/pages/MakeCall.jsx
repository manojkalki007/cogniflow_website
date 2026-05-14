import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Phone, Loader2, PhoneOff, Activity } from "lucide-react";
import { Button } from "../components/ui/button";
import PageHeader from "../components/PageHeader";

const inputStyle = {
  background: 'var(--surface)',
  borderColor: 'var(--border)',
  color: 'var(--text-primary)',
};

export default function MakeCall() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [provider, setProvider] = useState("twilio");
  const [instructions, setInstructions] = useState("");
  const [callSid, setCallSid] = useState(null);

  const makeCall = useMutation({
    mutationFn: () => api.makeCall(phoneNumber, provider, instructions),
    onSuccess: (data) => { if (data.call_sid) setCallSid(data.call_sid); },
  });

  const { data: status } = useQuery({
    queryKey: ["callStatus", callSid],
    queryFn: () => api.callStatus(callSid),
    enabled: !!callSid,
    refetchInterval: 3000,
  });

  const hangup = useMutation({
    mutationFn: () => api.hangupCall(callSid),
    onSuccess: () => setCallSid(null),
  });

  return (
    <div>
      <PageHeader title="Make a Call" description="Initiate an outbound AI call" />

      <div className="px-8 py-6 max-w-xl">
        <div className="rounded-xl border p-6 space-y-5"
             style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div>
            <label className="block text-sm mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Phone Number</label>
            <input type="tel" placeholder="+1234567890"
              value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm border outline-none font-mono transition-colors focus:border-[var(--accent)]"
              style={inputStyle} />
          </div>

          <div>
            <label className="block text-sm mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Provider</label>
            <select value={provider} onChange={(e) => setProvider(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm border outline-none transition-colors"
              style={inputStyle}>
              <option value="twilio">Twilio</option>
              <option value="vobiz">Vobiz (India — ₹0.45/min)</option>
              <option value="exotel">Exotel</option>
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>
              Custom Instructions <span style={{ color: 'var(--text-muted)' }}>(optional)</span>
            </label>
            <textarea placeholder="Override the default agent instructions for this call..."
              value={instructions} onChange={(e) => setInstructions(e.target.value)}
              rows={3}
              className="w-full rounded-xl px-4 py-3 text-sm border outline-none resize-none transition-colors focus:border-[var(--accent)]"
              style={inputStyle} />
          </div>

          <div className="flex gap-3 pt-1">
            <Button onClick={() => makeCall.mutate()} disabled={!phoneNumber || makeCall.isPending} size="lg">
              {makeCall.isPending ? <Loader2 size={16} className="animate-spin" /> : <Phone size={16} />}
              Call Now
            </Button>
            {callSid && (
              <Button variant="destructive" size="lg" onClick={() => hangup.mutate()}>
                <PhoneOff size={16} /> Hang Up
              </Button>
            )}
          </div>

          {makeCall.isError && (
            <p className="text-sm rounded-lg px-3 py-2 border" style={{ color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.05)' }}>
              Failed to initiate call. Check your API keys and phone number.
            </p>
          )}
        </div>

        {status && (
          <div className="mt-5 rounded-xl border p-5 animate-fade-in"
               style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.1)' }}>
                <Activity size={13} style={{ color: 'var(--success)' }} />
              </div>
              <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Call Status</h3>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center p-2.5 rounded-lg" style={{ background: 'var(--bg-muted)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Status</span>
                <span style={{ color: status.status === "active" ? 'var(--success)' : 'var(--text-secondary)', fontWeight: 500 }}>
                  {status.status || "unknown"}
                </span>
              </div>
              {status.duration != null && (
                <div className="flex justify-between items-center p-2.5 rounded-lg" style={{ background: 'var(--bg-muted)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Duration</span>
                  <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{status.duration}s</span>
                </div>
              )}
              {status.turns != null && (
                <div className="flex justify-between items-center p-2.5 rounded-lg" style={{ background: 'var(--bg-muted)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Turns</span>
                  <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{status.turns}</span>
                </div>
              )}
              {status.summary && (
                <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                  <p className="text-xs uppercase tracking-wider mb-2 font-semibold" style={{ color: 'var(--text-muted)' }}>Summary</p>
                  <p className="leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{status.summary}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
