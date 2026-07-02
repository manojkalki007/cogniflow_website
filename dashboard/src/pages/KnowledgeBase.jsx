import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import {
  BookOpen, Bot, FileText, Upload, Trash2, Search,
  Loader2, AlertCircle, CheckCircle2, X, File,
} from "lucide-react";
import { api } from "../lib/api";
import PageHeader from "../components/PageHeader";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "../components/ui/dialog";

const MAX_SIZE = 5 * 1024 * 1024;
const ACCEPT = {
  "text/plain": [".txt"],
  "text/markdown": [".md"],
  "text/csv": [".csv"],
  "application/pdf": [".pdf"],
};

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "—";
  }
}

function AgentPill({ agent, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-medium transition-all duration-200 cursor-pointer shrink-0"
      style={
        active
          ? { background: "var(--accent-subtle)", borderColor: "var(--accent)", color: "var(--accent-text)" }
          : { background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-secondary)" }
      }
    >
      <span
        className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: active ? "var(--accent)" : "var(--bg-muted)" }}
      >
        <Bot size={12} style={{ color: active ? "white" : "var(--text-muted)" }} />
      </span>
      <span className="truncate max-w-[140px]">{agent.name}</span>
      {agent.is_active === false && (
        <Badge variant="outline" className="text-[9px] px-1.5 py-0">Inactive</Badge>
      )}
    </button>
  );
}

function DeleteConfirmDialog({ open, onOpenChange, source, onConfirm, pending }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete document</DialogTitle>
          <DialogDescription>
            This will permanently remove <span style={{ color: "var(--text-primary)" }}>{source}</span> and all its
            indexed chunks from the knowledge base. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive" size="sm" onClick={onConfirm} disabled={pending}>
            {pending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DocumentsPanel({ agentId }) {
  const queryClient = useQueryClient();
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["knowledge-sources", agentId],
    queryFn: () => api.getKnowledgeSources(agentId),
    enabled: !!agentId,
  });

  const sources = data?.sources || [];

  const uploadMut = useMutation({
    mutationFn: (file) => api.uploadKnowledge(agentId, file),
    onSuccess: (res) => {
      if (res?.error) {
        setUploadError(res.error);
        setUploadSuccess("");
        return;
      }
      setUploadError("");
      setUploadSuccess(res?.source || "Document uploaded");
      queryClient.invalidateQueries({ queryKey: ["knowledge-sources", agentId] });
      setTimeout(() => setUploadSuccess(""), 4000);
    },
    onError: (err) => {
      setUploadError(err.message || "Upload failed");
      setUploadSuccess("");
    },
  });

  const deleteMut = useMutation({
    mutationFn: (source) => api.deleteKnowledge(agentId, source),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-sources", agentId] });
      setDeleteTarget(null);
    },
  });

  const onDrop = useCallback((accepted, rejected) => {
    setUploadError("");
    setUploadSuccess("");
    if (rejected?.length) {
      const reason = rejected[0]?.errors?.[0]?.code === "file-too-large"
        ? "File exceeds 5MB limit"
        : "Unsupported file type";
      setUploadError(reason);
      return;
    }
    const file = accepted[0];
    if (file) uploadMut.mutate(file);
  }, [uploadMut]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPT,
    maxFiles: 1,
    maxSize: MAX_SIZE,
    disabled: uploadMut.isPending,
  });

  return (
    <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>
          Documents
        </p>
        {sources.length > 0 && (
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {sources.length} file{sources.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-14 rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-12">
          <AlertCircle size={32} style={{ color: "var(--danger)", opacity: 0.5 }} />
          <p className="text-sm mt-3" style={{ color: "var(--text-muted)" }}>Failed to load documents</p>
        </div>
      ) : sources.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <FileText size={32} style={{ color: "var(--text-muted)", opacity: 0.3 }} />
          <p className="text-sm mt-3" style={{ color: "var(--text-muted)" }}>No documents uploaded yet</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)", opacity: 0.7 }}>
            Upload files below to power this agent's answers
          </p>
        </div>
      ) : (
        <div className="space-y-2 mb-1">
          {sources.map((doc) => (
            <div
              key={doc.source}
              className="flex items-center gap-3 rounded-lg border px-3.5 py-3 transition-colors duration-150"
              style={{ background: "var(--bg-muted)", borderColor: "var(--border)" }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "var(--accent-subtle)" }}
              >
                <File size={15} style={{ color: "var(--accent)" }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                  {doc.source}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {doc.chunks ?? 0} chunk{doc.chunks === 1 ? "" : "s"} · {formatDate(doc.created_at)}
                </p>
              </div>
              <button
                onClick={() => setDeleteTarget(doc.source)}
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-150 cursor-pointer"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; e.currentTarget.style.color = "var(--danger)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-muted)"; }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
        <div
          {...getRootProps()}
          className="border-2 border-dashed rounded-xl px-5 py-8 text-center cursor-pointer transition-all duration-200"
          style={{
            borderColor: isDragActive ? "var(--accent)" : "var(--border)",
            background: isDragActive ? "var(--accent-subtle)" : "transparent",
          }}
        >
          <input {...getInputProps()} />
          {uploadMut.isPending ? (
            <>
              <Loader2 size={22} className="animate-spin mx-auto" style={{ color: "var(--accent)" }} />
              <p className="text-sm mt-3" style={{ color: "var(--text-secondary)" }}>Uploading & indexing...</p>
            </>
          ) : (
            <>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: "var(--accent-subtle)" }}>
                <Upload size={18} style={{ color: "var(--accent)" }} />
              </div>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {isDragActive ? "Drop the file here..." : "Drag & drop a document, or click to browse"}
              </p>
              <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>
                .txt, .md, .csv, .pdf — up to 5MB
              </p>
            </>
          )}
        </div>

        {uploadError && (
          <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg text-xs" style={{ background: "rgba(239,68,68,0.08)", color: "var(--danger)" }}>
            <AlertCircle size={13} className="shrink-0" />
            {uploadError}
            <button onClick={() => setUploadError("")} className="ml-auto cursor-pointer">
              <X size={12} />
            </button>
          </div>
        )}
        {uploadSuccess && (
          <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg text-xs" style={{ background: "rgba(16,185,129,0.08)", color: "var(--success)" }}>
            <CheckCircle2 size={13} className="shrink-0" />
            {uploadSuccess} indexed successfully
          </div>
        )}
      </div>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        source={deleteTarget}
        pending={deleteMut.isPending}
        onConfirm={() => deleteMut.mutate(deleteTarget)}
      />
    </div>
  );
}

function TestQueryPanel({ agentId }) {
  const [question, setQuestion] = useState("");
  const [ran, setRan] = useState(false);

  const queryMut = useMutation({
    mutationFn: (q) => api.queryKnowledge(agentId, q),
    onSuccess: () => setRan(true),
  });

  const results = queryMut.data?.results || [];

  const handleSearch = () => {
    if (!question.trim() || queryMut.isPending) return;
    queryMut.mutate(question.trim());
  };

  return (
    <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <p className="text-[10px] uppercase tracking-wider font-medium mb-3" style={{ color: "var(--text-muted)" }}>
        Test Query
      </p>

      <div className="flex items-center gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Ask a question..."
          className="glass-input flex-1 rounded-lg px-3 py-2 text-sm outline-none"
          style={{ background: "var(--bg-muted)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
        />
      </div>
      <Button
        size="sm"
        className="w-full mt-2.5"
        onClick={handleSearch}
        disabled={queryMut.isPending || !question.trim()}
      >
        {queryMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
        Search
      </Button>

      <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
        {!ran ? (
          <div className="flex flex-col items-center justify-center py-10">
            <Search size={28} style={{ color: "var(--text-muted)", opacity: 0.3 }} />
            <p className="text-sm mt-3 text-center" style={{ color: "var(--text-muted)" }}>
              Run a query to preview how your agent retrieves knowledge
            </p>
          </div>
        ) : queryMut.isError ? (
          <div className="flex flex-col items-center justify-center py-10">
            <AlertCircle size={28} style={{ color: "var(--danger)", opacity: 0.5 }} />
            <p className="text-sm mt-3" style={{ color: "var(--text-muted)" }}>Query failed</p>
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10">
            <FileText size={28} style={{ color: "var(--text-muted)", opacity: 0.3 }} />
            <p className="text-sm mt-3 text-center" style={{ color: "var(--text-muted)" }}>
              No matching chunks found
            </p>
          </div>
        ) : (
          <div className="space-y-2.5 max-h-[480px] overflow-y-auto">
            {results.map((r, i) => (
              <div key={i} className="rounded-lg border p-3" style={{ background: "var(--bg-muted)", borderColor: "var(--border)" }}>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>
                    {r.source}
                  </span>
                  {typeof r.similarity === "number" && (
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      {(r.similarity * 100).toFixed(0)}% match
                    </Badge>
                  )}
                </div>
                <p className="text-xs line-clamp-4" style={{ color: "var(--text-secondary)" }}>
                  {r.content}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function KnowledgeBase() {
  const [selectedAgentId, setSelectedAgentId] = useState(null);

  const { data: agentsData, isLoading: agentsLoading } = useQuery({
    queryKey: ["agents"],
    queryFn: () => api.getAgents(),
  });

  const agents = useMemo(() => (Array.isArray(agentsData) ? agentsData : agentsData?.agents || []), [agentsData]);

  const activeAgentId = selectedAgentId || agents[0]?.id || null;

  return (
    <div className="animate-fade-in">
      <PageHeader
        icon={BookOpen}
        title="Knowledge Base"
        description="Upload documents to power your agents' RAG-based answers"
      />

      <div className="px-6 lg:px-8 pb-8 space-y-5">
        {agentsLoading ? (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-10 w-32 rounded-xl shrink-0" />
            ))}
          </div>
        ) : agents.length === 0 ? (
          <div className="rounded-xl border p-12 flex flex-col items-center justify-center" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <Bot size={32} style={{ color: "var(--text-muted)", opacity: 0.3 }} />
            <p className="text-sm mt-3" style={{ color: "var(--text-muted)" }}>No agents found</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)", opacity: 0.7 }}>
              Create an agent first to attach a knowledge base
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {agents.map((agent) => (
              <AgentPill
                key={agent.id}
                agent={agent}
                active={agent.id === activeAgentId}
                onClick={() => setSelectedAgentId(agent.id)}
              />
            ))}
          </div>
        )}

        {activeAgentId && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2">
              <DocumentsPanel agentId={activeAgentId} />
            </div>
            <div className="lg:col-span-1">
              <TestQueryPanel agentId={activeAgentId} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
