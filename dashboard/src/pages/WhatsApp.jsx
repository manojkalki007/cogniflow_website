import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { MessageSquare, Phone, CheckCircle, Clock } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";

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
      <div className="mb-8">
        <h2 className="text-2xl font-bold gradient-text">WhatsApp Integration</h2>
        <p className="text-sm text-gray-500 mt-1">Send messages during live calls via WhatsApp Business API</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        <div className="glass-card stat-card rounded-xl p-5">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <MessageSquare size={15} className="text-emerald-400" />
            </div>
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Status</p>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle size={18} className="text-emerald-400" />
            <span className="text-lg font-semibold text-emerald-400">Connected</span>
          </div>
          <p className="text-xs text-gray-500 mt-1.5">WhatsApp Business API via tool calling</p>
        </div>

        <div className="glass-card stat-card rounded-xl p-5">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Phone size={15} className="text-blue-400" />
            </div>
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">How It Works</p>
          </div>
          <p className="text-sm text-gray-300">
            During live calls, the AI agent sends WhatsApp messages using the <Badge variant="outline" className="text-[10px]">send_whatsapp</Badge> tool.
          </p>
        </div>

        <div className="glass-card stat-card rounded-xl p-5">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Clock size={15} className="text-amber-400" />
            </div>
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">WhatsApp Calls</p>
          </div>
          <p className="text-2xl font-bold text-white">{whatsappCalls.length}</p>
          <p className="text-xs text-gray-500 mt-1">of {calls.length} recent calls</p>
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
              <div key={tpl.id} className="glass-card rounded-xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-white">{tpl.name}</h3>
                  <Badge variant="success">Active</Badge>
                </div>
                <p className="text-xs text-gray-500 mb-3">{tpl.description}</p>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {tpl.params.map((p) => (
                    <Badge key={p} variant="outline" className="font-mono text-xs">
                      {`{{${p}}}`}
                    </Badge>
                  ))}
                </div>
                <div className="h-px bg-gradient-to-r from-transparent via-gray-700/50 to-transparent my-3" />
                <p className="text-[10px] text-gray-600 font-mono">
                  Template ID: {tpl.id}
                </p>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="activity">
          <div className="glass-card rounded-xl overflow-hidden">
            <div className="p-5 pb-0">
              <h3 className="text-sm font-medium text-white mb-4">Calls Mentioning WhatsApp</h3>
            </div>
            {whatsappCalls.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">
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
                      <TableCell className="font-mono text-xs text-gray-400">
                        {call.call_id?.slice(0, 8)}...
                      </TableCell>
                      <TableCell>{call.caller_number || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={call.direction === "inbound" ? "default" : "secondary"}>
                          {call.direction}
                        </Badge>
                      </TableCell>
                      <TableCell>{call.duration_seconds ? `${call.duration_seconds}s` : "—"}</TableCell>
                      <TableCell className="text-gray-500 text-xs">
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
  );
}
