import { useState, useRef, useEffect } from "react";
import { Phone, PhoneOff, PhoneCall, X, Loader2, Download, Play, Pause } from "lucide-react";
import { Button } from "./ui/button";

function LatencyBar({ eot_ms, llm_ms, tts_ms, total_ms }) {
  const wrapStyles = total_ms < 600
    ? "bg-emerald-500/5 border-emerald-500/15"
    : total_ms < 1000
      ? "bg-amber-500/5 border-amber-500/15"
      : "bg-red-500/5 border-red-500/15";
  const totalLabel = total_ms < 600
    ? "text-emerald-500"
    : total_ms < 1000
      ? "text-amber-500"
      : "text-red-500";
  const segColor = (ms, good, ok) =>
    ms < good ? "bg-emerald-500/60" : ms < ok ? "bg-amber-500/60" : "bg-red-500/60";
  const total = eot_ms + llm_ms + tts_ms || 1;

  return (
    <div className="w-full px-2 py-1.5">
      <div className={`rounded-lg border px-3 py-2 ${wrapStyles}`}>
        <div className="flex items-center justify-between mb-1.5">
          <span className={`text-[10px] font-bold tracking-wider uppercase ${totalLabel}`}>
            {total_ms}ms
          </span>
          <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Turn latency</span>
        </div>
        <div className="flex h-1.5 rounded-full overflow-hidden mb-1.5" style={{ background: 'var(--bg-muted)' }}>
          <div className={`${segColor(eot_ms, 80, 150)} transition-all`} style={{ width: `${(eot_ms / total) * 100}%` }} />
          <div className={`${segColor(llm_ms, 300, 500)} transition-all`} style={{ width: `${(llm_ms / total) * 100}%` }} />
          <div className={`${segColor(tts_ms, 300, 500)} transition-all`} style={{ width: `${(tts_ms / total) * 100}%` }} />
        </div>
        <div className="flex gap-3 text-[9px]" style={{ color: 'var(--text-muted)' }}>
          <span>EOT <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>{eot_ms}ms</span></span>
          <span>LLM <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>{llm_ms}ms</span></span>
          <span>TTS <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>{tts_ms}ms</span></span>
        </div>
      </div>
    </div>
  );
}

export default function TestCallPanel({ agent, onClose }) {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [duration, setDuration] = useState(0);
  const [transcript, setTranscript] = useState([]);
  const [recordingUrl, setRecordingUrl] = useState(null);
  const [recPlaying, setRecPlaying] = useState(false);
  const [recProgress, setRecProgress] = useState(0);
  const [recDuration, setRecDuration] = useState(0);
  const wsRef = useRef(null);
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const timerRef = useRef(null);
  const nextPlayTimeRef = useRef(0);
  const gainNodeRef = useRef(null);
  const transcriptEndRef = useRef(null);
  const recPlayerRef = useRef(null);

  useEffect(() => {
    return () => cleanup();
  }, []);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (wsRef.current && wsRef.current.readyState <= 1) {
      try { wsRef.current.send(JSON.stringify({ event: "stop" })); } catch {}
      wsRef.current.close();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    wsRef.current = null;
    nextPlayTimeRef.current = 0;
    gainNodeRef.current = null;
  };

  const scheduleAudioChunk = (pcm16Bytes) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const float32 = new Float32Array(pcm16Bytes.length / 2);
    const view = new DataView(pcm16Bytes.buffer, pcm16Bytes.byteOffset, pcm16Bytes.byteLength);
    for (let i = 0; i < float32.length; i++) {
      float32[i] = view.getInt16(i * 2, true) / 32768;
    }
    const buf = ctx.createBuffer(1, float32.length, 16000);
    buf.copyToChannel(float32, 0);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(gainNodeRef.current || ctx.destination);
    const now = ctx.currentTime;
    const startAt = Math.max(now + 0.005, nextPlayTimeRef.current);
    src.start(startAt);
    nextPlayTimeRef.current = startAt + buf.duration;
  };

  const startCall = async () => {
    setError("");
    setDuration(0);
    setTranscript([]);
    if (recordingUrl) { URL.revokeObjectURL(recordingUrl); setRecordingUrl(null); }
    setRecPlaying(false);
    setRecProgress(0);
    setRecDuration(0);
    setStatus("connecting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      if (audioCtx.state === "suspended") await audioCtx.resume();
      audioCtxRef.current = audioCtx;
      const gain = audioCtx.createGain();
      gain.gain.value = 1.0;
      gain.connect(audioCtx.destination);
      gainNodeRef.current = gain;
      nextPlayTimeRef.current = 0;

      const wsBase = (import.meta.env.VITE_API_URL || "https://api.cogniflowautomations.com").trim();
      const wsUrl = wsBase.replace(/^http/, "ws") + `/voice/browser/test?agent_id=${agent.id}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = async () => {
        ws.send(JSON.stringify({ event: "start", call_sid: crypto.randomUUID() }));
        setStatus("active");
        timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);

        const source = audioCtx.createMediaStreamSource(stream);

        const sendPcm = (input) => {
          if (ws.readyState !== 1) return;
          const pcm16 = new Int16Array(input.length);
          for (let i = 0; i < input.length; i++) {
            pcm16[i] = Math.max(-32768, Math.min(32767, Math.round(input[i] * 32768)));
          }
          const raw = new Uint8Array(pcm16.buffer);
          let binary = "";
          for (let i = 0; i < raw.length; i++) binary += String.fromCharCode(raw[i]);
          ws.send(JSON.stringify({ event: "audio", data: btoa(binary) }));
        };

        try {
          await audioCtx.audioWorklet.addModule('/audio-processor.js');
          const workletNode = new AudioWorkletNode(audioCtx, 'audio-send-processor');
          workletNode.port.onmessage = (e) => sendPcm(e.data);
          source.connect(workletNode);
          workletNode.connect(audioCtx.destination);
        } catch {
          const processor = audioCtx.createScriptProcessor(4096, 1, 1);
          processor.onaudioprocess = (e) => sendPcm(e.inputBuffer.getChannelData(0));
          source.connect(processor);
          processor.connect(audioCtx.destination);
        }
      };

      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.event === "audio") {
          const ctx = audioCtxRef.current;
          if (ctx && ctx.state === "suspended") ctx.resume();
          const raw = atob(msg.data);
          const bytes = new Uint8Array(raw.length);
          for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
          scheduleAudioChunk(bytes);
        } else if (msg.event === "transcript") {
          setTranscript(prev => [...prev, { role: msg.role, text: msg.text }]);
        } else if (msg.event === "latency") {
          setTranscript(prev => [...prev, {
            role: "latency",
            turn: msg.turn,
            eot_ms: msg.eot_ms,
            llm_ms: msg.llm_ms,
            tts_ms: msg.tts_ms,
            total_ms: msg.total_ms,
          }]);
        } else if (msg.event === "clear") {
          nextPlayTimeRef.current = 0;
        } else if (msg.event === "recording") {
          try {
            console.log("[TestCall] Recording received:", msg.data?.length, "chars");
            const raw = atob(msg.data);
            const bytes = new Uint8Array(raw.length);
            for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
            const blob = new Blob([bytes], { type: "audio/wav" });
            setRecordingUrl(URL.createObjectURL(blob));
          } catch (err) { console.error("[TestCall] Recording decode error:", err); }
        } else if (msg.event === "error") {
          setError(msg.message || "Agent error");
          cleanup();
          setStatus("idle");
        }
      };

      ws.onerror = () => { setError("WebSocket connection failed"); setStatus("idle"); cleanup(); };
      ws.onclose = () => {
        if (status !== "idle") setStatus("ended");
        if (timerRef.current) clearInterval(timerRef.current);
        wsRef.current = null;
      };
    } catch (err) {
      setError(err.message || "Microphone access denied");
      setStatus("idle");
    }
  };

  const endCall = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (wsRef.current && wsRef.current.readyState <= 1) {
      try { wsRef.current.send(JSON.stringify({ event: "stop" })); } catch {}
    }
    setStatus("ended");
  };

  const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const agentName = agent.name || "Agent";

  return (
    <div className="mt-4 pt-4 border-t animate-fade-in" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <PhoneCall size={12} className="text-emerald-500" />
          </div>
          <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Voice Test</span>
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>with {agentName}</span>
        </div>
        <button onClick={() => { cleanup(); onClose(); }} className="p-1 rounded-lg transition-all" style={{ color: 'var(--text-muted)' }}>
          <X size={14} />
        </button>
      </div>

      {status === "idle" || status === "ended" ? (
        <div className="space-y-3">
          {status === "ended" && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <PhoneOff size={13} className="text-emerald-500" />
              <span className="text-xs text-emerald-600">Call ended — {formatTime(duration)}</span>
            </div>
          )}
          {error && (
            <div className="px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-500">{error}</div>
          )}
          {status === "ended" && transcript.length > 0 && (
            <div className="max-h-48 overflow-y-auto rounded-xl border p-3 space-y-2" style={{ background: 'var(--bg-muted)', borderColor: 'var(--border)' }}>
              {transcript.map((t, i) =>
                t.role === "latency" ? (
                  <LatencyBar key={i} eot_ms={t.eot_ms} llm_ms={t.llm_ms} tts_ms={t.tts_ms} total_ms={t.total_ms} />
                ) : (
                  <div key={i} className={`flex gap-2 text-xs ${t.role === "user" ? "justify-end" : ""}`}>
                    <div className={`max-w-[85%] px-3 py-1.5 rounded-xl ${
                      t.role === "user"
                        ? "bg-blue-500/15 text-blue-600 border border-blue-500/20"
                        : "border"
                    }`} style={t.role === "user" ? {} : { background: 'var(--bg-muted)', color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
                      <span className="font-medium text-[10px] uppercase tracking-wider opacity-60 block mb-0.5">
                        {t.role === "user" ? "You" : agentName}
                      </span>
                      {t.text}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
          {status === "ended" && recordingUrl && (
            <div className="rounded-xl border p-3" style={{ background: 'var(--bg-muted)', borderColor: 'var(--border)' }}>
              <audio
                ref={recPlayerRef}
                src={recordingUrl}
                onLoadedMetadata={() => setRecDuration(recPlayerRef.current?.duration || 0)}
                onTimeUpdate={() => setRecProgress(recPlayerRef.current?.currentTime || 0)}
                onEnded={() => setRecPlaying(false)}
                className="hidden"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const el = recPlayerRef.current;
                    if (!el) return;
                    if (recPlaying) { el.pause(); setRecPlaying(false); }
                    else { el.play(); setRecPlaying(true); }
                  }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                  style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}
                >
                  {recPlaying ? <Pause size={14} /> : <Play size={14} />}
                </button>
                <div className="flex-1 min-w-0">
                  <div
                    className="h-1.5 rounded-full cursor-pointer"
                    style={{ background: 'var(--border)' }}
                    onClick={(e) => {
                      const el = recPlayerRef.current;
                      if (!el || !recDuration) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      el.currentTime = ((e.clientX - rect.left) / rect.width) * recDuration;
                    }}
                  >
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: recDuration ? `${(recProgress / recDuration) * 100}%` : '0%',
                        background: 'var(--accent)',
                      }}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[9px] font-mono" style={{ color: 'var(--text-muted)' }}>
                      {formatTime(Math.floor(recProgress))}
                    </span>
                    <span className="text-[9px] font-mono" style={{ color: 'var(--text-muted)' }}>
                      {formatTime(Math.floor(recDuration))}
                    </span>
                  </div>
                </div>
                <a
                  href={recordingUrl}
                  download={`call-recording-${Date.now()}.wav`}
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                  style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}
                >
                  <Download size={14} />
                </a>
              </div>
            </div>
          )}
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Talk to this agent in real-time using your microphone.</p>
          <Button size="sm" onClick={startCall} className="w-full gap-1.5">
            <Phone size={14} /> {status === "ended" ? "Call Again" : "Start Voice Test"}
          </Button>
        </div>
      ) : status === "connecting" ? (
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center bg-amber-500/10 animate-pulse">
            <Loader2 size={24} className="text-amber-500 animate-spin" />
          </div>
          <p className="text-sm mt-4" style={{ color: 'var(--text-secondary)' }}>Connecting to agent...</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center bg-emerald-500/10 relative">
                <Phone size={20} className="text-emerald-500" />
                <span className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                <span className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-emerald-600">Live — Speak now</p>
                <p className="text-lg font-bold font-mono" style={{ color: 'var(--text-primary)' }}>{formatTime(duration)}</p>
              </div>
            </div>
            <Button variant="destructive" size="sm" onClick={endCall} className="gap-1.5">
              <PhoneOff size={14} /> End
            </Button>
          </div>

          {transcript.length > 0 && (
            <div className="max-h-48 overflow-y-auto rounded-xl border p-3 space-y-2" style={{ background: 'var(--bg-muted)', borderColor: 'var(--border)' }}>
              {transcript.map((t, i) =>
                t.role === "latency" ? (
                  <LatencyBar key={i} eot_ms={t.eot_ms} llm_ms={t.llm_ms} tts_ms={t.tts_ms} total_ms={t.total_ms} />
                ) : (
                  <div key={i} className={`flex gap-2 text-xs ${t.role === "user" ? "justify-end" : ""}`}>
                    <div className={`max-w-[85%] px-3 py-1.5 rounded-xl ${
                      t.role === "user"
                        ? "bg-blue-500/15 text-blue-600 border border-blue-500/20"
                        : "border"
                    }`} style={t.role === "user" ? {} : { background: 'var(--bg-muted)', color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
                      <span className="font-medium text-[10px] uppercase tracking-wider opacity-60 block mb-0.5">
                        {t.role === "user" ? "You" : agentName}
                      </span>
                      {t.text}
                    </div>
                  </div>
                )
              )}
              <div ref={transcriptEndRef} />
            </div>
          )}

          <p className="text-[10px] text-center" style={{ color: 'var(--text-muted)' }}>Your mic is active. The agent will respond by voice.</p>
        </div>
      )}
    </div>
  );
}
