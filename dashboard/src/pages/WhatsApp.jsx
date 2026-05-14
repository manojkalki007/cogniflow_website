import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { MessageSquare, Phone, CheckCircle, Clock } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
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

export default function WhatsApp() {
  const { data: callsData } = useQuery({
    queryKey: ["calls-whatsapp"],
    queryFn: () => api.getCalls({ limit: 100 }),
    refetchInterval: 30_000,
  });

  const calls = callsData?.calls || [];
  const whatsappCalls = calls.filter((c) =>
    c.transcript?.some((t) => t.text?.toLowerCase().includes("whatsapp"))
  );

  return (
    <div>
      <PageHeader title="WhatsApp" description="Manage WhatsApp messaging and campaigns" />

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
              <CheckCircle size={18} style={{ color: 'var(--success)' }} />
              <span className="text-lg font-semibold" style={{ color: 'var(--success)' }}>Connected</span>
            </div>
            <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>WhatsApp Business API via tool calling</p>
          </div>

          <div className="rounded-xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-subtle)' }}>
                <Phone size={15} style={{ color: 'var(--accent)' }} />
              </div>
              <p className="text-xs uppercase tracking-wider font-medium" style={{ color: 'var(--text-muted)' }}>How It Works</p>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              During live calls, the AI agent sends WhatsApp messages using the <Badge variant="outline" className="text-[10px]">send_whatsapp</Badge> tool.
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

        <Tabs defaultValue="templates">
          <TabsList>
            <TabsTrigger value="templates">Message Templates</TabsTrigger>
            <TabsTrigger value="activity">Recent Activity</TabsTrigger>
          </TabsList>

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
                          {call.call_id?.slice(0, 8)}...
                        </TableCell>
                        <TableCell>{call.caller_number || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={call.direction === "inbound" ? "default" : "secondary"}>
                            {call.direction}
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
      </div>
    </div>
  );
}
