import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Mail, Phone, CheckCircle, Clock, Send, Loader2 } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog";
import PageHeader from "../components/PageHeader";

const TEMPLATES = [
  {
    id: "follow_up",
    name: "Post-Call Follow Up",
    description: "Sends a summary email after each completed call with next steps",
    params: ["caller_name", "summary", "next_steps"],
  },
  {
    id: "appointment_confirmation",
    name: "Appointment Confirmation",
    description: "Confirms appointment details via email after booking during a call",
    params: ["date", "time", "location", "calendar_link"],
  },
  {
    id: "quote_details",
    name: "Quote / Pricing",
    description: "Sends detailed pricing or quote information discussed on the call",
    params: ["items", "total", "valid_until"],
  },
  {
    id: "document_share",
    name: "Document Share",
    description: "Emails documents, brochures, or attachments mentioned during the call",
    params: ["document_name", "link"],
  },
  {
    id: "payment_receipt",
    name: "Payment Receipt",
    description: "Sends payment confirmation and receipt after successful transaction",
    params: ["amount", "transaction_id", "date"],
  },
  {
    id: "escalation_notice",
    name: "Escalation Notice",
    description: "Notifies the team when a call is escalated and needs human follow-up",
    params: ["caller_name", "reason", "priority"],
  },
];

export default function EmailAutomation() {
  const [testDialog, setTestDialog] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testResult, setTestResult] = useState(null);

  const testMut = useMutation({
    mutationFn: () => api.testEmail(testEmail),
    onSuccess: (data) => setTestResult(data),
    onError: (err) => setTestResult({ status: "error", message: err.message }),
  });

  const { data: callsData } = useQuery({
    queryKey: ["calls-email"],
    queryFn: () => api.getCalls({ limit: 100 }),
    refetchInterval: 30_000,
  });

  const { data: providersData } = useQuery({
    queryKey: ["providers"],
    queryFn: () => api.getProviders(),
  });

  const smtpProvider = providersData?.providers?.find((p) => p.id === "smtp");
  const isConnected = smtpProvider?.configured ?? false;

  const calls = callsData?.calls || [];
  const emailCalls = calls.filter((c) =>
    c.transcript?.some((t) => t.text?.toLowerCase().includes("email"))
  );

  return (
    <div>
      <PageHeader title="Email Automation" description="Automated email actions triggered during AI calls" />

      <div className="px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          <div className="rounded-xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-subtle)' }}>
                <Mail size={15} style={{ color: 'var(--accent)' }} />
              </div>
              <p className="text-xs uppercase tracking-wider font-medium" style={{ color: 'var(--text-muted)' }}>Status</p>
            </div>
            <div className="flex items-center gap-2">
              {isConnected ? (
                <>
                  <CheckCircle size={18} style={{ color: 'var(--success)' }} />
                  <span className="text-lg font-semibold" style={{ color: 'var(--success)' }}>Connected</span>
                </>
              ) : (
                <>
                  <Clock size={18} style={{ color: 'var(--warning)' }} />
                  <span className="text-lg font-semibold" style={{ color: 'var(--warning)' }}>Not Connected</span>
                </>
              )}
            </div>
            <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
              {isConnected ? "SMTP via Google Workspace (no_reply@cogniflowautomations.com)" : "Set SMTP credentials to enable email automation"}
            </p>
            {isConnected && (
              <Button size="sm" className="mt-3" onClick={() => { setTestResult(null); setTestDialog(true); }}>
                <Send size={12} /> Send Test Email
              </Button>
            )}
          </div>

          <div className="rounded-xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-subtle)' }}>
                <Send size={15} style={{ color: 'var(--accent)' }} />
              </div>
              <p className="text-xs uppercase tracking-wider font-medium" style={{ color: 'var(--text-muted)' }}>How It Works</p>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              During live calls, the AI agent schedules emails using the <Badge variant="outline" className="text-[10px]">send_followup</Badge> tool with pre-defined templates.
            </p>
          </div>

          <div className="rounded-xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(245, 158, 11, 0.1)' }}>
                <Clock size={15} style={{ color: 'var(--warning)' }} />
              </div>
              <p className="text-xs uppercase tracking-wider font-medium" style={{ color: 'var(--text-muted)' }}>Email Calls</p>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{emailCalls.length}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>of {calls.length} recent calls mentioned email</p>
          </div>
        </div>

        <Tabs defaultValue="templates">
          <TabsList>
            <TabsTrigger value="templates">Email Templates</TabsTrigger>
            <TabsTrigger value="activity">Recent Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="templates">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {TEMPLATES.map((tpl) => (
                <div key={tpl.id} className="rounded-xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{tpl.name}</h3>
                    <Badge variant="success">Active</Badge>
                  </div>
                  <p className="text-xs mb-3 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{tpl.description}</p>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {tpl.params.map((p) => (
                      <Badge key={p} variant="outline" className="font-mono text-xs">
                        {`{{${p}}}`}
                      </Badge>
                    ))}
                  </div>
                  <div className="h-px my-3" style={{ background: 'var(--border)' }} />
                  <p className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                    Template ID: {tpl.id}
                  </p>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="activity">
            <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <div className="p-5 pb-0">
                <h3 className="text-sm font-medium mb-4" style={{ color: 'var(--text-primary)' }}>Calls Mentioning Email</h3>
              </div>
              {emailCalls.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-subtle)' }}>
                    <Mail size={18} style={{ color: 'var(--accent)' }} />
                  </div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>No email activity yet</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Email actions will appear here when triggered during calls</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Call ID</TableHead>
                      <TableHead>Caller</TableHead>
                      <TableHead>Direction</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {emailCalls.map((call, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {call.call_id?.slice(0, 8)}...
                        </TableCell>
                        <TableCell>{call.caller_number || "N/A"}</TableCell>
                        <TableCell>
                          <Badge variant={call.direction === "inbound" ? "default" : "secondary"}>
                            {call.direction}
                          </Badge>
                        </TableCell>
                        <TableCell>{call.duration_seconds ? `${call.duration_seconds}s` : "N/A"}</TableCell>
                        <TableCell className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {call.started_at ? new Date(call.started_at).toLocaleString() : "N/A"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={testDialog} onOpenChange={setTestDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Send Test Email</DialogTitle>
              <DialogDescription>Send a test email to verify your SMTP configuration.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Email Address</label>
                <input type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl px-4 py-3 outline-none border"
                  style={{ background: 'var(--bg-muted)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              </div>
              {testResult && (
                <div className="text-sm p-3 rounded-xl border"
                  style={{
                    background: testResult.status === "ok" ? 'color-mix(in srgb, var(--success) 10%, transparent)' : 'color-mix(in srgb, var(--danger) 10%, transparent)',
                    color: testResult.status === "ok" ? 'var(--success)' : 'var(--danger)',
                    borderColor: testResult.status === "ok" ? 'color-mix(in srgb, var(--success) 20%, transparent)' : 'color-mix(in srgb, var(--danger) 20%, transparent)',
                  }}>
                  {testResult.message || testResult.error || testResult.status}
                </div>
              )}
              <Button onClick={() => testMut.mutate()} disabled={testMut.isPending || !testEmail}>
                {testMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Send Test
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
