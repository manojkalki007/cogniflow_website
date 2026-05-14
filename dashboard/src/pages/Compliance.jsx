import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { ShieldCheck, AlertTriangle, ShieldAlert, Clock, Search } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";
import { Button } from "../components/ui/button";
import PageHeader from "../components/PageHeader";

const SEVERITY_BADGE = {
  critical: "destructive",
  high: "destructive",
  warning: "warning",
  info: "default",
  low: "secondary",
};

const TYPE_LABELS = {
  pci_violation: "PCI Violation",
  pii_detected: "PII Detected",
  prompt_injection: "Prompt Injection",
  disclosure_missing: "Missing Disclosure",
  aadhaar_detected: "Aadhaar Number",
  pan_detected: "PAN Number",
  ssn_detected: "SSN Number",
  email_detected: "Email Address",
  card_detected: "Credit Card",
};

function StatCard({ icon: Icon, label, value, iconColor, iconBg }) {
  return (
    <div className="rounded-xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: iconBg }}>
          <Icon size={15} style={{ color: iconColor }} />
        </div>
        <p className="text-xs uppercase tracking-wider font-medium" style={{ color: 'var(--text-muted)' }}>{label}</p>
      </div>
      <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
    </div>
  );
}

export default function Compliance() {
  const [filter, setFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["compliance"],
    queryFn: () => api.getComplianceEvents(),
    refetchInterval: 15_000,
  });

  const events = data?.events || [];

  const filtered = events.filter((e) => {
    if (severityFilter !== "all" && e.severity !== severityFilter) return false;
    if (filter) {
      const q = filter.toLowerCase();
      return (
        (e.call_id || "").toLowerCase().includes(q) ||
        (e.type || "").toLowerCase().includes(q) ||
        (e.detail || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const criticalCount = events.filter((e) => e.severity === "critical" || e.severity === "high").length;
  const warningCount = events.filter((e) => e.severity === "warning").length;
  const infoCount = events.filter((e) => e.severity === "info" || e.severity === "low").length;

  return (
    <div>
      <PageHeader title="Compliance" description="DNC, consent, and regulatory status" />

      <div className="px-8 py-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard icon={ShieldCheck} label="Total Events" value={events.length} iconColor="var(--accent)" iconBg="var(--accent-subtle)" />
          <StatCard icon={ShieldAlert} label="Critical" value={criticalCount} iconColor="var(--danger)" iconBg="var(--accent-subtle)" />
          <StatCard icon={AlertTriangle} label="Warnings" value={warningCount} iconColor="var(--warning)" iconBg="var(--accent-subtle)" />
          <StatCard icon={Clock} label="Info" value={infoCount} iconColor="var(--text-muted)" iconBg="var(--accent-subtle)" />
        </div>

        <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="p-5 pb-4">
            <div className="flex flex-col sm:flex-row justify-between gap-3">
              <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Event Log</h3>
              <div className="flex gap-3">
                <div className="relative">
                  <Search size={14} className="absolute left-3.5 top-2.5" style={{ color: 'var(--text-muted)' }} />
                  <input
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Search events..."
                    className="rounded-xl pl-10 pr-4 py-2 text-sm border w-48"
                    style={{ background: 'var(--bg-muted)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="rounded-xl px-4 py-2 text-sm border"
                  style={{ background: 'var(--bg-muted)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                >
                  <option value="all">All Severity</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="warning">Warning</option>
                  <option value="info">Info</option>
                </select>
              </div>
            </div>
          </div>

          {isLoading ? (
            <p className="text-sm px-5 pb-5" style={{ color: 'var(--text-muted)' }}>Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
              {events.length === 0 ? "No compliance events recorded" : "No events match the filter"}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Call ID</TableHead>
                  <TableHead>Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((event, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                      {event.timestamp
                        ? new Date(event.timestamp).toLocaleString()
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {TYPE_LABELS[event.type] || event.type || "Unknown"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={SEVERITY_BADGE[event.severity] || "secondary"}>
                        {event.severity || "info"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                      {event.call_id ? event.call_id.slice(0, 8) + "..." : "—"}
                    </TableCell>
                    <TableCell className="text-sm max-w-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                      {event.detail || event.message || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}
