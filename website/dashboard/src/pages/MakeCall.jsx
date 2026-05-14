import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Phone, Loader2, PhoneOff, Activity } from "lucide-react";
import { Button } from "../components/ui/button";

export default function MakeCall() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [provider, setProvider] = useState("twilio");
  const [instructions, setInstructions] = useState("");
  const [callSid, setCallSid] = useState(null);

  const makeCall = useMutation({
    mutationFn: () => api.makeCall(phoneNumber, provider, instructions),
    onSuccess: (data) => {
      if (data.call_sid) setCallSid(data.call_sid);
    },
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
    <div className="max-w-xl">
      <div className="mb-8">
        <h2 className="text-2xl font-bold gradient-text">Make a Call</h2>
        <p className="text-sm text-gray-500 mt-1">Initiate an outbound AI call</p>
      </div>

      <div className="glass-card rounded-xl p-6 space-y-5">
        <div>
          <label className="block text-sm text-gray-400 mb-1.5 font-medium">Phone Number</label>
          <input
            type="tel"
            placeholder="+1234567890"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            className="w-full glass-card rounded-xl px-4 py-3 text-sm input-glow border border-gray-700/30 bg-gray-800/30 font-mono"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1.5 font-medium">Provider</label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="w-full glass-card rounded-xl px-4 py-3 text-sm border border-gray-700/30 bg-gray-800/30"
          >
            <option value="twilio">Twilio</option>
            <option value="exotel">Exotel</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1.5 font-medium">Custom Instructions <span className="text-gray-600">(optional)</span></label>
          <textarea
            placeholder="Override the default agent instructions for this call..."
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={3}
            className="w-full glass-card rounded-xl px-4 py-3 text-sm input-glow border border-gray-700/30 bg-gray-800/30 resize-none"
          />
        </div>

        <div className="flex gap-3 pt-1">
          <Button
            onClick={() => makeCall.mutate()}
            disabled={!phoneNumber || makeCall.isPending}
            size="lg"
          >
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
          <p className="text-red-400 text-sm bg-red-500/5 rounded-lg px-3 py-2 border border-red-500/10">
            Failed to initiate call. Check your API keys and phone number.
          </p>
        )}
      </div>

      {status && (
        <div className="mt-5 glass-card rounded-xl p-5 animate-fade-in">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Activity size={13} className="text-emerald-400" />
            </div>
            <h3 className="text-sm font-medium">Call Status</h3>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center p-2.5 rounded-lg bg-gray-800/30">
              <span className="text-gray-500">Status</span>
              <span className={status.status === "active" ? "text-emerald-400 font-medium" : "text-gray-400"}>
                {status.status || "unknown"}
              </span>
            </div>
            {status.duration != null && (
              <div className="flex justify-between items-center p-2.5 rounded-lg bg-gray-800/30">
                <span className="text-gray-500">Duration</span>
                <span className="font-mono">{status.duration}s</span>
              </div>
            )}
            {status.turns != null && (
              <div className="flex justify-between items-center p-2.5 rounded-lg bg-gray-800/30">
                <span className="text-gray-500">Turns</span>
                <span className="font-mono">{status.turns}</span>
              </div>
            )}
            {status.summary && (
              <div className="mt-4 pt-4 border-t border-gray-800/30">
                <p className="text-gray-500 text-xs uppercase tracking-wider mb-2 font-medium">Summary</p>
                <p className="text-gray-300 leading-relaxed">{status.summary}</p>
              </div>
            )}
            {status.transcript && status.transcript.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-800/30">
                <p className="text-gray-500 text-xs uppercase tracking-wider mb-2 font-medium">Transcript</p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {status.transcript.map((t, i) => (
                    <div key={i} className={t.role === "agent" ? "text-blue-300" : "text-gray-300"}>
                      <span className={`text-xs font-medium mr-2 px-1.5 py-0.5 rounded ${t.role === "agent" ? "bg-blue-500/10 text-blue-400" : "bg-gray-700/50 text-gray-400"}`}>
                        {t.role}
                      </span>
                      {t.text}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
