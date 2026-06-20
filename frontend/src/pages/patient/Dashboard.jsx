import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import PatientLayout from "../../components/PatientLayout";
import PageWrapper from "../../components/shared/PageWrapper";
import { SkeletonCard, SkeletonTable } from "../../components/shared/SkeletonCard";
import { getMyProfile, getMyAppointments, getHealthSummaryAI } from "../../api/api";
import {
  Activity, Calendar, FileText,
  Heart, Clock, ChevronRight,
  Stethoscope, TrendingUp, Sparkles,
  RefreshCw
} from "lucide-react";

// Animated counter
function AnimatedNumber({ value }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const end = parseInt(value);
    if (start === end) return;
    const timer = setInterval(() => {
      start += 1;
      setDisplay(start);
      if (start === end) clearInterval(timer);
    }, 80);
    return () => clearInterval(timer);
  }, [value]);
  return <span>{display}</span>;
}

function StatCard({ icon: Icon, label, value, color, bg, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-slate-500 text-sm font-medium">{label}</span>
        <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center`}>
          <Icon size={18} className={color} />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-800">
        {typeof value === "number"
          ? <AnimatedNumber value={value} />
          : value
        }
      </p>
    </motion.div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    scheduled: "bg-blue-50 text-blue-600 border-blue-100",
    completed: "bg-green-50 text-green-600 border-green-100",
    cancelled: "bg-red-50 text-red-600 border-red-100",
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status] || styles.scheduled}`}>
      {status}
    </span>
  );
}

// Countdown to next appointment
function Countdown({ appointmentDate }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const calc = () => {
      const now = new Date();
      const appt = new Date(appointmentDate);
      const diff = appt - now;
      if (diff <= 0) { setTimeLeft("Now"); return; }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      if (days > 0) setTimeLeft(`${days}d ${hours}h`);
      else if (hours > 0) setTimeLeft(`${hours}h ${minutes}m`);
      else setTimeLeft(`${minutes}m`);
    };
    calc();
    const interval = setInterval(calc, 60000);
    return () => clearInterval(interval);
  }, [appointmentDate]);

  return (
    <span className="text-sky-600 font-semibold">{timeLeft}</span>
  );
}

export default function Dashboard() {
  const [profile, setProfile] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [aiSummary, setAiSummary] = useState("");
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [pRes, aRes] = await Promise.all([
        getMyProfile(),
        getMyAppointments()
      ]);
      setProfile(pRes.data);
      setAppointments(aRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
    // Load AI summary separately so it doesn't block the page
    try {
      const sRes = await getHealthSummaryAI();
      setAiSummary(sRes.data.summary);
    } catch (err) {
      setAiSummary("Welcome! Book an appointment to get started on your health journey.");
    } finally {
      setLoadingSummary(false);
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
const past     = appointments.filter(a =>
  a.status === "completed" ||
  (a.status === "scheduled" && new Date(a.appointment_date) <= now)
);
  const nextAppt = upcoming[0];

  if (loading) return (
    <PatientLayout>
      <div className="mb-6">
        <div className="h-8 w-48 bg-slate-200 rounded-lg animate-pulse mb-2" />
        <div className="h-4 w-64 bg-slate-100 rounded-lg animate-pulse" />
      </div>
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
      </div>
      <SkeletonTable rows={4} />
    </PatientLayout>
  );

  return (
    <PatientLayout>
      <PageWrapper>

        {/* Page title */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-6"
        >
          <h1 className="text-2xl font-bold text-slate-800">My Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">Your personal health overview</p>
        </motion.div>

        {/* AI Summary card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-r from-navy-900 via-navy-800 to-sky-900 rounded-2xl p-5 mb-6 relative overflow-hidden"
        >
          {/* Background glow */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-sky-400/10 rounded-full blur-2xl" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-navy-400/10 rounded-full blur-2xl" />

          <div className="relative flex items-start gap-4">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
              <Sparkles size={18} className="text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <p className="text-white/70 text-xs font-semibold uppercase tracking-wide">
                  AI Health Summary
                </p>
                <button
                  onClick={refreshSummary}
                  disabled={loadingSummary}
                  className="text-white/40 hover:text-white/80 transition-colors"
                >
                  <RefreshCw size={14} className={loadingSummary ? "animate-spin" : ""} />
                </button>
              </div>
              {loadingSummary ? (
                <div className="space-y-2">
                  <div className="h-3 bg-white/10 rounded animate-pulse w-full" />
                  <div className="h-3 bg-white/10 rounded animate-pulse w-3/4" />
                </div>
              ) : (
                <div
                  className="text-white text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{
                    __html: aiSummary
                      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
                      .replace(/\n/g, '<br/>')
                  }}
                />
              )}
            </div>
          </div>
        </motion.div>

        {/* Next appointment countdown */}
        {nextAppt && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-sky-50 border border-sky-100 rounded-2xl p-4 mb-6 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-sky-100 rounded-xl flex items-center justify-center">
                <Clock size={18} className="text-sky-600" />
              </div>
              <div>
                <p className="text-sky-800 text-sm font-semibold">
                  Next appointment in <Countdown appointmentDate={nextAppt.appointment_date} />
                </p>
                <p className="text-sky-600 text-xs mt-0.5">
                  Dr. {nextAppt.doctor_name} · {nextAppt.specialization}
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate("/patient/appointments")}
              className="text-sky-600 hover:text-sky-800 text-xs font-medium flex items-center gap-1"
            >
              View <ChevronRight size={14} />
            </button>
          </motion.div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <StatCard icon={Calendar} label="Upcoming" value={upcoming.length} color="text-blue-600" bg="bg-blue-50" delay={0.1} />
          <StatCard icon={FileText} label="Past Visits" value={past.length} color="text-green-600" bg="bg-green-50" delay={0.15} />
          <StatCard icon={Heart} label="Health Status" value="Good" color="text-rose-600" bg="bg-rose-50" delay={0.2} />
          <StatCard icon={TrendingUp} label="Risk Level" value="Low" color="text-amber-600" bg="bg-amber-50" delay={0.25} />
        </div>

        <div className="grid grid-cols-3 gap-6">

          {/* Profile card */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="col-span-1 space-y-4"
          >
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-br from-navy-900 to-navy-700 p-6 text-center">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.3, type: "spring" }}
                  className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3"
                >
                  <span className="text-white text-2xl font-bold">
                    {profile?.first_name?.[0]}{profile?.last_name?.[0]}
                  </span>
                </motion.div>
                <h3 className="text-white font-semibold text-lg">
                  {profile?.first_name} {profile?.last_name}
                </h3>
                <p className="text-white/60 text-xs mt-0.5">Patient</p>
              </div>
              <div className="p-4 space-y-3">
                {[
                  ["Date of Birth", profile?.date_of_birth],
                  ["Gender", profile?.gender],
                  ["Phone", profile?.phone],
                  ["Email", profile?.email],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-slate-400">{label}</span>
                    <span className="text-slate-700 font-medium truncate ml-2 max-w-32">
                      {value || "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Health cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <p className="text-xs font-semibold text-slate-500 mb-2">Blood Group</p>
                <div className="flex items-center gap-2">
                  <Heart size={18} className="text-red-400" />
                  <div>
                    <p className="text-lg font-bold text-slate-800">—</p>
                    <p className="text-xs text-slate-400">By doctor</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <p className="text-xs font-semibold text-slate-500 mb-2">Risk Level</p>
                <div className="flex items-center gap-2">
                  <Activity size={18} className="text-green-500" />
                  <div>
                    <p className="text-lg font-bold text-green-600">Low</p>
                    <p className="text-xs text-slate-400">ML model</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Appointments */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25 }}
            className="col-span-2"
          >
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between p-5 border-b border-slate-100">
                <h3 className="font-semibold text-slate-800">Upcoming Appointments</h3>
                <button
                  onClick={() => navigate("/patient/appointments")}
                  className="text-sky-500 text-xs font-medium flex items-center gap-1 hover:underline"
                >
                  View all <ChevronRight size={14} />
                </button>
              </div>
              <div className="divide-y divide-slate-50">
                {upcoming.length === 0 ? (
                  <div className="p-10 text-center">
                    <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <Calendar className="text-slate-300" size={28} />
                    </div>
                    <p className="text-slate-400 text-sm font-medium">
                      No upcoming appointments
                    </p>
                    <p className="text-slate-300 text-xs mt-1">
                      Book one to see your doctor
                    </p>
                    <button
                      onClick={() => navigate("/patient/appointments")}
                      className="mt-3 px-4 py-2 bg-navy-900 text-white text-xs rounded-xl font-medium hover:bg-navy-700 transition-colors"
                    >
                      Book Appointment
                    </button>
                  </div>
                ) : (
                  upcoming.slice(0, 4).map((appt, i) => (
                    <motion.div
                      key={appt.appointment_id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.07 }}
                      className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors"
                    >
                      <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Stethoscope size={18} className="text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-800 text-sm font-medium">
                          Dr. {appt.doctor_name}
                        </p>
                        <p className="text-slate-400 text-xs mt-0.5">
                          {appt.specialization} · {appt.reason}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="flex items-center gap-1 text-slate-400 text-xs mb-1 justify-end">
                          <Clock size={11} />
                          {new Date(appt.appointment_date).toLocaleDateString("en-IN", {
                            day: "numeric", month: "short", year: "numeric"
                          })}
                        </div>
                        <StatusBadge status={appt.status} />
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </PageWrapper>
    </PatientLayout>
  );
}