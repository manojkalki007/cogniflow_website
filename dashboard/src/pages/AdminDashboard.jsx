import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import PageHeader from "../components/PageHeader";
import {
  Building2, IndianRupee, TrendingUp, Users, Phone, Plus, X,
  AlertTriangle, Pause, Play, ChevronRight, BarChart3,
} from "lucide-react";

function paise(p) {
  return `₹${(p / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

const STAT_STYLES = [
  { bg: "var(--success)", subtle: "rgba(16,185,129,0.10)" },
  { bg: "var(--danger)", subtle: "rgba(239,68,68,0.10)" },
  { bg: "var(--accent)", subtle: "var(--accent-subtle)" },
  { bg: "#8b5cf6", subtle: "rgba(139,92,246,0.10)" },
];

function Stat({ icon: Icon, label, value, sub, idx = 0 }) {
  const s = STAT_STYLES[idx % STAT_STYLES.length];
  return (
    <div className="rounded-xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: s.subtle }}>
          <Icon size={15} style={{ color: s.bg }} />
        </div>
        <span className="text-xs uppercase tracking-wider font-medium" style={{ color: 'var(--text-muted)' }}>{label}</span>
      </div>
      <p className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>{value}</p>
      {sub && <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
    </div>
  );
}

function MarginBar({ revenue, cost }) {
  const margin = revenue - cost;
  const marginPct = revenue > 0 ? Math.round((margin / revenue) * 100) : 0;
  const costPct = revenue > 0 ? Math.round((cost / revenue) * 100) : 0;

  return (
    <div className="rounded-xl border p-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Revenue Breakdown</h3>
        <span className="text-sm font-semibold" style={{ color: marginPct >= 50 ? 'var(--success)' : 'var(--warning)' }}>
          {marginPct}% margin
        </span>
      </div>
      <div className="flex items-center gap-6 mb-4">
        <div>
          <p className="text-[10px] uppercase" style={{ color: 'var(--text-muted)' }}>Revenue</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--success)' }}>{paise(revenue)}</p>
        </div>
        <div style={{ color: 'var(--text-muted)' }}>-</div>
        <div>
          <p className="text-[10px] uppercase" style={{ color: 'var(--text-muted)' }}>Infra Cost</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--danger)' }}>{paise(cost)}</p>
        </div>
        <div style={{ color: 'var(--text-muted)' }}>-</div>
        <div>
          <p className="text-[10px] uppercase" style={{ color: 'var(--text-muted)' }}>Margin</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>{paise(margin)}</p>
        </div>
      </div>
      <div className="w-full h-3 rounded-full overflow-hidden flex" style={{ background: 'var(--bg-muted)' }}>
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${100 - costPct}%`, background: 'var(--accent)' }}
          title={`Margin: ${paise(margin)}`}
        />
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${costPct}%`, background: 'var(--danger)', opacity: 0.6 }}
          title={`Cost: ${paise(cost)}`}
        />
      </div>
    </div>
  );
}

function TenantRow({ tenant, onSuspend }) {
  const usedPct = Math.round(
    (tenant.used_minutes / Math.max(tenant.included_minutes, 1)) * 100
  );
  const isOverage = tenant.overage_minutes > 0;

  return (
    <div
      className="flex items-center gap-4 p-4 rounded-lg transition-colors group"
      style={{ cursor: 'default' }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-muted)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{tenant.tenant_name}</p>
          <span className="text-[10px] px-1.5 py-0.5 rounded" style={
            tenant.plan === "enterprise"
              ? { background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }
              : tenant.plan === "growth"
                ? { background: 'var(--accent-subtle)', color: 'var(--accent)' }
                : { background: 'var(--bg-muted)', color: 'var(--text-muted)' }
          }>
            {tenant.plan}
          </span>
          {isOverage && (
            <span className="flex items-center gap-0.5 text-[10px]" style={{ color: 'var(--warning)' }}>
              <AlertTriangle size={10} /> overage
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 mt-1">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {Math.round(tenant.used_minutes)} / {tenant.included_minutes} min
          </span>
          <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-muted)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(usedPct, 100)}%`,
                background: usedPct >= 90 ? 'var(--danger)' : usedPct >= 70 ? 'var(--warning)' : 'var(--success)',
              }}
            />
          </div>
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{paise(tenant.total_bill_paise || 0)}</p>
        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
          margin: <span style={{ color: tenant.margin_paise >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {paise(tenant.margin_paise || 0)}
          </span>
        </p>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={() => onSuspend(tenant.tenant_id)}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = 'var(--danger)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          title="Suspend tenant"
        >
          <Pause size={13} />
        </button>
        <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
      </div>
    </div>
  );
}

function AddTenantModal({ onClose }) {
  const [form, setForm] = useState({ name: "", email: "", plan: "starter", phone: "" });
  const [result, setResult] = useState(null);
  const queryClient = useQueryClient();

  const createMut = useMutation({
    mutationFn: (data) => api.adminCreateTenant(data),
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["admin-billing"] });
      queryClient.invalidateQueries({ queryKey: ["admin-tenants"] });
    },
  });

  const [keyCopied, setKeyCopied] = useState(false);

  if (result?.api_key) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <div className="rounded-2xl border p-6 w-full max-w-lg mx-4" style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)' }} onClick={(e) => e.stopPropagation()}>
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Tenant Created</h3>
          <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{result.tenant?.name}</span> — {result.tenant?.plan} plan
          </p>
          <p className="text-xs mb-4" style={{ color: 'var(--warning)' }}>Save the API key below. It will not be shown again.</p>
          <div className="flex items-center gap-2 p-3 rounded-lg border mb-4" style={{ background: 'var(--bg-muted)', borderColor: 'var(--border)' }}>
            <code className="text-xs font-mono flex-1 break-all" style={{ color: 'var(--success)' }}>{result.api_key}</code>
            <button
              onClick={() => { navigator.clipboard.writeText(result.api_key); setKeyCopied(true); }}
              className="shrink-0 px-3 py-1.5 rounded-md text-white text-xs"
              style={{ background: 'var(--accent)' }}
            >
              {keyCopied ? "Copied!" : "Copy"}
            </button>
          </div>
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 rounded-lg text-sm transition-colors"
            style={{ background: 'var(--bg-muted)', color: 'var(--text-secondary)' }}
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="rounded-2xl border p-6 w-full max-w-lg mx-4" style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Add Tenant</h3>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }} className="hover:opacity-70"><X size={16} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Business Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Priya's Clinic"
              className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none"
              style={{ background: 'var(--bg-muted)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            />
          </div>
          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Email</label>
            <input
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="contact@clinic.com"
              className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none"
              style={{ background: 'var(--bg-muted)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Plan</label>
              <select
                value={form.plan}
                onChange={(e) => setForm({ ...form, plan: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none"
                style={{ background: 'var(--bg-muted)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              >
                <option value="starter">Starter (Free)</option>
                <option value="growth">Growth (₹2,999/mo)</option>
                <option value="enterprise">Enterprise (₹9,999/mo)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Phone</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+91 98765..."
                className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none"
                style={{ background: 'var(--bg-muted)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm transition-colors"
            style={{ background: 'var(--bg-muted)', color: 'var(--text-secondary)' }}
          >
            Cancel
          </button>
          <button
            onClick={() => createMut.mutate(form)}
            disabled={!form.name || !form.email || createMut.isPending}
            className="flex-1 px-4 py-2.5 rounded-lg text-white text-sm font-medium disabled:opacity-50"
            style={{ background: 'var(--accent)' }}
          >
            {createMut.isPending ? "Creating..." : "Create Tenant"}
          </button>
        </div>
        {createMut.error && (
          <p className="text-xs mt-3" style={{ color: 'var(--danger)' }}>Failed to create tenant. Check server logs.</p>
        )}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [showAdd, setShowAdd] = useState(false);
  const queryClient = useQueryClient();

  const { data: billing, isLoading } = useQuery({
    queryKey: ["admin-billing"],
    queryFn: () => api.adminGetBilling(),
    refetchInterval: 60_000,
  });

  const suspendMut = useMutation({
    mutationFn: (id) => api.adminSuspendTenant(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-billing"] }),
  });

  const tenants = billing?.tenants || [];
  const revenue = billing?.total_revenue_paise || 0;
  const cost = billing?.total_cost_paise || 0;
  const margin = billing?.total_margin_paise || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Admin Panel"
        description="Master billing and tenant management"
        action={
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-white text-sm font-medium"
            style={{ background: 'var(--accent)' }}
          >
            <Plus size={14} /> Add Tenant
          </button>
        }
      />

      <div className="px-8 py-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Stat icon={IndianRupee} label="Revenue" value={paise(revenue)} sub={billing?.month} idx={0} />
          <Stat icon={TrendingUp} label="Infra Cost" value={paise(cost)} idx={1} />
          <Stat icon={BarChart3} label="Margin" value={paise(margin)} sub={revenue > 0 ? `${Math.round((margin / revenue) * 100)}%` : "0%"} idx={2} />
          <Stat icon={Users} label="Tenants" value={billing?.total_tenants || 0} sub="active" idx={3} />
        </div>

        <MarginBar revenue={revenue} cost={cost} />

        {/* Tenant Billing Table */}
        <div className="rounded-xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Tenant Billing</h3>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{tenants.length} tenants</span>
          </div>

          {/* Header */}
          <div className="flex items-center gap-4 px-4 py-2 text-[10px] uppercase tracking-wider font-medium border-b" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
            <div className="flex-1">Client</div>
            <div className="w-24 text-right">Usage</div>
            <div className="w-24 text-right">Bill</div>
            <div className="w-20 text-right">Margin</div>
            <div className="w-16" />
          </div>

          {tenants.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>No tenants yet. Create one to get started.</p>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {tenants.map((t) => (
                <TenantRow
                  key={t.tenant_id}
                  tenant={t}
                  onSuspend={(id) => {
                    if (confirm(`Suspend ${t.tenant_name}?`)) suspendMut.mutate(id);
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Top Usage & Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <h3 className="text-sm font-medium mb-4" style={{ color: 'var(--text-secondary)' }}>Top Usage</h3>
            <div className="space-y-3">
              {[...tenants]
                .sort((a, b) => (b.used_minutes || 0) - (a.used_minutes || 0))
                .slice(0, 5)
                .map((t, i) => (
                  <div key={t.tenant_id} className="flex items-center gap-3">
                    <span className="text-xs w-5 text-right" style={{ color: 'var(--text-muted)' }}>{i + 1}.</span>
                    <span className="text-sm flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>{t.tenant_name}</span>
                    <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                      {Math.round(t.used_minutes || 0)} min
                    </span>
                  </div>
                ))}
              {tenants.length === 0 && (
                <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>No data</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <h3 className="text-sm font-medium mb-4" style={{ color: 'var(--text-secondary)' }}>Plan Distribution</h3>
            <div className="space-y-3">
              {["starter", "growth", "enterprise"].map((plan) => {
                const count = tenants.filter((t) => t.plan === plan).length;
                const planRevenue = tenants
                  .filter((t) => t.plan === plan)
                  .reduce((sum, t) => sum + (t.total_bill_paise || 0), 0);
                return (
                  <div key={plan} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{
                        background: plan === "enterprise" ? "#f59e0b" : plan === "growth" ? "var(--accent)" : "var(--text-muted)"
                      }} />
                      <span className="text-sm capitalize" style={{ color: 'var(--text-secondary)' }}>{plan}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{count} tenants</span>
                      <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>{paise(planRevenue)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {showAdd && <AddTenantModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}
