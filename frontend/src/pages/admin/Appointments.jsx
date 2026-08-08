import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import AdminLayout from "../../components/AdminLayout";
import PageWrapper from "../../components/shared/PageWrapper";
import { SkeletonCard, SkeletonTable } from "../../components/shared/SkeletonCard";
import EmptyState from "../../components/shared/EmptyState";
import Pagination from "../../components/shared/Pagination";
import AnimatedNumber from "../../components/shared/AnimatedNumber";
import { showError } from "../../components/shared/Toast";
import { getAdminAppointments } from "../../api/api";
import {
  Calendar, Search, Clock,
  User, Stethoscope, X,
  CheckCircle, XCircle
} from "lucide-react";

const PER_PAGE = 20;

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
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [appointments, setAppointments] = useState([]);
  const [total,        setTotal]        = useState(0);
  const [stats,        setStats]        = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [search,       setSearch]       = useState(searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "all");
  const [page,         setPage]         = useState(parseInt(searchParams.get("page")) || 1);

  const skipReset = useRef(true);

  useEffect(() => {
    if (skipReset.current) { skipReset.current = false; return; }
    setPage(1);
  }, [search, statusFilter]);

  useEffect(() => {
    const params = {};
    if (search) params.search = search;
    if (statusFilter !== "all") params.status = statusFilter;
    if (page > 1) params.page = String(page);
    setSearchParams(params, { replace: true });
  }, [search, statusFilter, page]);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      getAdminAppointments({ page, per_page: PER_PAGE, search, status: statusFilter })
        .then(res => {
          setAppointments(res.data.items);
          setTotal(res.data.total);
          setStats(res.data.stats);
        })
        .catch(() => showError("Failed to load appointments"))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [page, search, statusFilter]);

  if (loading && appointments.length === 0) return (
    <AdminLayout>
      <div className="mb-6">
        <div className="h-7 w-52 bg-slate-200 rounded-lg animate-pulse mb-2" />
        <div className="h-4 w-36 bg-slate-100 rounded-lg animate-pulse" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
      </div>
      <SkeletonTable rows={5} />
    </AdminLayout>
  );

  const cancelRate = stats?.total > 0
    ? Math.round((stats.cancelled / stats.total) * 100)
    : 0;

  return (
    <AdminLayout>
      <PageWrapper>

        {/* Header */}
        <div className="flex items-center justify-between mb-7">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">All Appointments</h1>
            <p className="text-slate-500 text-sm mt-1">
              {stats?.total ?? 0} total · {cancelRate}% cancellation rate
            </p>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            {
              key: "all", icon: Calendar, label: "Total",     value: stats?.total,
              gradient: "linear-gradient(135deg, #f5f3ff, #ede9fe)",
              iconBg: "rgba(124,58,237,0.12)", iconColor: "text-violet-600", dot: "#7c3aed", delay: 0.05
            },
            {
              key: "scheduled", icon: Clock, label: "Scheduled", value: stats?.scheduled,
              gradient: "linear-gradient(135deg, #eff6ff, #dbeafe)",
              iconBg: "rgba(59,130,246,0.12)", iconColor: "text-blue-600", dot: "#2563eb", delay: 0.1
            },
            {
              key: "completed", icon: CheckCircle, label: "Completed", value: stats?.completed,
              gradient: "linear-gradient(135deg, #f0fdf4, #dcfce7)",
              iconBg: "rgba(16,185,129,0.12)", iconColor: "text-emerald-600", dot: "#059669", delay: 0.15
            },
            {
              key: "cancelled", icon: XCircle, label: "Cancelled",  value: stats?.cancelled,
              gradient: "linear-gradient(135deg, #fff1f2, #ffe4e6)",
              iconBg: "rgba(239,68,68,0.1)", iconColor: "text-red-500", dot: "#dc2626", delay: 0.2
            },
          ].map(({ key, icon: Icon, label, value, gradient, iconBg, iconColor, dot, delay }) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="relative rounded-2xl p-5 overflow-hidden cursor-pointer stat-gradient-card"
              style={{ background: gradient, boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}
              onClick={() => setStatusFilter(key)}
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
                <AnimatedNumber value={value || 0} />
              </p>
              {statusFilter === key && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: dot }} />
              )}
            </motion.div>
          ))}
        </div>

        {/* Search + filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-5">
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
                className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${statusFilter === key ? "" : "bg-white"}`}
                style={statusFilter === key
                  ? { background: "rgba(124,58,237,0.12)", color: "#7c3aed", border: "1px solid rgba(124,58,237,0.25)" }
                  : { color: "#94a3b8", border: "1px solid #e2e8f0" }
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
              <p className="text-slate-400 text-xs mt-0.5">{total} matching</p>
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

          {appointments.length === 0 ? (
            <EmptyState
              variant="dashed"
              icon={Calendar}
              title="No appointments found"
              message="Try adjusting your search or filter"
              className="py-16"
            />
          ) : (
            <div className="divide-y divide-slate-50">
              <AnimatePresence>
                {appointments.map((appt, i) => (
                  <motion.div
                    key={appt.appointment_id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i, 10) * 0.04 }}
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
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => navigate(`/admin/patients/${appt.patient_id}`)}
                          className="text-slate-800 text-sm font-bold flex items-center gap-1 hover:text-violet-600 transition-colors"
                        >
                          <User size={12} className="text-slate-400" />
                          {appt.patient_name}
                        </motion.button>
                        <span className="text-slate-300 text-xs">→</span>
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => navigate(`/admin/doctors/${appt.doctor_id}`)}
                          className="text-slate-600 text-sm font-medium flex items-center gap-1 hover:text-violet-600 transition-colors"
                        >
                          <Stethoscope size={12} className="text-slate-400" />
                          Dr. {appt.doctor_name}
                        </motion.button>
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

          <Pagination page={page} perPage={PER_PAGE} total={total} onChange={setPage} />
        </div>

      </PageWrapper>
    </AdminLayout>
  );
}
