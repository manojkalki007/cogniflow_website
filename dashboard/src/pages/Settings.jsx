import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, getTenantId } from "../lib/api";
import { Plus, Trash2, Upload, Shield, Webhook, Building2, UserPlus, Crown, User } from "lucide-react";
import { Button } from "../components/ui/button";

function WebhookSection() {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState("call.completed");

  const { data } = useQuery({ queryKey: ["webhooks"], queryFn: api.getWebhooks });
  const webhooks = data?.webhooks || [];

  const createMut = useMutation({
    mutationFn: () => api.createWebhook(url, events.split(",").map((e) => e.trim())),
    onSuccess: () => { queryClient.invalidateQueries(["webhooks"]); setUrl(""); },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.deleteWebhook(id),
    onSuccess: () => queryClient.invalidateQueries(["webhooks"]),
  });

  return (
    <div className="glass-card rounded-xl p-6">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
          <Webhook size={15} className="text-purple-400" />
        </div>
        <div>
          <h3 className="text-sm font-medium text-white">Webhooks</h3>
          <p className="text-xs text-gray-500">Send signed HTTP POST to external URLs when events occur</p>
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-webhook-url.com"
          className="flex-1 glass-card rounded-xl px-4 py-2.5 text-sm input-glow border border-gray-700/30 bg-gray-800/30 font-mono" />
        <input value={events} onChange={(e) => setEvents(e.target.value)} placeholder="Events"
          className="w-48 glass-card rounded-xl px-4 py-2.5 text-sm input-glow border border-gray-700/30 bg-gray-800/30" />
        <Button size="sm" onClick={() => createMut.mutate()} disabled={!url}>
          <Plus size={12} /> Add
        </Button>
      </div>

      <div className="space-y-2">
        {webhooks.map((w) => (
          <div key={w.id} className="flex items-center justify-between rounded-xl bg-gray-800/30 px-4 py-3 text-sm group">
            <div>
              <span className="font-mono text-xs text-gray-300">{w.url}</span>
              <span className="ml-3 text-xs text-gray-500">{(w.events || []).join(", ")}</span>
              {w.failure_count > 0 && (
                <span className="ml-3 text-xs text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">{w.failure_count} failures</span>
              )}
            </div>
            <button onClick={() => deleteMut.mutate(w.id)} className="text-gray-600 hover:text-red-400 p-1 rounded-lg hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {webhooks.length === 0 && <p className="text-gray-600 text-sm text-center py-4">No webhooks configured</p>}
      </div>
    </div>
  );
}

function DNCSection() {
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState("");

  const { data } = useQuery({ queryKey: ["dnc"], queryFn: () => fetch("/api/dnc").then((r) => r.json()) });
  const dncList = data?.dnc_list || [];

  const addMut = useMutation({
    mutationFn: () => fetch("/api/dnc", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone_number: phone }),
    }).then((r) => r.json()),
    onSuccess: () => { queryClient.invalidateQueries(["dnc"]); setPhone(""); },
  });

  const removeMut = useMutation({
    mutationFn: (number) => fetch(`/api/dnc/${encodeURIComponent(number)}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries(["dnc"]),
  });

  return (
    <div className="glass-card rounded-xl p-6">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
          <Shield size={15} className="text-red-400" />
        </div>
        <div>
          <h3 className="text-sm font-medium text-white">Do Not Call List</h3>
          <p className="text-xs text-gray-500">Numbers automatically skipped in campaigns</p>
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1234567890"
          className="flex-1 glass-card rounded-xl px-4 py-2.5 text-sm input-glow border border-gray-700/30 bg-gray-800/30 font-mono" />
        <Button size="sm" variant="destructive" onClick={() => addMut.mutate()} disabled={!phone}>Block Number</Button>
      </div>

      <div className="space-y-2 max-h-48 overflow-y-auto">
        {dncList.map((d) => (
          <div key={d.id} className="flex items-center justify-between rounded-xl bg-gray-800/30 px-4 py-2.5 text-sm group">
            <div>
              <span className="font-mono text-xs text-gray-300">{d.phone_number}</span>
              <span className="ml-3 text-xs text-gray-500">{d.reason}</span>
            </div>
            <button onClick={() => removeMut.mutate(d.phone_number)} className="text-xs text-gray-600 hover:text-white p-1 rounded-lg hover:bg-gray-700/50 transition-all opacity-0 group-hover:opacity-100">
              Remove
            </button>
          </div>
        ))}
        {dncList.length === 0 && <p className="text-gray-600 text-sm text-center py-4">DNC list is empty</p>}
      </div>
    </div>
  );
}

function ImportSection() {
  const [result, setResult] = useState(null);

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/contacts/import", { method: "POST", body: fd });
    const data = await res.json();
    setResult(data);
  };

  return (
    <div className="glass-card rounded-xl p-6">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
          <Upload size={15} className="text-emerald-400" />
        </div>
        <div>
          <h3 className="text-sm font-medium text-white">Import Contacts</h3>
          <p className="text-xs text-gray-500">Upload a CSV with columns: phone, name, email, company</p>
        </div>
      </div>
      <input type="file" accept=".csv" onChange={handleImport}
        className="glass-card rounded-xl px-4 py-3 text-sm border border-gray-700/30 bg-gray-800/30 file:bg-gray-700 file:border-0 file:text-gray-300 file:rounded-lg file:px-3 file:py-1.5 file:text-xs file:mr-3 file:cursor-pointer" />
      {result && (
        <p className="mt-3 text-sm text-emerald-400 bg-emerald-500/10 rounded-lg px-3 py-2 border border-emerald-500/20">Imported {result.imported} contacts</p>
      )}
    </div>
  );
}

function OrganizationSection() {
  const queryClient = useQueryClient();
  const tenantId = getTenantId();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [email, setEmail] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState("member");

  const { data: orgs } = useQuery({ queryKey: ["organizations"], queryFn: () => api.getOrganizations() });
  const orgList = Array.isArray(orgs) ? orgs : [];
  const currentOrg = orgList.find(o => o.id === tenantId);

  const { data: members } = useQuery({
    queryKey: ["org-members", tenantId],
    queryFn: () => api.getMembers(tenantId),
    enabled: !!tenantId,
  });
  const memberList = Array.isArray(members) ? members : [];

  const createMut = useMutation({
    mutationFn: () => api.createOrganization({ name, slug, owner_email: email }),
    onSuccess: () => {
      queryClient.invalidateQueries(["organizations"]);
      setShowCreate(false);
      setName(""); setSlug(""); setEmail("");
    },
  });

  const addMemberMut = useMutation({
    mutationFn: () => api.addMember(tenantId, memberEmail, memberRole),
    onSuccess: () => {
      queryClient.invalidateQueries(["org-members"]);
      setMemberEmail("");
    },
  });

  const removeMemberMut = useMutation({
    mutationFn: (em) => api.removeMember(tenantId, em),
    onSuccess: () => queryClient.invalidateQueries(["org-members"]),
  });

  const roleIcons = { owner: Crown, admin: Shield, member: User, viewer: User };

  return (
    <div className="glass-card rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <Building2 size={15} className="text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-white">Organizations</h3>
            <p className="text-xs text-gray-500">Multi-tenant workspace management</p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowCreate(!showCreate)}>
          <Plus size={12} /> New Org
        </Button>
      </div>

      {showCreate && (
        <div className="rounded-xl bg-gray-800/30 p-4 mb-4 space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Organization name"
            className="w-full glass-card rounded-xl px-4 py-2.5 text-sm input-glow border border-gray-700/30 bg-gray-800/30" />
          <input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="slug (url-friendly)"
            className="w-full glass-card rounded-xl px-4 py-2.5 text-sm input-glow border border-gray-700/30 bg-gray-800/30 font-mono" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Owner email"
            className="w-full glass-card rounded-xl px-4 py-2.5 text-sm input-glow border border-gray-700/30 bg-gray-800/30" />
          <Button size="sm" onClick={() => createMut.mutate()} disabled={!name || !slug || !email || createMut.isPending}>
            Create Organization
          </Button>
        </div>
      )}

      {orgList.length > 0 && (
        <div className="space-y-2 mb-4">
          {orgList.map(org => (
            <div key={org.id} className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm ${
              org.id === tenantId ? "bg-blue-500/10 border border-blue-500/20" : "bg-gray-800/30"
            }`}>
              <div>
                <span className="text-gray-200 font-medium">{org.name}</span>
                <span className="ml-2 text-[10px] font-mono text-gray-500">{org.slug}</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-700/50 text-gray-400 uppercase tracking-wider">{org.plan}</span>
            </div>
          ))}
        </div>
      )}

      {currentOrg && (
        <div className="border-t border-gray-800/30 pt-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Team Members</p>
            <span className="text-[10px] text-gray-600">{currentOrg.name}</span>
          </div>

          <div className="flex gap-2 mb-3">
            <input value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} placeholder="member@email.com"
              className="flex-1 glass-card rounded-xl px-3 py-2 text-sm input-glow border border-gray-700/30 bg-gray-800/30" />
            <select value={memberRole} onChange={(e) => setMemberRole(e.target.value)}
              className="rounded-xl px-3 py-2 text-sm border border-gray-700/30 bg-gray-800/30 text-gray-300">
              <option value="member">Member</option>
              <option value="admin">Admin</option>
              <option value="viewer">Viewer</option>
            </select>
            <Button size="sm" onClick={() => addMemberMut.mutate()} disabled={!memberEmail}>
              <UserPlus size={12} />
            </Button>
          </div>

          <div className="space-y-1">
            {memberList.map(m => {
              const RoleIcon = roleIcons[m.role] || User;
              return (
                <div key={m.id} className="flex items-center justify-between rounded-lg px-3 py-2 text-xs group hover:bg-gray-800/20">
                  <div className="flex items-center gap-2">
                    <RoleIcon size={12} className={m.role === "owner" ? "text-amber-400" : "text-gray-500"} />
                    <span className="text-gray-300">{m.email}</span>
                    <span className="text-[10px] text-gray-600">{m.role}</span>
                  </div>
                  {m.role !== "owner" && (
                    <button onClick={() => removeMemberMut.mutate(m.email)}
                      className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {currentOrg.api_key && (
            <div className="mt-4 pt-3 border-t border-gray-800/20">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">API Key</p>
              <code className="text-[11px] font-mono text-gray-400 bg-gray-800/50 px-3 py-1.5 rounded-lg block overflow-x-auto">
                {currentOrg.api_key}
              </code>
            </div>
          )}
        </div>
      )}

      {orgList.length === 0 && !showCreate && (
        <p className="text-gray-600 text-sm text-center py-4">No organizations yet. Create one to enable multi-tenancy.</p>
      )}
    </div>
  );
}

export default function Settings() {
  return (
    <div className="max-w-2xl space-y-5">
      <div className="mb-8">
        <h2 className="text-2xl font-bold gradient-text">Settings</h2>
        <p className="text-sm text-gray-500 mt-1">Configure organizations, webhooks, DNC list, and data import</p>
      </div>
      <OrganizationSection />
      <WebhookSection />
      <DNCSection />
      <ImportSection />
    </div>
  );
}
