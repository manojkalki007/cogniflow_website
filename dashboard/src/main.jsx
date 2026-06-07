import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import "./index.css";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import AuthCallback from "./pages/AuthCallback";
import CallLog from "./pages/CallLog";
import Contacts from "./pages/Contacts";
import ContactDetail from "./pages/ContactDetail";
import Analytics from "./pages/Analytics";
import Agents from "./pages/Agents";
import Campaigns from "./pages/Campaigns";
import Settings from "./pages/Settings";
import Revenue from "./pages/Revenue";
import Compliance from "./pages/Compliance";
import Latency from "./pages/Latency";
import WhatsApp from "./pages/WhatsApp";
import Integrations from "./pages/Integrations";
import Templates from "./pages/Templates";
import TenantDashboard from "./pages/TenantDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import ApiHub from "./pages/ApiHub";
import EmailAutomation from "./pages/EmailAutomation";
import AgentBuilder from "./pages/AgentBuilder";
import AiSdr from "./pages/AiSdr";
import Scheduling from "./pages/Scheduling";
import PhoneNumbers from "./pages/PhoneNumbers";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 10_000, retry: 1 } },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/" element={<Navigate to="/home" replace />} />
                <Route path="/home" element={<CallLog />} />
                <Route path="/home/contacts" element={<Contacts />} />
                <Route path="/home/contacts/:id" element={<ContactDetail />} />
                <Route path="/home/analytics" element={<Analytics />} />
                <Route path="/home/agents" element={<Agents />} />
                <Route path="/home/agents/:id" element={<AgentBuilder />} />
                <Route path="/home/templates" element={<Templates />} />
                <Route path="/home/phone-numbers" element={<PhoneNumbers />} />
                <Route path="/home/campaigns" element={<Campaigns />} />
                <Route path="/home/revenue" element={<Revenue />} />
                <Route path="/home/compliance" element={<Compliance />} />
                <Route path="/home/latency" element={<Latency />} />
                <Route path="/home/whatsapp" element={<WhatsApp />} />
                <Route path="/home/email" element={<EmailAutomation />} />
                <Route path="/home/ai-sdr" element={<AiSdr />} />
                <Route path="/home/scheduling" element={<Scheduling />} />
                <Route path="/home/integrations" element={<Integrations />} />
                <Route path="/home/tenant" element={<TenantDashboard />} />
                <Route path="/home/admin" element={<AdminDashboard />} />
                <Route path="/home/api-hub" element={<ApiHub />} />
                <Route path="/home/settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="/home" replace />} />
              </Route>
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
