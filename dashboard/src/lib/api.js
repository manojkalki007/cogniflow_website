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

export const api = {
  // Calls
  getCalls: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/calls${qs ? `?${qs}` : ""}`);
  },
  getCall: (id) => request(`/api/calls/${id}`),
  makeCall: (toNumber, provider = "twilio", instructions = "") =>
    request("/api/call", {
      method: "POST",
      body: JSON.stringify({
        to_number: toNumber,
        provider,
        instructions: instructions || undefined,
      }),
    }),
  hangupCall: (id) => request(`/api/call/${id}/hangup`, { method: "POST" }),
  callStatus: (id) => request(`/api/call/${id}/status`),

  // Contacts
  getContacts: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/contacts${qs ? `?${qs}` : ""}`);
  },
  getContact: (id) => request(`/api/contacts/${id}`),
  updateContact: (id, data) =>
    request(`/api/contacts/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  // Stats
  getStats: () => request("/api/stats"),

  // Webhooks
  getWebhooks: () => request("/api/webhooks"),
  createWebhook: (url, events) =>
    request("/api/webhooks", { method: "POST", body: JSON.stringify({ url, events }) }),
  deleteWebhook: (id) => request(`/api/webhooks/${id}`, { method: "DELETE" }),

  // Agents
  getAgents: () => request("/api/agents"),
  createAgent: (data) => request("/api/agents", { method: "POST", body: JSON.stringify(data) }),
  updateAgent: (id, data) =>
    request(`/api/agents/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  // Campaigns
  getCampaigns: () => request("/api/campaigns"),
  getCampaign: (id) => request(`/api/campaigns/${id}`),
  createCampaign: (data) =>
    request("/api/campaigns", { method: "POST", body: JSON.stringify(data) }),
  startCampaign: (id) => request(`/api/campaigns/${id}/start`, { method: "POST" }),
  pauseCampaign: (id) => request(`/api/campaigns/${id}/pause`, { method: "POST" }),

  // Revenue
  getRevenue: () => request("/api/revenue"),
  closeDeal: (data) =>
    request("/api/revenue/deal-closed", { method: "POST", body: JSON.stringify(data) }),

  // Compliance
  getComplianceEvents: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/compliance/events${qs ? `?${qs}` : ""}`);
  },

  // Latency
  getLatency: () => request("/api/latency"),

  // Agent Cloning
  cloneAgent: (data) =>
    request("/api/agents/clone", { method: "POST", body: JSON.stringify(data) }),

  // DNC
  getDNC: () => request("/api/dnc"),
  addDNC: (phone, reason) =>
    request("/api/dnc", { method: "POST", body: JSON.stringify({ phone_number: phone, reason }) }),
  removeDNC: (phone) => request(`/api/dnc/${phone}`, { method: "DELETE" }),

  // Contact management
  createContact: (data) =>
    request("/api/contacts", { method: "POST", body: JSON.stringify(data) }),
  deleteContact: (id) => request(`/api/contacts/${id}`, { method: "DELETE" }),
  importContacts: (contacts) =>
    request("/api/contacts/import-mapped", {
      method: "POST",
      body: JSON.stringify({ contacts }),
    }),

  // Agent details
  getAgent: (id) => request(`/api/agents/${id}`),
  deleteAgent: (id) => request(`/api/agents/${id}`, { method: "DELETE" }),
  getAgentPerformance: (id) => request(`/api/agents/${id}/performance`),
  testAgentChat: (id, message, messages = []) =>
    request(`/api/agents/${id}/test-chat`, {
      method: "POST",
      body: JSON.stringify({ message, messages }),
    }),

  // Integrations
  getIntegrations: () => request("/api/integrations"),
  updateIntegration: (id, data) =>
    request(`/api/integrations/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  testIntegration: (id) =>
    request(`/api/integrations/${id}/test`, { method: "POST" }),

  // Analytics
  getAnalyticsTrends: (days = 30) =>
    request(`/api/analytics/trends?days=${days}`),
  getAgentComparison: () => request("/api/analytics/agents"),
  getCampaignAnalytics: (id) => request(`/api/campaigns/${id}/analytics`),

  // A/B Testing
  createABTest: (campaignId, variants) =>
    request(`/api/campaigns/${campaignId}/ab-test`, {
      method: "POST",
      body: JSON.stringify({ variants }),
    }),
  getABTestResults: (campaignId) =>
    request(`/api/campaigns/${campaignId}/ab-test/results`),

  // Templates
  getTemplates: () => request("/api/templates"),
  getTemplate: (id) => request(`/api/templates/${id}`),
  deployTemplate: (id, data = {}) =>
    request(`/api/templates/${id}/deploy`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
