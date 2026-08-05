import { useState, useEffect } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import {
  Heart, LayoutDashboard, Calendar,
  FileText, MessageSquare, LogOut,
  ChevronRight, Activity, Settings,
  Sun, Moon, Menu, X
} from "lucide-react";

const navItems = [
  {
    to:    "/patient",
    icon:  LayoutDashboard,
    label: "Dashboard",
    end:   true,
    desc:  "Overview"
  },
  {
    to:    "/patient/appointments",
    icon:  Calendar,
    label: "Appointments",
    end:   false,
    desc:  "Book & manage"
  },
  {
    to:    "/patient/history",
    icon:  FileText,
    label: "Clinical History",
    end:   false,
    desc:  "Records & vitals"
  },
  {
    to:    "/patient/chatbot",
    icon:  MessageSquare,
    label: "AI Health Chat",
    end:   false,
    desc:  "Ask anything"
  },
  {
    to:    "/patient/settings",
    icon:  Settings,
    label: "Settings",
    end:   false,
    desc:  "Account & security"
  },
];

// Page title map — shows in top header
const pageTitles = {
  "/patient":              { title: "Dashboard",       sub: "Your health overview"             },
  "/patient/appointments": { title: "Appointments",    sub: "Book and manage your visits"      },
  "/patient/history":      { title: "Clinical History",sub: "Your medical records"             },
  "/patient/chatbot":      { title: "AI Health Chat",  sub: "Ask anything about your health"   },
  "/patient/settings":     { title: "Settings",        sub: "Account & security"               },
};

export default function PatientLayout({ children, title, subtitle }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate         = useNavigate();
  const location         = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const page             = title
    ? { title, sub: subtitle || "" }
    : pageTitles[location.pathname] || { title: "MedCore AI", sub: "" };
  const initials         = user?.name?.split(" ").map(n => n[0]).join("").slice(0, 2) || "P";

  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === "Escape") setSidebarOpen(false); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

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
        style={{ background: "linear-gradient(180deg, #0D2137 0%, #0F2A45 60%, #0D2137 100%)" }}>

        {/* Top glow */}
        <div className="absolute top-0 left-0 right-0 h-32 opacity-20 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 50% 0%, #2176AE 0%, transparent 70%)" }} />

        {/* Logo */}
        <div className="relative px-5 py-5 border-b border-white/8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #2176AE, #1A4A7A)" }}>
                <Heart size={18} className="text-white" />
              </div>
              <div>
                <h1 className="text-white font-bold text-base leading-tight">
                  MedCore <span className="text-sky-400">AI</span>
                </h1>
                <p className="text-white/35 text-[10px] mt-0.5 uppercase tracking-widest">
                  Patient Portal
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

        {/* User card */}
        <div className="relative mx-3 my-3 rounded-2xl p-3.5"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm text-white shadow-lg"
              style={{ background: "linear-gradient(135deg, #2176AE, #1E5A9C)" }}>
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white text-sm font-semibold truncate leading-tight">
                {user?.name}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                <p className="text-white/40 text-[10px]">Active · Patient</p>
              </div>
            </div>
          </div>
        </div>

        {/* Nav section label */}
        <div className="px-5 pb-1">
          <p className="text-white/25 text-[9px] uppercase tracking-[0.15em] font-semibold">
            Navigation
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
                  isActive
                    ? "text-white"
                    : "text-white/50 hover:text-white/80"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {/* Active background */}
                  {isActive && (
                    <div className="absolute inset-0 rounded-xl"
                      style={{ background: "linear-gradient(135deg, rgba(33,118,174,0.4), rgba(30,90,156,0.2))", border: "1px solid rgba(33,118,174,0.3)" }} />
                  )}
                  {/* Hover background */}
                  {!isActive && (
                    <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: "rgba(255,255,255,0.05)" }} />
                  )}
                  {/* Active left bar */}
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-sky-400" />
                  )}
                  <div className={`relative w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
                    isActive ? "shadow-lg" : ""
                  }`}
                    style={isActive ? { background: "linear-gradient(135deg, #2176AE, #1A4A7A)" } : { background: "rgba(255,255,255,0.06)" }}>
                    <Icon size={16} className={isActive ? "text-white" : "text-white/50 group-hover:text-white/70"} />
                  </div>
                  <div className="relative flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight truncate">{label}</p>
                    <p className={`text-[10px] mt-0.5 truncate ${isActive ? "text-sky-300/60" : "text-white/25 group-hover:text-white/35"}`}>
                      {desc}
                    </p>
                  </div>
                  {isActive && (
                    <ChevronRight size={12} className="relative text-sky-400/60 flex-shrink-0" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Health tip */}
        <div className="mx-3 mb-3 rounded-2xl p-3.5"
          style={{ background: "linear-gradient(135deg, rgba(33,118,174,0.15), rgba(16,40,69,0.3))", border: "1px solid rgba(33,118,174,0.15)" }}>
          <div className="flex items-center gap-2 mb-1">
            <Activity size={12} className="text-sky-400" />
            <p className="text-sky-400 text-[10px] font-semibold uppercase tracking-wide">Health Tip</p>
          </div>
          <p className="text-white/40 text-[10px] leading-relaxed">
            Stay hydrated — aim for 8 glasses of water daily to keep your vitals in check.
          </p>
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

      {/* ── MAIN CONTENT ── */}
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
              {/* Breadcrumb */}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-slate-300 dark:text-slate-500 text-xs hidden sm:inline">Patient Portal</span>
                  <ChevronRight size={12} className="text-slate-300 dark:text-slate-500 hidden sm:inline" />
                  <span className="text-slate-700 dark:text-slate-100 text-sm font-semibold truncate">{page.title}</span>
                </div>
                <p className="text-slate-400 text-xs mt-0.5 truncate">{page.sub}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Date */}
              <div className="text-right hidden sm:block">
                <p className="text-slate-700 dark:text-slate-200 text-xs font-medium">
                  {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
                </p>
                <p className="text-slate-400 text-xs">{new Date().getFullYear()}</p>
              </div>
              {/* Theme toggle */}
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
              {/* Status pill */}
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border"
                style={{ background: "rgba(16,185,129,0.06)", borderColor: "rgba(16,185,129,0.2)" }}>
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-emerald-600 text-xs font-medium">Active</span>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 p-8">
          {children}
        </div>
      </main>
    </div>
  );
}