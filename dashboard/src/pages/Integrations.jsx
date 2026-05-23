import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  MessageSquare, Mail, Building2, Calendar, CreditCard, Phone,
  CheckCircle, XCircle, AlertTriangle, Loader2, ExternalLink,
  ChevronRight, X, ArrowLeft, HelpCircle, Plug, Database, Globe,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent } from "../components/ui/dialog";
import PageHeader from "../components/PageHeader";

const INTEGRATIONS = [
  {
    id: "whatsapp",
    name: "WhatsApp Business",
    icon: MessageSquare,
    category: "messaging",
    description: "Send appointment confirmations, follow-ups, and documents via WhatsApp.",
    providers: [
      { id: "gupshup", name: "Gupshup", recommended: true },
    ],
    setupSteps: [
      {
        title: "Create a Gupshup account",
        description: "Sign up at gupshup.io and verify your business.",
        instructions: [
          "Go to gupshup.io and click 'Sign Up'",
          "Enter your business email and create a password",
          "Verify your email address",
          "Complete business verification (PAN card, GST number)",
        ],
        helpUrl: "https://www.gupshup.io/whatsapp/dashboard",
      },
      {
        title: "Get your API Key",
        description: "Copy your API key from the Gupshup dashboard.",
        instructions: [
          "Log into your Gupshup dashboard",
          "Click on your profile icon (top-right corner)",
          "You'll see your API Key in the popup",
          "Click 'Copy' to copy it",
          "Paste it below",
        ],
        helpUrl: "https://www.gupshup.io/whatsapp/dashboard",
        field: { key: "api_key", label: "Gupshup API Key", placeholder: "Paste your API key here", type: "password" },
      },
      {
        title: "Enter your WhatsApp number",
        description: "The phone number connected to your WhatsApp Business account.",
        instructions: [
          "This is the number customers will see when they receive messages",
          "It should be the number you registered with Gupshup",
          "Format: 919876543210 (with country code, no + or spaces)",
        ],
        field: { key: "phone_number", label: "WhatsApp Business Number", placeholder: "919876543210", type: "tel" },
      },
      {
        title: "Enter your App Name",
        description: "The app name you created in Gupshup.",
        instructions: [
          "Go to your Gupshup dashboard",
          "Find your app under 'My Apps'",
          "Copy the app name exactly as shown",
        ],
        field: { key: "app_name", label: "Gupshup App Name", placeholder: "my-business-whatsapp" },
      },
      {
        title: "Test connection",
        description: "Let's make sure everything works.",
        isTest: true,
        successMessage: "WhatsApp connected! Your AI agent can now send messages.",
      },
    ],
  },
  {
    id: "email",
    name: "Email (SMTP)",
    icon: Mail,
    category: "messaging",
    description: "Send confirmation emails, follow-ups, and reports after calls.",
    providers: [
      { id: "gmail", name: "Gmail (App Password)", recommended: true },
      { id: "zoho", name: "Zoho Mail" },
      { id: "smtp", name: "Custom SMTP" },
    ],
    setupSteps: [
      {
        title: "Get Gmail App Password",
        description: "Google requires an 'App Password' for third-party apps.",
        instructions: [
          "Go to myaccount.google.com/security",
          "Make sure 2-Step Verification is ON",
          "Search for 'App Passwords' in Google Account settings",
          "Select 'Mail' and 'Other (Custom name)'",
          "Enter 'Cogniflow' as the name",
          "Click 'Generate' — copy the 16-character password",
          "IMPORTANT: This is NOT your Gmail password. It's a special app password.",
        ],
        helpUrl: "https://myaccount.google.com/apppasswords",
      },
      {
        title: "Enter your email settings",
        description: "We'll auto-detect SMTP settings from your email provider.",
        fields: [
          { key: "username", label: "Email address", placeholder: "clinic@gmail.com", type: "email" },
          { key: "password", label: "App Password (16 chars)", placeholder: "xxxx xxxx xxxx xxxx", type: "password" },
          { key: "from_name", label: "Sender name", placeholder: "Priya's Clinic" },
        ],
      },
      {
        title: "Test connection",
        isTest: true,
        successMessage: "Email connected! A test email was sent to verify.",
      },
    ],
  },
  {
    id: "crm_leadrat",
    name: "LeadRat CRM",
    icon: Building2,
    category: "crm",
    description: "Auto-push real estate leads to LeadRat after every call.",
    providers: [{ id: "leadrat", name: "LeadRat" }],
    setupSteps: [
      {
        title: "Get LeadRat API key",
        description: "You'll need admin access to your LeadRat account.",
        instructions: [
          "Log into app.leadrat.com",
          "Go to Global Config (you need admin access)",
          "Click on IVR option",
          "Click 'Add' to create a new integration",
          "Name it 'Cogniflow AI'",
          "Select 'Inbound' for call type",
          "Click 'Download' — you'll get an Excel file",
          "Open the Excel — it has your API Key and Account Name",
        ],
      },
      {
        title: "Enter LeadRat credentials",
        fields: [
          { key: "api_key", label: "API Key", placeholder: "From the Excel file", type: "password" },
          { key: "account_name", label: "Account Name", placeholder: "From the Excel file" },
        ],
      },
      {
        title: "Test connection",
        isTest: true,
        successMessage: "LeadRat connected! Leads will auto-sync after calls.",
      },
    ],
  },
  {
    id: "crm_hubspot",
    name: "HubSpot CRM",
    icon: Database,
    category: "crm",
    description: "Sync contacts and log call activity to HubSpot after every call.",
    providers: [{ id: "hubspot", name: "HubSpot" }],
    setupSteps: [
      {
        title: "Get HubSpot Private App token",
        description: "Create a Private App in HubSpot for Cogniflow access.",
        instructions: [
          "Log into app.hubspot.com",
          "Go to Settings → Integrations → Private Apps",
          "Click 'Create a private app'",
          "Name it 'Cogniflow AI'",
          "Under Scopes, enable: crm.objects.contacts (read/write), crm.objects.deals (read/write)",
          "Click 'Create app'",
          "Copy the Access Token",
        ],
        helpUrl: "https://app.hubspot.com/private-apps/",
      },
      {
        title: "Enter HubSpot token",
        fields: [
          { key: "access_token", label: "Access Token", placeholder: "pat-xxx", type: "password" },
        ],
      },
      {
        title: "Test connection",
        isTest: true,
        successMessage: "HubSpot connected! Contacts will sync after calls.",
      },
    ],
  },
  {
    id: "crm_salesforce",
    name: "Salesforce",
    icon: Globe,
    category: "crm",
    description: "Enterprise CRM — sync contacts, log calls, create leads automatically.",
    providers: [{ id: "salesforce", name: "Salesforce" }],
    setupSteps: [
      {
        title: "Create a Salesforce Connected App",
        description: "You'll need admin access to your Salesforce org.",
        instructions: [
          "Log into Salesforce Setup",
          "Search for 'App Manager' in Quick Find",
          "Click 'New Connected App'",
          "Enter app name: 'Cogniflow AI'",
          "Enable OAuth, add scopes: api, refresh_token",
          "Set callback URL to: https://api.cogniflowautomations.com/callback",
          "Save and wait 2–10 minutes for activation",
          "Copy Consumer Key (Client ID) and Consumer Secret",
        ],
        helpUrl: "https://login.salesforce.com",
      },
      {
        title: "Enter Salesforce credentials",
        fields: [
          { key: "client_id", label: "Consumer Key (Client ID)", type: "text" },
          { key: "client_secret", label: "Consumer Secret", type: "password" },
          { key: "username", label: "Salesforce Username", placeholder: "admin@company.com", type: "email" },
          { key: "password", label: "Password + Security Token", type: "password" },
        ],
      },
      {
        title: "Test connection",
        isTest: true,
        successMessage: "Salesforce connected! Contacts and leads will sync.",
      },
    ],
  },
  {
    id: "calendar_calcom",
    name: "Cal.com",
    icon: Calendar,
    category: "scheduling",
    description: "Let the AI agent book appointments directly into your calendar.",
    providers: [{ id: "calcom", name: "Cal.com" }],
    setupSteps: [
      {
        title: "Get Cal.com API key",
        description: "Create an API key in your Cal.com settings.",
        instructions: [
          "Log into app.cal.com",
          "Go to Settings → Developer → API Keys",
          "Click 'Create new key'",
          "Copy the key",
        ],
        helpUrl: "https://app.cal.com/settings/developer/api-keys",
      },
      {
        title: "Enter Cal.com details",
        fields: [
          { key: "api_key", label: "API Key", placeholder: "cal_live_xxx", type: "password" },
          { key: "username", label: "Cal.com username", placeholder: "priyas-clinic" },
          { key: "event_type_id", label: "Event Type ID (from URL)", placeholder: "12345" },
        ],
      },
      {
        title: "Test connection",
        isTest: true,
        successMessage: "Cal.com connected! AI can now book appointments.",
      },
    ],
  },
  {
    id: "calendar_google",
    name: "Google Calendar",
    icon: Calendar,
    category: "scheduling",
    description: "Check availability and book appointments via Google Calendar.",
    providers: [{ id: "google_calendar", name: "Google Calendar" }],
    setupSteps: [
      {
        title: "Create a Google Service Account",
        description: "You need a service account to allow Cogniflow to access your calendar.",
        instructions: [
          "Go to console.cloud.google.com",
          "Create a project (or use existing)",
          "Enable the Google Calendar API",
          "Go to IAM & Admin → Service Accounts",
          "Create a service account named 'Cogniflow'",
          "Create a key (JSON format) — download the file",
          "Share your Google Calendar with the service account email",
        ],
        helpUrl: "https://console.cloud.google.com",
      },
      {
        title: "Enter Google Calendar config",
        fields: [
          { key: "calendar_id", label: "Calendar ID", placeholder: "primary (or your calendar email)" },
          { key: "service_account_json", label: "Service Account JSON", placeholder: "Paste the entire JSON file contents", type: "textarea" },
        ],
      },
      {
        title: "Test connection",
        isTest: true,
        successMessage: "Google Calendar connected! AI can check availability and book.",
      },
    ],
  },
  {
    id: "razorpay",
    name: "Razorpay",
    icon: CreditCard,
    category: "payments",
    description: "Generate and send payment links during live calls.",
    providers: [{ id: "razorpay", name: "Razorpay" }],
    setupSteps: [
      {
        title: "Get Razorpay API Keys",
        description: "Find your API keys in the Razorpay dashboard.",
        instructions: [
          "Log into dashboard.razorpay.com",
          "Go to Settings → API Keys",
          "Generate a new key pair (or use existing)",
          "Copy the Key ID and Key Secret",
          "IMPORTANT: Key Secret is shown only once — save it!",
        ],
        helpUrl: "https://dashboard.razorpay.com/app/keys",
      },
      {
        title: "Enter Razorpay keys",
        fields: [
          { key: "key_id", label: "Key ID", placeholder: "rzp_live_xxx" },
          { key: "key_secret", label: "Key Secret", type: "password" },
        ],
      },
      {
        title: "Test connection",
        isTest: true,
        successMessage: "Razorpay connected! AI can create payment links during calls.",
      },
    ],
  },
];

const SMTP_PRESETS = {
  "gmail.com": { host: "smtp.gmail.com", port: 587, provider: "smtp" },
  "googlemail.com": { host: "smtp.gmail.com", port: 587, provider: "smtp" },
  "zoho.com": { host: "smtp.zoho.com", port: 587, provider: "smtp" },
  "zoho.in": { host: "smtp.zoho.in", port: 587, provider: "smtp" },
  "outlook.com": { host: "smtp.office365.com", port: 587, provider: "smtp" },
  "hotmail.com": { host: "smtp.office365.com", port: 587, provider: "smtp" },
  "yahoo.com": { host: "smtp.mail.yahoo.com", port: 587, provider: "smtp" },
};

const CATEGORY_LABELS = {
  messaging: "Messaging",
  crm: "CRM",
  scheduling: "Scheduling",
  payments: "Payments",
};

function SetupWizard({ integration, onComplete, onClose }) {
  const [step, setStep] = useState(0);
  const [credentials, setCredentials] = useState({});
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saving, setSaving] = useState(false);

  const currentStep = integration.setupSteps[step];
  const totalSteps = integration.setupSteps.length;

  useEffect(() => {
    if (credentials.username && integration.id === "email") {
      const domain = credentials.username.split("@")[1]?.toLowerCase();
      if (domain && SMTP_PRESETS[domain]) {
        const preset = SMTP_PRESETS[domain];
        setCredentials(prev => ({
          ...prev,
          host: prev.host || preset.host,
          port: prev.port || String(preset.port),
          provider: preset.provider,
          from_email: prev.from_email || prev.username,
        }));
      }
    }
  }, [credentials.username, integration.id]);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);

    const finalCreds = { ...credentials };
    if (integration.id === "email" && !finalCreds.from_email) {
      finalCreds.from_email = finalCreds.username;
    }
    finalCreds.provider = integration.providers[0]?.id || integration.id;

    try {
      setSaving(true);
      await api.saveTenantIntegration(integration.id, {
        credentials: finalCreds,
        config: {},
        setup_mode: "self",
      });
      setSaving(false);

      const result = await api.testTenantIntegration(integration.id);
      setTestResult(result);

      if (result.ok) {
        setTimeout(() => onComplete(), 1500);
      }
    } catch (err) {
      setTestResult({ ok: false, error: err.message || "Test failed" });
    } finally {
      setTesting(false);
      setSaving(false);
    }
  };

  const canProceed = () => {
    if (currentStep.field) {
      return !!credentials[currentStep.field.key]?.trim();
    }
    if (currentStep.fields) {
      return currentStep.fields.every(f =>
        f.type === "password" || f.key.includes("secret")
          ? !!credentials[f.key]?.trim()
          : true
      );
    }
    return true;
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="p-6 pb-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "var(--accent-subtle)" }}>
                <integration.icon size={20} style={{ color: "var(--accent)" }} />
              </div>
              <div>
                <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                  Connect {integration.name}
                </h2>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Step {step + 1} of {totalSteps}
                </p>
              </div>
            </div>
          </div>
          {/* Progress bar */}
          <div className="flex gap-1.5">
            {integration.setupSteps.map((_, i) => (
              <div key={i} className="h-1 flex-1 rounded-full transition-all duration-300"
                style={{
                  background: i <= step ? "var(--accent)" : "var(--bg-muted)",
                }} />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          <h3 className="font-medium text-sm mb-1" style={{ color: "var(--text-primary)" }}>
            {currentStep.title}
          </h3>
          {currentStep.description && (
            <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
              {currentStep.description}
            </p>
          )}

          {/* Instructions */}
          {currentStep.instructions && (
            <ol className="space-y-2 mb-5">
              {currentStep.instructions.map((inst, i) => (
                <li key={i} className="flex gap-3 text-xs">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-semibold"
                    style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}>
                    {i + 1}
                  </span>
                  <span style={{ color: "var(--text-secondary)" }}>{inst}</span>
                </li>
              ))}
            </ol>
          )}

          {/* Help link */}
          {currentStep.helpUrl && (
            <a href={currentStep.helpUrl} target="_blank" rel="noopener noreferrer"
              className="text-xs flex items-center gap-1 mb-4 hover:underline"
              style={{ color: "var(--accent)" }}>
              <ExternalLink size={11} /> Open {integration.name} dashboard
            </a>
          )}

          {/* Single field */}
          {currentStep.field && (
            <div className="mb-4">
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                {currentStep.field.label}
              </label>
              <input
                type={currentStep.field.type || "text"}
                placeholder={currentStep.field.placeholder}
                value={credentials[currentStep.field.key] || ""}
                onChange={(e) => setCredentials({ ...credentials, [currentStep.field.key]: e.target.value })}
                className="w-full px-4 py-3 rounded-xl outline-none border text-sm transition-all"
                style={{
                  background: "var(--bg-muted)", borderColor: "var(--border)", color: "var(--text-primary)",
                }}
                onFocus={(e) => e.target.style.borderColor = "var(--accent)"}
                onBlur={(e) => e.target.style.borderColor = "var(--border)"}
              />
            </div>
          )}

          {/* Multiple fields */}
          {currentStep.fields && currentStep.fields.map((field) => (
            <div key={field.key} className="mb-3">
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                {field.label}
              </label>
              {field.type === "textarea" ? (
                <textarea
                  placeholder={field.placeholder}
                  value={credentials[field.key] || ""}
                  onChange={(e) => setCredentials({ ...credentials, [field.key]: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl outline-none border text-xs font-mono resize-none transition-all"
                  style={{
                    background: "var(--bg-muted)", borderColor: "var(--border)", color: "var(--text-primary)",
                  }}
                  onFocus={(e) => e.target.style.borderColor = "var(--accent)"}
                  onBlur={(e) => e.target.style.borderColor = "var(--border)"}
                />
              ) : (
                <input
                  type={field.type || "text"}
                  placeholder={field.placeholder}
                  value={credentials[field.key] || ""}
                  onChange={(e) => setCredentials({ ...credentials, [field.key]: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl outline-none border text-sm transition-all"
                  style={{
                    background: "var(--bg-muted)", borderColor: "var(--border)", color: "var(--text-primary)",
                  }}
                  onFocus={(e) => e.target.style.borderColor = "var(--accent)"}
                  onBlur={(e) => e.target.style.borderColor = "var(--border)"}
                />
              )}
            </div>
          ))}

          {/* Test step */}
          {currentStep.isTest && (
            <div className="mt-4 space-y-3">
              {!testResult ? (
                <button
                  onClick={handleTest}
                  disabled={testing || saving}
                  className="w-full py-3 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: "var(--accent)" }}>
                  {testing || saving ? (
                    <><Loader2 size={14} className="animate-spin" /> {saving ? "Saving..." : "Testing..."}</>
                  ) : (
                    "Test Connection"
                  )}
                </button>
              ) : testResult.ok ? (
                <div className="p-4 rounded-xl border text-sm flex items-center gap-2"
                  style={{
                    background: "color-mix(in srgb, var(--success) 8%, transparent)",
                    borderColor: "color-mix(in srgb, var(--success) 20%, transparent)",
                    color: "var(--success)",
                  }}>
                  <CheckCircle size={16} />
                  {currentStep.successMessage}
                </div>
              ) : (
                <>
                  <div className="p-4 rounded-xl border text-sm"
                    style={{
                      background: "color-mix(in srgb, var(--danger) 8%, transparent)",
                      borderColor: "color-mix(in srgb, var(--danger) 20%, transparent)",
                      color: "var(--danger)",
                    }}>
                    <div className="flex items-start gap-2">
                      <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                      <span>Connection failed: {testResult.error || "Unknown error"}</span>
                    </div>
                  </div>
                  <button onClick={() => { setTestResult(null); setStep(step - 1); }}
                    className="text-xs flex items-center gap-1" style={{ color: "var(--accent)" }}>
                    <ArrowLeft size={12} /> Go back and check your credentials
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 flex justify-between items-center"
          style={{ borderTop: "1px solid var(--border)" }}>
          <button
            onClick={() => step === 0 ? onClose() : setStep(step - 1)}
            className="text-xs flex items-center gap-1 px-3 py-2 rounded-lg transition-colors"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-muted)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
            <ArrowLeft size={12} />
            {step === 0 ? "Cancel" : "Previous"}
          </button>
          {!currentStep.isTest && (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              size="sm">
              Next <ChevronRight size={14} />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ManagedSetupDialog({ integration, onClose }) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    setSending(true);
    await api.requestManagedSetup(integration.id, { email, phone });
    setSent(true);
    setSending(false);
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        {!sent ? (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "var(--accent-subtle)" }}>
                <HelpCircle size={20} style={{ color: "var(--accent)" }} />
              </div>
              <div>
                <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                  Request setup help
                </h2>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  We'll set up {integration.name} for you
                </p>
              </div>
            </div>
            <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
              Our team will reach out to help you connect {integration.name}. Please provide your contact details.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full px-4 py-3 rounded-xl outline-none border text-sm"
                  style={{ background: "var(--bg-muted)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Phone (optional)</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full px-4 py-3 rounded-xl outline-none border text-sm"
                  style={{ background: "var(--bg-muted)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <Button onClick={handleSubmit} disabled={!email || sending}>
                {sending ? <Loader2 size={14} className="animate-spin" /> : null}
                Request Setup
              </Button>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
            </div>
          </>
        ) : (
          <div className="text-center py-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: "color-mix(in srgb, var(--success) 10%, transparent)" }}>
              <CheckCircle size={24} style={{ color: "var(--success)" }} />
            </div>
            <h3 className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Request sent!</h3>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              We'll reach out to you at {email} to set up {integration.name}.
            </p>
            <Button variant="outline" className="mt-4" onClick={onClose}>Close</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function IntegrationCard({ integration, status, onSetup, onManaged, onConfigure }) {
  const Icon = integration.icon;
  const isConnected = status?.status === "connected";
  const isError = status?.status === "error";
  const isPending = status?.status === "pending_setup";

  return (
    <div className="rounded-xl border p-5 transition-all duration-200 hover:shadow-lg group"
      style={{ background: "var(--surface)", borderColor: isConnected ? "color-mix(in srgb, var(--success) 30%, var(--border))" : "var(--border)" }}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: isConnected ? "color-mix(in srgb, var(--success) 10%, transparent)" : "var(--accent-subtle)" }}>
            <Icon size={20} style={{ color: isConnected ? "var(--success)" : "var(--accent)" }} />
          </div>
          <div>
            <h3 className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>{integration.name}</h3>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{integration.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isConnected && <CheckCircle size={13} style={{ color: "var(--success)" }} />}
          {isError && <AlertTriangle size={13} style={{ color: "var(--danger)" }} />}
          {isPending && <Loader2 size={13} className="animate-spin" style={{ color: "var(--accent)" }} />}
          <Badge variant={isConnected ? "success" : isError ? "destructive" : isPending ? "warning" : "secondary"} className="text-[10px]">
            {isConnected ? "Connected" : isError ? "Error" : isPending ? "Pending" : "Not connected"}
          </Badge>
        </div>
      </div>

      {isError && status?.last_error && (
        <p className="text-[11px] mb-3 rounded-lg px-3 py-1.5 border"
          style={{
            color: "var(--danger)",
            background: "color-mix(in srgb, var(--danger) 5%, transparent)",
            borderColor: "color-mix(in srgb, var(--danger) 10%, transparent)",
          }}>
          {status.last_error}
        </p>
      )}

      {status?.last_tested_at && (
        <p className="text-[10px] mb-3 font-mono" style={{ color: "var(--text-muted)" }}>
          Last tested: {new Date(status.last_tested_at).toLocaleString()}
        </p>
      )}

      <div className="flex gap-2">
        {isConnected ? (
          <Button size="sm" variant="outline" onClick={onConfigure}>
            Configure
          </Button>
        ) : (
          <>
            <Button size="sm" onClick={onSetup}>
              Set up myself
            </Button>
            <Button size="sm" variant="outline" onClick={onManaged}>
              <HelpCircle size={12} className="mr-1" />
              Help me set up
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function ConnectedConfigDialog({ integration, status, onClose, onDisconnect }) {
  const queryClient = useQueryClient();
  const [retesting, setRetesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const handleRetest = async () => {
    setRetesting(true);
    setTestResult(null);
    const result = await api.testTenantIntegration(integration.id);
    setTestResult(result);
    setRetesting(false);
    queryClient.invalidateQueries(["tenant-integrations"]);
  };

  const handleDisconnect = async () => {
    await api.disconnectTenantIntegration(integration.id);
    queryClient.invalidateQueries(["tenant-integrations"]);
    onDisconnect();
  };

  const Icon = integration.icon;

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "color-mix(in srgb, var(--success) 10%, transparent)" }}>
            <Icon size={20} style={{ color: "var(--success)" }} />
          </div>
          <div>
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
              {integration.name}
            </h2>
            <p className="text-xs flex items-center gap-1" style={{ color: "var(--success)" }}>
              <CheckCircle size={11} /> Connected
              {status?.setup_mode === "managed" && " (Managed by Cogniflow)"}
            </p>
          </div>
        </div>

        {status?.last_tested_at && (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Last tested: {new Date(status.last_tested_at).toLocaleString()}
          </p>
        )}

        {testResult && (
          <div className="text-sm p-3 rounded-xl border"
            style={{
              background: testResult.ok ? "color-mix(in srgb, var(--success) 8%, transparent)" : "color-mix(in srgb, var(--danger) 8%, transparent)",
              color: testResult.ok ? "var(--success)" : "var(--danger)",
              borderColor: testResult.ok ? "color-mix(in srgb, var(--success) 20%, transparent)" : "color-mix(in srgb, var(--danger) 20%, transparent)",
            }}>
            {testResult.ok ? (
              <span className="flex items-center gap-1.5"><CheckCircle size={14} /> {testResult.message || "Connection healthy"}</span>
            ) : (
              <span className="flex items-center gap-1.5"><AlertTriangle size={14} /> {testResult.error}</span>
            )}
          </div>
        )}

        <div className="flex gap-3 mt-2">
          <Button variant="outline" onClick={handleRetest} disabled={retesting}>
            {retesting ? <Loader2 size={14} className="animate-spin" /> : null}
            Re-test Connection
          </Button>
          <Button variant="destructive" onClick={handleDisconnect}>
            Disconnect
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Integrations() {
  const queryClient = useQueryClient();
  const [wizardIntegration, setWizardIntegration] = useState(null);
  const [managedIntegration, setManagedIntegration] = useState(null);
  const [configIntegration, setConfigIntegration] = useState(null);

  const { data } = useQuery({
    queryKey: ["tenant-integrations"],
    queryFn: api.getTenantIntegrations,
  });

  const statusMap = {};
  (data?.integrations || []).forEach(item => {
    statusMap[item.integration] = item;
  });

  const connected = INTEGRATIONS.filter(i => statusMap[i.id]?.status === "connected");
  const available = INTEGRATIONS.filter(i => statusMap[i.id]?.status !== "connected");

  const categories = {};
  available.forEach(i => {
    const cat = i.category;
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(i);
  });

  return (
    <div>
      <PageHeader title="Integrations" description="Connect your business tools to Cogniflow" />

      <div className="px-8 py-6">
        {/* Summary badges */}
        <div className="flex gap-3 mb-6">
          <Badge variant="outline" className="text-xs">
            {connected.length} of {INTEGRATIONS.length} connected
          </Badge>
        </div>

        {/* Connected */}
        {connected.length > 0 && (
          <div className="mb-8">
            <h3 className="text-xs font-medium uppercase tracking-wider mb-3 flex items-center gap-2"
              style={{ color: "var(--text-muted)" }}>
              <span className="w-2 h-2 rounded-full" style={{ background: "var(--success)" }} />
              Connected
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {connected.map(i => (
                <IntegrationCard
                  key={i.id}
                  integration={i}
                  status={statusMap[i.id]}
                  onSetup={() => setWizardIntegration(i)}
                  onManaged={() => setManagedIntegration(i)}
                  onConfigure={() => setConfigIntegration(i)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Available by category */}
        {Object.entries(categories).map(([cat, items]) => (
          <div key={cat} className="mb-8">
            <h3 className="text-xs font-medium uppercase tracking-wider mb-3"
              style={{ color: "var(--text-muted)" }}>
              {CATEGORY_LABELS[cat] || cat}
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {items.map(i => (
                <IntegrationCard
                  key={i.id}
                  integration={i}
                  status={statusMap[i.id]}
                  onSetup={() => setWizardIntegration(i)}
                  onManaged={() => setManagedIntegration(i)}
                  onConfigure={() => setConfigIntegration(i)}
                />
              ))}
            </div>
          </div>
        ))}

        {INTEGRATIONS.length === 0 && (
          <div className="text-center py-16 rounded-xl border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: "var(--accent-subtle)" }}>
              <Plug size={24} style={{ color: "var(--accent)" }} />
            </div>
            <p style={{ color: "var(--text-secondary)" }}>No integrations available</p>
          </div>
        )}
      </div>

      {/* Wizard modal */}
      {wizardIntegration && (
        <SetupWizard
          integration={wizardIntegration}
          onComplete={() => {
            setWizardIntegration(null);
            queryClient.invalidateQueries(["tenant-integrations"]);
          }}
          onClose={() => setWizardIntegration(null)}
        />
      )}

      {/* Managed setup modal */}
      {managedIntegration && (
        <ManagedSetupDialog
          integration={managedIntegration}
          onClose={() => {
            setManagedIntegration(null);
            queryClient.invalidateQueries(["tenant-integrations"]);
          }}
        />
      )}

      {/* Connected config modal */}
      {configIntegration && (
        <ConnectedConfigDialog
          integration={configIntegration}
          status={statusMap[configIntegration.id]}
          onClose={() => setConfigIntegration(null)}
          onDisconnect={() => setConfigIntegration(null)}
        />
      )}
    </div>
  );
}
