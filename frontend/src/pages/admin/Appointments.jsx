import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AdminLayout from "../../components/AdminLayout";
import PageWrapper from "../../components/shared/PageWrapper";
import { SkeletonCard } from "../../components/shared/SkeletonCard";
import { getAdminAppointments } from "../../api/api";
import {
  Calendar, Search, Clock,
  User, Stethoscope, X,
  CheckCircle, XCircle
} from "lucide-react";

// Animated counter
function AnimatedNumber({ value }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const end  = parseInt(value) || 0;
    if (start === end) return;
    const step  = Math.max(1, Math.floor(end / 20));
    const timer = setInterval(() => {
      start = Math.min(start + step, end);
      setDisplay(start);
      if (start >= end) clearInterval(timer);
    }, 50);
    return () => clearInterval(timer);
  }, [value]);
  return <span>{display}</span>;
}

function StatusBadge({ status }) {
  const map = {
    scheduled: { bg: "rgba(59,130,246,0.08)",  color: "#2563eb", border: "rgba(59,130,246,0.2)"  },
    completed: { bg: "rgba(16,185,129,0.08)",  color: "#059669", border: "rgba(16,185,129,0.2)"  },
    cancelled: { bg: "rgba(239,68,68,0.08)",   color: "#dc2626", border: "rgba(239,68,68,0.2)"   },
  };
  const s = map[status] || map.scheduled;
  return (
    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {status}
    </span>
  );
}

export default function AdminAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [filtered,     setFiltered]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    getAdminAppointments()
      .then(res => { setAppointments(res.data); setFiltered(res.data); })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let result = appointments;
    if (statusFilter !== "all") {
      result = result.filter(a => a.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(a =>
        a.patient_name?.toLowerCase().includes(q) ||
        a.doctor_name?.toLowerCase().includes(q) ||
        a.reason?.toLowerCase().includes(q) ||
        a.specialization?.toLowerCase().includes(q)
      );
    }
    setFiltered(result);
  }, [search, statusFilter, appointments]);

  if (loading) return (
    <AdminLayout>
      <div className="mb-6">
        <div className="h-7 w-52 bg-slate-200 rounded-lg animate-pulse mb-2" />
        <div className="h-4 w-36 bg-slate-100 rounded-lg animate-pulse" />
      </div>
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
      </div>
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-3 border-b border-slate-50 last:border-0">
            <div className="w-10 h-10 bg-slate-100 rounded-xl animate-pulse flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-slate-100 rounded w-48 animate-pulse" />
              <div className="h-3 bg-slate-50 rounded w-72 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </AdminLayout>
  );

  const scheduled = appointments.filter(a => a.status === "scheduled").length;
  const completed = appointments.filter(a => a.status === "completed").length;
  const cancelled = appointments.filter(a => a.status === "cancelled").length;
  const today     = appointments.filter(a => {
    const d = new Date(a.appointment_date);
    const n = new Date();
    return d.toDateString() === n.toDateString();
  }).length;

  const cancelRate = appointments.length > 0
    ? Math.round((cancelled / appointments.length) * 100)
    : 0;

  return (
    <AdminLayout>
      <PageWrapper>

        {/* Header */}
        <div className="flex items-center justify-between mb-7">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">All Appointments</h1>
            <p className="text-slate-500 text-sm mt-1">
              {appointments.length} total · {cancelRate}% cancellation rate
            </p>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            {
              icon: Calendar, label: "Total",     value: appointments.length,
              gradient: "linear-gradient(135deg, #f5f3ff, #ede9fe)",
              iconBg: "rgba(124,58,237,0.12)", iconColor: "text-violet-600", delay: 0.05
            },
            {
              icon: Clock, label: "Scheduled", value: scheduled,
              gradient: "linear-gradient(135deg, #eff6ff, #dbeafe)",
              iconBg: "rgba(59,130,246,0.12)", iconColor: "text-blue-600", delay: 0.1
            },
            {
              icon: CheckCircle, label: "Completed", value: completed,
              gradient: "linear-gradient(135deg, #f0fdf4, #dcfce7)",
              iconBg: "rgba(16,185,129,0.12)", iconColor: "text-emerald-600", delay: 0.15
            },
            {
              icon: XCircle, label: "Cancelled",  value: cancelled,
              gradient: "linear-gradient(135deg, #fff1f2, #ffe4e6)",
              iconBg: "rgba(239,68,68,0.1)", iconColor: "text-red-500", delay: 0.2
            },
          ].map(({ icon: Icon, label, value, gradient, iconBg, iconColor, delay }) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay }}
              className="relative rounded-2xl p-5 overflow-hidden cursor-pointer"
              style={{ background: gradient, boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}
              onClick={() => setStatusFilter(label.toLowerCase() === "total" ? "all" : label.toLowerCase())}
            >
              <div className="absolute top-0 right-0 w-16 h-16 rounded-full blur-2xl opacity-30"
                style={{ background: iconBg }} />
              <div className="relative flex items-center justify-between mb-3">
                <span className="text-slate-500 text-xs font-medium">{label}</span>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm"
                  style={{ background: iconBg }}>
                  <Icon size={16} className={iconColor} />
                </div>
              </div>
              <p className="relative text-3xl font-bold text-slate-800">
                <AnimatedNumber value={value} />
              </p>
              {statusFilter === label.toLowerCase() && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5"
                  style={{ background: iconColor.replace("text-", "") === "violet-600" ? "#7c3aed"
                    : iconColor === "text-blue-600" ? "#2563eb"
                    : iconColor === "text-emerald-600" ? "#059669" : "#dc2626" }} />
              )}
            </motion.div>
          ))}
        </div>

        {/* Search + filter */}
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="Search by patient, doctor, specialization or reason..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 shadow-sm transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full bg-slate-200 hover:bg-slate-300 transition-colors"
              >
                <X size={11} className="text-slate-500" />
              </button>
            )}
          </div>
          {/* Status filter pills */}
          <div className="flex items-center gap-2">
            {[
              { key: "all",       label: "All"       },
              { key: "scheduled", label: "Scheduled" },
              { key: "completed", label: "Completed" },
              { key: "cancelled", label: "Cancelled" },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className="px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                style={statusFilter === key
                  ? { background: "rgba(124,58,237,0.12)", color: "#7c3aed", border: "1px solid rgba(124,58,237,0.25)" }
                  : { background: "white", color: "#94a3b8", border: "1px solid #e2e8f0" }
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Appointments list */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800">Appointment Records</h3>
              <p className="text-slate-400 text-xs mt-0.5">{filtered.length} shown</p>
            </div>
            {(search || statusFilter !== "all") && (
              <button
                onClick={() => { setSearch(""); setStatusFilter("all"); }}
                className="text-xs text-violet-600 hover:text-violet-700 font-medium"
              >
                Clear filters
              </button>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(124,58,237,0.05)", border: "1px dashed rgba(124,58,237,0.2)" }}>
                <Calendar size={24} className="text-slate-300" />
              </div>
              <p className="text-slate-500 text-sm font-medium">No appointments found</p>
              <p className="text-slate-400 text-xs mt-1">Try adjusting your search or filter</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              <AnimatePresence>
                {filtered.map((appt, i) => (
                  <motion.div
                    key={appt.appointment_id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/70 transition-colors"
                  >
                    {/* Date badge */}
                    <div className="w-12 h-12 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 shadow-sm"
                      style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)" }}>
                      <span className="text-white text-sm font-bold leading-none">
                        {new Date(appt.appointment_date).getDate()}
                      </span>
                      <span className="text-white/60 text-[9px] mt-0.5 uppercase">
                        {new Date(appt.appointment_date).toLocaleDateString("en-IN", { month: "short" })}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-slate-800 text-sm font-bold flex items-center gap-1">
                          <User size={12} className="text-slate-400" />
                          {appt.patient_name}
                        </span>
                        <span className="text-slate-300 text-xs">→</span>
                        <span className="text-slate-600 text-sm font-medium flex items-center gap-1">
                          <Stethoscope size={12} className="text-slate-400" />
                          Dr. {appt.doctor_name}
                        </span>
                        <StatusBadge status={appt.status} />
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-slate-400 text-xs px-2 py-0.5 rounded-lg bg-slate-50 border border-slate-100">
                          {appt.specialization}
                        </span>
                        <span className="text-slate-400 text-xs italic truncate max-w-xs">
                          "{appt.reason}"
                        </span>
                      </div>
                    </div>

                    {/* Time */}
                    <div className="text-right flex-shrink-0">
                      <div className="flex items-center gap-1 text-slate-600 text-xs justify-end font-medium">
                        <Clock size={11} />
                        {new Date(appt.appointment_date).toLocaleTimeString("en-IN", {
                          hour: "2-digit", minute: "2-digit"
                        })}
                      </div>
                      <p className="text-slate-400 text-xs mt-1">
                        {new Date(appt.appointment_date).toLocaleDateString("en-IN", {
                          weekday: "short", day: "numeric", month: "short"
                        })}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

      </PageWrapper>
    </AdminLayout>
  );
}