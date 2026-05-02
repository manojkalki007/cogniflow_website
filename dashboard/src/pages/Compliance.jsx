import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { ShieldCheck, AlertTriangle, ShieldAlert, Clock, Search } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";
import { Button } from "../components/ui/button";

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

function StatCard({ icon: Icon, label, value, color, bg }) {
  return (
    <div className="glass-card stat-card rounded-xl p-5">
      <div className="flex items-center gap-2.5 mb-3">
        <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}>
          <Icon size={15} className={color} />
        </div>
        <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">{label}</p>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
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
      <div className="mb-8">
        <h2 className="text-2xl font-bold gradient-text">Compliance Monitor</h2>
        <p className="text-sm text-gray-500 mt-1">Track PII, PCI, and security events across calls</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={ShieldCheck} label="Total Events" value={events.length} color="text-blue-400" bg="bg-blue-500/10" />
        <StatCard icon={ShieldAlert} label="Critical" value={criticalCount} color="text-red-400" bg="bg-red-500/10" />
        <StatCard icon={AlertTriangle} label="Warnings" value={warningCount} color="text-amber-400" bg="bg-amber-500/10" />
        <StatCard icon={Clock} label="Info" value={infoCount} color="text-gray-400" bg="bg-gray-500/10" />
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <div className="p-5 pb-4">
          <div className="flex flex-col sm:flex-row justify-between gap-3">
            <h3 className="text-sm font-medium text-white">Event Log</h3>
            <div className="flex gap-3">
              <div className="relative">
                <Search size={14} className="absolute left-3.5 top-2.5 text-gray-500" />
                <input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Search events..."
                  className="glass-card rounded-xl pl-10 pr-4 py-2 text-sm input-glow border border-gray-700/30 bg-gray-800/30 w-48"
                />
              </div>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="glass-card rounded-xl px-4 py-2 text-sm border border-gray-700/30 bg-gray-800/30"
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
          <p className="text-gray-500 text-sm px-5 pb-5">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">
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
                  <TableCell className="text-gray-500 text-xs whitespace-nowrap">
                    {event.timestamp
                      ? new Date(event.timestamp).toLocaleString()
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {TYPE_LABELS[event.type] || event.type || "Unknown"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={SEVERITY_BADGE[event.severity] || "secondary"}>
                      {event.severity || "info"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-gray-500">
                    {event.call_id ? event.call_id.slice(0, 8) + "..." : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-gray-400 max-w-xs truncate">
                    {event.detail || event.message || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
