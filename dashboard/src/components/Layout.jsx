import { useState, useEffect, createContext, useContext } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  Phone, PhoneOutgoing, Users, BarChart3, Bot,
  LayoutTemplate, Megaphone, Settings, Sun, Moon,
  UserCircle, ShieldAlert, Cable, MessageSquare,
  Mail, DollarSign, ShieldCheck, Timer, Plug,
  PanelLeftClose, PanelLeftOpen, Search, Bell,
  ChevronRight, Command, LogOut,
} from "lucide-react";

const SidebarContext = createContext();
export const useSidebar = () => useContext(SidebarContext);

const NAV_CORE = [
  { to: "/dashboard", label: "Call Log", icon: Phone, end: true },
  { to: "/dashboard/call", label: "Make a Call", icon: PhoneOutgoing },
  { to: "/dashboard/contacts", label: "Contacts", icon: Users },
  { to: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/dashboard/agents", label: "Agents", icon: Bot },
  { to: "/dashboard/templates", label: "Templates", icon: LayoutTemplate },
  { to: "/dashboard/campaigns", label: "Campaigns", icon: Megaphone },
];

const NAV_CHANNELS = [
  { to: "/dashboard/whatsapp", label: "WhatsApp", icon: MessageSquare },
  { to: "/dashboard/email", label: "Email", icon: Mail },
  { to: "/dashboard/integrations", label: "Integrations", icon: Plug },
];

const NAV_INSIGHTS = [
  { to: "/dashboard/revenue", label: "Revenue", icon: DollarSign },
  { to: "/dashboard/compliance", label: "Compliance", icon: ShieldCheck },
  { to: "/dashboard/latency", label: "Latency", icon: Timer },
];

const NAV_ACCOUNT = [
  { to: "/dashboard/tenant", label: "My Account", icon: UserCircle },
  { to: "/dashboard/admin", label: "Admin Panel", icon: ShieldAlert },
  { to: "/dashboard/api-hub", label: "API Hub", icon: Cable },
];

const PAGE_TITLES = {
  "/dashboard": "Call Log",
  "/dashboard/call": "Make a Call",
  "/dashboard/contacts": "Contacts",
  "/dashboard/analytics": "Analytics",
  "/dashboard/agents": "Agents",
  "/dashboard/templates": "Templates",
  "/dashboard/campaigns": "Campaigns",
  "/dashboard/whatsapp": "WhatsApp",
  "/dashboard/email": "Email",
  "/dashboard/integrations": "Integrations",
  "/dashboard/revenue": "Revenue",
  "/dashboard/compliance": "Compliance",
  "/dashboard/latency": "Latency",
  "/dashboard/tenant": "My Account",
  "/dashboard/admin": "Admin Panel",
  "/dashboard/api-hub": "API Hub",
  "/dashboard/settings": "Settings",
};

function NavItem({ to, label, icon: Icon, end, collapsed }) {
  return (
    <NavLink
      to={to}
      end={end}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        `sidebar-nav-item ${isActive ? "active" : ""}`
      }
    >
      <Icon size={16} strokeWidth={1.8} className="flex-shrink-0" />
      {!collapsed && (
        <span className="truncate whitespace-nowrap">{label}</span>
      )}
    </NavLink>
  );
}

function SectionLabel({ children, collapsed }) {
  if (collapsed) {
    return <div className="mx-auto my-3 w-5 h-px" style={{ background: "var(--sidebar-border)" }} />;
  }
  return (
    <p
      className="px-2.5 pt-6 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
      style={{ color: "var(--sidebar-text)", opacity: 0.5 }}
    >
      {children}
    </p>
  );
}

export default function Layout() {
  const { user, signOut } = useAuth();
  const [dark, setDark] = useState(
    () => localStorage.getItem("theme") !== "light",
  );
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("sidebar_collapsed") === "true",
  );
  const location = useLocation();
  const userEmail = user?.email || "";
  const userInitials = userEmail ? userEmail.substring(0, 2).toUpperCase() : "C";

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    localStorage.setItem("sidebar_collapsed", collapsed);
  }, [collapsed]);

  const currentTitle = PAGE_TITLES[location.pathname] || "Dashboard";
  const pathSegments = location.pathname.split("/").filter(Boolean);

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
      <div
        className="flex h-screen overflow-hidden"
        style={{ background: "var(--bg-subtle)" }}
      >
        {/* ──── Sidebar ──── */}
        <aside
          className={`sidebar-glass flex-shrink-0 flex flex-col transition-all duration-300 ease-in-out ${
            collapsed ? "w-[60px] sidebar-collapsed" : "w-[220px]"
          }`}
        >
          {/* Logo */}
          <div
            className="flex items-center flex-shrink-0"
            style={{
              borderBottom: "1px solid var(--sidebar-border)",
              padding: collapsed ? "16px 0" : "16px 14px",
              justifyContent: collapsed ? "center" : "flex-start",
            }}
          >
            <img
              src="/cogniflow-logo.png"
              alt="Cogniflow"
              style={{
                height: collapsed ? 28 : 32,
                width: "auto",
                objectFit: "contain",
              }}
            />
          </div>

          {/* Navigation */}
          <nav
            className="flex-1 overflow-y-auto overflow-x-hidden"
            style={{ padding: collapsed ? "8px 6px" : "8px 8px" }}
          >
            <div className="space-y-0.5">
              {NAV_CORE.map((item) => (
                <NavItem key={item.to} {...item} collapsed={collapsed} />
              ))}
            </div>

            <SectionLabel collapsed={collapsed}>Channels</SectionLabel>
            <div className="space-y-0.5">
              {NAV_CHANNELS.map((item) => (
                <NavItem key={item.to} {...item} collapsed={collapsed} />
              ))}
            </div>

            <SectionLabel collapsed={collapsed}>Insights</SectionLabel>
            <div className="space-y-0.5">
              {NAV_INSIGHTS.map((item) => (
                <NavItem key={item.to} {...item} collapsed={collapsed} />
              ))}
            </div>

            <SectionLabel collapsed={collapsed}>Account</SectionLabel>
            <div className="space-y-0.5">
              {NAV_ACCOUNT.map((item) => (
                <NavItem key={item.to} {...item} collapsed={collapsed} />
              ))}
            </div>
          </nav>

          {/* Bottom Controls */}
          <div
            className="flex-shrink-0"
            style={{
              borderTop: "1px solid var(--sidebar-border)",
              padding: collapsed ? "10px 6px" : "10px 8px",
            }}
          >
            {!collapsed && userEmail && (
              <div
                className="px-2.5 py-2 mb-1.5 rounded-lg truncate text-[11px]"
                style={{ color: "var(--sidebar-text)", opacity: 0.7 }}
                title={userEmail}
              >
                {userEmail}
              </div>
            )}

            <NavLink
              to="/dashboard/settings"
              title={collapsed ? "Settings" : undefined}
              className={({ isActive }) =>
                `sidebar-nav-item ${isActive ? "active" : ""}`
              }
            >
              <Settings size={16} strokeWidth={1.8} className="flex-shrink-0" />
              {!collapsed && <span>Settings</span>}
            </NavLink>

            <button
              onClick={signOut}
              className="sidebar-nav-item w-full"
              title={collapsed ? "Sign out" : undefined}
            >
              <LogOut size={16} strokeWidth={1.8} className="flex-shrink-0" />
              {!collapsed && <span>Sign out</span>}
            </button>

            <div
              className={`flex items-center mt-1.5 ${
                collapsed ? "flex-col gap-1" : "gap-1"
              }`}
            >
              <button
                onClick={() => setDark((d) => !d)}
                className="sidebar-nav-item flex-1"
                style={{ justifyContent: "center" }}
                title={dark ? "Light mode" : "Dark mode"}
              >
                {dark ? <Sun size={15} /> : <Moon size={15} />}
              </button>
              <button
                onClick={() => setCollapsed((c) => !c)}
                className="sidebar-nav-item flex-1"
                style={{ justifyContent: "center" }}
                title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {collapsed ? (
                  <PanelLeftOpen size={15} />
                ) : (
                  <PanelLeftClose size={15} />
                )}
              </button>
            </div>
          </div>
        </aside>

        {/* ──── Main Content ──── */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Header */}
          <header
            className="header-glass flex items-center justify-between flex-shrink-0"
            style={{
              padding: "0 24px",
              height: "54px",
            }}
          >
            {/* Left: Breadcrumbs */}
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                Dashboard
              </span>
              {pathSegments.length > 1 && (
                <>
                  <ChevronRight
                    size={12}
                    style={{ color: "var(--text-muted)" }}
                  />
                  <span
                    className="text-xs font-medium truncate"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {currentTitle}
                  </span>
                </>
              )}
            </div>

            {/* Right: Search + Actions */}
            <div className="flex items-center gap-3">
              <div className="relative hidden md:block">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--text-muted)" }}
                />
                <input
                  type="text"
                  placeholder="Search..."
                  className="header-search pl-9 pr-14 py-1.5 rounded-lg text-xs w-48 focus:w-64 transition-all duration-200"
                />
                <div
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5"
                >
                  <kbd
                    className="text-[9px] px-1.5 py-0.5 rounded font-mono flex items-center gap-0.5"
                    style={{
                      background: "var(--bg-muted)",
                      color: "var(--text-muted)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <Command size={9} />K
                  </kbd>
                </div>
              </div>

              <button
                className="relative p-2 rounded-lg transition-all duration-200 cursor-pointer"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--bg-muted)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
                title="Notifications"
              >
                <Bell size={16} />
                <span
                  className="absolute top-1 right-1 w-2 h-2 rounded-full"
                  style={{
                    background: "var(--accent)",
                    boxShadow: "0 0 6px var(--accent-glow)",
                  }}
                />
              </button>

              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-bold text-white cursor-pointer transition-all duration-200 hover:scale-105"
                style={{
                  background: "linear-gradient(135deg, rgba(0,188,212,0.9), rgba(0,151,167,0.9))",
                  border: "1px solid rgba(34,211,238,0.15)",
                  boxShadow: "0 2px 8px rgba(0,188,212,0.2)",
                }}
                title={userEmail || "Profile"}
              >
                {userInitials}
              </div>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 overflow-auto">
            <div className="animate-fade-in">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarContext.Provider>
  );
}
