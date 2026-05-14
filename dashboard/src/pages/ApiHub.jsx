import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  Mic, Brain, AudioLines, Phone, Database, Users, MessageSquare,
  CreditCard, Calendar, Mail, ExternalLink, CheckCircle2, XCircle,
  Activity, Zap, TrendingUp, Search, Filter,
} from "lucide-react";
import PageHeader from "../components/PageHeader";

const CATEGORY_META = {
  stt:        { label: "Speech-to-Text", icon: Mic, color: "#00BCD4" },
  llm:        { label: "LLM / AI", icon: Brain, color: "#8b5cf6" },
  tts:        { label: "Text-to-Speech", icon: AudioLines, color: "#10b981" },
  telephony:  { label: "Telephony", icon: Phone, color: "#f59e0b" },
  database:   { label: "Database", icon: Database, color: "#06b6d4" },
  crm:        { label: "CRM", icon: Users, color: "#ec4899" },
  messaging:  { label: "Messaging", icon: MessageSquare, color: "#10b981" },
  payments:   { label: "Payments", icon: CreditCard, color: "#f59e0b" },
  scheduling: { label: "Scheduling", icon: Calendar, color: "#6366f1" },
};

function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="rounded-xl border p-5 transition-shadow hover:shadow-md"
         style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center"
             style={{ background: 'var(--accent-subtle)' }}>
          <Icon size={17} style={{ color: color || 'var(--accent)' }} />
        </div>
        <span className="text-xs uppercase tracking-wide font-semibold" style={{ color: 'var(--text-muted)' }}>{label}</span>
      </div>
      <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
    </div>
  );
}

function StatusBadge({ configured }) {
  return configured ? (
    <span className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full"
          style={{ color: 'var(--success)', background: 'rgba(16,185,129,0.1)' }}>
      <CheckCircle2 size={12} /> Active
    </span>
  ) : (
    <span className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full"
          style={{ color: 'var(--text-muted)', background: 'var(--bg-muted)' }}>
      <XCircle size={12} /> Not configured
    </span>
  );
}

function CategoryBadge({ category }) {
  const meta = CATEGORY_META[category] || { label: category, icon: Zap, color: '#94a3b8' };
  const Icon = meta.icon;
  return (
    <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded"
          style={{ color: meta.color, background: `${meta.color}15` }}>
      <Icon size={10} /> {meta.label}
    </span>
  );
}

function ProviderCard({ provider, callCount }) {
  const meta = CATEGORY_META[provider.category] || { color: '#94a3b8' };

  return (
    <div className="rounded-xl border p-5 transition-all duration-200 hover:shadow-md"
         style={{
           background: 'var(--surface)',
           borderColor: 'var(--border)',
           opacity: provider.configured ? 1 : 0.6,
         }}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center"
               style={{ background: `${meta.color}15` }}>
            {(() => {
              const Icon = (CATEGORY_META[provider.category] || { icon: Zap }).icon;
              return <Icon size={18} style={{ color: meta.color }} />;
            })()}
          </div>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{provider.name}</h3>
            <CategoryBadge category={provider.category} />
          </div>
        </div>
        <StatusBadge configured={provider.configured} />
      </div>

      <p className="text-xs mb-4 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{provider.description}</p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {provider.rate_per_unit > 0 && (
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>₹{provider.rate_per_unit}</span>/{provider.unit}
            </span>
          )}
          {callCount > 0 && (
            <span className="text-[11px] font-medium" style={{ color: 'var(--success)' }}>
              {callCount} calls this month
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {provider.docs && (
            <a href={provider.docs} target="_blank" rel="noopener noreferrer"
              className="text-[11px] flex items-center gap-1 transition-colors hover:opacity-70"
              style={{ color: 'var(--text-muted)' }}>
              Console <ExternalLink size={10} />
            </a>
          )}
          {provider.pricing && (
            <a href={provider.pricing} target="_blank" rel="noopener noreferrer"
              className="text-[11px] flex items-center gap-1 transition-colors hover:opacity-70"
              style={{ color: 'var(--accent)' }}>
              Pricing <ExternalLink size={10} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function PipelineView({ providers }) {
  const stt = providers.filter(p => p.category === "stt" && p.configured);
  const llm = providers.filter(p => p.category === "llm" && p.configured);
  const tts = providers.filter(p => p.category === "tts" && p.configured);
  const tel = providers.filter(p => p.category === "telephony" && p.configured);

  const stages = [
    { label: "Telephony", items: tel, color: "#f59e0b" },
    { label: "STT", items: stt, color: "#00BCD4" },
    { label: "LLM", items: llm, color: "#8b5cf6" },
    { label: "TTS", items: tts, color: "#10b981" },
  ];

  return (
    <div className="rounded-xl border p-6 mb-6"
         style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
             style={{ background: 'var(--accent-subtle)' }}>
          <Zap size={15} style={{ color: 'var(--accent)' }} />
        </div>
        <div>
          <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Voice Pipeline</h3>
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Active providers in your call flow</p>
        </div>
      </div>

      <div className="flex items-center gap-3 overflow-x-auto pb-2">
        {stages.map((stage, i) => (
          <div key={stage.label} className="flex items-center gap-3">
            <div className="min-w-[140px] rounded-lg border p-3"
                 style={{ borderColor: `${stage.color}30`, background: `${stage.color}08` }}>
              <p className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: stage.color }}>
                {stage.label}
              </p>
              {stage.items.length > 0 ? (
                <div className="space-y-1">
                  {stage.items.map(p => (
                    <p key={p.id} className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                  ))}
                </div>
              ) : (
                <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>None</p>
              )}
            </div>
            {i < stages.length - 1 && (
              <div className="text-lg shrink-0" style={{ color: 'var(--text-muted)' }}>→</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ApiHub() {
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["providers"],
    queryFn: api.getProviders,
    staleTime: 30000,
  });

  const providers = data?.providers || [];
  const summary = data?.summary || {};
  const callsByProvider = summary.calls_by_provider || {};
  const categories = [...new Set(providers.map(p => p.category))];

  const filtered = providers.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) &&
        !p.description.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCat !== "all" && p.category !== filterCat) return false;
    if (filterStatus === "active" && !p.configured) return false;
    if (filterStatus === "inactive" && p.configured) return false;
    return true;
  });

  const grouped = {};
  for (const p of filtered) {
    if (!grouped[p.category]) grouped[p.category] = [];
    grouped[p.category].push(p);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="API Hub" description="Monitor all providers, usage, and billing in one place" />

      <div className="px-8 py-6">
        <div className="grid grid-cols-4 gap-4 mb-6">
          <StatCard icon={CheckCircle2} label="Active APIs"
            value={`${summary.configured || 0} / ${summary.total_providers || 0}`}
            sub={`${summary.not_configured || 0} not configured`}
            color="var(--success)" />
          <StatCard icon={Activity} label="Calls This Month"
            value={(summary.this_month_calls || 0).toLocaleString()}
            sub="across all providers"
            color="var(--accent)" />
          <StatCard icon={TrendingUp} label="Minutes Used"
            value={(summary.this_month_minutes || 0).toLocaleString()}
            sub="total voice minutes"
            color="#8b5cf6" />
          <StatCard icon={Zap} label="Pipeline Ready"
            value={
              providers.some(p => p.category === "stt" && p.configured) &&
              providers.some(p => p.category === "llm" && p.configured) &&
              providers.some(p => p.category === "tts" && p.configured) &&
              providers.some(p => p.category === "telephony" && p.configured)
                ? "Yes" : "Incomplete"
            }
            sub="STT → LLM → TTS → Tel"
            color="var(--warning)" />
        </div>

        <PipelineView providers={providers} />

        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search providers..."
              className="w-full pl-9 pr-4 py-2.5 text-sm rounded-lg border outline-none transition-colors focus:border-[var(--accent)]"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
          </div>

          <div className="flex items-center gap-1.5">
            <Filter size={13} style={{ color: 'var(--text-muted)' }} />
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
              className="text-xs border rounded-lg px-3 py-2.5 outline-none"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
              <option value="all">All Categories</option>
              {categories.map(c => (
                <option key={c} value={c}>{(CATEGORY_META[c]?.label) || c}</option>
              ))}
            </select>
          </div>

          <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            {["all", "active", "inactive"].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className="px-3 py-2 text-xs font-medium transition-colors"
                style={filterStatus === s
                  ? { background: 'var(--accent-subtle)', color: 'var(--accent)' }
                  : { background: 'var(--surface)', color: 'var(--text-muted)' }}>
                {s === "all" ? "All" : s === "active" ? "Active" : "Inactive"}
              </button>
            ))}
          </div>
        </div>

        {Object.entries(grouped).map(([category, items]) => {
          const meta = CATEGORY_META[category] || { label: category, icon: Zap, color: '#94a3b8' };
          const CatIcon = meta.icon;
          return (
            <div key={category} className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <CatIcon size={15} style={{ color: meta.color }} />
                <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{meta.label}</h2>
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {items.filter(p => p.configured).length}/{items.length} active
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map(p => (
                  <ProviderCard key={p.id} provider={p} callCount={callsByProvider[p.id] || 0} />
                ))}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-subtle)' }}>
              <Search size={20} style={{ color: 'var(--accent)' }} />
            </div>
            <p className="font-medium" style={{ color: 'var(--text-primary)' }}>No providers match your filters</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Try adjusting your search or filter criteria</p>
          </div>
        )}
      </div>
    </div>
  );
}
