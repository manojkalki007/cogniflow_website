import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import Papa from "papaparse";
import { api } from "../lib/api";
import { Search, Phone, User, Upload, Plus, X, FileSpreadsheet, AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import PageHeader from "../components/PageHeader";

function ContactForm({ onSubmit, onCancel }) {
  const [form, setForm] = useState({ name: "", phone_number: "", email: "", company: "", tags: "", notes: "" });
  const set = (k, v) => setForm({ ...form, [k]: v });

  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm mb-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>Name *</label>
          <input value={form.name} onChange={(e) => set("name", e.target.value)}
            className="w-full rounded-xl px-4 py-3 border outline-none transition-colors focus:border-[var(--accent)]"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            placeholder="John Doe" />
        </div>
        <div>
          <label className="block text-sm mb-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>Phone *</label>
          <input value={form.phone_number} onChange={(e) => set("phone_number", e.target.value)}
            className="w-full rounded-xl px-4 py-3 border font-mono outline-none transition-colors focus:border-[var(--accent)]"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            placeholder="+919876543210" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm mb-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>Email</label>
          <input value={form.email} onChange={(e) => set("email", e.target.value)}
            className="w-full rounded-xl px-4 py-3 border outline-none transition-colors focus:border-[var(--accent)]"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            placeholder="john@example.com" />
        </div>
        <div>
          <label className="block text-sm mb-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>Company</label>
          <input value={form.company} onChange={(e) => set("company", e.target.value)}
            className="w-full rounded-xl px-4 py-3 border outline-none transition-colors focus:border-[var(--accent)]"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            placeholder="Acme Corp" />
        </div>
      </div>
      <div>
        <label className="block text-sm mb-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>Tags <span style={{ color: 'var(--text-muted)' }}>(comma-separated)</span></label>
        <input value={form.tags} onChange={(e) => set("tags", e.target.value)}
          className="w-full rounded-xl px-4 py-3 border outline-none transition-colors focus:border-[var(--accent)]"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          placeholder="lead, enterprise, inbound" />
      </div>
      <div>
        <label className="block text-sm mb-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>Notes</label>
        <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2}
          className="w-full rounded-xl px-4 py-3 border resize-none outline-none transition-colors focus:border-[var(--accent)]"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          placeholder="Any additional notes..." />
      </div>
      <div className="flex gap-3 pt-1">
        <Button size="sm" onClick={() => onSubmit({ ...form, tags: form.tags ? form.tags.split(",").map(t => t.trim()) : [] })}
          disabled={!form.name || !form.phone_number}>
          <Plus size={12} /> Add Contact
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

function CSVImportDialog({ open, onOpenChange }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState("upload");
  const [csvData, setCsvData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [importResult, setImportResult] = useState(null);

  const FIELDS = [
    { key: "phone_number", label: "Phone", required: true },
    { key: "name", label: "Name" },
    { key: "email", label: "Email" },
    { key: "company", label: "Company" },
    { key: "tags", label: "Tags" },
    { key: "notes", label: "Notes" },
  ];

  const onDrop = useCallback((files) => {
    const file = files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        setCsvData(result.data);
        setHeaders(result.meta.fields || []);
        const autoMap = {};
        (result.meta.fields || []).forEach((h) => {
          const lower = h.toLowerCase().replace(/[_\s-]/g, "");
          if (lower.includes("phone") || lower.includes("mobile") || lower.includes("number")) autoMap.phone_number = h;
          else if (lower === "name" || lower === "fullname") autoMap.name = h;
          else if (lower.includes("email") || lower.includes("mail")) autoMap.email = h;
          else if (lower.includes("company") || lower.includes("org")) autoMap.company = h;
          else if (lower.includes("tag")) autoMap.tags = h;
          else if (lower.includes("note")) autoMap.notes = h;
        });
        setMapping(autoMap);
        setStep("map");
      },
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { "text/csv": [".csv"] }, maxFiles: 1 });

  const importMut = useMutation({
    mutationFn: (contacts) => api.importContacts(contacts),
    onSuccess: (result) => {
      setImportResult(result);
      setStep("done");
      queryClient.invalidateQueries(["contacts"]);
    },
  });

  const handleImport = () => {
    const mapped = csvData.map((row) => {
      const contact = {};
      FIELDS.forEach(({ key }) => {
        if (mapping[key]) contact[key] = row[mapping[key]] || "";
      });
      if (contact.tags && typeof contact.tags === "string") {
        contact.tags = contact.tags.split(",").map(t => t.trim()).filter(Boolean);
      }
      return contact;
    }).filter((c) => c.phone_number);
    importMut.mutate(mapped);
  };

  const handleClose = () => {
    setStep("upload");
    setCsvData([]);
    setHeaders([]);
    setMapping({});
    setImportResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl" style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)' }}>
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--text-primary)' }}>Import Contacts from CSV</DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-200`}
            style={{ borderColor: isDragActive ? 'var(--accent)' : 'var(--border)', background: isDragActive ? 'var(--accent-subtle)' : 'transparent' }}>
            <input {...getInputProps()} />
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--accent-subtle)' }}>
              <FileSpreadsheet size={22} style={{ color: 'var(--accent)' }} />
            </div>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{isDragActive ? "Drop your CSV file here..." : "Drag & drop a CSV file, or click to browse"}</p>
            <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>Supports .csv files up to 5MB</p>
          </div>
        )}

        {step === "map" && (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Found {csvData.length} rows. Map your CSV columns:</p>
            <div className="space-y-3">
              {FIELDS.map(({ key, label, required }) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="w-28 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{label} {required && <span style={{ color: 'var(--danger)' }}>*</span>}</span>
                  <select value={mapping[key] || ""} onChange={(e) => setMapping({ ...mapping, [key]: e.target.value })}
                    className="flex-1 rounded-xl px-4 py-2.5 text-sm border outline-none transition-colors focus:border-[var(--accent)]"
                    style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                    <option value="">-- Select column --</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>

            <div className="rounded-xl border p-4 max-h-40 overflow-auto" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <p className="text-xs mb-2 font-medium" style={{ color: 'var(--text-muted)' }}>Preview (first 3 rows):</p>
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ color: 'var(--text-muted)' }}>
                    {FIELDS.filter(f => mapping[f.key]).map(f => <th key={f.key} className="text-left p-1">{f.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {csvData.slice(0, 3).map((row, i) => (
                    <tr key={i} style={{ color: 'var(--text-secondary)' }}>
                      {FIELDS.filter(f => mapping[f.key]).map(f => <td key={f.key} className="p-1">{row[mapping[f.key]] || "--"}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-3">
              <Button size="sm" onClick={handleImport} disabled={!mapping.phone_number || importMut.isPending}>
                {importMut.isPending ? "Importing..." : `Import ${csvData.length} contacts`}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setStep("upload")}>Back</Button>
            </div>
          </div>
        )}

        {step === "done" && importResult && (
          <div className="space-y-4 text-center py-6">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto" style={{ background: 'var(--accent-subtle)' }}>
              <span className="text-3xl" style={{ color: 'var(--success)' }}>&#10003;</span>
            </div>
            <p className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{importResult.imported} contacts imported</p>
            {importResult.duplicates > 0 && (
              <p className="text-sm flex items-center justify-center gap-1.5" style={{ color: 'var(--warning)' }}>
                <AlertTriangle size={14} /> {importResult.duplicates} duplicates skipped
              </p>
            )}
            <Button onClick={handleClose}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function Contacts() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [tagFilter, setTagFilter] = useState("");
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ["contacts", search],
    queryFn: () => api.getContacts(search ? { search } : {}),
    refetchInterval: 30_000,
  });

  const { data: dncData } = useQuery({
    queryKey: ["dnc"],
    queryFn: api.getDNC,
  });

  const createMut = useMutation({
    mutationFn: (data) => api.createContact(data),
    onSuccess: () => { queryClient.invalidateQueries(["contacts"]); setShowAdd(false); },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.deleteContact(id),
    onSuccess: () => queryClient.invalidateQueries(["contacts"]),
  });

  const contacts = data?.contacts || [];
  const dncSet = new Set((dncData?.dnc_list || []).map(d => d.phone_number || d));

  const allTags = [...new Set(contacts.flatMap(c => c.tags || []))].filter(Boolean);
  const filtered = tagFilter ? contacts.filter(c => (c.tags || []).includes(tagFilter)) : contacts;

  return (
    <div>
      <PageHeader
        title="Contacts"
        description="Manage your contact database"
        action={
          <div className="flex gap-3">
            <Button size="sm" variant="outline" onClick={() => setShowImport(true)}>
              <Upload size={14} /> Import CSV
            </Button>
            <Button size="sm" onClick={() => setShowAdd(true)}>
              <Plus size={14} /> Add Contact
            </Button>
          </div>
        }
      />

      <div className="px-8 py-6">
        {showAdd && (
          <div className="rounded-xl border p-6 mb-5 animate-fade-in" style={{ background: 'var(--surface)', borderColor: 'var(--accent)' }}>
            <h3 className="text-sm font-medium mb-4" style={{ color: 'var(--text-primary)' }}>Add Contact</h3>
            <ContactForm onSubmit={(data) => createMut.mutate(data)} onCancel={() => setShowAdd(false)} />
            {createMut.isError && <p className="text-xs mt-3 rounded-lg px-3 py-2 border" style={{ color: 'var(--danger)', background: 'var(--surface)', borderColor: 'var(--danger)' }}>Failed to create contact</p>}
          </div>
        )}

        <div className="flex gap-3 mb-5">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3.5 top-3" style={{ color: 'var(--text-muted)' }} />
            <input type="text" placeholder="Search by name, phone, or company..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl pl-10 pr-4 py-2.5 text-sm border outline-none transition-colors focus:border-[var(--accent)]"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
          </div>
        </div>

        {allTags.length > 0 && (
          <div className="flex gap-2 mb-5 flex-wrap">
            <button onClick={() => setTagFilter("")}
              className={`text-xs px-3 py-1.5 rounded-lg transition-all duration-200 border ${!tagFilter ? "text-white shadow-md" : ""}`}
              style={!tagFilter
                ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' }
                : { background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
              All
            </button>
            {allTags.map(tag => (
              <button key={tag} onClick={() => setTagFilter(tagFilter === tag ? "" : tag)}
                className={`text-xs px-3 py-1.5 rounded-lg transition-all duration-200 border ${tagFilter === tag ? "text-white shadow-md" : ""}`}
                style={tagFilter === tag
                  ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' }
                  : { background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                {tag}
              </button>
            ))}
          </div>
        )}

        <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wider" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                <th className="text-left p-4">Name</th>
                <th className="text-left p-4">Phone</th>
                <th className="text-left p-4">Company</th>
                <th className="text-left p-4">Tags</th>
                <th className="text-left p-4">Calls</th>
                <th className="text-left p-4">Status</th>
                <th className="text-left p-4">Last Call</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b cursor-pointer group transition-colors"
                  style={{ borderColor: 'var(--border)' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-muted)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  onClick={() => navigate(`/dashboard/contacts/${c.id}`)}>
                  <td className="p-4 flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-subtle)' }}>
                      <User size={13} style={{ color: 'var(--accent)' }} />
                    </div>
                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{c.name || <span style={{ color: 'var(--text-muted)' }}>Unknown</span>}</span>
                  </td>
                  <td className="p-4 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{c.phone_number}</td>
                  <td className="p-4 text-xs" style={{ color: 'var(--text-muted)' }}>{c.company || "--"}</td>
                  <td className="p-4">
                    <div className="flex gap-1 flex-wrap">
                      {(c.tags || []).slice(0, 3).map(tag => (
                        <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">{tag}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="p-4" style={{ color: 'var(--text-muted)' }}>{c.total_calls || 0}</td>
                  <td className="p-4">
                    {dncSet.has(c.phone_number) ? (
                      <Badge variant="destructive">DNC</Badge>
                    ) : (
                      <Badge variant="success">Active</Badge>
                    )}
                  </td>
                  <td className="p-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {c.last_call_at ? new Date(c.last_call_at).toLocaleDateString() : "--"}
                  </td>
                  <td className="p-4">
                    <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/call?phone=${encodeURIComponent(c.phone_number)}`); }}
                        className="p-1 rounded-lg transition-all" style={{ color: 'var(--accent)' }}><Phone size={14} /></button>
                      <button onClick={(e) => { e.stopPropagation(); if (confirm("Delete this contact?")) deleteMut.mutate(c.id); }}
                        className="p-1 rounded-lg transition-all" style={{ color: 'var(--text-muted)' }}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-subtle)' }}>
                        <User size={18} style={{ color: 'var(--accent)' }} />
                      </div>
                      <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                        {contacts.length === 0 ? "No contacts yet" : "No contacts match the filter"}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {contacts.length === 0 ? "Add one or import a CSV to get started." : "Try adjusting your search or filter."}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="text-xs mt-4 text-right font-mono" style={{ color: 'var(--text-muted)' }}>
          Showing {filtered.length} of {contacts.length} contacts
        </p>

        <CSVImportDialog open={showImport} onOpenChange={setShowImport} />
      </div>
    </div>
  );
}
