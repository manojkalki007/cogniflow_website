import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  Search, Phone, Bot, Users, BarChart3, Megaphone,
  MessageSquare, Mail, Settings, Hash, LayoutTemplate,
  Target, Plug, Cable, Calendar, ArrowRight,
} from "lucide-react";

const STATIC_PAGES = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3, path: "/home/dashboard" },
  { id: "calls", label: "Call Log", icon: Phone, path: "/home/calls" },
  { id: "agents", label: "Agents", icon: Bot, path: "/home/agents" },
  { id: "contacts", label: "Contacts", icon: Users, path: "/home/contacts" },
  { id: "analytics", label: "Analytics", icon: BarChart3, path: "/home/analytics" },
  { id: "campaigns", label: "Campaigns", icon: Megaphone, path: "/home/campaigns" },
  { id: "templates", label: "Templates", icon: LayoutTemplate, path: "/home/templates" },
  { id: "phone-numbers", label: "Phone Numbers", icon: Hash, path: "/home/phone-numbers" },
  { id: "whatsapp", label: "WhatsApp", icon: MessageSquare, path: "/home/whatsapp" },
  { id: "email", label: "Email", icon: Mail, path: "/home/email" },
  { id: "scheduling", label: "Scheduling", icon: Calendar, path: "/home/scheduling" },
  { id: "ai-sdr", label: "AI SDR", icon: Target, path: "/home/ai-sdr" },
  { id: "integrations", label: "Integrations", icon: Plug, path: "/home/integrations" },
  { id: "api-hub", label: "API Hub", icon: Cable, path: "/home/api-hub" },
  { id: "settings", label: "Settings", icon: Settings, path: "/home/settings" },
];

export default function CommandPalette({ open, onClose }) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const navigate = useNavigate();

  const { data: agentsData } = useQuery({
    queryKey: ["cmd-agents"],
    queryFn: () => api.getAgents(),
    enabled: open,
    staleTime: 30_000,
  });

  const { data: contactsData } = useQuery({
    queryKey: ["cmd-contacts"],
    queryFn: () => api.getContacts({ limit: 20 }),
    enabled: open && query.length > 1,
    staleTime: 30_000,
  });

  const agents = agentsData?.agents || [];
  const contacts = contactsData?.contacts || [];

  const items = useMemo(() => {
    const q = query.toLowerCase().trim();
    const items = [];

    const matchedPages = STATIC_PAGES.filter((p) =>
      p.label.toLowerCase().includes(q)
    );
    matchedPages.forEach((p) =>
      items.push({ type: "page", label: p.label, icon: p.icon, path: p.path })
    );

    if (agents.length > 0) {
      const matchedAgents = agents.filter((a) =>
        (a.name || "").toLowerCase().includes(q)
      );
      matchedAgents.slice(0, 5).forEach((a) =>
        items.push({ type: "agent", label: a.name, icon: Bot, path: `/home/agents/${a.id}` })
      );
    }

    if (contacts.length > 0 && q.length > 1) {
      const matchedContacts = contacts.filter(
        (c) =>
          (c.name || "").toLowerCase().includes(q) ||
          (c.phone_number || "").includes(q)
      );
      matchedContacts.slice(0, 5).forEach((c) =>
        items.push({
          type: "contact",
          label: c.name || c.phone_number,
          icon: Users,
          path: `/home/contacts/${c.id}`,
          sub: c.phone_number,
        })
      );
    }

    return items;
  }, [query, agents, contacts]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e) {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, items.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && items[selectedIndex]) {
        navigate(items[selectedIndex].path);
        onClose();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, items, selectedIndex, navigate, onClose]);

  useEffect(() => {
    if (listRef.current) {
      const el = listRef.current.children[selectedIndex];
      if (el) el.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  if (!open) return null;

  const grouped = {};
  items.forEach((item) => {
    const group = item.type === "page" ? "Pages" : item.type === "agent" ? "Agents" : "Contacts";
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push(item);
  });

  let flatIndex = 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }} />
      <div
        className="relative w-full max-w-[560px] mx-4 rounded-2xl overflow-hidden animate-fade-in"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          boxShadow: "0 24px 64px -12px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05) inset",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <Search size={18} style={{ color: "var(--text-muted)" }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, agents, contacts..."
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: "var(--text-primary)" }}
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded font-mono"
            style={{ background: "var(--bg-muted)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[360px] overflow-y-auto py-2">
          {items.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                {query ? "No results found" : "Start typing to search..."}
              </p>
            </div>
          ) : (
            Object.entries(grouped).map(([group, groupItems]) => (
              <div key={group}>
                <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  {group}
                </p>
                {groupItems.map((item) => {
                  const idx = flatIndex++;
                  const Icon = item.icon;
                  return (
                    <button
                      key={`${item.type}-${item.path}`}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-left transition-colors"
                      style={{
                        background: idx === selectedIndex ? "var(--accent-subtle)" : "transparent",
                        color: idx === selectedIndex ? "var(--accent-text)" : "var(--text-secondary)",
                      }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      onClick={() => { navigate(item.path); onClose(); }}
                    >
                      <Icon size={16} className="shrink-0" style={{ color: idx === selectedIndex ? "var(--accent)" : "var(--text-muted)" }} />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm">{item.label}</span>
                        {item.sub && <span className="text-xs ml-2" style={{ color: "var(--text-muted)" }}>{item.sub}</span>}
                      </div>
                      {idx === selectedIndex && <ArrowRight size={12} style={{ color: "var(--accent)" }} />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2 text-[10px]"
          style={{ borderTop: "1px solid var(--border)", color: "var(--text-muted)" }}>
          <span><kbd className="font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono">↵</kbd> open</span>
          <span><kbd className="font-mono">esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
