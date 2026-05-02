import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { ArrowLeft, Phone, Save, User, Clock } from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";

export default function ContactDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});

  const { data: contact } = useQuery({
    queryKey: ["contact", id],
    queryFn: () => api.getContact(id),
  });

  const save = useMutation({
    mutationFn: (data) => api.updateContact(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["contact", id]);
      setEditing(false);
    },
  });

  if (!contact || contact.error) {
    return <p className="text-gray-500">Contact not found</p>;
  }

  const startEdit = () => {
    setForm({
      name: contact.name || "",
      email: contact.email || "",
      company: contact.company || "",
      notes: contact.notes || "",
    });
    setEditing(true);
  };

  return (
    <div className="max-w-2xl">
      <button onClick={() => navigate("/dashboard/contacts")} className="flex items-center gap-1.5 text-gray-500 hover:text-white text-sm mb-6 transition-colors">
        <ArrowLeft size={14} /> Back to Contacts
      </button>

      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <User size={20} className="text-violet-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{contact.name || "Unknown Contact"}</h2>
              <p className="text-gray-500 font-mono text-sm">{contact.phone_number}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button size="sm"
              onClick={() => navigate(`/dashboard/call?phone=${encodeURIComponent(contact.phone_number)}`)}>
              <Phone size={12} /> Call
            </Button>
            {!editing && (
              <Button size="sm" variant="outline" onClick={startEdit}>Edit</Button>
            )}
          </div>
        </div>

        {editing ? (
          <div className="space-y-4 animate-fade-in">
            {["name", "email", "company", "notes"].map((field) => (
              <div key={field}>
                <label className="block text-sm text-gray-400 mb-1.5 font-medium capitalize">{field}</label>
                {field === "notes" ? (
                  <textarea
                    value={form[field]}
                    onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                    rows={3}
                    className="w-full glass-card rounded-xl px-4 py-3 input-glow border border-gray-700/30 bg-gray-800/30 text-sm resize-none"
                  />
                ) : (
                  <input
                    value={form[field]}
                    onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                    className="w-full glass-card rounded-xl px-4 py-3 input-glow border border-gray-700/30 bg-gray-800/30 text-sm"
                  />
                )}
              </div>
            ))}
            <div className="flex gap-3 pt-1">
              <Button size="sm" onClick={() => save.mutate(form)}>
                <Save size={12} /> Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 text-sm">
            {[
              { label: "Email", value: contact.email },
              { label: "Company", value: contact.company },
              { label: "Total Calls", value: contact.total_calls || 0 },
              { label: "Language", value: contact.language || "en" },
            ].map(({ label, value }) => (
              <div key={label} className="p-3 rounded-xl bg-gray-800/30">
                <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">{label}</p>
                <p className="text-gray-200">{value || "--"}</p>
              </div>
            ))}
            {contact.notes && (
              <div className="col-span-2 p-3 rounded-xl bg-gray-800/30">
                <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Notes</p>
                <p className="text-gray-300">{contact.notes}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {contact.calls && contact.calls.length > 0 && (
        <div className="mt-6 animate-fade-in">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Clock size={13} className="text-blue-400" />
            </div>
            <h3 className="text-sm font-medium">Call History</h3>
          </div>
          <div className="space-y-3">
            {contact.calls.map((call) => (
              <div key={call.id} className="glass-card rounded-xl p-4">
                <div className="flex justify-between text-sm mb-2">
                  <div className="flex gap-2">
                    <Badge variant={call.direction === "inbound" ? "default" : "secondary"} className="text-[10px]">
                      {call.direction}
                    </Badge>
                    <span className="text-gray-500 text-xs flex items-center gap-1">
                      <Clock size={10} />
                      {call.duration_seconds || 0}s
                    </span>
                    <span className="text-gray-600 text-xs">{call.provider || "twilio"}</span>
                  </div>
                  <span className="text-gray-600 text-xs">
                    {call.started_at ? new Date(call.started_at).toLocaleString() : ""}
                  </span>
                </div>
                {call.summary && <p className="text-sm text-gray-400">{call.summary}</p>}
                {call.disposition && (
                  <Badge variant="outline" className="mt-2 text-[10px]">{call.disposition}</Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
