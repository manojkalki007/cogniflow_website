import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import CallLog from "./pages/CallLog";
import MakeCall from "./pages/MakeCall";
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

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 10_000, retry: 1 } },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<CallLog />} />
            <Route path="/dashboard/call" element={<MakeCall />} />
            <Route path="/dashboard/contacts" element={<Contacts />} />
            <Route path="/dashboard/contacts/:id" element={<ContactDetail />} />
            <Route path="/dashboard/analytics" element={<Analytics />} />
            <Route path="/dashboard/agents" element={<Agents />} />
            <Route path="/dashboard/templates" element={<Templates />} />
            <Route path="/dashboard/campaigns" element={<Campaigns />} />
            <Route path="/dashboard/revenue" element={<Revenue />} />
            <Route path="/dashboard/compliance" element={<Compliance />} />
            <Route path="/dashboard/latency" element={<Latency />} />
            <Route path="/dashboard/whatsapp" element={<WhatsApp />} />
            <Route path="/dashboard/email" element={<EmailAutomation />} />
            <Route path="/dashboard/integrations" element={<Integrations />} />
            <Route path="/dashboard/tenant" element={<TenantDashboard />} />
            <Route path="/dashboard/admin" element={<AdminDashboard />} />
            <Route path="/dashboard/api-hub" element={<ApiHub />} />
            <Route path="/dashboard/settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
