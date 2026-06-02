"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Bot, Plus, Edit2, Trash2, X, Save, Phone } from "lucide-react";

interface Agent {
  id: string;
  name: string;
  instructions: string;
  llm_model: string;
  voice_id: string;
  phone_numbers: string[];
  is_active: boolean;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    instructions: "",
    llm_model: "llama-3.3-70b-versatile",
    voice_id: "default",
  });

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/proxy/api/agents");
      const data = await res.json();
      setAgents(data.agents || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingAgent(null);
    setFormData({ name: "", instructions: "", llm_model: "llama-3.3-70b-versatile", voice_id: "default" });
    setShowModal(true);
  };

  const openEditModal = (agent: Agent) => {
    setEditingAgent(agent);
    setFormData({
      name: agent.name || "",
      instructions: agent.instructions || "",
      llm_model: agent.llm_model || "llama-3.3-70b-versatile",
      voice_id: agent.voice_id || "default",
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      if (editingAgent) {
        await fetch(`/api/proxy/api/agents/${editingAgent.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
      } else {
        await fetch("/api/proxy/api/agents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
      }
      setShowModal(false);
      fetchAgents();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this agent?")) return;
    try {
      await fetch(`/api/proxy/api/agents/${id}`, { method: "DELETE" });
      fetchAgents();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--d-text)" }}>
            Agents
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--d-text-2)" }}>
            Configure AI voice agents for your calls
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-transform duration-200"
          style={{
            background: "var(--d-primary)",
            color: "var(--d-bg)",
            boxShadow: "0 0 20px var(--d-primary-glow)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = "0 0 32px var(--d-primary-glow)";
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = "0 0 20px var(--d-primary-glow)";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          <Plus size={16} /> New Agent
        </button>
      </div>

      {loading ? (
        <div className="text-sm" style={{ color: "var(--d-text-3)" }}>Loading agents...</div>
      ) : agents.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="dash-card p-12 text-center"
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "var(--d-primary-muted)", border: "1px solid rgba(0,221,179,0.2)" }}
          >
            <Bot size={28} style={{ color: "var(--d-primary)" }} />
          </div>
          <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--d-text)" }}>
            No agents found
          </h2>
          <p className="text-sm max-w-md mx-auto" style={{ color: "var(--d-text-2)" }}>
            Create an agent to handle your calls automatically.
          </p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <motion.div
              key={agent.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="dash-card-glow p-5 flex flex-col gap-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "var(--d-primary-muted)" }}>
                    <Bot size={20} style={{ color: "var(--d-primary)" }} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm" style={{ color: "var(--d-text)" }}>{agent.name}</h3>
                    <span className="text-xs" style={{ color: "var(--d-text-3)" }}>{agent.llm_model}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEditModal(agent)} className="p-1.5 rounded-md hover:bg-white/5 transition-colors" style={{ color: "var(--d-text-2)" }}>
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => handleDelete(agent.id)} className="p-1.5 rounded-md hover:bg-red-500/10 transition-colors" style={{ color: "var(--d-error)" }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              
              <div className="text-sm line-clamp-2" style={{ color: "var(--d-text-2)" }}>
                {agent.instructions || "No instructions provided."}
              </div>

              <div className="mt-auto pt-3 border-t" style={{ borderColor: "var(--d-border)" }}>
                <div className="flex items-center gap-2">
                  <Phone size={12} style={{ color: "var(--d-text-3)" }} />
                  <span className="text-xs font-medium" style={{ color: "var(--d-text-2)" }}>
                    {agent.phone_numbers?.length || 0} number(s) assigned
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-lg rounded-xl shadow-2xl flex flex-col overflow-hidden"
            style={{ background: "var(--d-surface)", border: "1px solid var(--d-border)" }}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--d-border)", background: "var(--d-surface-2)" }}>
              <h2 className="text-lg font-semibold" style={{ color: "var(--d-text)" }}>
                {editingAgent ? "Edit Agent" : "Create Agent"}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-white/5 rounded-md transition-colors" style={{ color: "var(--d-text-2)" }}>
                <X size={18} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--d-text-2)" }}>Agent Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm transition-all focus:outline-none"
                  style={{ background: "var(--d-bg)", color: "var(--d-text)", border: "1px solid var(--d-border)" }}
                  placeholder="e.g. Sales Assistant"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--d-text-2)" }}>System Prompt / Instructions</label>
                <textarea
                  value={formData.instructions}
                  onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm transition-all focus:outline-none h-32 resize-none"
                  style={{ background: "var(--d-bg)", color: "var(--d-text)", border: "1px solid var(--d-border)" }}
                  placeholder="You are a helpful assistant..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--d-text-2)" }}>LLM Model</label>
                  <select
                    value={formData.llm_model}
                    onChange={(e) => setFormData({ ...formData, llm_model: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                    style={{ background: "var(--d-bg)", color: "var(--d-text)", border: "1px solid var(--d-border)" }}
                  >
                    <option value="llama-3.3-70b-versatile">Llama 3.3 70B</option>
                    <option value="gpt-4o">GPT-4o</option>
                    <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--d-text-2)" }}>Voice Profile</label>
                  <select
                    value={formData.voice_id}
                    onChange={(e) => setFormData({ ...formData, voice_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                    style={{ background: "var(--d-bg)", color: "var(--d-text)", border: "1px solid var(--d-border)" }}
                  >
                    <option value="default">Default Female (Smallest)</option>
                    <option value="male-1">Friendly Male</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 flex items-center justify-end gap-3 border-t" style={{ borderColor: "var(--d-border)", background: "var(--d-surface-2)" }}>
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ color: "var(--d-text-2)", background: "transparent", border: "1px solid var(--d-border)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all"
                style={{ background: "var(--d-primary)", color: "var(--d-bg)" }}
              >
                <Save size={16} /> {editingAgent ? "Update Agent" : "Create Agent"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
