import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { DollarSign, TrendingUp, Target, ArrowDownRight } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import PageHeader from "../components/PageHeader";

const STAGE_CONFIG = {
  call_completed: { label: "Call Completed", color: "bg-gray-500", badge: "secondary" },
  lead_qualified: { label: "Lead Qualified", color: "bg-blue-500", badge: "default" },
  appointment_booked: { label: "Appointment Booked", color: "bg-yellow-500", badge: "warning" },
  deal_won: { label: "Deal Won", color: "bg-green-500", badge: "success" },
};

function formatCurrency(amount, currency = "INR") {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(amount);
}

function StatCard({ icon: Icon, label, value, idx = 0 }) {
  return (
    <div
      className="rounded-xl border p-5"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-center gap-2.5 mb-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--accent-subtle)' }}
        >
          <Icon size={15} style={{ color: 'var(--accent)' }} />
        </div>
        <p className="text-xs uppercase tracking-wider font-medium" style={{ color: 'var(--text-muted)' }}>{label}</p>
      </div>
      <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
    </div>
  );
}

function FunnelStage({ stage, count, total, nextCount }) {
  const config = STAGE_CONFIG[stage] || STAGE_CONFIG.call_completed;
  const pct = total > 0 ? (count / total) * 100 : 0;
  const conversionRate = nextCount != null && count > 0
    ? ((nextCount / count) * 100).toFixed(1)
    : null;

  return (
    <div className="flex items-center gap-4">
      <div className="flex-1">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{config.label}</span>
          <span className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>{count}</span>
        </div>
        <Progress value={pct} color={config.color} />
      </div>
      {conversionRate && (
        <div className="flex items-center gap-1 text-xs w-20" style={{ color: 'var(--text-muted)' }}>
          <ArrowDownRight size={12} />
          {conversionRate}%
        </div>
      )}
    </div>
  );
}

export default function Revenue() {
  const { data, isLoading } = useQuery({
    queryKey: ["revenue"],
    queryFn: api.getRevenue,
    refetchInterval: 30_000,
  });

  const summary = data || {};
  const funnelStages = summary.funnel || {};
  const recentDeals = summary.recent_deals || [];
  const totalCalls = funnelStages.call_completed || 0;

  const stageOrder = ["call_completed", "lead_qualified", "appointment_booked", "deal_won"];
  const stageCounts = stageOrder.map((s) => funnelStages[s] || 0);

  return (
    <div>
      <PageHeader title="Revenue" description="Track billing and revenue metrics" />

      <div className="px-8 py-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard icon={DollarSign} label="Total Revenue" value={formatCurrency(summary.total_revenue)} />
          <StatCard icon={TrendingUp} label="Pipeline Value" value={formatCurrency(summary.pipeline_value)} />
          <StatCard icon={Target} label="Conversion Rate" value={summary.conversion_rate != null ? `${summary.conversion_rate}%` : "—"} />
          <StatCard icon={DollarSign} label="Avg Deal Size" value={formatCurrency(summary.avg_deal_size)} />
        </div>

        <Tabs defaultValue="funnel">
          <TabsList>
            <TabsTrigger value="funnel">Funnel</TabsTrigger>
            <TabsTrigger value="deals">Recent Deals</TabsTrigger>
          </TabsList>

          <TabsContent value="funnel">
            <div
              className="rounded-xl border p-6"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <h3 className="text-sm font-medium mb-5" style={{ color: 'var(--text-primary)' }}>Conversion Funnel</h3>
              {isLoading ? (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading...</p>
              ) : totalCalls === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>No call data yet</p>
              ) : (
                <div className="space-y-5">
                  {stageOrder.map((stage, i) => (
                    <FunnelStage
                      key={stage}
                      stage={stage}
                      count={stageCounts[i]}
                      total={totalCalls}
                      nextCount={i < stageCounts.length - 1 ? stageCounts[i + 1] : null}
                    />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="deals">
            <div
              className="rounded-xl border overflow-hidden"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <div className="p-5 pb-0">
                <h3 className="text-sm font-medium mb-4" style={{ color: 'var(--text-primary)' }}>Recent Deals</h3>
              </div>
              {recentDeals.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>No deals closed yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Call ID</TableHead>
                      <TableHead>Caller</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Revenue</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentDeals.map((deal, i) => {
                      const stageConf = STAGE_CONFIG[deal.funnel_stage] || STAGE_CONFIG.call_completed;
                      return (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{deal.call_id?.slice(0, 8)}...</TableCell>
                          <TableCell style={{ color: 'var(--text-secondary)' }}>{deal.phone_number || "—"}</TableCell>
                          <TableCell>
                            <Badge variant={stageConf.badge}>{stageConf.label}</Badge>
                          </TableCell>
                          <TableCell className="font-medium" style={{ color: 'var(--success)' }}>
                            {formatCurrency(deal.revenue_amount, deal.revenue_currency)}
                          </TableCell>
                          <TableCell className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {deal.conversion_at ? new Date(deal.conversion_at).toLocaleDateString() : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
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
