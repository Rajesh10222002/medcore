import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard, Users, UserPlus,
  Calendar, LogOut, Shield
} from "lucide-react";

const navItems = [
  { to: "/admin",              icon: LayoutDashboard, label: "Dashboard",      end: true  },
  { to: "/admin/patients",     icon: Users,           label: "All Patients",   end: false },
  { to: "/admin/doctors",      icon: UserPlus,        label: "Manage Doctors", end: false },
  { to: "/admin/appointments", icon: Calendar,        label: "Appointments",   end: false },
];

export default function AdminLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();

  return (
    <div className="flex min-h-screen bg-slate-50">

      {/* SIDEBAR */}
      <aside className="w-64 bg-slate-900 flex flex-col fixed h-full z-10 shadow-2xl">

        {/* Logo */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-violet-500 rounded-xl flex items-center justify-center shadow-lg">
              <Shield size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-lg leading-none">
                MedCore <span className="text-violet-400">AI</span>
              </h1>
              <p className="text-white/40 text-xs mt-0.5">Admin Panel</p>
            </div>
          </div>
        </div>

        {/* User */}
        <div className="px-4 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-violet-600 to-violet-400 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white text-sm font-bold">
                {user?.name?.[0]}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-medium truncate">
                {user?.name}
              </p>
              <p className="text-white/40 text-xs">Administrator</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? "bg-violet-500 text-white shadow-lg shadow-violet-500/30"
                    : "text-white/60 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-white/10">
          <button
            onClick={() => { logout(); navigate("/"); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:bg-red-500/20 hover:text-red-400 transition-all"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 ml-64">
        <header className="bg-white border-b border-slate-200 px-8 py-4 sticky top-0 z-10 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-slate-800 font-semibold text-lg">
                Admin Panel
              </h2>
              <p className="text-slate-400 text-xs mt-0.5">
                {new Date().toLocaleDateString("en-IN", {
                  weekday: "long", year: "numeric",
                  month: "long", day: "numeric"
                })}
              </p>
            </div>
            <span className="px-3 py-1 bg-violet-50 text-violet-600 text-xs font-medium rounded-full border border-violet-100">
              ● Administrator
            </span>
          </div>
        </header>
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}