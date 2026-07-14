import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DoctorLayout from "../../components/DoctorLayout";
import {
  getScheduleCalendar, getScheduleLeaves,
  getDayDetail, addLeave, deleteLeave
} from "../../api/api";
import { showSuccess, showError } from "../../components/shared/Toast";
import {
  CalendarDays, Clock, X, Plus, Loader2,
  CheckCircle, AlertCircle, Trash2,
  User, ChevronRight, CalendarOff,
  Calendar, Stethoscope
} from "lucide-react";

// ── Weekday label helper ──────────────────
const DAY_LABELS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// Hour options for hourly block picker
const HOURS = [];
for (let h = 9; h <= 17; h++) {
  for (let m = 0; m < 60; m += 30) {
    const hh  = String(h).padStart(2, "0");
    const mm  = String(m).padStart(2, "0");
    const ampm = h < 12 ? "AM" : "PM";
    const h12  = h > 12 ? h - 12 : h;
    HOURS.push({ value: `${hh}:${mm}`, label: `${h12}:${mm} ${ampm}` });
  }
}

// ── Day cell in calendar ──────────────────
function DayCell({ day, isToday, isSelected, onClick }) {
  const hasAppts    = day.appointments.scheduled > 0;
  const isLeave     = day.full_day_leave;
  const hasBlocks   = day.blocks.some(b => b.block_type === "hourly");
  const isWeekend   = day.weekday === "Sun" || day.weekday === "Sat";
  const isPast      = new Date(day.date) < new Date(new Date().toDateString());

  return (
    <motion.button
      whileHover={!isPast ? { scale: 1.04 } : {}}
      onClick={onClick}
      className={`relative flex flex-col items-center py-3 px-1 rounded-2xl transition-all text-center ${
        isSelected  ? "shadow-lg" :
        isPast      ? "opacity-40 cursor-default" :
        isWeekend   ? "opacity-50" : "hover:bg-slate-50 cursor-pointer"
      }`}
      style={isSelected ? {
        background: "linear-gradient(135deg, #0f1f0f, #0a1a0a)",
        color: "white"
      } : {}}
    >
      {/* Day label */}
      <span className={`text-[10px] font-medium uppercase tracking-wide mb-1 ${
        isSelected ? "text-white/50" : "text-slate-400"
      }`}>{day.weekday}</span>

      {/* Date number */}
      <span className={`text-lg font-bold leading-none ${
        isSelected ? "text-white" :
        isToday    ? "text-emerald-600" :
        isLeave    ? "text-red-400" : "text-slate-700"
      }`}>
        {new Date(day.date).getDate()}
      </span>

      {/* Indicator dots */}
      <div className="flex items-center gap-0.5 mt-1.5 h-2">
        {hasAppts && (
          <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-emerald-400" : "bg-emerald-500"}`} />
        )}
        {isLeave && (
          <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-red-300" : "bg-red-400"}`} />
        )}
        {hasBlocks && !isLeave && (
          <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-amber-300" : "bg-amber-400"}`} />
        )}
      </div>

      {/* Appointment count badge */}
      {hasAppts && (
        <span className={`absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center ${
          isSelected ? "bg-emerald-400 text-white" : "bg-emerald-500 text-white"
        }`}>
          {day.appointments.scheduled}
        </span>
      )}
    </motion.button>
  );
}

// ─────────────────────────────────────────
export default function Schedule() {
  const [calendar,     setCalendar]     = useState([]);
  const [leaves,       setLeaves]       = useState([]);
  const [selectedDay,  setSelectedDay]  = useState(null);
  const [dayDetail,    setDayDetail]    = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [loadingDay,   setLoadingDay]   = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addType,      setAddType]      = useState("full_day");
  const [addForm,      setAddForm]      = useState({
    leave_date: "", reason: "", block_start: "09:00", block_end: "10:00"
  });
  const [saving,       setSaving]       = useState(false);
  const [deleting,     setDeleting]     = useState(null);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [calRes, leavRes] = await Promise.all([
        getScheduleCalendar(),
        getScheduleLeaves()
      ]);
      setCalendar(calRes.data);
      setLeaves(leavRes.data);
      // Auto-select today
      const todayStr = new Date().toISOString().split("T")[0];
      const today    = calRes.data.find(d => d.date === todayStr);
      if (today) handleSelectDay(today, calRes.data);
    } catch {
      showError("Failed to load schedule");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDay = async (day, cal = calendar) => {
    setSelectedDay(day);
    setLoadingDay(true);
    try {
      const res = await getDayDetail(day.date);
      setDayDetail(res.data);
    } catch {
      setDayDetail(null);
    } finally {
      setLoadingDay(false);
    }
  };

  const handleAddLeave = async () => {
    if (!addForm.leave_date) { showError("Please select a date"); return; }
    setSaving(true);
    try {
      await addLeave({
        leave_date:  addForm.leave_date,
        block_type:  addType,
        reason:      addForm.reason,
        block_start: addType === "hourly" ? addForm.block_start : null,
        block_end:   addType === "hourly" ? addForm.block_end   : null,
      });
      showSuccess(addType === "full_day" ? "Full day leave added." : "Hourly block added.");
      setShowAddModal(false);
      setAddForm({ leave_date: "", reason: "", block_start: "09:00", block_end: "10:00" });
      await loadAll();
    } catch (err) {
      showError(err.response?.data?.error || "Failed to add leave");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (leaveId) => {
    setDeleting(leaveId);
    try {
      await deleteLeave(leaveId);
      showSuccess("Leave removed.");
      await loadAll();
    } catch {
      showError("Failed to remove leave");
    } finally {
      setDeleting(null);
    }
  };

  const today = new Date().toISOString().split("T")[0];

  // Group calendar into weeks for grid display
  const weeks = [];
  let week    = [];
  calendar.forEach((day, i) => {
    week.push(day);
    if (week.length === 7 || i === calendar.length - 1) {
      weeks.push(week);
      week = [];
    }
  });

  if (loading) return (
    <DoctorLayout>
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-emerald-500" size={32} />
      </div>
    </DoctorLayout>
  );

  return (
    <DoctorLayout>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">My Schedule</h1>
          <p className="text-slate-500 text-sm mt-1">
            View appointments by day · Manage leaves and availability
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-white text-sm font-semibold rounded-xl shadow-md hover:shadow-lg transition-all"
          style={{ background: "linear-gradient(135deg, #059669, #047857)" }}
        >
          <Plus size={16} /> Add Leave / Block
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 mb-5 px-1">
        {[
          { color: "bg-emerald-500", label: "Appointments" },
          { color: "bg-red-400",     label: "Full day leave" },
          { color: "bg-amber-400",   label: "Hourly block" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${color}`} />
            <span className="text-slate-500 text-xs">{label}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">

        {/* ── LEFT: Calendar grid ── */}
        <div className="col-span-2 space-y-4">

          {/* Calendar */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800">Next 30 Days</h3>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                Today is {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long" })}
              </div>
            </div>

            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
                <div key={d} className="text-center text-[10px] font-semibold text-slate-400 uppercase tracking-wide py-1">
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar days — offset first week by day of week */}
            <div>
              {(() => {
                const firstDayIdx = new Date(calendar[0]?.date).getDay();
                const cells = [];
                // Empty cells for offset
                for (let i = 0; i < firstDayIdx; i++) {
                  cells.push(<div key={`empty-${i}`} />);
                }
                calendar.forEach(day => {
                  cells.push(
                    <DayCell
                      key={day.date}
                      day={day}
                      isToday={day.date === today}
                      isSelected={selectedDay?.date === day.date}
                      onClick={() => handleSelectDay(day)}
                    />
                  );
                });
                // Chunk into rows of 7
                const rows = [];
                for (let i = 0; i < cells.length; i += 7) {
                  rows.push(
                    <div key={i} className="grid grid-cols-7 gap-1">
                      {cells.slice(i, i + 7)}
                    </div>
                  );
                }
                return rows;
              })()}
            </div>
          </div>

          {/* Day detail */}
          {selectedDay && (
            <motion.div
              key={selectedDay.date}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
            >
              {/* Day header */}
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between"
                style={selectedDay.full_day_leave ? { background: "rgba(239,68,68,0.04)" } : {}}>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-800">
                      {new Date(selectedDay.date).toLocaleDateString("en-IN", {
                        weekday: "long", day: "numeric", month: "long", year: "numeric"
                      })}
                    </h3>
                    {selectedDay.full_day_leave && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{ background: "rgba(239,68,68,0.1)", color: "#dc2626" }}>
                        On Leave
                      </span>
                    )}
                    {selectedDay.date === today && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{ background: "rgba(16,185,129,0.1)", color: "#059669" }}>
                        Today
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-slate-400 text-xs">
                      {selectedDay.appointments.scheduled} scheduled ·{" "}
                      {selectedDay.appointments.completed} completed ·{" "}
                      {selectedDay.appointments.cancelled} cancelled
                    </span>
                  </div>
                </div>
              </div>

              {loadingDay ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="animate-spin text-emerald-500" size={24} />
                </div>
              ) : (
                <div>
                  {/* Leave/block alerts */}
                  {dayDetail?.blocks?.length > 0 && (
                    <div className="px-5 py-3 border-b border-slate-50">
                      {dayDetail.blocks.map(block => (
                        <div key={block.leave_id}
                          className="flex items-center justify-between p-3 rounded-xl mb-2 last:mb-0"
                          style={{
                            background: block.block_type === "full_day"
                              ? "rgba(239,68,68,0.06)"
                              : "rgba(245,158,11,0.06)",
                            border: `1px solid ${block.block_type === "full_day"
                              ? "rgba(239,68,68,0.15)"
                              : "rgba(245,158,11,0.15)"}`
                          }}>
                          <div className="flex items-center gap-2">
                            <CalendarOff size={14} className={block.block_type === "full_day" ? "text-red-500" : "text-amber-500"} />
                            <span className={`text-xs font-semibold ${block.block_type === "full_day" ? "text-red-600" : "text-amber-600"}`}>
                              {block.block_type === "full_day"
                                ? `Full day leave${block.reason ? ` — ${block.reason}` : ""}`
                                : `Blocked ${block.block_start?.slice(0,5)} – ${block.block_end?.slice(0,5)}${block.reason ? ` — ${block.reason}` : ""}`}
                            </span>
                          </div>
                          <button
                            onClick={() => handleDelete(block.leave_id)}
                            disabled={deleting === block.leave_id}
                            className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-red-100 transition-colors"
                          >
                            {deleting === block.leave_id
                              ? <Loader2 size={12} className="animate-spin text-red-400" />
                              : <Trash2 size={12} className="text-red-400" />
                            }
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Appointments list */}
                  {dayDetail?.appointments?.length === 0 ? (
                    <div className="py-10 text-center">
                      <Calendar size={28} className="text-slate-200 mx-auto mb-2" />
                      <p className="text-slate-400 text-sm">No appointments this day</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-50">
                      {dayDetail?.appointments?.map((appt, i) => (
                        <div key={appt.appointment_id} className="flex items-center gap-4 px-5 py-3.5">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                            style={{ background: "linear-gradient(135deg, #059669, #047857)" }}>
                            {appt.patient_name?.split(" ").map(n => n[0]).join("").slice(0,2)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-slate-800 text-sm font-semibold">{appt.patient_name}</p>
                            <p className="text-slate-400 text-xs mt-0.5 truncate">"{appt.reason}"</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-slate-600 text-sm font-medium flex items-center gap-1 justify-end">
                              <Clock size={11} />
                              {new Date(appt.appointment_date).toLocaleTimeString("en-IN", {
                                hour: "2-digit", minute: "2-digit"
                              })}
                            </p>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium mt-0.5 inline-block ${
                              appt.status === "scheduled" ? "bg-blue-50 text-blue-600" :
                              appt.status === "completed" ? "bg-green-50 text-green-600" :
                              "bg-red-50 text-red-500"
                            }`}>
                              {appt.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </div>

        {/* ── RIGHT: Upcoming leaves ── */}
        <div className="col-span-1 space-y-4">

          {/* Quick add button */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h3 className="font-bold text-slate-800 mb-1">Manage Availability</h3>
            <p className="text-slate-400 text-xs mb-4">
              Block days or hours so patients can't book during those times.
            </p>
            <div className="space-y-2">
              <button
                onClick={() => { setAddType("full_day"); setShowAddModal(true); }}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-red-300 hover:bg-red-50/50 transition-all text-left group"
              >
                <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <CalendarOff size={15} className="text-red-500" />
                </div>
                <div>
                  <p className="text-slate-700 text-sm font-medium">Full Day Leave</p>
                  <p className="text-slate-400 text-xs">Block an entire day</p>
                </div>
              </button>
              <button
                onClick={() => { setAddType("hourly"); setShowAddModal(true); }}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-amber-300 hover:bg-amber-50/50 transition-all text-left group"
              >
                <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Clock size={15} className="text-amber-500" />
                </div>
                <div>
                  <p className="text-slate-700 text-sm font-medium">Hourly Block</p>
                  <p className="text-slate-400 text-xs">Block specific hours</p>
                </div>
              </button>
            </div>
          </div>

          {/* Upcoming leaves list */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800">Upcoming Leaves</h3>
              <p className="text-slate-400 text-xs mt-0.5">{leaves.length} scheduled</p>
            </div>
            {leaves.length === 0 ? (
              <div className="py-10 text-center">
                <CheckCircle size={24} className="text-emerald-300 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">No leaves scheduled</p>
                <p className="text-slate-300 text-xs mt-1">You're available every day</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {leaves.map(leave => (
                  <div key={leave.leave_id} className="flex items-start gap-3 px-4 py-3.5">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      leave.block_type === "full_day" ? "bg-red-50" : "bg-amber-50"
                    }`}>
                      {leave.block_type === "full_day"
                        ? <CalendarOff size={14} className="text-red-500" />
                        : <Clock size={14} className="text-amber-500" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-700 text-sm font-semibold">
                        {new Date(leave.leave_date).toLocaleDateString("en-IN", {
                          day: "numeric", month: "short", year: "numeric"
                        })}
                      </p>
                      <p className="text-slate-400 text-xs mt-0.5">
                        {leave.block_type === "full_day"
                          ? "Full day"
                          : `${leave.block_start?.slice(0,5)} – ${leave.block_end?.slice(0,5)}`
                        }
                        {leave.reason && ` · ${leave.reason}`}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(leave.leave_id)}
                      disabled={deleting === leave.leave_id}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors flex-shrink-0 mt-0.5"
                    >
                      {deleting === leave.leave_id
                        ? <Loader2 size={13} className="animate-spin text-red-400" />
                        : <Trash2 size={13} className="text-slate-300 hover:text-red-400 transition-colors" />
                      }
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── ADD LEAVE MODAL ── */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    addType === "full_day" ? "bg-red-50" : "bg-amber-50"
                  }`}>
                    {addType === "full_day"
                      ? <CalendarOff size={16} className="text-red-500" />
                      : <Clock size={16} className="text-amber-500" />
                    }
                  </div>
                  <h3 className="font-bold text-slate-800">
                    {addType === "full_day" ? "Add Full Day Leave" : "Add Hourly Block"}
                  </h3>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100"
                >
                  <X size={17} className="text-slate-400" />
                </button>
              </div>

              <div className="p-6 space-y-4">

                {/* Type toggle */}
                <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                  {[
                    { val: "full_day", label: "Full Day Leave" },
                    { val: "hourly",   label: "Hourly Block"   },
                  ].map(({ val, label }) => (
                    <button
                      key={val}
                      onClick={() => setAddType(val)}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                        addType === val
                          ? "bg-white text-slate-800 shadow-sm"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Date picker */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                    Date *
                  </label>
                  <input
                    type="date"
                    min={new Date().toISOString().split("T")[0]}
                    value={addForm.leave_date}
                    onChange={e => setAddForm({ ...addForm, leave_date: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none bg-slate-50"
                    onFocus={e => e.target.style.boxShadow = "0 0 0 3px rgba(5,150,105,0.12)"}
                    onBlur={e => e.target.style.boxShadow = ""}
                  />
                </div>

                {/* Hourly time pickers */}
                {addType === "hourly" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                        From
                      </label>
                      <select
                        value={addForm.block_start}
                        onChange={e => {
                          const newStart = e.target.value;
                          // Auto-set end to 30 mins after start so it's always valid
                          const validEnds = HOURS.filter(h => h.value > newStart);
                          const newEnd = validEnds.length > 0 ? validEnds[0].value : newStart;
                          setAddForm({ ...addForm, block_start: newStart, block_end: newEnd });
                        }}
                        className="w-full px-3 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none bg-slate-50"
                      >
                        {HOURS.map(h => (
                          <option key={h.value} value={h.value}>{h.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                        To
                      </label>
                      <select
                        value={addForm.block_end}
                        onChange={e => setAddForm({ ...addForm, block_end: e.target.value })}
                        className="w-full px-3 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none bg-slate-50"
                      >
                        {HOURS.filter(h => h.value > addForm.block_start).map(h => (
                          <option key={h.value} value={h.value}>{h.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Reason */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                    Reason <span className="text-slate-300 font-normal normal-case">(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder={addType === "full_day" ? "e.g. Medical conference, Personal leave" : "e.g. Team meeting, Lunch break"}
                    value={addForm.reason}
                    onChange={e => setAddForm({ ...addForm, reason: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none bg-slate-50"
                    onFocus={e => e.target.style.boxShadow = "0 0 0 3px rgba(5,150,105,0.12)"}
                    onBlur={e => e.target.style.boxShadow = ""}
                  />
                </div>

                {/* Info note */}
                <div className="flex items-start gap-2.5 p-3 rounded-xl"
                  style={{ background: "rgba(5,150,105,0.05)", border: "1px solid rgba(5,150,105,0.12)" }}>
                  <AlertCircle size={13} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                  <p className="text-emerald-700 text-xs leading-relaxed">
                    {addType === "full_day"
                      ? "Patients will not be able to book any appointments on this day."
                      : "Patients will not be able to book time slots within this range."}
                  </p>
                </div>

                {/* Submit */}
                <button
                  onClick={handleAddLeave}
                  disabled={saving || !addForm.leave_date}
                  className="w-full flex items-center justify-center gap-2 text-white font-bold py-3.5 rounded-2xl transition-all disabled:opacity-50"
                  style={{
                    background: "linear-gradient(135deg, #059669, #047857)",
                    boxShadow: "0 4px 20px rgba(5,150,105,0.3)"
                  }}
                >
                  {saving
                    ? <><Loader2 size={16} className="animate-spin" /> Saving...</>
                    : <><CheckCircle size={16} /> {addType === "full_day" ? "Add Full Day Leave" : "Add Hourly Block"}</>
                  }
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </DoctorLayout>
  );
}