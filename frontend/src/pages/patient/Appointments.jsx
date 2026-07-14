import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PatientLayout from "../../components/PatientLayout";
import {
  getMyAppointments, getDoctors,
  bookAppointment, getAvailableSlots,
  cancelAppointment
} from "../../api/api";
import {
  Calendar, Clock, Plus, X, CheckCircle,
  AlertCircle, Loader2, Stethoscope,
  ChevronLeft, ChevronRight,
  CalendarOff, Heart
} from "lucide-react";

// ── Status badge ──────────────────────────
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

// ── Next 14 working days ──────────────────
function getNext14Days() {
  const days = [], today = new Date();
  for (let i = 1; i <= 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  return days;
}

// ── Step indicator ────────────────────────
function StepDot({ n, current, label }) {
  const done   = current > n;
  const active = current === n;
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-sm ${
        done   ? "bg-emerald-500 text-white shadow-emerald-200" :
        active ? "text-white shadow-sky-200"                   :
                 "bg-slate-100 text-slate-400"
      }`}
        style={active ? { background: "linear-gradient(135deg, #2176AE, #1A4A7A)" } : {}}>
        {done ? <CheckCircle size={14} /> : n}
      </div>
      <span className={`text-xs font-semibold hidden sm:block ${
        active ? "text-slate-700" : done ? "text-emerald-600" : "text-slate-400"
      }`}>{label}</span>
    </div>
  );
}

// ── Countdown timer ───────────────────────
function Countdown({ appointmentDate }) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    const calc = () => {
      const diff = new Date(appointmentDate) - new Date();
      if (diff <= 0) { setLabel("Now"); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setLabel(d > 0 ? `in ${d}d ${h}h` : h > 0 ? `in ${h}h ${m}m` : `in ${m}m`);
    };
    calc();
    const t = setInterval(calc, 60000);
    return () => clearInterval(t);
  }, [appointmentDate]);
  return <span>{label}</span>;
}

// ─────────────────────────────────────────
export default function Appointments() {
  const [appointments, setAppointments] = useState([]);
  const [doctors,      setDoctors]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [showForm,     setShowForm]     = useState(false);
  const [booking,      setBooking]      = useState(false);
  const [success,      setSuccess]      = useState("");
  const [error,        setError]        = useState("");
  const [step,         setStep]         = useState(1);
  const [selectedDoc,  setSelectedDoc]  = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [reason,       setReason]       = useState("");
  const [slots,        setSlots]        = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [leaveBlocked, setLeaveBlocked] = useState(false);
  const [cancelId,     setCancelId]     = useState(null);
  const [cancelling,   setCancelling]   = useState(false);
  const [activeTab,    setActiveTab]    = useState("upcoming");

  const days = getNext14Days();
  const DAY  = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [aRes, dRes] = await Promise.all([getMyAppointments(), getDoctors()]);
      setAppointments(aRes.data);
      setDoctors(dRes.data);
    } catch {
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDate = async (date) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    setLeaveBlocked(false);
    setLoadingSlots(true);
    setStep(3);
    try {
      const res = await getAvailableSlots(selectedDoc.doctor_id, date.toISOString().split("T")[0]);
      if (res.data.leave_blocked || res.data.message === "Doctor is on leave this day") {
        setLeaveBlocked(true);
        setSlots([]);
      } else {
        setSlots(res.data.slots || []);
      }
    } catch {
      setError("Failed to load slots");
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleBook = async () => {
    if (!selectedDoc || !selectedSlot || !reason.trim()) return;
    setBooking(true);
    setError("");
    try {
      await bookAppointment({
        doctor_id:        selectedDoc.doctor_id,
        appointment_date: selectedSlot.datetime,
        reason
      });
      setSuccess(`Booked with Dr. ${selectedDoc.last_name} on ${
        selectedDate.toLocaleDateString("en-IN", { day: "numeric", month: "long" })
      } at ${selectedSlot.label}`);
      setShowForm(false);
      resetForm();
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || "Booking failed. Please try again.");
    } finally {
      setBooking(false);
    }
  };

  const resetForm = () => {
    setStep(1); setSelectedDoc(null); setSelectedDate(null);
    setSelectedSlot(null); setReason(""); setSlots([]);
    setLeaveBlocked(false); setError("");
  };

  const confirmCancel = async () => {
    setCancelling(true);
    try {
      await cancelAppointment(cancelId);
      setSuccess("Appointment cancelled successfully.");
      setCancelId(null);
      loadData();
    } catch {
      setError("Failed to cancel appointment");
    } finally {
      setCancelling(false);
    }
  };

  const now      = new Date();
  const upcoming = appointments.filter(a => a.status === "scheduled" && new Date(a.appointment_date) > now);
  const past     = appointments.filter(a => a.status !== "scheduled" || new Date(a.appointment_date) <= now);
  const nextAppt = upcoming[0];

  if (loading) return (
    <PatientLayout>
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-sky-500" size={32} />
      </div>
    </PatientLayout>
  );

  return (
    <PatientLayout>

      {/* ── Page header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Appointments</h1>
          <p className="text-slate-500 text-sm mt-1">
            {upcoming.length > 0
              ? `${upcoming.length} upcoming · next ${upcoming[0] ? new Date(upcoming[0].appointment_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : ""}`
              : "Book a visit with your doctor"}
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); resetForm(); }}
          className="flex items-center gap-2 px-5 py-2.5 text-white text-sm font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all"
          style={{ background: "linear-gradient(135deg, #2176AE, #1A4A7A)", boxShadow: "0 4px 20px rgba(33,118,174,0.3)" }}
        >
          <Plus size={16} /> Book Appointment
        </button>
      </div>

      {/* ── Alerts ── */}
      <AnimatePresence>
        {success && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm mb-5 border"
            style={{ background: "rgba(16,185,129,0.06)", borderColor: "rgba(16,185,129,0.2)", color: "#059669" }}>
            <CheckCircle size={16} className="flex-shrink-0" />
            <span className="font-medium">{success}</span>
            <button onClick={() => setSuccess("")} className="ml-auto"><X size={14} /></button>
          </motion.div>
        )}
        {error && !showForm && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm mb-5 border"
            style={{ background: "rgba(239,68,68,0.06)", borderColor: "rgba(239,68,68,0.2)", color: "#dc2626" }}>
            <AlertCircle size={16} className="flex-shrink-0" />
            <span>{error}</span>
            <button onClick={() => setError("")} className="ml-auto"><X size={14} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Next appointment hero card ── */}
      {nextAppt && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-2xl p-5 mb-6 overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #0D2137 0%, #0F2A45 60%, #1A1035 100%)",
            boxShadow: "0 8px 32px rgba(13,33,55,0.2)"
          }}
        >
          {/* BG effects */}
          <div className="absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl opacity-10"
            style={{ background: "radial-gradient(circle, #2176AE, transparent)" }} />
          <div className="absolute inset-0 opacity-[0.02]"
            style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)", backgroundSize: "20px 20px" }} />

          <div className="relative flex items-center gap-5">
            {/* Date block */}
            <div className="flex-shrink-0 text-center w-16 h-16 rounded-2xl flex flex-col items-center justify-center"
              style={{ background: "rgba(33,118,174,0.3)", border: "1px solid rgba(33,118,174,0.4)" }}>
              <span className="text-white text-2xl font-bold leading-none">
                {new Date(nextAppt.appointment_date).getDate()}
              </span>
              <span className="text-white/50 text-xs uppercase tracking-wider mt-0.5">
                {new Date(nextAppt.appointment_date).toLocaleDateString("en-IN", { month: "short" })}
              </span>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-white/40 text-xs uppercase tracking-widest font-semibold">Next Appointment</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ background: "rgba(16,185,129,0.2)", color: "#34d399" }}>
                  <Countdown appointmentDate={nextAppt.appointment_date} />
                </span>
              </div>
              <p className="text-white text-lg font-bold">Dr. {nextAppt.doctor_name}</p>
              <p className="text-white/50 text-sm mt-0.5">{nextAppt.specialization}</p>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1.5 text-white/40 text-xs">
                  <Clock size={11} />
                  {new Date(nextAppt.appointment_date).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </div>
                <div className="flex items-center gap-1.5 text-white/40 text-xs italic">
                  <Heart size={11} />
                  "{nextAppt.reason}"
                </div>
              </div>
            </div>

            {/* Cancel button */}
            <button
              onClick={() => setCancelId(nextAppt.appointment_id)}
              className="flex-shrink-0 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{ background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}
            >
              Cancel
            </button>
          </div>
        </motion.div>
      )}

      {/* ── Tabs + list ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

        {/* Tab bar */}
        <div className="flex border-b border-slate-100">
          {[
            { key: "upcoming", label: "Upcoming", count: upcoming.length },
            { key: "past",     label: "Past",     count: past.length     },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex items-center gap-2 px-5 py-4 text-sm font-semibold transition-all border-b-2"
              style={{
                color:       activeTab === tab.key ? "#2176AE" : "#94a3b8",
                borderColor: activeTab === tab.key ? "#2176AE" : "transparent"
              }}
            >
              {tab.label}
              <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                style={activeTab === tab.key
                  ? { background: "rgba(33,118,174,0.1)", color: "#2176AE" }
                  : { background: "#f1f5f9", color: "#94a3b8" }
                }>
                {tab.count}
              </span>
            </button>
          ))}
          {/* Book button in tab bar */}
          <div className="flex-1 flex items-center justify-end px-4">
            <button
              onClick={() => { setShowForm(true); resetForm(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all"
              style={{ background: "rgba(33,118,174,0.08)", color: "#2176AE", border: "1px solid rgba(33,118,174,0.15)" }}
            >
              <Plus size={13} /> New
            </button>
          </div>
        </div>

        {/* Upcoming tab */}
        <AnimatePresence mode="wait">
          {activeTab === "upcoming" && (
            <motion.div key="upcoming" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {upcoming.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                    style={{ background: "rgba(33,118,174,0.05)", border: "1px dashed rgba(33,118,174,0.2)" }}>
                    <Calendar size={26} className="text-slate-300" />
                  </div>
                  <p className="text-slate-500 text-sm font-semibold">No upcoming appointments</p>
                  <p className="text-slate-400 text-xs mt-1 mb-5">Book one to see your doctor</p>
                  <button
                    onClick={() => { setShowForm(true); resetForm(); }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-white text-sm font-bold rounded-2xl shadow-lg"
                    style={{ background: "linear-gradient(135deg, #2176AE, #1A4A7A)" }}
                  >
                    <Plus size={15} /> Book Now
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {upcoming.map((appt, i) => (
                    <motion.div
                      key={appt.appointment_id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/70 transition-colors"
                    >
                      {/* Date badge */}
                      <div className="w-13 flex-shrink-0">
                        <div className="w-12 h-12 rounded-2xl flex flex-col items-center justify-center shadow-sm"
                          style={{ background: "linear-gradient(135deg, #2176AE, #1A4A7A)" }}>
                          <span className="text-white text-sm font-bold leading-none">
                            {new Date(appt.appointment_date).getDate()}
                          </span>
                          <span className="text-white/60 text-[9px] mt-0.5 uppercase">
                            {new Date(appt.appointment_date).toLocaleDateString("en-IN", { month: "short" })}
                          </span>
                        </div>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-slate-800 text-sm font-bold">Dr. {appt.doctor_name}</p>
                          <StatusBadge status={appt.status} />
                        </div>
                        <p className="text-slate-400 text-xs mt-0.5">{appt.specialization}</p>
                        <p className="text-slate-500 text-xs mt-1 italic truncate">"{appt.reason}"</p>
                      </div>

                      {/* Time + cancel */}
                      <div className="text-right flex-shrink-0 space-y-2">
                        <div className="flex items-center gap-1.5 text-slate-500 text-xs justify-end font-medium">
                          <Clock size={11} />
                          {new Date(appt.appointment_date).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                        <div className="text-sky-500 text-xs font-medium">
                          <Countdown appointmentDate={appt.appointment_date} />
                        </div>
                        <button
                          onClick={() => setCancelId(appt.appointment_id)}
                          className="text-xs text-red-400 hover:text-red-600 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Past tab */}
          {activeTab === "past" && (
            <motion.div key="past" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {past.length === 0 ? (
                <div className="py-16 text-center">
                  <Stethoscope size={28} className="text-slate-200 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">No past visits yet</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {past.map((appt, i) => (
                    <div key={appt.appointment_id} className="flex items-center gap-4 px-5 py-3.5">
                      <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Stethoscope size={15} className="text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-600 text-sm font-semibold">Dr. {appt.doctor_name}</p>
                        <p className="text-slate-400 text-xs mt-0.5 truncate">{appt.specialization} · "{appt.reason}"</p>
                      </div>
                      <div className="text-right flex-shrink-0 space-y-1">
                        <p className="text-slate-400 text-xs">
                          {new Date(appt.appointment_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                        <StatusBadge status={appt.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── BOOKING MODAL ── */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: "spring", damping: 25 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
              style={{ maxHeight: "90vh", display: "flex", flexDirection: "column" }}
            >
              {/* Modal header */}
              <div className="px-6 pt-6 pb-5 border-b border-slate-100 flex-shrink-0">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ background: "linear-gradient(135deg, #2176AE, #1A4A7A)" }}>
                      <Calendar size={16} className="text-white" />
                    </div>
                    <h3 className="font-bold text-slate-800 text-lg">Book Appointment</h3>
                  </div>
                  <button
                    onClick={() => { setShowForm(false); resetForm(); }}
                    className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors"
                  >
                    <X size={17} className="text-slate-400" />
                  </button>
                </div>
                {/* Steps */}
                <div className="flex items-center gap-2">
                  {[["1","Doctor"],["2","Date"],["3","Time"],["4","Confirm"]].map(([n, label], i) => (
                    <div key={n} className="flex items-center gap-2">
                      <StepDot n={parseInt(n)} current={step} label={label} />
                      {i < 3 && (
                        <div className={`h-px transition-all ${parseInt(n) < step ? "bg-emerald-300" : "bg-slate-200"}`}
                          style={{ width: "20px" }} />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 overflow-y-auto">

                {/* ── STEP 1: Doctor ── */}
                {step === 1 && (
                  <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}>
                    <p className="text-sm font-bold text-slate-700 mb-4">Choose your doctor</p>
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-0.5">
                      {doctors.length === 0 ? (
                        <p className="text-slate-400 text-sm text-center py-8">No doctors available</p>
                      ) : doctors.map(d => (
                        <button
                          key={d.doctor_id}
                          onClick={() => { setSelectedDoc(d); setStep(2); }}
                          className="w-full flex items-center gap-3 p-4 border border-slate-200 rounded-2xl hover:border-sky-300 hover:bg-sky-50/40 transition-all text-left group"
                        >
                          <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 text-white text-sm font-bold shadow-md"
                            style={{ background: "linear-gradient(135deg, #2176AE, #1A4A7A)" }}>
                            {d.first_name[0]}{d.last_name[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-slate-800 text-sm font-bold">Dr. {d.first_name} {d.last_name}</p>
                            <p className="text-slate-400 text-xs mt-0.5">{d.specialization}</p>
                          </div>
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-slate-100 group-hover:bg-sky-100 transition-colors">
                            <ChevronRight size={14} className="text-slate-400 group-hover:text-sky-500" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* ── STEP 2: Date ── */}
                {step === 2 && (
                  <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}>
                    <button onClick={() => setStep(1)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mb-4 transition-colors">
                      <ChevronLeft size={13} /> Back
                    </button>
                    {/* Doctor pill */}
                    <div className="flex items-center gap-3 p-3.5 rounded-2xl mb-5"
                      style={{ background: "rgba(33,118,174,0.05)", border: "1px solid rgba(33,118,174,0.15)" }}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ background: "linear-gradient(135deg, #2176AE, #1A4A7A)" }}>
                        {selectedDoc?.first_name[0]}{selectedDoc?.last_name[0]}
                      </div>
                      <div>
                        <p className="text-slate-700 text-sm font-bold">Dr. {selectedDoc?.first_name} {selectedDoc?.last_name}</p>
                        <p className="text-slate-400 text-xs">{selectedDoc?.specialization}</p>
                      </div>
                      <button onClick={() => setStep(1)} className="ml-auto text-slate-300 hover:text-slate-500">
                        <X size={14} />
                      </button>
                    </div>

                    <p className="text-sm font-bold text-slate-700 mb-3">Select a date</p>
                    {/* Day header */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                      {DAY.map(d => (
                        <div key={d} className="text-center text-[9px] font-bold text-slate-400 uppercase tracking-wider py-1">{d}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {/* Offset for first day */}
                      {Array(days[0].getDay()).fill(null).map((_, i) => <div key={`e${i}`} />)}
                      {days.map((day, i) => {
                        const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                        return (
                          <button
                            key={i}
                            disabled={isWeekend}
                            onClick={() => handleSelectDate(day)}
                            className={`relative flex flex-col items-center py-2.5 rounded-xl text-xs font-bold transition-all ${
                              isWeekend
                                ? "opacity-20 cursor-not-allowed"
                                : "border border-slate-200 text-slate-600 hover:border-sky-400 hover:bg-sky-500 hover:text-white cursor-pointer"
                            }`}
                          >
                            <span className="text-base leading-tight">{day.getDate()}</span>
                            <span className="text-[9px] opacity-60 mt-0.5">
                              {day.toLocaleDateString("en-IN", { month: "short" })}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-slate-400 text-center mt-3">Mon – Fri available · 9 AM – 5 PM</p>
                  </motion.div>
                )}

                {/* ── STEP 3: Time ── */}
                {step === 3 && (
                  <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}>
                    <button onClick={() => { setStep(2); setLeaveBlocked(false); }} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mb-4 transition-colors">
                      <ChevronLeft size={13} /> Back
                    </button>

                    {/* Selected date info */}
                    <div className="flex items-center gap-3 p-3.5 rounded-2xl mb-4"
                      style={{ background: "rgba(33,118,174,0.05)", border: "1px solid rgba(33,118,174,0.15)" }}>
                      <div className="w-9 h-9 rounded-xl flex-shrink-0 flex flex-col items-center justify-center"
                        style={{ background: "linear-gradient(135deg, #2176AE, #1A4A7A)" }}>
                        <span className="text-white text-sm font-bold leading-none">{selectedDate?.getDate()}</span>
                        <span className="text-white/50 text-[9px] uppercase">{selectedDate?.toLocaleDateString("en-IN", { month: "short" })}</span>
                      </div>
                      <div>
                        <p className="text-slate-700 text-sm font-bold">
                          {selectedDate?.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
                        </p>
                        <p className="text-slate-400 text-xs">Dr. {selectedDoc?.last_name} · {selectedDoc?.specialization}</p>
                      </div>
                    </div>

                    <p className="text-sm font-bold text-slate-700 mb-3">Pick a time</p>

                    {loadingSlots ? (
                      <div className="flex flex-col items-center justify-center py-10 gap-3">
                        <Loader2 className="animate-spin text-sky-500" size={28} />
                        <p className="text-slate-400 text-xs">Checking availability...</p>
                      </div>
                    ) : leaveBlocked ? (
                      <div className="py-8 text-center">
                        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)" }}>
                          <CalendarOff size={24} className="text-red-400" />
                        </div>
                        <p className="text-red-600 text-sm font-bold">Doctor is on leave</p>
                        <p className="text-slate-400 text-xs mt-1 mb-4">
                          No appointments available on this day. Please choose another date.
                        </p>
                        <button
                          onClick={() => { setStep(2); setLeaveBlocked(false); }}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                          <ChevronLeft size={13} /> Choose Another Date
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-4 gap-2">
                          {slots.map((slot, i) => {
                            const isBlocked = slot.blocked;
                            const available = slot.available;
                            return (
                              <button
                                key={i}
                                disabled={!available}
                                onClick={() => { if (available) { setSelectedSlot(slot); setStep(4); } }}
                                title={isBlocked ? "Doctor is unavailable" : !available ? "Not available" : ""}
                                className={`py-2.5 rounded-xl text-xs font-semibold transition-all relative ${
                                  available
                                    ? "bg-white border border-slate-200 text-slate-700 hover:bg-sky-500 hover:text-white hover:border-sky-500 hover:shadow-md cursor-pointer"
                                    : isBlocked
                                      ? "bg-amber-50 text-amber-300 border border-amber-100 cursor-not-allowed"
                                      : "bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed"
                                }`}
                              >
                                {slot.label}
                                {isBlocked && (
                                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full border border-white" />
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {/* Legend */}
                        <div className="flex items-center gap-4 mt-3">
                          {slots.some(s => s.blocked) && (
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 bg-amber-400 rounded-full" />
                              <span className="text-xs text-slate-400">Doctor unavailable</span>
                            </div>
                          )}
                          {slots.some(s => !s.available && !s.blocked) && (
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 bg-slate-300 rounded-full" />
                              <span className="text-xs text-slate-400">Already booked</span>
                            </div>
                          )}
                        </div>

                        {!slots.filter(s => s.available).length && (
                          <div className="mt-4 text-center py-4">
                            <p className="text-slate-400 text-sm">No available slots on this day.</p>
                            <button
                              onClick={() => setStep(2)}
                              className="mt-2 text-sky-500 text-xs hover:underline"
                            >
                              Try another date →
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </motion.div>
                )}

                {/* ── STEP 4: Confirm ── */}
                {step === 4 && (
                  <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}>
                    <button onClick={() => setStep(3)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mb-4 transition-colors">
                      <ChevronLeft size={13} /> Back
                    </button>

                    {/* Summary card */}
                    <div className="rounded-2xl overflow-hidden mb-5"
                      style={{ border: "1px solid rgba(33,118,174,0.15)" }}>
                      <div className="px-4 py-3"
                        style={{ background: "linear-gradient(135deg, #0D2137, #1A4A7A)" }}>
                        <p className="text-white/50 text-xs uppercase tracking-widest font-semibold">Appointment Summary</p>
                      </div>
                      <div className="p-4 space-y-3 bg-slate-50/50">
                        {[
                          ["Doctor",         `Dr. ${selectedDoc?.first_name} ${selectedDoc?.last_name}`],
                          ["Specialization", selectedDoc?.specialization],
                          ["Date",           selectedDate?.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })],
                          ["Time",           selectedSlot?.label],
                        ].map(([label, value]) => (
                          <div key={label} className="flex items-center justify-between">
                            <span className="text-slate-400 text-xs">{label}</span>
                            <span className="text-slate-800 text-xs font-bold text-right">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Reason */}
                    <div className="mb-4">
                      <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">
                        Reason for visit <span className="text-red-400">*</span>
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Briefly describe your symptoms or reason for the visit..."
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-sm focus:outline-none bg-slate-50 resize-none leading-relaxed"
                        onFocus={e => e.target.style.boxShadow = "0 0 0 3px rgba(33,118,174,0.12)"}
                        onBlur={e => e.target.style.boxShadow = ""}
                      />
                      <p className="text-xs text-slate-400 mt-1">{reason.length}/200 characters</p>
                    </div>

                    {error && (
                      <div className="flex items-center gap-2 text-red-600 text-xs mb-3 px-3 py-2.5 bg-red-50 rounded-xl border border-red-100">
                        <AlertCircle size={14} className="flex-shrink-0" /> {error}
                      </div>
                    )}

                    <button
                      onClick={handleBook}
                      disabled={booking || !reason.trim()}
                      className="w-full flex items-center justify-center gap-2 text-white font-bold py-4 rounded-2xl transition-all disabled:opacity-50 text-sm"
                      style={{ background: "linear-gradient(135deg, #2176AE, #1A4A7A)", boxShadow: "0 4px 20px rgba(33,118,174,0.35)" }}
                    >
                      {booking
                        ? <><Loader2 size={16} className="animate-spin" /> Confirming...</>
                        : <><CheckCircle size={16} /> Confirm Appointment</>
                      }
                    </button>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── CANCEL MODAL ── */}
      <AnimatePresence>
        {cancelId && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 text-center"
            >
              <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ border: "1px solid rgba(239,68,68,0.15)" }}>
                <CalendarOff size={24} className="text-red-500" />
              </div>
              <h3 className="font-bold text-slate-800 text-lg mb-1">Cancel this appointment?</h3>
              <p className="text-slate-400 text-sm mb-6">This action cannot be undone. The time slot will become available for other patients.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setCancelId(null)}
                  className="flex-1 py-3 border border-slate-200 text-slate-600 text-sm font-semibold rounded-2xl hover:bg-slate-50 transition-colors"
                >
                  Keep it
                </button>
                <button
                  onClick={confirmCancel}
                  disabled={cancelling}
                  className="flex-1 py-3 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-bold rounded-2xl transition-colors flex items-center justify-center gap-2"
                >
                  {cancelling
                    ? <><Loader2 size={14} className="animate-spin" /> Cancelling...</>
                    : "Yes, Cancel"
                  }
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </PatientLayout>
  );
}