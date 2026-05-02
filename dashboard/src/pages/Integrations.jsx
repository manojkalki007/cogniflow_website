import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Plug, CheckCircle, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog";

const INTEGRATION_META = {
  salesforce: { icon: "⚡", color: "text-blue-400", bg: "bg-blue-500/10", description: "Sync contacts, log calls as Tasks, auto-create Leads" },
  hubspot: { icon: "🟠", color: "text-orange-400", bg: "bg-orange-500/10", description: "Push call data and contact updates to HubSpot CRM" },
  zoho: { icon: "🔵", color: "text-indigo-400", bg: "bg-indigo-500/10", description: "Connect to Zoho CRM for lead and contact sync" },
  google_calendar: { icon: "📅", color: "text-green-400", bg: "bg-green-500/10", description: "Check availability and book appointments via Google Calendar" },
  razorpay: { icon: "💳", color: "text-emerald-400", bg: "bg-emerald-500/10", description: "Generate and send payment links during calls" },
  webhook: { icon: "🔗", color: "text-purple-400", bg: "bg-purple-500/10", description: "Send call events to custom HTTP endpoints" },
};

const INTEGRATION_FIELDS = {
  salesforce: [
    { key: "client_id", label: "Client ID", type: "text" },
    { key: "client_secret", label: "Client Secret", type: "password" },
    { key: "username", label: "Username", type: "text" },
    { key: "password", label: "Password", type: "password" },
  ],
  hubspot: [
    { key: "api_key", label: "API Key", type: "password" },
  ],
  zoho: [
    { key: "client_id", label: "Client ID", type: "text" },
    { key: "client_secret", label: "Client Secret", type: "password" },
    { key: "domain", label: "Domain", type: "text", placeholder: "zoho.com" },
  ],
  google_calendar: [
    { key: "calendar_id", label: "Calendar ID", type: "text", placeholder: "primary" },
    { key: "service_account_json", label: "Service Account JSON", type: "textarea" },
  ],
  razorpay: [
    { key: "key_id", label: "Key ID", type: "text" },
    { key: "key_secret", label: "Key Secret", type: "password" },
  ],
  webhook: [
    { key: "url", label: "Webhook URL", type: "text", placeholder: "https://your-server.com/webhook" },
    { key: "secret", label: "Secret (optional)", type: "password" },
    { key: "events", label: "Events (comma-separated)", type: "text", placeholder: "call.completed, call.started" },
  ],
};

function ConfigDialog({ open, onOpenChange, integration }) {
  const queryClient = useQueryClient();
  const type = integration?.type || "";
  const fields = INTEGRATION_FIELDS[type] || [];
  const [config, setConfig] = useState(() => integration?.config || {});
  const [testResult, setTestResult] = useState(null);

  const updateMut = useMutation({
    mutationFn: () => api.updateIntegration(integration.id || type, {
      name: integration.name,
      status: "connected",
      config,
    }),
    onSuccess: () => { queryClient.invalidateQueries(["integrations"]); onOpenChange(false); },
  });

  const testMut = useMutation({
    mutationFn: () => api.testIntegration(integration.id || type),
    onSuccess: (data) => setTestResult(data),
  });

  const disconnectMut = useMutation({
    mutationFn: () => api.updateIntegration(integration.id || type, { status: "disconnected", config: {} }),
    onSuccess: () => { queryClient.invalidateQueries(["integrations"]); onOpenChange(false); },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-xl">{INTEGRATION_META[type]?.icon}</span>
            Configure {integration?.name}
          </DialogTitle>
          <DialogDescription>{INTEGRATION_META[type]?.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {fields.map(f => (
            <div key={f.key}>
              <label className="block text-sm text-gray-400 mb-1.5 font-medium">{f.label}</label>
              {f.type === "textarea" ? (
                <textarea value={config[f.key] || ""} onChange={(e) => setConfig({ ...config, [f.key]: e.target.value })}
                  rows={4} className="w-full glass-card rounded-xl px-4 py-3 input-glow border border-gray-700/30 bg-gray-800/30 resize-none font-mono text-xs"
                  placeholder={f.placeholder} />
              ) : (
                <input type={f.type} value={config[f.key] || ""} onChange={(e) => setConfig({ ...config, [f.key]: e.target.value })}
                  className="w-full glass-card rounded-xl px-4 py-3 input-glow border border-gray-700/30 bg-gray-800/30" placeholder={f.placeholder} />
              )}
            </div>
          ))}
        </div>

        {testResult && (
          <div className={`text-sm p-3 rounded-xl ${testResult.status === "ok" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
            {testResult.message || testResult.status}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button onClick={() => updateMut.mutate()} disabled={updateMut.isPending}>
            {updateMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
            {integration?.status === "connected" ? "Update" : "Connect"}
          </Button>
          <Button variant="outline" onClick={() => testMut.mutate()} disabled={testMut.isPending}>
            {testMut.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
            Test Connection
          </Button>
          {integration?.status === "connected" && (
            <Button variant="destructive" onClick={() => disconnectMut.mutate()}>Disconnect</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function IntegrationCard({ integration, onClick }) {
  const meta = INTEGRATION_META[integration.type] || {};
  const statusIcon = {
    connected: <CheckCircle size={14} className="text-emerald-400" />,
    disconnected: <XCircle size={14} className="text-gray-500" />,
    error: <AlertTriangle size={14} className="text-red-400" />,
  };

  return (
    <div className="glass-card rounded-xl p-5 cursor-pointer transition-all duration-200 hover:shadow-lg group" onClick={onClick}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl ${meta.bg || "bg-gray-800/50"} flex items-center justify-center text-xl`}>
            {meta.icon || "🔌"}
          </div>
          <div>
            <h3 className="font-medium text-white">{integration.name}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{meta.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {statusIcon[integration.status] || statusIcon.disconnected}
          <Badge variant={integration.status === "connected" ? "success" : integration.status === "error" ? "destructive" : "secondary"}>
            {integration.status}
          </Badge>
        </div>
      </div>
      {integration.last_sync_at && (
        <p className="text-[10px] text-gray-600 mt-3 font-mono">Last sync: {new Date(integration.last_sync_at).toLocaleString()}</p>
      )}
      {integration.error_message && (
        <p className="text-xs text-red-400 mt-2 bg-red-500/5 rounded-lg px-3 py-1.5 border border-red-500/10">{integration.error_message}</p>
      )}
    </div>
  );
}

export default function Integrations() {
  const [configDialog, setConfigDialog] = useState({ open: false, integration: null });

  const { data } = useQuery({
    queryKey: ["integrations"],
    queryFn: api.getIntegrations,
  });

  const integrations = data?.integrations || [];
  const connected = integrations.filter(i => i.status === "connected");
  const available = integrations.filter(i => i.status !== "connected");

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold gradient-text">Integrations</h2>
          <p className="text-sm text-gray-500 mt-1">Connect your CRM, calendar, and payment tools</p>
        </div>
        <Badge variant="outline" className="text-xs">{connected.length} connected</Badge>
      </div>

      {connected.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" /> Connected
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {connected.map(i => (
              <IntegrationCard key={i.id || i.type} integration={i}
                onClick={() => setConfigDialog({ open: true, integration: i })} />
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-medium text-gray-400 mb-3">
          {connected.length > 0 ? "Available" : "All Integrations"}
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {available.map(i => (
            <IntegrationCard key={i.id || i.type} integration={i}
              onClick={() => setConfigDialog({ open: true, integration: i })} />
          ))}
        </div>
      </div>

      {integrations.length === 0 && (
        <div className="text-center py-16 glass-card rounded-xl">
          <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
            <Plug size={24} className="text-purple-400" />
          </div>
          <p className="text-gray-400">No integrations available</p>
        </div>
      )}

      {configDialog.integration && (
        <ConfigDialog open={configDialog.open}
          onOpenChange={(open) => setConfigDialog({ open, integration: configDialog.integration })}
          integration={configDialog.integration} />
      )}
    </div>
  );
}
