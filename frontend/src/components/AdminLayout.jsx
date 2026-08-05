import { useState, useEffect } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import {
  LayoutDashboard, Users, UserPlus,
  Calendar, LogOut, Shield,
  ChevronRight, TrendingUp, Settings,
  Sun, Moon, Menu, X
} from "lucide-react";

const navItems = [
  {
    to:    "/admin",
    icon:  LayoutDashboard,
    label: "Dashboard",
    end:   true,
    desc:  "KPIs & analytics"
  },
  {
    to:    "/admin/patients",
    icon:  Users,
    label: "All Patients",
    end:   false,
    desc:  "Patient registry"
  },
  {
    to:    "/admin/doctors",
    icon:  UserPlus,
    label: "Manage Doctors",
    end:   false,
    desc:  "Create & view"
  },
  {
    to:    "/admin/appointments",
    icon:  Calendar,
    label: "Appointments",
    end:   false,
    desc:  "All records"
  },
  {
    to:    "/admin/settings",
    icon:  Settings,
    label: "Settings",
    end:   false,
    desc:  "Account & security"
  },
];

const pageTitles = {
  "/admin":              { title: "Dashboard",      sub: "System overview & analytics"   },
  "/admin/patients":     { title: "All Patients",   sub: "Complete patient registry"     },
  "/admin/doctors":      { title: "Manage Doctors", sub: "Doctor accounts & schedules"   },
  "/admin/appointments": { title: "Appointments",   sub: "All appointment records"       },
  "/admin/settings":     { title: "Settings",       sub: "Account & security"            },
};

export default function AdminLayout({ children, title, subtitle }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate         = useNavigate();
  const location         = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === "Escape") setSidebarOpen(false); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  const isPatientDetail = location.pathname.startsWith("/admin/patients/");
  const isDoctorDetail  = location.pathname.startsWith("/admin/doctors/");
  const page = title
    ? { title, sub: subtitle || "" }
    : isPatientDetail
    ? { title: "Patient Detail", sub: "Full clinical view" }
    : isDoctorDetail
    ? { title: "Doctor Detail", sub: "Profile & schedule" }
    : (pageTitles[location.pathname] || { title: "Admin Panel", sub: "" });
  const initials         = user?.name?.split(" ").map(n => n[0]).join("").slice(0, 2) || "A";

  return (
    <div className="flex min-h-screen bg-[#f0f4f8] dark:bg-[#0f172a]">

      {/* ── MOBILE BACKDROP ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── SIDEBAR ── */}
      <aside className={`w-64 flex flex-col fixed h-full z-30 transition-transform duration-300 lg:translate-x-0 ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      }`}
        style={{ background: "linear-gradient(180deg, #12062a 0%, #1a0938 50%, #12062a 100%)" }}>

        {/* Top glow — violet */}
        <div className="absolute top-0 left-0 right-0 h-32 opacity-20 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 50% 0%, #8b5cf6 0%, transparent 70%)" }} />

        {/* Logo */}
        <div className="relative px-5 py-5 border-b border-white/8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)" }}>
                <Shield size={18} className="text-white" />
              </div>
              <div>
                <h1 className="text-white font-bold text-base leading-tight">
                  MedCore <span className="text-violet-400">AI</span>
                </h1>
                <p className="text-white/35 text-[10px] mt-0.5 uppercase tracking-widest">
                  Admin Panel
                </p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              aria-label="Close menu"
              className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/60 flex-shrink-0"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Admin card */}
        <div className="relative mx-3 my-3 rounded-2xl p-3.5"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm text-white shadow-lg"
              style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)" }}>
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white text-sm font-semibold truncate leading-tight">
                {user?.name || "Administrator"}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-1.5 h-1.5 bg-violet-400 rounded-full" />
                <p className="text-white/40 text-[10px]">System Administrator</p>
              </div>
            </div>
          </div>
        </div>

        {/* Nav section label */}
        <div className="px-5 pb-1">
          <p className="text-white/25 text-[9px] uppercase tracking-[0.15em] font-semibold">
            Management
          </p>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-1 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label, desc, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative ${
                  isActive ? "text-white" : "text-white/50 hover:text-white/80"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <div className="absolute inset-0 rounded-xl"
                      style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.35), rgba(109,40,217,0.2))", border: "1px solid rgba(124,58,237,0.3)" }} />
                  )}
                  {!isActive && (
                    <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: "rgba(255,255,255,0.05)" }} />
                  )}
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-violet-400" />
                  )}
                  <div className="relative w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all"
                    style={isActive
                      ? { background: "linear-gradient(135deg, #7c3aed, #6d28d9)" }
                      : { background: "rgba(255,255,255,0.06)" }}>
                    <Icon size={16} className={isActive ? "text-white" : "text-white/50 group-hover:text-white/70"} />
                  </div>
                  <div className="relative flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight truncate">{label}</p>
                    <p className={`text-[10px] mt-0.5 truncate ${isActive ? "text-violet-300/60" : "text-white/25 group-hover:text-white/35"}`}>
                      {desc}
                    </p>
                  </div>
                  {isActive && <ChevronRight size={12} className="relative text-violet-400/60 flex-shrink-0" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* System status */}
        <div className="mx-3 mb-3 rounded-2xl p-3.5"
          style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.12), rgba(109,40,217,0.08))", border: "1px solid rgba(124,58,237,0.15)" }}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={11} className="text-violet-400" />
            <p className="text-violet-400 text-[10px] font-semibold uppercase tracking-wide">System Status</p>
          </div>
          <div className="space-y-1.5">
            {[
              { label: "Database", ok: true },
              { label: "AI Services", ok: true },
              { label: "FHIR Server", ok: true },
            ].map(({ label, ok }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-white/30 text-[10px]">{label}</span>
                <div className="flex items-center gap-1">
                  <div className={`w-1 h-1 rounded-full ${ok ? "bg-emerald-400" : "bg-red-400"}`} />
                  <span className={`text-[9px] ${ok ? "text-emerald-400/60" : "text-red-400/60"}`}>
                    {ok ? "Online" : "Offline"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Logout */}
        <div className="px-3 pb-4 border-t border-white/8 pt-3">
          <button
            onClick={() => { logout(); navigate("/"); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all group"
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 group-hover:bg-red-500/15 transition-colors">
              <LogOut size={15} />
            </div>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="flex-1 lg:ml-64 flex flex-col min-h-screen">

        {/* Top header */}
        <header className="sticky top-0 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/70 dark:border-slate-700/70 px-4 sm:px-8 py-3.5"
          style={{ boxShadow: "0 1px 20px rgba(0,0,0,0.04)" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setSidebarOpen(true)}
                aria-label="Open menu"
                className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex-shrink-0"
              >
                <Menu size={16} className="text-slate-500 dark:text-slate-300" />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-slate-300 dark:text-slate-500 text-xs hidden sm:inline">Admin Panel</span>
                  <ChevronRight size={12} className="text-slate-300 dark:text-slate-500 hidden sm:inline" />
                  <span className="text-slate-700 dark:text-slate-100 text-sm font-semibold truncate">{page.title}</span>
                </div>
                <p className="text-slate-400 text-xs mt-0.5 truncate">{page.sub}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-slate-700 dark:text-slate-200 text-xs font-medium">
                  {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
                </p>
                <p className="text-slate-400 text-xs">{new Date().getFullYear()}</p>
              </div>
              <button
                onClick={toggleTheme}
                className="w-8 h-8 flex items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                {theme === "dark"
                  ? <Sun size={14} className="text-amber-400" />
                  : <Moon size={14} className="text-slate-500" />
                }
              </button>
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border"
                style={{ background: "rgba(124,58,237,0.06)", borderColor: "rgba(124,58,237,0.2)" }}>
                <div className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-pulse" />
                <span className="text-violet-600 text-xs font-medium">Administrator</span>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 p-8">
          {children}
        </div>
      </main>
    </div>
  );
}