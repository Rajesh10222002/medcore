import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import PatientLayout from "../../components/PatientLayout";
import PageWrapper from "../../components/shared/PageWrapper";
import { SkeletonCard, SkeletonTable } from "../../components/shared/SkeletonCard";
import EmptyState from "../../components/shared/EmptyState";
import AnimatedNumber from "../../components/shared/AnimatedNumber";
import { showError } from "../../components/shared/Toast";
import { getMyProfile, getMyAppointments, getHealthSummaryAI, getMyFHIR } from "../../api/api";
import {
  Activity, Calendar, FileText,
  Heart, Clock, ChevronRight,
  Stethoscope, TrendingUp, Sparkles,
  RefreshCw, ArrowRight, User,
  Mail, Phone, CheckCircle
} from "lucide-react";

// ── Status badge ──────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    scheduled: { bg: "rgba(59,130,246,0.08)", color: "#2563eb", border: "rgba(59,130,246,0.2)" },
    completed: { bg: "rgba(16,185,129,0.08)", color: "#059669", border: "rgba(16,185,129,0.2)" },
    cancelled: { bg: "rgba(239,68,68,0.08)",  color: "#dc2626", border: "rgba(239,68,68,0.2)"  },
  };
  const s = map[status] || map.scheduled;
  return (
    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {status}
    </span>
  );
}

// ── Countdown to next appointment ─────────────────────────
function Countdown({ appointmentDate }) {
  const [timeLeft, setTimeLeft] = useState("");
  useEffect(() => {
    const calc = () => {
      const diff = new Date(appointmentDate) - new Date();
      if (diff <= 0) { setTimeLeft("Now"); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setTimeLeft(d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`);
    };
    calc();
    const t = setInterval(calc, 60000);
    return () => clearInterval(t);
  }, [appointmentDate]);
  return <span className="font-bold text-white">{timeLeft}</span>;
}

// ── Stat card ─────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, gradient, iconBg, iconColor, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="relative rounded-2xl p-5 overflow-hidden stat-gradient-card"
      style={{ background: gradient, boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}
    >
      {/* Subtle inner glow top-right */}
      <div className="absolute top-0 right-0 w-20 h-20 rounded-full blur-2xl opacity-30"
        style={{ background: iconBg }} />
      <div className="relative flex items-center justify-between mb-4">
        <span className="text-slate-500 text-sm font-medium">{label}</span>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm"
          style={{ background: iconBg }}>
          <Icon size={18} className={iconColor} />
        </div>
      </div>
      <p className="relative text-3xl font-bold text-slate-800">
        {typeof value === "number" ? <AnimatedNumber value={value} /> : value}
      </p>
    </motion.div>
  );
}

// ── Quick action button ───────────────────────────────────
function QuickAction({ icon: Icon, label, desc, color, bg, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-md transition-all text-left w-full group"
    >
      <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform`}>
        <Icon size={18} className={color} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-slate-800 text-sm font-semibold">{label}</p>
        <p className="text-slate-400 text-xs mt-0.5">{desc}</p>
      </div>
      <ChevronRight size={15} className="text-slate-300 group-hover:text-slate-400 transition-colors flex-shrink-0" />
    </button>
  );
}

// ─────────────────────────────────────────────────────────
export default function Dashboard() {
  const [profile,        setProfile]        = useState(null);
  const [appointments,   setAppointments]   = useState([]);
  const [aiSummary,      setAiSummary]      = useState("");
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loading,        setLoading]        = useState(true);
  const [bloodGroup,     setBloodGroup]     = useState(null);
  const navigate = useNavigate();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [pRes, aRes] = await Promise.all([getMyProfile(), getMyAppointments()]);
      setProfile(pRes.data);
      setAppointments(aRes.data);
    } catch (err) {
      showError("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
    // Load AI summary separately so it doesn't block the page
    try {
      const sRes = await getHealthSummaryAI();
      setAiSummary(sRes.data.summary);
    } catch {
      setAiSummary("Welcome! Book an appointment to get started on your health journey.");
    } finally {
      setLoadingSummary(false);
    }
    // Load blood group from FHIR
    try {
      const bgRes = await getMyFHIR();
      const bg = bgRes.data?.blood_group || bgRes.data?.fhir?.blood_group || null;
      setBloodGroup(bg);
    } catch {
      // Blood group not critical — fail silently
    }
  };

  const refreshSummary = async () => {
    setLoadingSummary(true);
    try {
      const sRes = await getHealthSummaryAI();
      setAiSummary(sRes.data.summary);
    } catch {
      setAiSummary("Unable to load summary right now.");
    } finally {
      setLoadingSummary(false);
    }
  };

  const now      = new Date();
  const upcoming = appointments.filter(a =>
    a.status === "scheduled" && new Date(a.appointment_date) > now
  );
  const past = appointments.filter(a =>
    a.status === "completed" ||
    (a.status === "scheduled" && new Date(a.appointment_date) <= now)
  );
  const nextAppt = upcoming[0];

  // ── Loading skeleton ──────────────────────────────────
  if (loading) return (
    <PatientLayout>
      <div className="mb-6">
        <div className="h-7 w-48 bg-slate-200 rounded-lg animate-pulse mb-2" />
        <div className="h-4 w-64 bg-slate-100 rounded-lg animate-pulse" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
      </div>
      <SkeletonTable rows={4} />
    </PatientLayout>
  );

  const initials = `${profile?.first_name?.[0] || ""}${profile?.last_name?.[0] || ""}`;

  return (
    <PatientLayout>
      <PageWrapper>

        {/* ── Page header ── */}
        <div className="flex items-center justify-between mb-7">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              My Dashboard
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Welcome back, <span className="font-semibold text-slate-700">{profile?.first_name}</span> — here's your health overview
            </p>
          </div>
          <button
            onClick={() => navigate("/patient/appointments")}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white rounded-xl shadow-md hover:shadow-lg transition-all"
            style={{ background: "linear-gradient(135deg, #2176AE, #1A4A7A)" }}
          >
            <Calendar size={15} />
            Book Appointment
          </button>
        </div>

        {/* ── AI Health Summary ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="relative rounded-2xl p-6 mb-6 overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #0D2137 0%, #0F2A45 50%, #1a1035 100%)",
            boxShadow: "0 4px 32px rgba(13,33,55,0.25)"
          }}
        >
          {/* Background effects */}
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl opacity-10"
            style={{ background: "radial-gradient(circle, #2176AE, transparent)" }} />
          <div className="absolute bottom-0 left-0 w-40 h-40 rounded-full blur-3xl opacity-10"
            style={{ background: "radial-gradient(circle, #7c3aed, transparent)" }} />
          <div className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)",
              backgroundSize: "20px 20px"
            }} />

          <div className="relative flex items-start gap-4">
            {/* Icon */}
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(33,118,174,0.25)", border: "1px solid rgba(33,118,174,0.3)" }}>
              <Sparkles size={20} className="text-sky-300" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <p className="text-white/60 text-xs font-semibold uppercase tracking-widest">
                    AI Health Summary
                  </p>
                  {!loadingSummary && aiSummary && (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.2)" }}>
                      <div className="w-1 h-1 bg-emerald-400 rounded-full" />
                      <span className="text-emerald-400 text-[9px] font-medium">Live</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={refreshSummary}
                  disabled={loadingSummary}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-white/10"
                  title="Refresh summary"
                >
                  <RefreshCw size={13} className={`text-white/40 hover:text-white/70 ${loadingSummary ? "animate-spin" : ""}`} />
                </button>
              </div>

              {loadingSummary ? (
                <div className="space-y-2.5">
                  <div className="h-3 rounded-full animate-pulse w-full" style={{ background: "rgba(255,255,255,0.08)" }} />
                  <div className="h-3 rounded-full animate-pulse w-4/5" style={{ background: "rgba(255,255,255,0.06)" }} />
                  <div className="h-3 rounded-full animate-pulse w-3/5" style={{ background: "rgba(255,255,255,0.04)" }} />
                </div>
              ) : (
                <p className="text-white/80 text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{
                    __html: aiSummary
                      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>')
                      .replace(/\n/g, "<br/>")
                  }}
                />
              )}
            </div>
          </div>

          {/* Next appointment pill inside summary card */}
          {nextAppt && (
            <div className="relative mt-4 flex items-center justify-between px-4 py-3 rounded-xl"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(33,118,174,0.3)" }}>
                  <Clock size={14} className="text-sky-300" />
                </div>
                <div>
                  <p className="text-white/80 text-xs font-semibold">
                    Next appointment in <Countdown appointmentDate={nextAppt.appointment_date} />
                  </p>
                  <p className="text-white/40 text-[10px] mt-0.5">
                    Dr. {nextAppt.doctor_name} · {nextAppt.specialization}
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate("/patient/appointments")}
                className="flex items-center gap-1 text-sky-400 text-xs font-medium hover:text-sky-300 transition-colors"
              >
                View <ArrowRight size={12} />
              </button>
            </div>
          )}
        </motion.div>

        {/* ── Stats row ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            icon={Calendar}  label="Upcoming"     value={upcoming.length}
            gradient="linear-gradient(135deg, #eff6ff, #dbeafe)"
            iconBg="rgba(59,130,246,0.12)"  iconColor="text-blue-600"  delay={0.08}
          />
          <StatCard
            icon={CheckCircle} label="Past Visits"  value={past.length}
            gradient="linear-gradient(135deg, #f0fdf4, #dcfce7)"
            iconBg="rgba(16,185,129,0.12)" iconColor="text-emerald-600" delay={0.12}
          />
          <StatCard
            icon={Heart}     label="Health Status" value="Good"
            gradient="linear-gradient(135deg, #fff1f2, #ffe4e6)"
            iconBg="rgba(239,68,68,0.1)"   iconColor="text-rose-500"   delay={0.16}
          />
          <StatCard
            icon={TrendingUp} label="Risk Level"   value="Low"
            gradient="linear-gradient(135deg, #fffbeb, #fef3c7)"
            iconBg="rgba(245,158,11,0.12)" iconColor="text-amber-500"  delay={0.20}
          />
        </div>

        {/* ── Main content grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── LEFT: Profile + Quick Actions ── */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.18 }}
            className="col-span-1 space-y-4"
          >
            {/* Profile card */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {/* Header */}
              <div className="relative p-6 text-center overflow-hidden"
                style={{ background: "linear-gradient(135deg, #0D2137, #1A4A7A)" }}>
                <div className="absolute inset-0 opacity-[0.05]"
                  style={{
                    backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)",
                    backgroundSize: "16px 16px"
                  }} />
                {/* Avatar */}
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.3, type: "spring" }}
                  className="relative w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 text-white text-xl font-bold shadow-xl"
                  style={{
                    background: "linear-gradient(135deg, rgba(33,118,174,0.5), rgba(26,74,122,0.3))",
                    border: "2px solid rgba(255,255,255,0.15)"
                  }}
                >
                  {initials}
                </motion.div>
                <h3 className="text-white font-bold text-base relative">
                  {profile?.first_name} {profile?.last_name}
                </h3>
                <p className="text-white/40 text-xs mt-0.5 relative">Patient</p>
              </div>

              {/* Info rows */}
              <div className="p-4 space-y-2.5">
                {[
                  { icon: Calendar, label: "Date of Birth", value: profile?.date_of_birth },
                  { icon: User,     label: "Gender",        value: profile?.gender         },
                  { icon: Phone,    label: "Phone",         value: profile?.phone          },
                  { icon: Mail,     label: "Email",         value: profile?.email          },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors">
                    <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Icon size={13} className="text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-400 text-[10px] uppercase tracking-wide">{label}</p>
                      <p className="text-slate-700 text-xs font-medium truncate mt-0.5">{value || "—"}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Health mini cards */}
              <div className="grid grid-cols-2 gap-2 px-4 pb-4">
                <div className="p-3 rounded-xl text-center"
                  style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.1)" }}>
                  <Heart size={14} className="text-red-400 mx-auto mb-1" />
                  <p className={`text-sm font-bold ${bloodGroup ? "text-red-600" : "text-slate-400"}`}>
                    {bloodGroup || "—"}
                  </p>
                  <p className="text-slate-400 text-[10px]">{bloodGroup ? "Blood Group" : "Ask doctor"}</p>
                </div>
                <div className="p-3 rounded-xl text-center"
                  style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.1)" }}>
                  <Activity size={14} className="text-emerald-500 mx-auto mb-1" />
                  <p className="text-emerald-600 text-sm font-bold">Low</p>
                  <p className="text-slate-400 text-[10px]">Risk Level</p>
                </div>
              </div>
            </div>

            {/* Quick actions */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 px-1">
                Quick Actions
              </p>
              <div className="space-y-2">
                <QuickAction
                  icon={Calendar}      label="Book Appointment" desc="Schedule a visit"
                  color="text-blue-600" bg="bg-blue-50"
                  onClick={() => navigate("/patient/appointments")}
                />
                <QuickAction
                  icon={FileText}      label="Clinical History" desc="View records & vitals"
                  color="text-violet-600" bg="bg-violet-50"
                  onClick={() => navigate("/patient/history")}
                />
                <QuickAction
                  icon={Sparkles}      label="AI Health Chat"   desc="Ask your assistant"
                  color="text-sky-600" bg="bg-sky-50"
                  onClick={() => navigate("/patient/chatbot")}
                />
              </div>
            </div>
          </motion.div>

          {/* ── RIGHT: Appointments ── */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.22 }}
            className="lg:col-span-2 space-y-4"
          >
            {/* Upcoming appointments card */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-slate-800">Upcoming Appointments</h3>
                  <p className="text-slate-400 text-xs mt-0.5">{upcoming.length} scheduled</p>
                </div>
                <button
                  onClick={() => navigate("/patient/appointments")}
                  className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:bg-sky-50"
                  style={{ color: "#2176AE" }}
                >
                  View all <ChevronRight size={13} />
                </button>
              </div>

              {upcoming.length === 0 ? (
                <EmptyState
                  variant="dashed"
                  icon={Calendar}
                  title="No upcoming appointments"
                  message="Book one to see your doctor"
                  className="py-14"
                  action={
                    <button
                      onClick={() => navigate("/patient/appointments")}
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-white text-sm font-semibold rounded-xl shadow-md hover:shadow-lg transition-all"
                      style={{ background: "linear-gradient(135deg, #2176AE, #1A4A7A)" }}
                    >
                      <Calendar size={14} />
                      Book Appointment
                    </button>
                  }
                />
              ) : (
                <div className="divide-y divide-slate-50">
                  {upcoming.slice(0, 4).map((appt, i) => (
                    <motion.div
                      key={appt.appointment_id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.07 }}
                      className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors"
                    >
                      {/* Date badge */}
                      <div className="w-12 h-12 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 shadow-sm"
                        style={{ background: "linear-gradient(135deg, #2176AE, #1A4A7A)" }}>
                        <span className="text-white text-sm font-bold leading-none">
                          {new Date(appt.appointment_date).getDate()}
                        </span>
                        <span className="text-white/60 text-[9px] mt-0.5 uppercase tracking-wide">
                          {new Date(appt.appointment_date).toLocaleDateString("en-IN", { month: "short" })}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-slate-800 text-sm font-semibold">
                          Dr. {appt.doctor_name}
                        </p>
                        <p className="text-slate-400 text-xs mt-0.5">
                          {appt.specialization}
                        </p>
                        <p className="text-slate-500 text-xs mt-1 italic truncate">
                          "{appt.reason}"
                        </p>
                      </div>

                      <div className="text-right flex-shrink-0 space-y-1">
                        <div className="flex items-center gap-1 text-slate-400 text-xs justify-end">
                          <Clock size={10} />
                          {new Date(appt.appointment_date).toLocaleTimeString("en-IN", {
                            hour: "2-digit", minute: "2-digit"
                          })}
                        </div>
                        <StatusBadge status={appt.status} />
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Past visits card */}
            {past.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                  <div>
                    <h3 className="font-bold text-slate-800">Recent Visits</h3>
                    <p className="text-slate-400 text-xs mt-0.5">{past.length} completed</p>
                  </div>
                </div>
                <div className="divide-y divide-slate-50">
                  {past.slice(0, 3).map((appt, i) => (
                    <div
                      key={appt.appointment_id}
                      className="flex items-center gap-4 px-5 py-3.5"
                    >
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-slate-100">
                        <Stethoscope size={15} className="text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-600 text-sm font-medium">
                          Dr. {appt.doctor_name}
                        </p>
                        <p className="text-slate-400 text-xs mt-0.5 truncate">
                          {appt.specialization} · {appt.reason}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-slate-400 text-xs">
                          {new Date(appt.appointment_date).toLocaleDateString("en-IN", {
                            day: "numeric", month: "short", year: "numeric"
                          })}
                        </p>
                        <StatusBadge status={appt.status} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </PageWrapper>
    </PatientLayout>
  );
}