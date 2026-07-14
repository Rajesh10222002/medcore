import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  Users, FileText, Brain,
  LogOut, Stethoscope, ChevronRight,
  Heart, Activity, Clock, CalendarDays
} from "lucide-react";

const navItems = [
  {
    to:    "/doctor",
    icon:  Users,
    label: "My Patients",
    end:   true,
    desc:  "Patient list"
  },
  {
    to:    "/doctor/schedule",
    icon:  CalendarDays,
    label: "My Schedule",
    end:   false,
    desc:  "Leaves & calendar"
  },
  {
    to:    "/doctor/notes",
    icon:  FileText,
    label: "Clinical Notes",
    end:   false,
    desc:  "Write & extract"
  },
  {
    to:    "/doctor/copilot",
    icon:  Brain,
    label: "AI Copilot",
    end:   false,
    desc:  "Differential diagnosis"
  },
];

const pageTitles = {
  "/doctor":           { title: "My Patients",    sub: "Patients under your care"        },
  "/doctor/schedule":  { title: "My Schedule",    sub: "Leaves, blocks & calendar"       },
  "/doctor/notes":     { title: "Clinical Notes", sub: "Write notes and extract data"    },
  "/doctor/copilot":   { title: "AI Copilot",     sub: "Differential diagnosis support"  },
};

export default function DoctorLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();
  const location         = useLocation();

  // Handle patient detail page
  const isPatientDetail = location.pathname.startsWith("/doctor/patient/");
  const page = isPatientDetail
    ? { title: "Patient Detail", sub: "Full clinical view" }
    : (pageTitles[location.pathname] || { title: "Doctor Dashboard", sub: "" });

  const initials = (user?.name || "Dr")
    .replace("Dr. ", "")
    .split(" ")
    .map(n => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const now  = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="flex min-h-screen bg-[#f0f4f8]">

      {/* ── SIDEBAR ── */}
      <aside className="w-64 flex flex-col fixed h-full z-20"
        style={{ background: "linear-gradient(180deg, #0f1f0f 0%, #0a1a0a 50%, #0d1f0d 100%)" }}>

        {/* Top glow — emerald */}
        <div className="absolute top-0 left-0 right-0 h-32 opacity-20 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 50% 0%, #10b981 0%, transparent 70%)" }} />

        {/* Logo */}
        <div className="relative px-5 py-5 border-b border-white/8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #059669, #047857)" }}>
              <Stethoscope size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-base leading-tight">
                MedCore <span className="text-emerald-400">AI</span>
              </h1>
              <p className="text-white/35 text-[10px] mt-0.5 uppercase tracking-widest">
                Doctor Dashboard
              </p>
            </div>
          </div>
        </div>

        {/* Doctor card */}
        <div className="relative mx-3 my-3 rounded-2xl p-3.5"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm text-white shadow-lg"
              style={{ background: "linear-gradient(135deg, #059669, #047857)" }}>
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white text-sm font-semibold truncate leading-tight">
                {user?.name}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                <p className="text-white/40 text-[10px] truncate">
                  {user?.specialization || "Doctor"} · On Duty
                </p>
              </div>
            </div>
          </div>
          {/* Greeting */}
          <div className="mt-2.5 pt-2.5 border-t border-white/8">
            <p className="text-white/30 text-[10px]">{greeting}, Doctor 👨‍⚕️</p>
          </div>
        </div>

        {/* Nav section label */}
        <div className="px-5 pb-1">
          <p className="text-white/25 text-[9px] uppercase tracking-[0.15em] font-semibold">
            Workspace
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
                      style={{ background: "linear-gradient(135deg, rgba(5,150,105,0.35), rgba(4,120,87,0.2))", border: "1px solid rgba(5,150,105,0.3)" }} />
                  )}
                  {!isActive && (
                    <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: "rgba(255,255,255,0.05)" }} />
                  )}
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-emerald-400" />
                  )}
                  <div className={`relative w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all`}
                    style={isActive
                      ? { background: "linear-gradient(135deg, #059669, #047857)" }
                      : { background: "rgba(255,255,255,0.06)" }}>
                    <Icon size={16} className={isActive ? "text-white" : "text-white/50 group-hover:text-white/70"} />
                  </div>
                  <div className="relative flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight truncate">{label}</p>
                    <p className={`text-[10px] mt-0.5 truncate ${isActive ? "text-emerald-300/60" : "text-white/25 group-hover:text-white/35"}`}>
                      {desc}
                    </p>
                  </div>
                  {isActive && <ChevronRight size={12} className="relative text-emerald-400/60 flex-shrink-0" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Quick stats */}
        <div className="mx-3 mb-3 rounded-2xl p-3.5"
          style={{ background: "linear-gradient(135deg, rgba(5,150,105,0.12), rgba(4,120,87,0.08))", border: "1px solid rgba(5,150,105,0.15)" }}>
          <div className="flex items-center gap-2 mb-2">
            <Clock size={11} className="text-emerald-400" />
            <p className="text-emerald-400 text-[10px] font-semibold uppercase tracking-wide">
              {new Date().toLocaleDateString("en-IN", { weekday: "long" })}
            </p>
          </div>
          <p className="text-white/30 text-[10px] leading-relaxed">
            {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
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

      {/* ── MAIN ── */}
      <main className="flex-1 ml-64 flex flex-col min-h-screen">

        {/* Top header */}
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-200/70 px-8 py-3.5"
          style={{ boxShadow: "0 1px 20px rgba(0,0,0,0.04)" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-300 text-xs">Doctor Dashboard</span>
                  <ChevronRight size={12} className="text-slate-300" />
                  <span className="text-slate-700 text-sm font-semibold">{page.title}</span>
                </div>
                <p className="text-slate-400 text-xs mt-0.5">{page.sub}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-slate-700 text-xs font-medium">
                  {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
                </p>
                <p className="text-slate-400 text-xs">{user?.specialization}</p>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border"
                style={{ background: "rgba(5,150,105,0.06)", borderColor: "rgba(5,150,105,0.2)" }}>
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-emerald-600 text-xs font-medium">On Duty</span>
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