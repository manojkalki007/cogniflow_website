"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Phone,
  PhoneIncoming,
  PhoneOff,
  Mic,
  Volume2,
  Bot,
  Activity,
  ArrowUpRight,
  ArrowDownLeft,
  Zap,
  Clock,
  TrendingUp,
  Radio,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   MOCK DATA
   ═══════════════════════════════════════════════════════════ */

type Provider = "Twilio" | "Exotel" | "Vobiz";
type Direction = "Inbound" | "Outbound";
type CallStatus = "Speaking" | "Listening" | "Processing";

interface ActiveCall {
  id: string;
  provider: Provider;
  callerNumber: string;
  agentName: string;
  direction: Direction;
  initialSeconds: number;
  status: CallStatus;
}

interface EventItem {
  id: string;
  timestamp: string;
  icon: "PhoneIncoming" | "Bot" | "Mic" | "Volume2" | "PhoneOff" | "Zap";
  description: string;
  color: "green" | "amber" | "red" | "primary";
}

const PROVIDER_COLORS: Record<Provider, string> = {
  Twilio: "#F22F46",
  Exotel: "#4F8DF5",
  Vobiz: "#A855F7",
};

const MOCK_CALLS: ActiveCall[] = [
  { id: "c1", provider: "Twilio",  callerNumber: "+91 98765 43210", agentName: "Sales Bot A",      direction: "Inbound",  initialSeconds: 154, status: "Speaking"    },
  { id: "c2", provider: "Exotel",  callerNumber: "+91 87654 32109", agentName: "Support Agent",    direction: "Inbound",  initialSeconds: 87,  status: "Listening"   },
  { id: "c3", provider: "Twilio",  callerNumber: "+1 (415) 555-0123", agentName: "Lead Qualifier", direction: "Outbound", initialSeconds: 212, status: "Speaking"    },
  { id: "c4", provider: "Vobiz",   callerNumber: "+91 76543 21098", agentName: "Appointment Bot",  direction: "Inbound",  initialSeconds: 42,  status: "Processing"  },
  { id: "c5", provider: "Exotel",  callerNumber: "+91 65432 10987", agentName: "Sales Bot B",      direction: "Outbound", initialSeconds: 305, status: "Speaking"    },
  { id: "c6", provider: "Vobiz",   callerNumber: "+91 54321 09876", agentName: "Survey Agent",     direction: "Inbound",  initialSeconds: 19,  status: "Listening"   },
  { id: "c7", provider: "Twilio",  callerNumber: "+44 20 7946 0958", agentName: "Follow-up Bot",   direction: "Outbound", initialSeconds: 128, status: "Speaking"    },
];

const INITIAL_EVENTS: EventItem[] = [
  { id: "e1",  timestamp: "10:42:15", icon: "PhoneIncoming", description: "Inbound call from +91 98765 43210",                color: "green"   },
  { id: "e2",  timestamp: "10:42:12", icon: "Bot",           description: "Agent 'Sales Bot A' handling call",                color: "amber"   },
  { id: "e3",  timestamp: "10:41:58", icon: "Mic",           description: "STT: 'I want to book an appointment'",             color: "primary" },
  { id: "e4",  timestamp: "10:41:55", icon: "Volume2",       description: "TTS: 'Sure, let me check available slots'",        color: "primary" },
  { id: "e5",  timestamp: "10:41:30", icon: "PhoneOff",      description: "Call ended: +1 (415) 555-0199 (duration: 4:12)",   color: "red"     },
  { id: "e6",  timestamp: "10:41:15", icon: "Zap",           description: "Intent detected: booking_request (confidence: 94%)", color: "amber" },
  { id: "e7",  timestamp: "10:40:48", icon: "PhoneIncoming", description: "Inbound call from +91 87654 32109",                color: "green"   },
  { id: "e8",  timestamp: "10:40:32", icon: "Bot",           description: "Agent 'Support Agent' assigned",                   color: "amber"   },
  { id: "e9",  timestamp: "10:40:10", icon: "Mic",           description: "STT: 'My order hasn’t arrived yet'",          color: "primary" },
  { id: "e10", timestamp: "10:39:55", icon: "Volume2",       description: "TTS: 'Let me look up your order status'",          color: "primary" },
  { id: "e11", timestamp: "10:39:30", icon: "PhoneOff",      description: "Call ended: +91 11223 34455 (duration: 2:47)",     color: "red"     },
  { id: "e12", timestamp: "10:39:12", icon: "Zap",           description: "Sentiment shift: negative -> neutral",             color: "amber"   },
  { id: "e13", timestamp: "10:38:45", icon: "PhoneIncoming", description: "Outbound call connected: +44 20 7946 0958",        color: "green"   },
  { id: "e14", timestamp: "10:38:20", icon: "Bot",           description: "Agent 'Follow-up Bot' initiated outbound",         color: "amber"   },
  { id: "e15", timestamp: "10:37:55", icon: "Mic",           description: "STT: 'Yes, I received the proposal'",             color: "primary" },
];

const STREAMING_EVENTS: Omit<EventItem, "id" | "timestamp">[] = [
  { icon: "Mic",           description: "STT: 'Can you send me the details on WhatsApp?'",     color: "primary" },
  { icon: "Volume2",       description: "TTS: 'Absolutely, I will send it right away'",        color: "primary" },
  { icon: "Zap",           description: "Action triggered: send_whatsapp_message",             color: "amber"   },
  { icon: "PhoneIncoming", description: "Inbound call from +91 99887 76655",                   color: "green"   },
  { icon: "Bot",           description: "Agent 'Lead Qualifier' handling new call",             color: "amber"   },
  { icon: "Mic",           description: "STT: 'I am interested in the premium plan'",          color: "primary" },
  { icon: "Volume2",       description: "TTS: 'Great choice! Let me walk you through it'",     color: "primary" },
  { icon: "PhoneOff",      description: "Call ended: +91 65432 10987 (duration: 6:31)",        color: "red"     },
  { icon: "Zap",           description: "Lead scored: hot (score: 87/100)",                    color: "amber"   },
  { icon: "Mic",           description: "STT: 'What are the payment options?'",                color: "primary" },
  { icon: "Volume2",       description: "TTS: 'We accept UPI, cards, and net banking'",        color: "primary" },
  { icon: "PhoneIncoming", description: "Inbound call from +91 44556 67788",                   color: "green"   },
  { icon: "Bot",           description: "Agent 'Appointment Bot' picked up call",               color: "amber"   },
  { icon: "Zap",           description: "Calendar slot booked: May 21, 2:30 PM",               color: "amber"   },
  { icon: "PhoneOff",      description: "Call ended: +91 54321 09876 (duration: 1:58)",        color: "red"     },
];

/* ═══════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════ */

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getCurrentTimestamp(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
}

const EVENT_ICON_MAP = {
  PhoneIncoming,
  Bot,
  Mic,
  Volume2,
  PhoneOff,
  Zap,
} as const;

const EVENT_COLOR_MAP: Record<EventItem["color"], string> = {
  green: "var(--d-success)",
  amber: "var(--d-warning)",
  red: "var(--d-error)",
  primary: "var(--d-primary)",
};

/* ═══════════════════════════════════════════════════════════
   COMPONENTS
   ═══════════════════════════════════════════════════════════ */

// Deterministic heights to avoid SSR/CSR hydration mismatches. CSS animation gives the visual variance.
const WAVE_BAR_HEIGHTS = [12, 22, 10, 26, 16, 24, 14, 20];

function WaveformBars() {
  return (
    <div className="flex items-end gap-[3px]" style={{ height: 28 }}>
      {WAVE_BAR_HEIGHTS.map((h, i) => (
        <div
          key={i}
          className="dash-wave-bar"
          style={{
            height: h,
            animationDelay: `${i * 0.1}s`,
            animationDuration: `${0.6 + (i % 3) * 0.15}s`,
          }}
        />
      ))}
    </div>
  );
}

function CallCard({ call, elapsed }: { call: ActiveCall; elapsed: number }) {
  const DirIcon = call.direction === "Inbound" ? ArrowDownLeft : ArrowUpRight;
  const dirColor = call.direction === "Inbound" ? "var(--d-success)" : "var(--d-accent)";

  return (
    <motion.div
      className="dash-card hover:border-[rgba(0,221,179,0.3)] p-5 flex flex-col gap-4 cursor-default group"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      whileHover={{
        borderColor: "rgba(0, 221, 179, 0.3)",
        boxShadow:
          "0 0 0 1px rgba(0, 221, 179, 0.1), 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 48px rgba(0, 221, 179, 0.06)",
      }}
    >
      {/* Top row: provider + direction */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: PROVIDER_COLORS[call.provider] }}
          />
          <span
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--d-text-3)" }}
          >
            {call.provider}
          </span>
        </div>
        <div
          className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold"
          style={{
            background: call.direction === "Inbound"
              ? "rgba(52, 211, 153, 0.1)"
              : "rgba(255, 139, 62, 0.1)",
            color: dirColor,
          }}
        >
          <DirIcon size={11} />
          {call.direction}
        </div>
      </div>

      {/* Caller number */}
      <div
        className="text-lg font-semibold tracking-tight"
        style={{ fontFamily: "var(--d-mono)", color: "var(--d-text)" }}
      >
        {call.callerNumber}
      </div>

      {/* Agent name */}
      <div className="flex items-center gap-2">
        <Bot size={14} style={{ color: "var(--d-text-3)" }} />
        <span className="text-sm" style={{ color: "var(--d-text-2)" }}>
          {call.agentName}
        </span>
      </div>

      {/* Duration + Waveform */}
      <div className="flex items-end justify-between mt-auto">
        <div className="flex flex-col gap-1">
          <div
            className="dash-stat text-2xl font-bold"
            style={{ color: "var(--d-text)" }}
          >
            {formatDuration(call.initialSeconds + elapsed)}
          </div>
          <span
            className="text-xs font-medium"
            style={{ color: "var(--d-primary)" }}
          >
            {call.status}
          </span>
        </div>
        <WaveformBars />
      </div>
    </motion.div>
  );
}

function EventRow({ event, isNew }: { event: EventItem; isNew: boolean }) {
  const IconComp = EVENT_ICON_MAP[event.icon];

  return (
    <motion.div
      initial={isNew ? { opacity: 0, y: -20, height: 0 } : { opacity: 1, y: 0 }}
      animate={{ opacity: 1, y: 0, height: "auto" }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="flex items-start gap-3 px-4 py-3 border-b"
      style={{ borderColor: "rgba(31, 33, 51, 0.5)" }}
    >
      <div
        className="mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style={{
          background:
            event.color === "green"
              ? "rgba(52, 211, 153, 0.12)"
              : event.color === "amber"
                ? "rgba(251, 191, 36, 0.12)"
                : event.color === "red"
                  ? "rgba(248, 113, 113, 0.12)"
                  : "rgba(0, 221, 179, 0.12)",
        }}
      >
        <IconComp size={14} style={{ color: EVENT_COLOR_MAP[event.color] }} />
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="text-[13px] leading-snug"
          style={{ color: "var(--d-text)" }}
        >
          {event.description}
        </p>
        <span
          className="text-[11px] mt-1 block"
          style={{ fontFamily: "var(--d-mono)", color: "var(--d-text-3)" }}
        >
          {event.timestamp}
        </span>
      </div>
    </motion.div>
  );
}

function ProviderBar({
  provider,
  count,
  total,
  color,
}: {
  provider: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = Math.round((count / total) * 100);
  return (
    <div className="flex items-center gap-4">
      <div className="w-20 flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
        <span className="text-sm font-medium" style={{ color: "var(--d-text-2)" }}>
          {provider}
        </span>
      </div>
      <div className="flex-1 h-7 rounded-md overflow-hidden" style={{ background: "var(--d-surface-2)" }}>
        <motion.div
          className="h-full rounded-md"
          style={{ background: color, opacity: 0.8 }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
        />
      </div>
      <div className="w-24 text-right">
        <span
          className="text-sm font-bold"
          style={{ fontFamily: "var(--d-mono)", color: "var(--d-text)" }}
        >
          {count}
        </span>
        <span className="text-xs ml-1.5" style={{ color: "var(--d-text-3)" }}>
          ({pct}%)
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════ */

export default function LiveCallsPage() {
  const [elapsed, setElapsed] = useState(0);
  const [events, setEvents] = useState<EventItem[]>(INITIAL_EVENTS);
  const streamIndexRef = useRef(0);
  const eventFeedRef = useRef<HTMLDivElement>(null);

  // Tick call durations every second
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Stream new events every 3 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      const template = STREAMING_EVENTS[streamIndexRef.current % STREAMING_EVENTS.length];
      streamIndexRef.current += 1;
      const newEvent: EventItem = {
        ...template,
        id: `stream-${Date.now()}`,
        timestamp: getCurrentTimestamp(),
      };
      setEvents((prev) => [newEvent, ...prev].slice(0, 50));
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="space-y-6 dash-animate-in">
      {/* ───────── Header Row ───────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Radio size={22} style={{ color: "var(--d-accent)" }} />
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: "var(--d-text)" }}
          >
            Live Calls
          </h1>
          <div className="flex items-center gap-2 ml-1">
            <div
              className="dash-live-dot w-2.5 h-2.5 rounded-full"
              style={{ background: "var(--d-accent)" }}
            />
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: "var(--d-accent)" }}
            >
              Live
            </span>
          </div>
        </div>
        <button
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
          style={{
            background: "var(--d-primary)",
            color: "#06070B",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = "0 0 24px rgba(0, 221, 179, 0.4)";
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = "none";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          <Phone size={15} />
          Make Test Call
        </button>
      </div>

      {/* ───────── Big Counter Section ───────── */}
      <div className="dash-card relative overflow-hidden p-8">
        {/* Animated gradient glow behind the counter */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 60% 70% at 50% 30%, rgba(255, 139, 62, 0.08), transparent 70%)",
          }}
        />
        <div className="relative z-10 flex flex-col items-center text-center">
          <motion.div
            className="dash-stat font-black leading-none"
            style={{
              fontSize: "clamp(72px, 10vw, 112px)",
              color: "var(--d-text)",
              textShadow: "0 0 60px rgba(255, 139, 62, 0.2)",
            }}
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            7
          </motion.div>
          <span
            className="text-sm font-semibold uppercase tracking-[0.15em] mt-2"
            style={{ color: "var(--d-text-3)" }}
          >
            Active Calls
          </span>
          <div
            className="flex items-center gap-6 mt-6 pt-6 border-t w-full max-w-md justify-center"
            style={{ borderColor: "var(--d-border)" }}
          >
            <MiniStat icon={<TrendingUp size={14} />} label="Peak Today" value="23" />
            <div className="w-px h-8" style={{ background: "var(--d-border)" }} />
            <MiniStat icon={<Phone size={14} />} label="Total Today" value="1,247" />
            <div className="w-px h-8" style={{ background: "var(--d-border)" }} />
            <MiniStat icon={<Clock size={14} />} label="Avg Duration" value="3:42" />
          </div>
        </div>
      </div>

      {/* ───────── Main Area (65/35 split, stacks on tablet/mobile) ───────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
        {/* Left: Active Call Cards */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity size={16} style={{ color: "var(--d-primary)" }} />
            <h2
              className="text-sm font-semibold uppercase tracking-wider"
              style={{ color: "var(--d-text-3)" }}
            >
              Active Sessions
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {MOCK_CALLS.map((call, i) => (
              <motion.div
                key={call.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
              >
                <CallCard call={call} elapsed={elapsed} />
              </motion.div>
            ))}
          </div>
        </div>

        {/* Right: Event Feed */}
        <div className="dash-card flex flex-col" style={{ maxHeight: "calc(100vh - 320px)" }}>
          <div
            className="flex items-center justify-between px-5 py-4 border-b shrink-0"
            style={{ borderColor: "var(--d-border)" }}
          >
            <div className="flex items-center gap-2">
              <Zap size={15} style={{ color: "var(--d-warning)" }} />
              <h2 className="text-sm font-bold" style={{ color: "var(--d-text)" }}>
                Event Stream
              </h2>
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: "var(--d-success)",
                  animation: "dash-pulse 1.5s ease-in-out infinite",
                }}
              />
              <span className="text-[11px]" style={{ color: "var(--d-text-3)" }}>
                Streaming
              </span>
            </div>
          </div>
          <div
            ref={eventFeedRef}
            className="flex-1 overflow-y-auto"
          >
            <AnimatePresence initial={false}>
              {events.map((event, i) => (
                <EventRow key={event.id} event={event} isNew={i === 0} />
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ───────── Bottom: Provider Breakdown ───────── */}
      <div className="dash-card p-6">
        <div className="flex items-center gap-2 mb-5">
          <Activity size={15} style={{ color: "var(--d-text-3)" }} />
          <h2
            className="text-sm font-semibold uppercase tracking-wider"
            style={{ color: "var(--d-text-3)" }}
          >
            Provider Breakdown
          </h2>
        </div>
        <div className="space-y-3">
          <ProviderBar provider="Twilio" count={3} total={7} color={PROVIDER_COLORS.Twilio} />
          <ProviderBar provider="Exotel" count={2} total={7} color={PROVIDER_COLORS.Exotel} />
          <ProviderBar provider="Vobiz"  count={2} total={7} color={PROVIDER_COLORS.Vobiz} />
        </div>
      </div>
    </div>
  );
}

/* ─── Small helper component ─── */

function MiniStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex items-center gap-1.5" style={{ color: "var(--d-text-3)" }}>
        {icon}
        <span className="text-[11px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <span
        className="dash-stat text-lg font-bold"
        style={{ color: "var(--d-text)" }}
      >
        {value}
      </span>
    </div>
  );
}
