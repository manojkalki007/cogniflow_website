import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Loader2, Eye, Rocket, Settings2, Sparkles, Globe, Flag,
  Wrench, Clock, MessageSquare, ArrowRight, CheckCircle2,
} from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "../components/ui/dialog";

const BASE = import.meta.env.VITE_API_URL || "";
const API_KEY = import.meta.env.VITE_API_KEY || "";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": API_KEY,
      ...options.headers,
    },
    ...options,
  });
  return res.json();
}

const LANGUAGE_LABELS = {
  en: "English", hi: "Hindi", ta: "Tamil", te: "Telugu",
  kn: "Kannada", ml: "Malayalam", bn: "Bengali", mr: "Marathi",
  gu: "Gujarati", "en-in": "English (IN)", es: "Spanish",
  fr: "French", de: "German", ar: "Arabic", pt: "Portuguese",
  ja: "Japanese", zh: "Chinese",
};

const DIFFICULTY_VARIANT = {
  easy: "success",
  medium: "warning",
  hard: "destructive",
};

const TAG_FILTERS = [
  { key: "all", label: "All", icon: Sparkles },
  { key: "india", label: "India", icon: Flag },
  { key: "global", label: "Global", icon: Globe },
];

function TemplateCard({ template, onPreview }) {
  return (
    <div className="glass-card rounded-xl p-5 flex flex-col transition-all duration-200 group">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-3xl shrink-0">{template.icon}</span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white leading-snug">{template.name}</h3>
            <Badge variant="secondary" className="mt-1 text-[10px]">
              {template.industry}
            </Badge>
          </div>
        </div>
        <Badge variant={DIFFICULTY_VARIANT[template.difficulty] || "outline"} className="text-[10px] shrink-0">
          {template.difficulty}
        </Badge>
      </div>

      <p className="text-sm text-gray-400 line-clamp-2 mb-3">{template.description}</p>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {template.languages.map((lang) => (
          <Badge key={lang} variant="outline" className="text-[10px]">
            {LANGUAGE_LABELS[lang] || lang}
          </Badge>
        ))}
      </div>

      <div className="flex items-center gap-3 text-xs text-gray-500 mb-4">
        <span className="flex items-center gap-1">
          <Wrench size={12} />
          {template.tools_used.length} tools
        </span>
        <span className="flex items-center gap-1">
          <Clock size={12} />
          {template.deploy_time}
        </span>
      </div>

      <div className="mt-auto">
        <Button variant="outline" size="sm" className="w-full" onClick={() => onPreview(template)}>
          <Eye size={14} /> Preview & Deploy
        </Button>
      </div>
    </div>
  );
}

function PreviewDialog({ open, onOpenChange, template }) {
  const navigate = useNavigate();
  const [showCustomise, setShowCustomise] = useState(false);
  const [form, setForm] = useState({ company_name: "", name: "", instructions_extra: "" });
  const [deployResult, setDeployResult] = useState(null);

  const deployMut = useMutation({
    mutationFn: (body) =>
      request(`/api/templates/${template?.id}/deploy`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => setDeployResult(data),
  });

  const handleClose = () => {
    setShowCustomise(false);
    setForm({ company_name: "", name: "", instructions_extra: "" });
    setDeployResult(null);
    onOpenChange(false);
  };

  const handleDeployInstantly = () => {
    deployMut.mutate({});
  };

  const handleDeployCustom = () => {
    deployMut.mutate({
      company_name: form.company_name || undefined,
      name: form.name || undefined,
      instructions_extra: form.instructions_extra || undefined,
    });
  };

  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{template.icon}</span>
            <div>
              <DialogTitle>{template.name}</DialogTitle>
              <DialogDescription>{template.use_case}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {deployResult ? (
          <div className="space-y-5 text-center py-6">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto">
              <CheckCircle2 size={32} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-lg font-semibold text-white">Agent Deployed!</p>
              <p className="text-sm text-gray-400 mt-1">
                {deployResult.agent_name || template.name} is ready to take calls.
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => navigate("/dashboard/agents")}>
                <ArrowRight size={14} /> Go to Agents
              </Button>
              <Button variant="outline" onClick={handleClose}>Close</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3">
              <p className="text-sm font-medium text-blue-400">{template.roi_headline}</p>
            </div>

            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1.5">Description</p>
              <p className="text-sm text-gray-300">{template.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-2">Languages</p>
                <div className="flex flex-wrap gap-1.5">
                  {template.languages.map((lang) => (
                    <Badge key={lang} variant="outline" className="text-[10px]">
                      {LANGUAGE_LABELS[lang] || lang}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-2">Industry</p>
                <Badge variant="secondary">{template.industry}</Badge>
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-2">Tools Used</p>
              <div className="flex flex-wrap gap-1.5">
                {template.tools_used.map((tool) => (
                  <Badge key={tool} variant="default" className="text-[10px]">
                    <Wrench size={10} /> {tool.replace(/_/g, " ")}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-2">
                <MessageSquare size={12} className="inline mr-1" />
                Sample Questions
              </p>
              <ul className="space-y-2">
                {template.sample_questions.map((q, i) => (
                  <li key={i} className="text-sm text-gray-400 flex items-start gap-2.5 p-2.5 rounded-lg bg-gray-800/30">
                    <span className="text-blue-400 mt-0.5 shrink-0 font-mono text-xs">{i + 1}</span>
                    <span>{q}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Clock size={12} />
              Deploy time: {template.deploy_time}
              <span className="mx-1">·</span>
              Difficulty:
              <Badge variant={DIFFICULTY_VARIANT[template.difficulty] || "outline"} className="text-[10px]">
                {template.difficulty}
              </Badge>
            </div>

            {showCustomise && (
              <div className="space-y-4 glass-card rounded-xl p-5 animate-fade-in">
                <p className="text-sm font-medium text-white">Customise Before Deploying</p>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5 font-medium">Company Name</label>
                  <input
                    value={form.company_name}
                    onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                    className="w-full glass-card rounded-xl px-4 py-3 input-glow border border-gray-700/30 bg-gray-800/30 text-sm"
                    placeholder="Your Company Name"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5 font-medium">Agent Name</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full glass-card rounded-xl px-4 py-3 input-glow border border-gray-700/30 bg-gray-800/30 text-sm"
                    placeholder={template.name}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5 font-medium">Additional Instructions</label>
                  <textarea
                    value={form.instructions_extra}
                    onChange={(e) => setForm({ ...form, instructions_extra: e.target.value })}
                    rows={3}
                    className="w-full glass-card rounded-xl px-4 py-3 input-glow border border-gray-700/30 bg-gray-800/30 text-sm resize-none"
                    placeholder="Any extra instructions for this agent..."
                  />
                </div>
                <Button onClick={handleDeployCustom} disabled={deployMut.isPending} className="w-full">
                  {deployMut.isPending ? (
                    <><Loader2 size={14} className="animate-spin" /> Deploying...</>
                  ) : (
                    <><Rocket size={14} /> Deploy with Customisations</>
                  )}
                </Button>
              </div>
            )}

            {!showCustomise && (
              <div className="flex gap-3">
                <Button onClick={handleDeployInstantly} disabled={deployMut.isPending} className="flex-1">
                  {deployMut.isPending ? (
                    <><Loader2 size={14} className="animate-spin" /> Deploying...</>
                  ) : (
                    <><Rocket size={14} /> Deploy Instantly</>
                  )}
                </Button>
                <Button variant="outline" onClick={() => setShowCustomise(true)} className="flex-1">
                  <Settings2 size={14} /> Customise & Deploy
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function Templates() {
  const [activeFilter, setActiveFilter] = useState("all");
  const [previewTemplate, setPreviewTemplate] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["templates"],
    queryFn: () => request("/api/templates"),
  });

  const templates = data?.templates || [];

  const filtered = activeFilter === "all"
    ? templates
    : templates.filter((t) => t.tags.includes(activeFilter));

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold gradient-text">Agent Templates</h2>
        <p className="text-sm text-gray-500 mt-1">
          Prebuilt AI agent templates ready to deploy in minutes
        </p>
      </div>

      <div className="flex gap-2 mb-6">
        {TAG_FILTERS.map(({ key, label, icon: Icon }) => (
          <Button
            key={key}
            variant={activeFilter === key ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveFilter(key)}
          >
            <Icon size={14} /> {label}
          </Button>
        ))}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-blue-400" />
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-16 glass-card rounded-xl">
          <div className="w-14 h-14 rounded-2xl bg-violet-500/10 flex items-center justify-center mx-auto mb-4">
            <Sparkles size={24} className="text-violet-400" />
          </div>
          <p className="text-gray-400">
            {templates.length === 0
              ? "No templates available yet."
              : "No templates match this filter."}
          </p>
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onPreview={setPreviewTemplate}
            />
          ))}
        </div>
      )}

      <PreviewDialog
        open={!!previewTemplate}
        onOpenChange={(open) => { if (!open) setPreviewTemplate(null); }}
        template={previewTemplate}
      />
    </div>
  );
}
