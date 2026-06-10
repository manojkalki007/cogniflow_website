import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { MessageSquare, Phone, CheckCircle, Clock, Send, Loader2, ArrowLeft, User, Bot, AlertTriangle } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog";
import PageHeader from "../components/PageHeader";

const TEMPLATES = [
  {
    id: "appointment_confirmation",
    name: "Appointment Confirmation",
    description: "Sends appointment date, time, and location to the caller",
    params: ["date", "time", "location"],
  },
  {
    id: "payment_link",
    name: "Payment Link",
    description: "Sends a payment link with amount details",
    params: ["amount", "link"],
  },
  {
    id: "document_share",
    name: "Document Share",
    description: "Shares a document or brochure link",
    params: ["document_name", "link"],
  },
  {
    id: "fee_details",
    name: "Fee Details",
    description: "Sends detailed fee breakdown",
    params: ["details"],
  },
];

function ConversationList({ onSelect }) {
  const { data, isLoading } = useQuery({
    queryKey: ["wa-conversations"],
    queryFn: () => api.getWhatsAppConversations(),
    refetchInterval: 10_000,
  });

  const convos = [...(data?.conversations || [])].sort((a, b) => {
    if (a.status === "escalated" && b.status !== "escalated") return -1;
    if (b.status === "escalated" && a.status !== "escalated") return 1;
    return 0;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={20} className="animate-spin" style={{ color: "var(--text-muted)" }} />
      </div>
    );
  }

  if (convos.length === 0) {
    return (
      <div className="text-center py-12">
        <MessageSquare size={32} className="mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>No WhatsApp conversations yet</p>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          Conversations appear when leads message your WhatsApp number
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {convos.map((c) => (
        <div
          key={c.id}
          className="p-4 rounded-xl border cursor-pointer transition-all duration-200 hover:shadow-sm"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          onClick={() => onSelect(c.phone_number)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: "rgba(37, 211, 102, 0.1)" }}
              >
                <User size={16} className="text-[#25D366]" />
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {c.phone_number}
                </p>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {c.message_count || 0} messages
                </p>
              </div>
            </div>
            <div className="text-right">
              <Badge
                variant={c.status === "escalated" ? "destructive" : c.status === "active" ? "success" : "secondary"}
                className="text-[10px]"
              >
                {c.status === "escalated" && <AlertTriangle size={8} className="mr-1" />}
                {c.status}
              </Badge>
              <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                {c.last_message_at ? new Date(c.last_message_at).toLocaleString() : ""}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ChatView({ phone, onBack }) {
  const queryClient = useQueryClient();
  const [replyText, setReplyText] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["wa-messages", phone],
    queryFn: () => api.getWhatsAppMessages(phone),
    refetchInterval: 5_000,
  });

  const { data: convoData } = useQuery({
    queryKey: ["wa-conversations"],
    queryFn: () => api.getWhatsAppConversations(),
  });

  const convo = (convoData?.conversations || []).find((c) => c.phone_number === phone);
  const isEscalated = convo?.status === "escalated";
  const escalationMeta = convo?.metadata || {};

  const resolveMut = useMutation({
    mutationFn: () => api.resolveWhatsAppConversation(phone),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wa-conversations"] }),
  });

  const replyMut = useMutation({
    mutationFn: (text) => api.sendWhatsAppReply(phone, text),
    onSuccess: () => {
      setReplyText("");
      queryClient.invalidateQueries({ queryKey: ["wa-messages", phone] });
    },
  });

  const messages = data?.messages || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft size={14} />
          </Button>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: "rgba(37, 211, 102, 0.1)" }}
          >
            <User size={14} className="text-[#25D366]" />
          </div>
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{phone}</span>
          {isEscalated && (
            <Badge variant="destructive" className="text-[10px]">
              <AlertTriangle size={8} className="mr-1" /> Escalated
            </Badge>
          )}
        </div>
        {isEscalated && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => resolveMut.mutate()}
            disabled={resolveMut.isPending}
          >
            {resolveMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
            <span className="ml-1">Resolve</span>
          </Button>
        )}
      </div>

      {isEscalated && escalationMeta.escalation_reason && (
        <div
          className="rounded-lg border px-4 py-2.5 mb-3 text-xs"
          style={{
            background: "color-mix(in srgb, var(--danger) 8%, transparent)",
            borderColor: "color-mix(in srgb, var(--danger) 20%, transparent)",
            color: "var(--text-secondary)",
          }}
        >
          <strong>Escalation reason:</strong> {escalationMeta.escalation_reason}
          {escalationMeta.escalation_department && (
            <span className="ml-2">
              <strong>Dept:</strong> {escalationMeta.escalation_department}
            </span>
          )}
        </div>
      )}

      <div
        className="rounded-xl border p-4 space-y-3 max-h-[500px] overflow-y-auto"
        style={{ background: "var(--bg-muted)", borderColor: "var(--border)" }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={18} className="animate-spin" style={{ color: "var(--text-muted)" }} />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>No messages</p>
        ) : (
          messages.map((msg) => {
            const isInbound = msg.direction === "inbound";
            const meta = typeof msg.metadata === "string" ? JSON.parse(msg.metadata || "{}") : (msg.metadata || {});
            const isHuman = meta.sent_by === "human";
            return (
              <div key={msg.id} className={`flex ${isInbound ? "justify-start" : "justify-end"}`}>
                <div
                  className="max-w-[75%] rounded-2xl px-4 py-2.5"
                  style={{
                    background: isInbound
                      ? "var(--surface)"
                      : isHuman
                        ? "color-mix(in srgb, var(--success) 80%, black)"
                        : "var(--accent)",
                    color: isInbound ? "var(--text-primary)" : "#fff",
                    border: isInbound ? "1px solid var(--border)" : "none",
                  }}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    {isInbound ? (
                      <User size={10} style={{ opacity: 0.5 }} />
                    ) : (
                      <Bot size={10} style={{ opacity: 0.7 }} />
                    )}
                    <span className="text-[9px] font-medium" style={{ opacity: 0.6 }}>
                      {isInbound ? "Lead" : isHuman ? "Human Agent" : "AI Agent"}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed">{msg.content}</p>
                  <p className="text-[9px] mt-1 text-right" style={{ opacity: 0.5 }}>
                    {msg.created_at ? new Date(msg.created_at).toLocaleTimeString() : ""}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {isEscalated && (
        <div className="flex items-center gap-2 mt-3">
          <input
            type="text"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && replyText.trim()) replyMut.mutate(replyText.trim());
            }}
            placeholder="Type a reply as human agent..."
            className="flex-1 rounded-xl px-4 py-2.5 outline-none border text-sm"
            style={{ background: "var(--bg-muted)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
          <Button
            size="sm"
            onClick={() => replyText.trim() && replyMut.mutate(replyText.trim())}
            disabled={replyMut.isPending || !replyText.trim()}
          >
            {replyMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
          </Button>
        </div>
      )}
    </div>
  );
}

export default function WhatsApp() {
  const [testDialog, setTestDialog] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testTemplate, setTestTemplate] = useState("appointment_confirmation");
  const [testResult, setTestResult] = useState(null);
  const [selectedPhone, setSelectedPhone] = useState(null);

  const testMut = useMutation({
    mutationFn: () => api.testWhatsApp(testPhone, testTemplate),
    onSuccess: (data) => setTestResult(data),
    onError: (err) => setTestResult({ status: "error", message: err.message }),
  });

  const { data: callsData } = useQuery({
    queryKey: ["calls-whatsapp"],
    queryFn: () => api.getCalls({ limit: 100 }),
    refetchInterval: 30_000,
  });

  const { data: providersData } = useQuery({
    queryKey: ["providers"],
    queryFn: () => api.getProviders(),
  });

  const whatsappProvider = providersData?.providers?.find((p) => p.id === "whatsapp");
  const isConnected = whatsappProvider?.configured ?? false;

  const calls = callsData?.calls || [];
  const whatsappCalls = calls.filter((c) =>
    c.transcript?.some((t) => t.text?.toLowerCase().includes("whatsapp"))
  );

  return (
    <div>
      <PageHeader title="WhatsApp" description="Manage WhatsApp messaging, campaigns, and chat conversations" />

      <div className="px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          <div className="rounded-xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(37, 211, 102, 0.1)' }}>
                <MessageSquare size={15} className="text-[#25D366]" />
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
              {isConnected ? "WhatsApp Business API via tool calling" : "Set WHATSAPP_API_KEY to enable"}
            </p>
            {isConnected && (
              <Button size="sm" className="mt-3" onClick={() => { setTestResult(null); setTestDialog(true); }}>
                <Send size={12} /> Send Test Message
              </Button>
            )}
          </div>

          <div className="rounded-xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-subtle)' }}>
                <Phone size={15} style={{ color: 'var(--accent)' }} />
              </div>
              <p className="text-xs uppercase tracking-wider font-medium" style={{ color: 'var(--text-muted)' }}>How It Works</p>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              During live calls, the AI sends WhatsApp messages. Leads can also chat back — the agent replies autonomously.
            </p>
          </div>

          <div className="rounded-xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(245, 158, 11, 0.1)' }}>
                <Clock size={15} style={{ color: 'var(--warning)' }} />
              </div>
              <p className="text-xs uppercase tracking-wider font-medium" style={{ color: 'var(--text-muted)' }}>WhatsApp Calls</p>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{whatsappCalls.length}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>of {calls.length} recent calls</p>
          </div>
        </div>

        <Tabs defaultValue="conversations">
          <TabsList>
            <TabsTrigger value="conversations">Conversations</TabsTrigger>
            <TabsTrigger value="templates">Message Templates</TabsTrigger>
            <TabsTrigger value="activity">Recent Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="conversations">
            <div className="rounded-xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              {selectedPhone ? (
                <ChatView phone={selectedPhone} onBack={() => setSelectedPhone(null)} />
              ) : (
                <ConversationList onSelect={setSelectedPhone} />
              )}
            </div>
          </TabsContent>

          <TabsContent value="templates">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {TEMPLATES.map((tpl) => (
                <div key={tpl.id} className="rounded-xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{tpl.name}</h3>
                    <Badge variant="success">Active</Badge>
                  </div>
                  <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>{tpl.description}</p>
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
                <h3 className="text-sm font-medium mb-4" style={{ color: 'var(--text-primary)' }}>Calls Mentioning WhatsApp</h3>
              </div>
              {whatsappCalls.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
                  No WhatsApp activity in recent calls
                </p>
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
                    {whatsappCalls.map((call, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {call.id?.slice(0, 8)}...
                        </TableCell>
                        <TableCell>{call.phone_number || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={call.status === "completed" ? "success" : "secondary"}>
                            {call.status || "unknown"}
                          </Badge>
                        </TableCell>
                        <TableCell>{call.duration_seconds ? `${call.duration_seconds}s` : "—"}</TableCell>
                        <TableCell className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {call.started_at ? new Date(call.started_at).toLocaleString() : "—"}
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
              <DialogTitle>Send Test WhatsApp Message</DialogTitle>
              <DialogDescription>Send a test template message to verify your WhatsApp integration.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Phone Number</label>
                <input type="text" value={testPhone} onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="+919876543210"
                  className="w-full rounded-xl px-4 py-3 outline-none border"
                  style={{ background: 'var(--bg-muted)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="block text-sm mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Template</label>
                <select value={testTemplate} onChange={(e) => setTestTemplate(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 outline-none border"
                  style={{ background: 'var(--bg-muted)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                  {TEMPLATES.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
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
              <Button onClick={() => testMut.mutate()} disabled={testMut.isPending || !testPhone}>
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
