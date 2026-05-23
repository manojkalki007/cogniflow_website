import { useState, useEffect, createContext, useContext } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  Phone, PhoneOutgoing, Users, BarChart3, Bot,
  LayoutTemplate, Megaphone, Settings, Target,
  UserCircle, ShieldAlert, Cable, MessageSquare,
  Mail, DollarSign, ShieldCheck, Timer, Plug, Calendar,
  PanelLeftClose, PanelLeftOpen, Search, Bell,
  ChevronRight, Command, LogOut, Menu, X,
} from "lucide-react";

const SidebarContext = createContext();
export const useSidebar = () => useContext(SidebarContext);

const NAV_CORE = [
  { to: "/home", label: "Call Log", icon: Phone, end: true },
  { to: "/home/call", label: "Make a Call", icon: PhoneOutgoing },
  { to: "/home/contacts", label: "Contacts", icon: Users },
  { to: "/home/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/home/agents", label: "Agents", icon: Bot },
  { to: "/home/templates", label: "Templates", icon: LayoutTemplate },
  { to: "/home/campaigns", label: "Campaigns", icon: Megaphone },
];

const NAV_CHANNELS = [
  { to: "/home/whatsapp", label: "WhatsApp", icon: MessageSquare },
  { to: "/home/email", label: "Email", icon: Mail },
  { to: "/home/scheduling", label: "Scheduling", icon: Calendar },
  { to: "/home/ai-sdr", label: "AI SDR", icon: Target },
  { to: "/home/integrations", label: "Integrations", icon: Plug },
];

const NAV_INSIGHTS = [
  { to: "/home/revenue", label: "Revenue", icon: DollarSign },
  { to: "/home/compliance", label: "Compliance", icon: ShieldCheck },
  { to: "/home/latency", label: "Latency", icon: Timer },
];

const NAV_ACCOUNT = [
  { to: "/home/tenant", label: "My Account", icon: UserCircle },
  { to: "/home/admin", label: "Admin Panel", icon: ShieldAlert },
  { to: "/home/api-hub", label: "API Hub", icon: Cable },
];

const PAGE_TITLES = {
  "/home": "Call Log",
  "/home/call": "Make a Call",
  "/home/contacts": "Contacts",
  "/home/analytics": "Analytics",
  "/home/agents": "Agents",
  "/home/templates": "Templates",
  "/home/campaigns": "Campaigns",
  "/home/whatsapp": "WhatsApp",
  "/home/email": "Email",
  "/home/ai-sdr": "AI SDR",
  "/home/integrations": "Integrations",
  "/home/revenue": "Revenue",
  "/home/compliance": "Compliance",
  "/home/latency": "Latency",
  "/home/tenant": "My Account",
  "/home/admin": "Admin Panel",
  "/home/api-hub": "API Hub",
  "/home/settings": "Settings",
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
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("sidebar_collapsed") === "true",
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const userEmail = user?.email || "";
  const userInitials = userEmail ? userEmail.substring(0, 2).toUpperCase() : "C";

  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);

  useEffect(() => {
    localStorage.setItem("sidebar_collapsed", collapsed);
  }, [collapsed]);

  // Close mobile sidebar on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const currentTitle = PAGE_TITLES[location.pathname] || "Dashboard";
  const pathSegments = location.pathname.split("/").filter(Boolean);

  const sidebarContent = (isMobile = false) => (
    <>
          {/* Logo */}
          <div
            className="flex items-center flex-shrink-0"
            style={{
              borderBottom: "1px solid var(--sidebar-border)",
              padding: (!isMobile && collapsed) ? "16px 0" : "16px 14px",
              justifyContent: (!isMobile && collapsed) ? "center" : "flex-start",
            }}
          >
            {isMobile && (
              <button
                onClick={() => setMobileOpen(false)}
                className="mr-3 p-1.5 rounded-lg transition-all"
                style={{ color: "var(--sidebar-text)" }}
              >
                <X size={18} />
              </button>
            )}
            <img
              src="/cogniflow-logo.png"
              alt="Cogniflow"
              style={{
                height: (!isMobile && collapsed) ? 36 : 44,
                width: "auto",
                objectFit: "contain",
              }}
            />
          </div>

          {/* Navigation */}
          <nav
            className="flex-1 overflow-y-auto overflow-x-hidden"
            style={{ padding: (!isMobile && collapsed) ? "8px 6px" : "8px 8px" }}
          >
            <div className="space-y-0.5">
              {NAV_CORE.map((item) => (
                <NavItem key={item.to} {...item} collapsed={!isMobile && collapsed} />
              ))}
            </div>

            <SectionLabel collapsed={!isMobile && collapsed}>Channels</SectionLabel>
            <div className="space-y-0.5">
              {NAV_CHANNELS.map((item) => (
                <NavItem key={item.to} {...item} collapsed={!isMobile && collapsed} />
              ))}
            </div>

            <SectionLabel collapsed={!isMobile && collapsed}>Insights</SectionLabel>
            <div className="space-y-0.5">
              {NAV_INSIGHTS.map((item) => (
                <NavItem key={item.to} {...item} collapsed={!isMobile && collapsed} />
              ))}
            </div>

            <SectionLabel collapsed={!isMobile && collapsed}>Account</SectionLabel>
            <div className="space-y-0.5">
              {NAV_ACCOUNT.map((item) => (
                <NavItem key={item.to} {...item} collapsed={!isMobile && collapsed} />
              ))}
            </div>
          </nav>

          {/* Bottom Controls */}
          <div
            className="flex-shrink-0"
            style={{
              borderTop: "1px solid var(--sidebar-border)",
              padding: (!isMobile && collapsed) ? "10px 6px" : "10px 8px",
            }}
          >
            {(isMobile || !collapsed) && userEmail && (
              <div
                className="px-2.5 py-2 mb-1.5 rounded-lg truncate text-[11px]"
                style={{ color: "var(--sidebar-text)", opacity: 0.7 }}
                title={userEmail}
              >
                {userEmail}
              </div>
            )}

            <NavLink
              to="/home/settings"
              title={(!isMobile && collapsed) ? "Settings" : undefined}
              className={({ isActive }) =>
                `sidebar-nav-item ${isActive ? "active" : ""}`
              }
            >
              <Settings size={16} strokeWidth={1.8} className="flex-shrink-0" />
              {(isMobile || !collapsed) && <span>Settings</span>}
            </NavLink>

            <button
              onClick={signOut}
              className="sidebar-nav-item w-full"
              title={(!isMobile && collapsed) ? "Sign out" : undefined}
            >
              <LogOut size={16} strokeWidth={1.8} className="flex-shrink-0" />
              {(isMobile || !collapsed) && <span>Sign out</span>}
            </button>

            {!isMobile && (
              <div className="flex items-center mt-1.5">
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
            )}
          </div>
    </>
  );

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
      <div
        className="flex h-screen overflow-hidden"
        style={{ background: "var(--bg-subtle)" }}
      >
        {/* ──── Mobile Sidebar Overlay ──── */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <div
              className="absolute inset-0"
              style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
            />
          </div>
        )}

        {/* ──── Mobile Sidebar ──── */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-[260px] sidebar-glass flex flex-col transition-transform duration-300 ease-in-out lg:hidden ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {sidebarContent(true)}
        </aside>

        {/* ──── Desktop Sidebar ──── */}
        <aside
          className={`sidebar-glass flex-shrink-0 flex-col transition-all duration-300 ease-in-out hidden lg:flex ${
            collapsed ? "w-[60px] sidebar-collapsed" : "w-[220px]"
          }`}
        >
          {sidebarContent(false)}
        </aside>

        {/* ──── Main Content ──── */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Header */}
          <header
            className="header-glass flex items-center justify-between flex-shrink-0"
            style={{
              padding: "0 16px 0 12px",
              height: "54px",
            }}
          >
            {/* Left: Hamburger + Breadcrumbs */}
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => setMobileOpen(true)}
                className="p-2 rounded-lg transition-all lg:hidden cursor-pointer"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-muted)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                title="Open menu"
              >
                <Menu size={18} />
              </button>
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
