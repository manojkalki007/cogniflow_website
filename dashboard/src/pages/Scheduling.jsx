import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Calendar, CheckCircle, Clock, ExternalLink, Users } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import PageHeader from "../components/PageHeader";
import supabase from "../lib/supabase";

export default function Scheduling() {
  const { data: providersData } = useQuery({
    queryKey: ["providers"],
    queryFn: () => api.getProviders(),
  });

  const calProvider = providersData?.providers?.find((p) => p.id === "calcom");
  const isConnected = calProvider?.configured ?? false;

  const { data: bookingsData } = useQuery({
    queryKey: ["call-bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_bookings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) return { bookings: [] };
      return { bookings: data || [] };
    },
    refetchInterval: 30_000,
  });

  const bookings = bookingsData?.bookings || [];
  const confirmed = bookings.filter((b) => b.status === "confirmed");
  const pending = bookings.filter((b) => b.status === "pending");
  const cancelled = bookings.filter((b) => b.status === "cancelled");

  return (
    <div>
      <PageHeader title="Scheduling" description="Cal.com appointment booking and availability management" />

      <div className="px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          <div className="rounded-xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-subtle)' }}>
                <Calendar size={15} style={{ color: 'var(--accent)' }} />
              </div>
              <p className="text-xs uppercase tracking-wider font-medium" style={{ color: 'var(--text-muted)' }}>Cal.com Status</p>
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
              {isConnected
                ? "Cal.com API connected. Agents can check availability and book appointments."
                : "Set CAL_API_KEY and CAL_EVENT_TYPE_ID to enable"}
            </p>
          </div>

          <div className="rounded-xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-subtle)' }}>
                <Users size={15} style={{ color: 'var(--accent)' }} />
              </div>
              <p className="text-xs uppercase tracking-wider font-medium" style={{ color: 'var(--text-muted)' }}>How It Works</p>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              During live calls, the AI agent uses{" "}
              <Badge variant="outline" className="text-[10px]">check_availability</Badge> and{" "}
              <Badge variant="outline" className="text-[10px]">book_appointment</Badge> tools to schedule via Cal.com.
            </p>
          </div>

          <div className="rounded-xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(245, 158, 11, 0.1)' }}>
                <CheckCircle size={15} style={{ color: 'var(--success)' }} />
              </div>
              <p className="text-xs uppercase tracking-wider font-medium" style={{ color: 'var(--text-muted)' }}>Bookings</p>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{confirmed.length}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              confirmed &middot; {pending.length} pending &middot; {cancelled.length} cancelled
            </p>
          </div>
        </div>

        <Tabs defaultValue="bookings">
          <TabsList>
            <TabsTrigger value="bookings">Bookings</TabsTrigger>
            <TabsTrigger value="setup">Setup Guide</TabsTrigger>
          </TabsList>

          <TabsContent value="bookings">
            <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <div className="p-5 pb-0">
                <h3 className="text-sm font-medium mb-4" style={{ color: 'var(--text-primary)' }}>Recent Bookings</h3>
              </div>
              {bookings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-subtle)' }}>
                    <Calendar size={18} style={{ color: 'var(--accent)' }} />
                  </div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>No bookings yet</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Bookings from the website and AI calls will appear here</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Scheduled</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookings.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          {b.name}
                        </TableCell>
                        <TableCell className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {b.email}
                        </TableCell>
                        <TableCell className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {b.scheduled_at ? new Date(b.scheduled_at).toLocaleString() : "Pending"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {b.source === "cal_webhook" ? "Cal.com" : b.source || "website"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            b.status === "confirmed" ? "success"
                              : b.status === "cancelled" ? "destructive"
                                : "secondary"
                          }>
                            {b.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {b.created_at ? new Date(b.created_at).toLocaleString() : ""}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </TabsContent>

          <TabsContent value="setup">
            <div className="rounded-xl border p-6 space-y-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <div>
                <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>1. Get your Cal.com API Key</h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  Go to <span className="font-mono">Cal.com &rarr; Settings &rarr; Developer &rarr; API Keys</span> and create a new key.
                  Add it as <Badge variant="outline" className="font-mono text-[10px]">CAL_API_KEY</Badge> in your Railway environment variables.
                </p>
              </div>
              <div className="h-px" style={{ background: 'var(--border)' }} />
              <div>
                <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>2. Set Event Type ID</h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  Find your event type ID from <span className="font-mono">Cal.com &rarr; Event Types</span> (the number in the URL).
                  Add it as <Badge variant="outline" className="font-mono text-[10px]">CAL_EVENT_TYPE_ID</Badge> in Railway.
                </p>
              </div>
              <div className="h-px" style={{ background: 'var(--border)' }} />
              <div>
                <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>3. Configure Cal.com Webhook</h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  In Cal.com &rarr; Settings &rarr; Developer &rarr; Webhooks, add:<br />
                  URL: <span className="font-mono">https://cogniflowautomations.com/api/cal-webhook</span><br />
                  Events: <Badge variant="outline" className="text-[10px]">BOOKING_CREATED</Badge>{" "}
                  <Badge variant="outline" className="text-[10px]">BOOKING_RESCHEDULED</Badge>{" "}
                  <Badge variant="outline" className="text-[10px]">BOOKING_CANCELLED</Badge><br />
                  Set the webhook secret and add it as <Badge variant="outline" className="font-mono text-[10px]">CAL_WEBHOOK_SECRET</Badge> in Vercel.
                </p>
              </div>
              <div className="h-px" style={{ background: 'var(--border)' }} />
              <div>
                <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>4. Enable on Agents</h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  In Agent Builder, enable the <Badge variant="outline" className="text-[10px]">book_appointment</Badge> and{" "}
                  <Badge variant="outline" className="text-[10px]">check_availability</Badge> tools.
                  The agent will automatically use Cal.com when configured.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
