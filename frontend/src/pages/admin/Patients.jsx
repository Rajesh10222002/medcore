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
import { getAdminPatients } from "../../api/api";
import {
  Users, Search, Calendar,
  Mail, Phone, TrendingUp,
  UserCheck, X, Heart, ChevronRight
} from "lucide-react";

const PER_PAGE = 20;

export default function AdminPatients() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [patients, setPatients] = useState([]);
  const [total,    setTotal]    = useState(0);
  const [stats,    setStats]    = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [search,       setSearch]       = useState(searchParams.get("search") || "");
  const [genderFilter, setGenderFilter] = useState(searchParams.get("gender") || "all");
  const [page,         setPage]         = useState(parseInt(searchParams.get("page")) || 1);

  const skipReset = useRef(true);

  // Reset to page 1 whenever filters change (but not on initial mount,
  // so a shared URL like ?search=foo&page=3 still lands on page 3).
  useEffect(() => {
    if (skipReset.current) { skipReset.current = false; return; }
    setPage(1);
  }, [search, genderFilter]);

  // Keep the URL in sync with current filters/page
  useEffect(() => {
    const params = {};
    if (search) params.search = search;
    if (genderFilter !== "all") params.gender = genderFilter;
    if (page > 1) params.page = String(page);
    setSearchParams(params, { replace: true });
  }, [search, genderFilter, page]);

  // Fetch (debounced so typing doesn't fire a request per keystroke)
  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      getAdminPatients({ page, per_page: PER_PAGE, search, gender: genderFilter })
        .then(res => {
          setPatients(res.data.items);
          setTotal(res.data.total);
          setStats(res.data.stats);
        })
        .catch(() => showError("Failed to load patients"))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [page, search, genderFilter]);

  if (loading && patients.length === 0) return (
    <AdminLayout>
      <div className="mb-6">
        <div className="h-7 w-48 bg-slate-200 rounded-lg animate-pulse mb-2" />
        <div className="h-4 w-32 bg-slate-100 rounded-lg animate-pulse" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
      </div>
      <SkeletonTable rows={5} />
    </AdminLayout>
  );

  return (
    <AdminLayout>
      <PageWrapper>

        {/* Header */}
        <div className="flex items-center justify-between mb-7">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">All Patients</h1>
            <p className="text-slate-500 text-sm mt-1">
              Complete patient registry — {stats?.total ?? 0} registered
            </p>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            {
              icon: Users, label: "Total Patients", value: stats?.total,
              gradient: "linear-gradient(135deg, #f5f3ff, #ede9fe)",
              iconBg: "rgba(124,58,237,0.12)", iconColor: "text-violet-600", delay: 0.05
            },
            {
              icon: TrendingUp, label: "New This Month", value: stats?.new_this_month,
              gradient: "linear-gradient(135deg, #fffbeb, #fef3c7)",
              iconBg: "rgba(245,158,11,0.12)", iconColor: "text-amber-500", delay: 0.1
            },
            {
              icon: UserCheck, label: "Male Patients", value: stats?.male,
              gradient: "linear-gradient(135deg, #eff6ff, #dbeafe)",
              iconBg: "rgba(59,130,246,0.12)", iconColor: "text-blue-600", delay: 0.15
            },
            {
              icon: Heart, label: "Female Patients", value: stats?.female,
              gradient: "linear-gradient(135deg, #fdf2f8, #fce7f3)",
              iconBg: "rgba(236,72,153,0.12)", iconColor: "text-pink-500", delay: 0.2
            },
          ].map(({ icon: Icon, label, value, gradient, iconBg, iconColor, delay }) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay }}
              className="relative rounded-2xl p-5 overflow-hidden stat-gradient-card"
              style={{ background: gradient, boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}
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
            </motion.div>
          ))}
        </div>

        {/* Search + filter bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="Search by name, email or phone..."
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
          {/* Gender filter pills */}
          <div className="flex items-center gap-2">
            {["all","male","female"].map(g => (
              <button
                key={g}
                onClick={() => setGenderFilter(g)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold capitalize transition-all ${genderFilter === g ? "" : "bg-white"}`}
                style={genderFilter === g
                  ? { background: "rgba(124,58,237,0.12)", color: "#7c3aed", border: "1px solid rgba(124,58,237,0.25)" }
                  : { color: "#94a3b8", border: "1px solid #e2e8f0" }
                }
              >
                {g === "all" ? "All" : g.charAt(0).toUpperCase() + g.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Patient list */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800">Patient Registry</h3>
              <p className="text-slate-400 text-xs mt-0.5">{total} matching</p>
            </div>
            {(search || genderFilter !== "all") && (
              <button
                onClick={() => { setSearch(""); setGenderFilter("all"); }}
                className="text-xs text-violet-600 hover:text-violet-700 font-medium"
              >
                Clear filters
              </button>
            )}
          </div>

          {patients.length === 0 ? (
            <EmptyState
              variant="dashed"
              icon={Users}
              title="No patients found"
              message="Try adjusting your search or filter"
              className="py-16"
            />
          ) : (
            <div className="divide-y divide-slate-50">
              <AnimatePresence>
                {patients.map((p, i) => (
                  <motion.div
                    key={p.patient_id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i, 10) * 0.04 }}
                    onClick={() => navigate(`/admin/patients/${p.patient_id}`)}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/70 cursor-pointer transition-colors"
                  >
                    {/* Avatar */}
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 text-white text-sm font-bold shadow-sm"
                      style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)" }}>
                      {p.first_name?.[0]}{p.last_name?.[0]}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-slate-800 text-sm font-bold">
                          {p.first_name} {p.last_name}
                        </p>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                          style={p.gender?.toLowerCase() === "female"
                            ? { background: "rgba(236,72,153,0.08)", color: "#db2777" }
                            : { background: "rgba(59,130,246,0.08)", color: "#2563eb" }
                          }>
                          {p.gender}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="text-slate-400 text-xs">
                          {(() => {
                            if (p.age && p.age > 0) return `${p.age}y`;
                            if (p.date_of_birth) {
                              const dob = new Date(p.date_of_birth);
                              const age = new Date().getFullYear() - dob.getFullYear();
                              return age > 0 ? `${age}y` : "—";
                            }
                            return "—";
                          })()}
                        </span>
                        <span className="text-slate-200">·</span>
                        <span className="text-slate-400 text-xs flex items-center gap-1">
                          <Mail size={10} />
                          <span className="truncate max-w-[180px]">{p.email}</span>
                        </span>
                        <span className="text-slate-200">·</span>
                        <span className="text-slate-400 text-xs flex items-center gap-1">
                          <Phone size={10} /> {p.phone}
                        </span>
                      </div>
                    </div>

                    {/* Right side */}
                    <div className="text-right flex-shrink-0 space-y-1.5">
                      <p className="text-slate-500 text-xs flex items-center gap-1 justify-end">
                        <Calendar size={11} />
                        {new Date(p.created_at).toLocaleDateString("en-IN", {
                          day: "numeric", month: "short", year: "numeric"
                        })}
                      </p>
                      <div className="flex items-center gap-1 justify-end">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                          style={p.total_appointments > 0
                            ? { background: "rgba(16,185,129,0.08)", color: "#059669", border: "1px solid rgba(16,185,129,0.15)" }
                            : { background: "#f8fafc", color: "#94a3b8", border: "1px solid #e2e8f0" }
                          }>
                          {p.total_appointments} visit{p.total_appointments !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>

                    <ChevronRight size={16} className="text-slate-300 flex-shrink-0" />
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
