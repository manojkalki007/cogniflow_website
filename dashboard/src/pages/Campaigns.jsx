import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  Upload, Play, Pause, Plus, ChevronDown, ChevronUp, BarChart3,
  Users, Phone, CheckCircle, XCircle, Clock, Beaker,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";

const STATUS_COLORS = {
  draft: "secondary", active: "success", paused: "warning", completed: "default", failed: "destructive",
};

function CampaignCreateDialog({ open, onOpenChange, agents }) {
  const queryClient = useQueryClient();
  const fileRef = useRef(null);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: "", agent_id: "", phone_numbers: "", max_concurrent: "1",
    retry_max: "3", retry_delay_minutes: "30",
    call_window_start: "09:00", call_window_end: "18:00", timezone: "Asia/Kolkata",
  });

  const set = (k, v) => setForm({ ...form, [k]: v });

  const createMut = useMutation({
    mutationFn: (data) => api.createCampaign(data),
    onSuccess: () => { queryClient.invalidateQueries(["campaigns"]); onOpenChange(false); setStep(1); },
  });

  const uploadMut = useMutation({
    mutationFn: (formData) => fetch("/api/campaigns/upload", { method: "POST", body: formData }).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries(["campaigns"]); onOpenChange(false); setStep(1); },
  });

  const numbers = form.phone_numbers.split(/[\n,]/).map(n => n.trim()).filter(Boolean);

  const handleCreate = () => {
    createMut.mutate({
      name: form.name,
      agent_id: form.agent_id || undefined,
      phone_numbers: numbers,
      max_concurrent: parseInt(form.max_concurrent) || 1,
    });
  };

  const handleUpload = () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("name", form.name || file.name);
    fd.append("max_concurrent", form.max_concurrent);
    if (form.agent_id) fd.append("agent_id", form.agent_id);
    uploadMut.mutate(fd);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Campaign</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 mb-5">
          {[1, 2, 3].map(s => (
            <div key={s} className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${step >= s ? "btn-gradient shadow-sm shadow-blue-500/20" : "bg-gray-800"}`} />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4 text-sm">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5 font-medium">Campaign Name *</label>
              <input value={form.name} onChange={(e) => set("name", e.target.value)}
                className="w-full glass-card rounded-xl px-4 py-3 input-glow border border-gray-700/30 bg-gray-800/30" placeholder="Q4 Lead Outreach" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5 font-medium">Select Agent</label>
              <select value={form.agent_id} onChange={(e) => set("agent_id", e.target.value)}
                className="w-full glass-card rounded-xl px-4 py-3 border border-gray-700/30 bg-gray-800/30">
                <option value="">Default Agent</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <Button size="sm" onClick={() => setStep(2)} disabled={!form.name}>Next</Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5 font-medium">Phone Numbers (one per line)</label>
                <textarea value={form.phone_numbers} onChange={(e) => set("phone_numbers", e.target.value)}
                  rows={6} placeholder={"+919876543210\n+918765432109"}
                  className="w-full glass-card rounded-xl px-4 py-3 input-glow border border-gray-700/30 bg-gray-800/30 resize-none font-mono text-xs" />
                {numbers.length > 0 && <p className="text-xs text-gray-500 mt-1.5">{numbers.length} numbers entered</p>}
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5 font-medium">Or upload CSV</label>
                <div className="border-2 border-dashed border-gray-700/50 rounded-xl p-6 text-center hover:border-gray-500/50 transition-all duration-200">
                  <input ref={fileRef} type="file" accept=".csv" className="hidden" id="csv-upload" />
                  <label htmlFor="csv-upload" className="cursor-pointer">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center mx-auto mb-2">
                      <Upload size={18} className="text-blue-400" />
                    </div>
                    <p className="text-xs text-gray-400">Click to select CSV</p>
                  </label>
                </div>
                <Button size="sm" variant="outline" onClick={handleUpload} className="mt-3 w-full">
                  <Upload size={12} /> Upload & Create
                </Button>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button size="sm" variant="ghost" onClick={() => setStep(1)}>Back</Button>
              <Button size="sm" onClick={() => setStep(3)} disabled={numbers.length === 0}>Next</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5 text-sm">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5 font-medium">Max Concurrent</label>
                <input type="number" min={1} max={20} value={form.max_concurrent}
                  onChange={(e) => set("max_concurrent", e.target.value)}
                  className="w-full glass-card rounded-xl px-4 py-3 input-glow border border-gray-700/30 bg-gray-800/30" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5 font-medium">Max Retries</label>
                <input type="number" min={0} max={5} value={form.retry_max}
                  onChange={(e) => set("retry_max", e.target.value)}
                  className="w-full glass-card rounded-xl px-4 py-3 input-glow border border-gray-700/30 bg-gray-800/30" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5 font-medium">Retry Delay (min)</label>
                <input type="number" min={5} value={form.retry_delay_minutes}
                  onChange={(e) => set("retry_delay_minutes", e.target.value)}
                  className="w-full glass-card rounded-xl px-4 py-3 input-glow border border-gray-700/30 bg-gray-800/30" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5 font-medium">Call Window Start</label>
                <input type="time" value={form.call_window_start}
                  onChange={(e) => set("call_window_start", e.target.value)}
                  className="w-full glass-card rounded-xl px-4 py-3 border border-gray-700/30 bg-gray-800/30" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5 font-medium">Call Window End</label>
                <input type="time" value={form.call_window_end}
                  onChange={(e) => set("call_window_end", e.target.value)}
                  className="w-full glass-card rounded-xl px-4 py-3 border border-gray-700/30 bg-gray-800/30" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5 font-medium">Timezone</label>
                <select value={form.timezone} onChange={(e) => set("timezone", e.target.value)}
                  className="w-full glass-card rounded-xl px-4 py-3 border border-gray-700/30 bg-gray-800/30">
                  <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                  <option value="America/New_York">America/New_York (EST)</option>
                  <option value="America/Los_Angeles">America/LA (PST)</option>
                  <option value="Europe/London">Europe/London (GMT)</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
            </div>

            <div className="glass-card rounded-xl p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1.5">Summary</p>
              <p className="text-sm text-gray-300">{form.name} — {numbers.length} contacts, max {form.max_concurrent} concurrent, window {form.call_window_start}–{form.call_window_end}</p>
            </div>

            <div className="flex gap-3">
              <Button size="sm" variant="ghost" onClick={() => setStep(2)}>Back</Button>
              <Button size="sm" onClick={handleCreate} disabled={createMut.isPending}>
                {createMut.isPending ? "Creating..." : "Create Campaign"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CampaignAnalytics({ campaignId }) {
  const { data } = useQuery({
    queryKey: ["campaign-analytics", campaignId],
    queryFn: () => api.getCampaignAnalytics(campaignId),
    enabled: !!campaignId,
  });

  if (!data || data.total_calls === 0) return <p className="text-xs text-gray-500 mt-2">No analytics yet</p>;

  const dispositions = data.dispositions || {};
  const colors = ["text-blue-400", "text-emerald-400", "text-violet-400", "text-amber-400"];

  return (
    <div className="mt-4 space-y-3">
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total Calls", value: data.total_calls },
          { label: "Conversion", value: `${data.conversion_rate}%` },
          { label: "Avg Duration", value: `${data.avg_duration}s` },
          { label: "Unique Contacts", value: data.unique_contacts },
        ].map(({ label, value }, i) => (
          <div key={label} className="rounded-xl bg-gray-800/30 p-3 text-center">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">{label}</p>
            <p className={`text-sm font-bold ${colors[i]}`}>{value}</p>
          </div>
        ))}
      </div>
      {Object.keys(dispositions).length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {Object.entries(dispositions).map(([d, count]) => (
            <Badge key={d} variant="outline" className="text-[10px]">{d}: {count}</Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function ABTestPanel({ campaignId }) {
  const [showSetup, setShowSetup] = useState(false);
  const [variants, setVariants] = useState([
    { name: "Control", weight: 50 }, { name: "Variant B", weight: 50 },
  ]);

  const queryClient = useQueryClient();
  const { data: results } = useQuery({
    queryKey: ["ab-results", campaignId],
    queryFn: () => api.getABTestResults(campaignId),
    enabled: !!campaignId,
  });

  const createMut = useMutation({
    mutationFn: () => api.createABTest(campaignId, variants),
    onSuccess: () => { queryClient.invalidateQueries(["ab-results"]); setShowSetup(false); },
  });

  const addVariant = () => setVariants([...variants, { name: `Variant ${String.fromCharCode(65 + variants.length)}`, weight: 0 }]);

  const hasTest = results && !results.error && results.variants;

  return (
    <div className="mt-4">
      {hasTest ? (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-3">A/B Test Results</p>
          <div className="space-y-2">
            {(results.variants || []).map((v, i) => (
              <div key={i} className="flex items-center gap-3 text-xs glass-card rounded-xl p-3">
                <span className="font-medium w-24">{v.name}</span>
                <span className="text-gray-500">Calls: {v.total_calls || 0}</span>
                <span className="text-gray-500">Conv: {v.conversion_rate || 0}%</span>
                {results.winner === v.name && <Badge variant="success" className="text-[10px]">Winner</Badge>}
              </div>
            ))}
          </div>
        </div>
      ) : showSetup ? (
        <div className="glass-card rounded-xl p-4 space-y-3">
          <p className="text-xs text-gray-400 font-medium">Configure A/B Test Variants</p>
          {variants.map((v, i) => (
            <div key={i} className="flex gap-3 items-center">
              <input value={v.name} onChange={(e) => { const copy = [...variants]; copy[i].name = e.target.value; setVariants(copy); }}
                className="flex-1 glass-card rounded-xl px-3 py-2 text-xs input-glow border border-gray-700/30 bg-gray-800/30" />
              <input type="number" value={v.weight} onChange={(e) => { const copy = [...variants]; copy[i].weight = parseInt(e.target.value) || 0; setVariants(copy); }}
                className="w-16 glass-card rounded-xl px-3 py-2 text-xs input-glow border border-gray-700/30 bg-gray-800/30" />
              <span className="text-[10px] text-gray-500">%</span>
            </div>
          ))}
          <div className="flex gap-3">
            <Button size="sm" variant="ghost" onClick={addVariant}><Plus size={10} /> Add</Button>
            <Button size="sm" onClick={() => createMut.mutate()} disabled={createMut.isPending}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowSetup(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setShowSetup(true)}>
          <Beaker size={12} /> Setup A/B Test
        </Button>
      )}
    </div>
  );
}

function ProgressBar({ dialed, total }) {
  const pct = total > 0 ? (dialed / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 bg-gray-800/50 rounded-full h-2.5 overflow-hidden">
        <div className="btn-gradient h-full rounded-full transition-all duration-500 shadow-sm shadow-blue-500/20" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 font-mono">{dialed}/{total} ({Math.round(pct)}%)</span>
    </div>
  );
}

function CampaignCard({ campaign }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  const startMut = useMutation({
    mutationFn: (id) => api.startCampaign(id),
    onSuccess: () => queryClient.invalidateQueries(["campaigns"]),
  });

  const pauseMut = useMutation({
    mutationFn: (id) => api.pauseCampaign(id),
    onSuccess: () => queryClient.invalidateQueries(["campaigns"]),
  });

  const c = campaign;

  return (
    <div className="glass-card rounded-xl p-5 transition-all duration-200">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold text-white">{c.name}</h3>
          <Badge variant={STATUS_COLORS[c.status] || "secondary"}>{c.status}</Badge>
        </div>
        <div className="flex gap-2 items-center">
          {(c.status === "draft" || c.status === "paused") && (
            <Button size="sm" variant="outline" onClick={() => startMut.mutate(c.id)}>
              <Play size={12} /> Start
            </Button>
          )}
          {c.status === "active" && (
            <Button size="sm" variant="outline" onClick={() => pauseMut.mutate(c.id)}>
              <Pause size={12} /> Pause
            </Button>
          )}
          <button onClick={() => setExpanded(!expanded)} className="text-gray-500 hover:text-white p-1.5 rounded-lg hover:bg-gray-800/50 transition-all">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      <ProgressBar dialed={c.dialed_count || 0} total={c.total_numbers || 0} />

      <div className="flex gap-4 mt-3 text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><Users size={11} /> {c.total_numbers || 0} total</span>
        <span className="flex items-center gap-1.5"><Phone size={11} /> {c.dialed_count || 0} dialed</span>
        <span className="flex items-center gap-1.5"><CheckCircle size={11} className="text-emerald-500" /> {c.completed_count || 0} completed</span>
        <span className="flex items-center gap-1.5"><XCircle size={11} className="text-red-400" /> {c.failed_count || 0} failed</span>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-800/30 animate-fade-in">
          <Tabs defaultValue="analytics">
            <TabsList>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="abtest">A/B Test</TabsTrigger>
            </TabsList>
            <TabsContent value="analytics">
              <CampaignAnalytics campaignId={c.id} />
            </TabsContent>
            <TabsContent value="abtest">
              <ABTestPanel campaignId={c.id} />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}

export default function Campaigns() {
  const [showCreate, setShowCreate] = useState(false);

  const { data } = useQuery({
    queryKey: ["campaigns"],
    queryFn: api.getCampaigns,
    refetchInterval: 5000,
  });

  const { data: agentsData } = useQuery({ queryKey: ["agents"], queryFn: api.getAgents });

  const campaigns = data?.campaigns || [];
  const agents = agentsData?.agents || [];

  const active = campaigns.filter(c => c.status === "active");
  const other = campaigns.filter(c => c.status !== "active");

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold gradient-text">Campaigns</h2>
          <p className="text-sm text-gray-500 mt-1">Manage outbound calling campaigns</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus size={14} /> New Campaign
        </Button>
      </div>

      {active.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Live Campaigns
          </h3>
          <div className="space-y-4">
            {active.map(c => <CampaignCard key={c.id} campaign={c} />)}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {other.map(c => <CampaignCard key={c.id} campaign={c} />)}
      </div>

      {campaigns.length === 0 && (
        <div className="text-center py-16 glass-card rounded-xl">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
            <BarChart3 size={24} className="text-blue-400" />
          </div>
          <p className="text-gray-400 mb-1">No campaigns yet</p>
          <p className="text-gray-600 text-sm mb-4">Create your first outbound campaign to get started.</p>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus size={14} /> Create Your First Campaign
          </Button>
        </div>
      )}

      <CampaignCreateDialog open={showCreate} onOpenChange={setShowCreate} agents={agents} />
    </div>
  );
}
