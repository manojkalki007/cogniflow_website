import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { ArrowLeft, Phone, Save, User, Clock } from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import PageHeader from "../components/PageHeader";

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
    return <p style={{ color: 'var(--text-muted)' }}>Contact not found</p>;
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
    <div>
      <PageHeader title="Contact Details" description="View and edit contact information" />

      <div className="px-8 py-6">
        <div className="max-w-2xl">
          <button
            onClick={() => navigate("/home/contacts")}
            className="flex items-center gap-1.5 text-sm mb-6 transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            <ArrowLeft size={14} /> Back to Contacts
          </button>

          <div className="rounded-xl border p-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-subtle)' }}>
                  <User size={20} style={{ color: 'var(--accent)' }} />
                </div>
                <div>
                  <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{contact.name || "Unknown Contact"}</h2>
                  <p className="font-mono text-sm" style={{ color: 'var(--text-muted)' }}>{contact.phone_number}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Button size="sm" className="text-white" style={{ background: 'var(--accent)' }}
                  onClick={() => navigate(`/home/agents?call=${encodeURIComponent(contact.phone_number)}`)}>
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
                    <label className="block text-sm mb-1.5 font-medium capitalize" style={{ color: 'var(--text-secondary)' }}>{field}</label>
                    {field === "notes" ? (
                      <textarea
                        value={form[field]}
                        onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                        rows={3}
                        className="w-full rounded-xl px-4 py-3 outline-none border text-sm resize-none"
                        style={{ background: 'var(--bg-muted)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                      />
                    ) : (
                      <input
                        value={form[field]}
                        onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                        className="w-full rounded-xl px-4 py-3 outline-none border text-sm"
                        style={{ background: 'var(--bg-muted)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                      />
                    )}
                  </div>
                ))}
                <div className="flex gap-3 pt-1">
                  <Button size="sm" className="text-white" style={{ background: 'var(--accent)' }} onClick={() => save.mutate(form)}>
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
                  <div key={label} className="p-3 rounded-xl" style={{ background: 'var(--bg-muted)' }}>
                    <p className="text-xs uppercase tracking-wider font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
                    <p style={{ color: 'var(--text-secondary)' }}>{value || "--"}</p>
                  </div>
                ))}
                {contact.notes && (
                  <div className="col-span-2 p-3 rounded-xl" style={{ background: 'var(--bg-muted)' }}>
                    <p className="text-xs uppercase tracking-wider font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Notes</p>
                    <p style={{ color: 'var(--text-secondary)' }}>{contact.notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {contact.calls && contact.calls.length > 0 && (
            <div className="mt-6 animate-fade-in">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-subtle)' }}>
                  <Clock size={13} style={{ color: 'var(--accent)' }} />
                </div>
                <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Call History</h3>
              </div>
              <div className="space-y-3">
                {contact.calls.map((call) => (
                  <div key={call.id} className="rounded-xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                    <div className="flex justify-between text-sm mb-2">
                      <div className="flex gap-2">
                        <Badge variant={call.status === "completed" ? "success" : "secondary"} className="text-[10px]">
                          {call.status || "unknown"}
                        </Badge>
                        <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                          <Clock size={10} />
                          {call.duration_seconds || 0}s
                        </span>
                      </div>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {call.started_at ? new Date(call.started_at).toLocaleString() : call.created_at ? new Date(call.created_at).toLocaleString() : ""}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
