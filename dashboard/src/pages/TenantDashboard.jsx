import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  Phone, Bot, Key, Copy, Check, Plus, Trash2, Clock,
  TrendingUp, AlertTriangle, IndianRupee, BarChart3,
} from "lucide-react";
import PageHeader from "../components/PageHeader";

const GRADIENT_COLORS = [
  { icon: "text-blue-400" },
  { icon: "text-emerald-400" },
  { icon: "text-violet-400" },
  { icon: "text-amber-400" },
];

function paise(p) {
  return `₹${(p / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

function Stat({ icon: Icon, label, value, sub, idx = 0 }) {
  const c = GRADIENT_COLORS[idx % GRADIENT_COLORS.length];
  return (
    <div className="rounded-xl p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-subtle)' }}>
          <Icon size={15} className={c.icon} />
        </div>
        <span className="text-xs uppercase tracking-wider font-medium" style={{ color: 'var(--text-muted)' }}>{label}</span>
      </div>
      <p className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>{value}</p>
      {sub && <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
    </div>
  );
}

function UsageBar({ used, limit }) {
  const pct = Math.min((used / Math.max(limit, 1)) * 100, 100);
  const remaining = Math.max(0, limit - used);

  return (
    <div className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>This Month</h3>
        {pct >= 90 && (
          <span className="flex items-center gap-1 text-xs text-red-400">
            <AlertTriangle size={12} /> Approaching limit
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-2 mb-4">
        <span className="text-4xl font-bold" style={{ color: 'var(--text-primary)' }}>{Math.round(used)}</span>
        <span className="text-lg" style={{ color: 'var(--text-muted)' }}>/ {limit} min</span>
      </div>
      <div className="w-full h-3 rounded-full overflow-hidden mb-3" style={{ background: 'var(--bg-muted)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: 'var(--accent)' }}
        />
      </div>
      <div className="flex justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
        <span>{pct.toFixed(1)}% used</span>
        <span>{remaining} min remaining</span>
      </div>
    </div>
  );
}

function ApiKeyCard({ keyData, onRevoke }) {
  const [copied, setCopied] = useState(false);

  function copyPrefix() {
    navigator.clipboard.writeText(keyData.key_prefix);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex items-center justify-between p-4 rounded-lg transition-colors" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-3 min-w-0">
        <Key size={14} className="shrink-0" style={{ color: 'var(--text-muted)' }} />
        <div className="min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{keyData.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <code className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{keyData.key_prefix}</code>
            <button onClick={copyPrefix} className="transition-colors" style={{ color: 'var(--accent)' }}>
              {copied ? <Check size={10} /> : <Copy size={10} />}
            </button>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <span className={`text-[10px] px-2 py-0.5 rounded-full ${
          keyData.is_active
            ? ""
            : "bg-red-500/10 text-red-400 border border-red-500/20"
        }`}
          style={keyData.is_active ? { background: 'var(--accent-subtle)', color: 'var(--accent-text)', border: '1px solid var(--accent)' } : {}}
        >
          {keyData.is_active ? "Active" : "Revoked"}
        </span>
        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{keyData.total_requests || 0} reqs</span>
        {keyData.is_active && (
          <button
            onClick={() => onRevoke(keyData.id)}
            className="hover:text-red-400 transition-colors"
            title="Revoke key"
            style={{ color: 'var(--text-muted)' }}
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

function NewKeyModal({ onClose, onCreated }) {
  const [name, setName] = useState("Production Key");
  const [newKey, setNewKey] = useState(null);
  const [keyCopied, setKeyCopied] = useState(false);
  const queryClient = useQueryClient();

  const createMut = useMutation({
    mutationFn: (data) => api.createApiKey(data),
    onSuccess: (data) => {
      setNewKey(data.key);
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });

  function copyKey() {
    navigator.clipboard.writeText(newKey);
    setKeyCopied(true);
  }

  if (newKey) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <div className="rounded-2xl p-6 w-full max-w-md mx-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Save Your API Key</h3>
          <p className="text-xs text-amber-400 mb-4">This key will not be shown again. Copy it now.</p>
          <div className="flex items-center gap-2 p-3 rounded-lg mb-4" style={{ background: 'var(--bg-muted)', border: '1px solid var(--border)' }}>
            <code className="text-xs font-mono flex-1 break-all" style={{ color: 'var(--accent-text)' }}>{newKey}</code>
            <button
              onClick={copyKey}
              className="shrink-0 px-3 py-1.5 rounded-md text-white text-xs"
              style={{ background: 'var(--accent)' }}
            >
              {keyCopied ? "Copied!" : "Copy"}
            </button>
          </div>
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 rounded-lg text-sm" style={{ background: 'var(--bg-muted)', color: 'var(--text-secondary)' }}
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="rounded-2xl p-6 w-full max-w-md mx-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Create API Key</h3>
        <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Key Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 rounded-lg text-sm mb-4 focus:outline-none"
          style={{ background: 'var(--bg-muted)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        />
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm"
            style={{ background: 'var(--bg-muted)', color: 'var(--text-secondary)' }}
          >
            Cancel
          </button>
          <button
            onClick={() => createMut.mutate({ name })}
            disabled={createMut.isPending}
            className="flex-1 px-4 py-2.5 rounded-lg text-white text-sm font-medium"
            style={{ background: 'var(--accent)' }}
          >
            {createMut.isPending ? "Creating..." : "Create Key"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TenantDashboard() {
  const [showNewKey, setShowNewKey] = useState(false);
  const queryClient = useQueryClient();

  const { data: usage } = useQuery({
    queryKey: ["tenant-usage"],
    queryFn: () => api.getUsage(),
    refetchInterval: 30_000,
  });

  const { data: live } = useQuery({
    queryKey: ["tenant-live"],
    queryFn: () => api.getLiveUsage(),
    refetchInterval: 10_000,
  });

  const { data: keysData } = useQuery({
    queryKey: ["api-keys"],
    queryFn: () => api.getApiKeys(),
  });

  const { data: callsData } = useQuery({
    queryKey: ["tenant-calls"],
    queryFn: () => api.getCalls({ limit: 10 }),
  });

  const { data: agentsData } = useQuery({
    queryKey: ["tenant-agents"],
    queryFn: () => api.getAgents(),
  });

  const revokeMut = useMutation({
    mutationFn: (id) => api.revokeApiKey(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["api-keys"] }),
  });

  const keys = keysData?.keys || [];
  const calls = callsData?.calls || [];
  const agents = agentsData?.agents || [];
  const usedMinutes = usage?.used_minutes || 0;
  const limitMinutes = usage?.included_minutes || 500;

  return (
    <div>
      <PageHeader title="My Account" description="Usage, API keys, and billing overview" />

      <div className="px-8 py-6 space-y-6">
        <UsageBar used={usedMinutes} limit={limitMinutes} />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Stat
            icon={Phone}
            label="Calls"
            value={usage?.total_calls || 0}
            sub="this month"
            idx={0}
          />
          <Stat
            icon={Bot}
            label="Agents"
            value={agents.length}
            sub="deployed"
            idx={1}
          />
          <Stat
            icon={IndianRupee}
            label="Estimated Bill"
            value={paise(usage?.total_bill_paise || 0)}
            sub={`infra cost: ${paise(usage?.infrastructure_cost_paise || 0)}`}
            idx={2}
          />
          <Stat
            icon={TrendingUp}
            label="Active Now"
            value={live?.active_calls || 0}
            sub={`max ${live?.max_concurrent || 5} concurrent`}
            idx={3}
          />
        </div>

        {/* API Keys */}
        <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>API Keys</h3>
            <button
              onClick={() => setShowNewKey(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-medium"
              style={{ background: 'var(--accent)' }}
            >
              <Plus size={12} /> New Key
            </button>
          </div>
          <div className="space-y-2">
            {keys.length === 0 && (
              <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>No API keys yet</p>
            )}
            {keys.map((k) => (
              <ApiKeyCard key={k.id} keyData={k} onRevoke={(id) => revokeMut.mutate(id)} />
            ))}
          </div>
        </div>

        {/* Cost Breakdown */}
        {usage?.component_breakdown && (
          <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h3 className="text-sm font-medium mb-4" style={{ color: 'var(--text-secondary)' }}>Cost Breakdown</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "STT", value: usage.component_breakdown.stt_paise, color: "text-blue-400" },
                { label: "LLM", value: usage.component_breakdown.llm_paise, color: "text-violet-400" },
                { label: "TTS", value: usage.component_breakdown.tts_paise, color: "text-emerald-400" },
                { label: "Telephony", value: usage.component_breakdown.tel_paise, color: "text-amber-400" },
              ].map((item) => (
                <div key={item.label} className="text-center p-3 rounded-lg" style={{ background: 'var(--bg-muted)', border: '1px solid var(--border)' }}>
                  <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
                  <p className={`text-lg font-semibold ${item.color}`}>{paise(item.value || 0)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Calls */}
        <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Recent Calls</h3>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{calls.length} shown</span>
          </div>
          {calls.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>No calls yet</p>
          ) : (
            <div className="space-y-1">
              {calls.map((call) => (
                <div
                  key={call.id}
                  className="flex items-center justify-between p-3 rounded-lg transition-colors"
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-muted)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Phone size={13} className="shrink-0" style={{ color: 'var(--text-muted)' }} />
                    <div className="min-w-0">
                      <p className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>
                        {call.caller_number || call.phone_number || "Unknown"}
                      </p>
                      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        {call.created_at ? new Date(call.created_at).toLocaleString() : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {call.duration_seconds != null && (
                      <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                        <Clock size={10} />
                        {Math.floor(call.duration_seconds / 60)}m {call.duration_seconds % 60}s
                      </span>
                    )}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                      call.status === "completed"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : call.status === "active"
                          ? "bg-blue-500/10 text-blue-400"
                          : "bg-gray-500/10 text-gray-400"
                    }`}>
                      {call.status || "unknown"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {showNewKey && <NewKeyModal onClose={() => setShowNewKey(false)} />}
      </div>
    </div>
  );
}
