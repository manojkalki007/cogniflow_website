import { NavLink, Outlet } from "react-router-dom";
import {
  Phone, PhoneOutgoing, Users, BarChart3, Bot, LayoutTemplate, Megaphone,
  Settings, DollarSign, ShieldCheck, Gauge, MessageSquare, Plug, Zap,
} from "lucide-react";

const NAV_MAIN = [
  { to: "/dashboard", label: "Call Log", icon: Phone },
  { to: "/dashboard/call", label: "Make a Call", icon: PhoneOutgoing },
  { to: "/dashboard/contacts", label: "Contacts", icon: Users },
  { to: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/dashboard/agents", label: "Agents", icon: Bot },
  { to: "/dashboard/templates", label: "Templates", icon: LayoutTemplate },
  { to: "/dashboard/campaigns", label: "Campaigns", icon: Megaphone },
];

const NAV_FEATURES = [
  { to: "/dashboard/revenue", label: "Revenue", icon: DollarSign },
  { to: "/dashboard/compliance", label: "Compliance", icon: ShieldCheck },
  { to: "/dashboard/latency", label: "Latency", icon: Gauge },
  { to: "/dashboard/whatsapp", label: "WhatsApp", icon: MessageSquare },
  { to: "/dashboard/integrations", label: "Integrations", icon: Plug },
];

function NavItem({ to, label, icon: Icon, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-200 ${
          isActive
            ? "nav-active text-white"
            : "text-gray-500 hover:text-gray-200 hover:bg-white/[0.03]"
        }`
      }
    >
      <Icon size={16} strokeWidth={isActive => isActive ? 2.5 : 1.5} />
      {label}
    </NavLink>
  );
}

export default function Layout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-60 sidebar-gradient border-r border-gray-800/50 flex flex-col">
        <div className="p-5 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg btn-gradient flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Zap size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-[15px] font-bold tracking-tight text-white">Cogniflow</h1>
              <p className="text-[10px] text-gray-500 font-medium tracking-wide uppercase">AI Voice Agent</p>
            </div>
          </div>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-gray-700/50 to-transparent mx-4" />

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV_MAIN.map(({ to, label, icon }) => (
            <NavItem key={to} to={to} label={label} icon={icon} end={to === "/dashboard"} />
          ))}

          <div className="h-px bg-gradient-to-r from-transparent via-gray-700/30 to-transparent my-4 mx-2" />
          <p className="px-3 py-1.5 text-[10px] uppercase tracking-[0.15em] text-gray-600 font-semibold">
            Edge Features
          </p>

          {NAV_FEATURES.map(({ to, label, icon }) => (
            <NavItem key={to} to={to} label={label} icon={icon} />
          ))}

          <div className="h-px bg-gradient-to-r from-transparent via-gray-700/30 to-transparent my-4 mx-2" />
          <NavItem to="/dashboard/settings" label="Settings" icon={Settings} />
        </nav>

        <div className="p-4 border-t border-gray-800/30">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-gray-600 font-mono">v2.0.0</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="System online" />
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto page-bg p-8">
        <div className="animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
