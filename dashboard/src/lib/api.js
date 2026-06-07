import supabase from "./supabase";

const BASE = (import.meta.env.VITE_API_URL || "https://api.cogniflowautomations.com").trim();
const API_KEY = (import.meta.env.VITE_API_KEY || "").trim();

let _tenantId = localStorage.getItem("cogniflow_tenant_id") || "";

export function setTenantId(id) {
  _tenantId = id;
  if (id) localStorage.setItem("cogniflow_tenant_id", id);
  else localStorage.removeItem("cogniflow_tenant_id");
}

export function getTenantId() {
  return _tenantId;
}

async function request(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }
  } catch {}

  if (API_KEY) headers["X-Api-Key"] = API_KEY;
  if (_tenantId) headers["X-Tenant-Id"] = _tenantId;

  try {
    const res = await fetch(`${BASE}${path}`, { headers, ...options });
    let data;
    try {
      const text = await res.text();
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`Server error (${res.status}): Invalid response`);
    }
    if (!res.ok && !data.error) {
      data.error = data.detail || `Request failed (${res.status})`;
    }
    return data;
  } catch (err) {
    return { error: err.message || "Network error" };
  }
}

export const api = {
  // Calls
  getCalls: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/calls${qs ? `?${qs}` : ""}`);
  },
  getCall: (id) => request(`/api/calls/${id}`),
  makeCall: (toNumber, provider = "twilio", instructions = "", agentId = null) =>
    request("/api/call", {
      method: "POST",
      body: JSON.stringify({
        to_number: toNumber,
        provider,
        instructions: instructions || undefined,
        agent_id: agentId || undefined,
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

  // Integrations (legacy)
  getIntegrations: () => request("/api/integrations"),
  updateIntegration: (id, data) =>
    request(`/api/integrations/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  testIntegration: (id) =>
    request(`/api/integrations/${id}/test`, { method: "POST" }),

  // Tenant Integrations (multi-tenant setup wizard)
  getTenantIntegrations: () => request("/api/tenant-integrations"),
  saveTenantIntegration: (integration, data) =>
    request(`/api/tenant-integrations/${integration}`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  testTenantIntegration: (integration) =>
    request(`/api/tenant-integrations/${integration}/test`, { method: "POST" }),
  disconnectTenantIntegration: (integration) =>
    request(`/api/tenant-integrations/${integration}`, { method: "DELETE" }),
  requestManagedSetup: (integration, contactInfo) =>
    request(`/api/tenant-integrations/${integration}/request-setup`, {
      method: "POST",
      body: JSON.stringify(contactInfo || {}),
    }),

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

  // Benchmarks
  runBenchmarks: () => request("/api/benchmarks/run", { method: "POST" }),
  getLatestBenchmark: () => request("/api/benchmarks/latest"),
  getPipelineMetrics: () => request("/api/benchmarks/pipeline"),
  getBehaviourDrift: () => request("/api/benchmarks/drift"),

  // Organizations (multi-tenant)
  getOrganizations: (email = "") =>
    request(`/api/organizations${email ? `?email=${encodeURIComponent(email)}` : ""}`),
  getOrganization: (id) => request(`/api/organizations/${id}`),
  createOrganization: (data) =>
    request("/api/organizations", { method: "POST", body: JSON.stringify(data) }),
  getMembers: (orgId) => request(`/api/organizations/${orgId}/members`),
  addMember: (orgId, email, role = "member") =>
    request(`/api/organizations/${orgId}/members`, {
      method: "POST",
      body: JSON.stringify({ email, role }),
    }),
  removeMember: (orgId, email) =>
    request(`/api/organizations/${orgId}/members/${encodeURIComponent(email)}`, { method: "DELETE" }),

  // Admin: Tenant Management
  adminGetTenants: () => request("/admin/tenants"),
  adminGetTenant: (id) => request(`/admin/tenants/${id}`),
  adminCreateTenant: (data) =>
    request("/admin/tenants", { method: "POST", body: JSON.stringify(data) }),
  adminUpdateTenant: (id, data) =>
    request(`/admin/tenants/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  adminSuspendTenant: (id) =>
    request(`/admin/tenants/${id}/suspend`, { method: "POST" }),
  adminGetBilling: () => request("/admin/billing"),

  // Tenant: API Keys
  getApiKeys: () => request("/api/keys"),
  createApiKey: (data) =>
    request("/api/keys", { method: "POST", body: JSON.stringify(data) }),
  revokeApiKey: (id) => request(`/api/keys/${id}`, { method: "DELETE" }),

  // Test integrations
  testEmail: (toEmail) =>
    request("/api/test-email", { method: "POST", body: JSON.stringify({ to_email: toEmail }) }),
  testWhatsApp: (toPhone, template = "appointment_confirmation") =>
    request("/api/test-whatsapp", { method: "POST", body: JSON.stringify({ to_phone: toPhone, template }) }),

  // Phone Numbers
  getPhoneNumbers: () => request("/api/phone-numbers"),
  setupPhoneNumber: (data) =>
    request("/api/phone-numbers/setup", { method: "POST", body: JSON.stringify(data) }),
  verifyPhoneCredentials: (provider, credentials) =>
    request("/api/phone-numbers/verify-credentials", {
      method: "POST",
      body: JSON.stringify({ provider, credentials }),
    }),
  updatePhoneNumber: (id, updates) =>
    request(`/api/phone-numbers/${id}`, { method: "PATCH", body: JSON.stringify(updates) }),
  removePhoneNumber: (id) =>
    request(`/api/phone-numbers/${id}`, { method: "DELETE" }),
  verifyPhoneNumber: (id) =>
    request(`/api/phone-numbers/${id}/verify`, { method: "POST" }),
  testPhoneNumber: (id, toNumber) =>
    request(`/api/phone-numbers/${id}/test-call`, {
      method: "POST",
      body: JSON.stringify({ to_number: toNumber }),
    }),

  // API Hub
  getProviders: () => request("/api/providers"),

  // Tenant: Usage & Billing
  getUsage: (month) =>
    request(`/api/usage${month ? `?month=${month}` : ""}`),
  getUsageHistory: () => request("/api/usage/history"),
  getLiveUsage: () => request("/api/usage/live"),
};
