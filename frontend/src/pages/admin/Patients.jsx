import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AdminLayout from "../../components/AdminLayout";
import PageWrapper from "../../components/shared/PageWrapper";
import { SkeletonCard } from "../../components/shared/SkeletonCard";
import { getAdminPatients } from "../../api/api";
import {
  Users, Search, Calendar,
  Mail, Phone, TrendingUp,
  UserCheck, X, Heart
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

export default function AdminPatients() {
  const [patients, setPatients] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [genderFilter, setGenderFilter] = useState("all");

  useEffect(() => {
    getAdminPatients()
      .then(res => { setPatients(res.data); setFiltered(res.data); })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let result = patients;
    if (genderFilter !== "all") {
      result = result.filter(p => p.gender?.toLowerCase() === genderFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q) ||
        p.phone?.includes(q)
      );
    }
    setFiltered(result);
  }, [search, genderFilter, patients]);

  if (loading) return (
    <AdminLayout>
      <div className="mb-6">
        <div className="h-7 w-48 bg-slate-200 rounded-lg animate-pulse mb-2" />
        <div className="h-4 w-32 bg-slate-100 rounded-lg animate-pulse" />
      </div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
      </div>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-3 border-b border-slate-50 last:border-0">
            <div className="w-10 h-10 bg-slate-100 rounded-full animate-pulse flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-slate-100 rounded w-40 animate-pulse" />
              <div className="h-3 bg-slate-50 rounded w-64 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </AdminLayout>
  );

  const maleCount    = patients.filter(p => p.gender?.toLowerCase() === "male").length;
  const femaleCount  = patients.filter(p => p.gender?.toLowerCase() === "female").length;
  const thisMonth    = patients.filter(p => {
    const d = new Date(p.created_at);
    const n = new Date();
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  }).length;

  return (
    <AdminLayout>
      <PageWrapper>

        {/* Header */}
        <div className="flex items-center justify-between mb-7">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">All Patients</h1>
            <p className="text-slate-500 text-sm mt-1">
              Complete patient registry — {patients.length} registered
            </p>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            {
              icon: Users, label: "Total Patients", value: patients.length,
              gradient: "linear-gradient(135deg, #f5f3ff, #ede9fe)",
              iconBg: "rgba(124,58,237,0.12)", iconColor: "text-violet-600", delay: 0.05
            },
            {
              icon: TrendingUp, label: "New This Month", value: thisMonth,
              gradient: "linear-gradient(135deg, #fffbeb, #fef3c7)",
              iconBg: "rgba(245,158,11,0.12)", iconColor: "text-amber-500", delay: 0.1
            },
            {
              icon: UserCheck, label: "Male Patients", value: maleCount,
              gradient: "linear-gradient(135deg, #eff6ff, #dbeafe)",
              iconBg: "rgba(59,130,246,0.12)", iconColor: "text-blue-600", delay: 0.15
            },
            {
              icon: Heart, label: "Female Patients", value: femaleCount,
              gradient: "linear-gradient(135deg, #fdf2f8, #fce7f3)",
              iconBg: "rgba(236,72,153,0.12)", iconColor: "text-pink-500", delay: 0.2
            },
          ].map(({ icon: Icon, label, value, gradient, iconBg, iconColor, delay }) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay }}
              className="relative rounded-2xl p-5 overflow-hidden"
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
                <AnimatedNumber value={value} />
              </p>
            </motion.div>
          ))}
        </div>

        {/* Search + filter bar */}
        <div className="flex items-center gap-3 mb-5">
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
                className="px-3 py-2 rounded-xl text-xs font-semibold capitalize transition-all"
                style={genderFilter === g
                  ? { background: "rgba(124,58,237,0.12)", color: "#7c3aed", border: "1px solid rgba(124,58,237,0.25)" }
                  : { background: "white", color: "#94a3b8", border: "1px solid #e2e8f0" }
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
              <p className="text-slate-400 text-xs mt-0.5">{filtered.length} shown</p>
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

          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(124,58,237,0.05)", border: "1px dashed rgba(124,58,237,0.2)" }}>
                <Users size={24} className="text-slate-300" />
              </div>
              <p className="text-slate-500 text-sm font-medium">No patients found</p>
              <p className="text-slate-400 text-xs mt-1">Try adjusting your search or filter</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              <AnimatePresence>
                {filtered.map((p, i) => (
                  <motion.div
                    key={p.patient_id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/70 transition-colors"
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