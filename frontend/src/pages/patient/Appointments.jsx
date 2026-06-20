import { useState, useEffect } from "react";
import PatientLayout from "../../components/PatientLayout";
import {
  getMyAppointments, getDoctors,
  bookAppointment, getAvailableSlots,
  cancelAppointment
} from "../../api/api";
import {
  Calendar, Clock, Plus, X,
  CheckCircle, AlertCircle,
  Loader2, Stethoscope, ChevronLeft,
  ChevronRight
} from "lucide-react";

function StatusBadge({ status }) {
  const styles = {
    scheduled: "bg-blue-50 text-blue-600 border-blue-100",
    completed: "bg-green-50 text-green-600 border-green-100",
    cancelled: "bg-red-50 text-red-600 border-red-100",
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status] || styles.scheduled}`}>
      {status}
    </span>
  );
}

function getNext14Days() {
  const days = [];
  const today = new Date();
  for (let i = 1; i <= 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  return days;
}

export default function Appointments() {

  // ── STATE ──────────────────────────────────────────────────────
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [booking, setBooking] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [reason, setReason] = useState("");
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [cancelId, setCancelId] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const days = getNext14Days();
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // ── LOAD DATA ──────────────────────────────────────────────────
  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [aRes, dRes] = await Promise.all([
        getMyAppointments(),
        getDoctors()
      ]);
      setAppointments(aRes.data);
      setDoctors(dRes.data);
    } catch (err) {
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  // ── BOOKING ────────────────────────────────────────────────────
  const handleSelectDate = async (date) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    setLoadingSlots(true);
    try {
      const dateStr = date.toISOString().split("T")[0];
      const res = await getAvailableSlots(selectedDoc.doctor_id, dateStr);
      setSlots(res.data.slots);
    } catch (err) {
      setError("Failed to load slots");
    } finally {
      setLoadingSlots(false);
    }
    setStep(3);
  };

  const handleBook = async () => {
    if (!selectedDoc || !selectedSlot || !reason.trim()) return;
    setBooking(true);
    setError("");
    try {
      await bookAppointment({
        doctor_id: selectedDoc.doctor_id,
        appointment_date: selectedSlot.datetime,
        reason
      });
      setSuccess(
        `Appointment confirmed with Dr. ${selectedDoc.last_name} on ` +
        `${selectedDate.toLocaleDateString("en-IN", { day: "numeric", month: "long" })} ` +
        `at ${selectedSlot.label}`
      );
      setShowForm(false);
      resetForm();
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || "Booking failed");
    } finally {
      setBooking(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setSelectedDoc(null);
    setSelectedDate(null);
    setSelectedSlot(null);
    setReason("");
    setSlots([]);
  };

  // ── CANCEL ─────────────────────────────────────────────────────
  const handleCancel = (id) => {
    setCancelId(id);
  };

  const confirmCancel = async () => {
    setCancelling(true);
    setError("");
    try {
      await cancelAppointment(cancelId);
      setSuccess("Appointment cancelled successfully.");
      setCancelId(null);
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to cancel");
    } finally {
      setCancelling(false);
    }
  };

  const now = new Date();
  const upcoming = appointments.filter(a =>
    a.status === "scheduled" && new Date(a.appointment_date) > now
  );
  const past = appointments.filter(a =>
    a.status !== "scheduled" || new Date(a.appointment_date) <= now
  );
  // ── LOADING STATE ──────────────────────────────────────────────
  if (loading) return (
    <PatientLayout>
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-sky-500" size={32} />
      </div>
    </PatientLayout>
  );

  // ── RENDER ─────────────────────────────────────────────────────
  return (
    <PatientLayout>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Appointments</h1>
          <p className="text-slate-500 text-sm mt-1">
            Book and manage your medical appointments
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); resetForm(); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-navy-900 hover:bg-navy-700 text-white text-sm font-medium rounded-xl transition-colors shadow-lg"
        >
          <Plus size={16} /> Book Appointment
        </button>
      </div>

      {/* Messages */}
      {success && (
        <div className="flex items-start gap-2 bg-green-50 border border-green-100 text-green-700 px-4 py-3 rounded-xl text-sm mb-4">
          <CheckCircle size={16} className="flex-shrink-0 mt-0.5" />
          {success}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm mb-4">
          <AlertCircle size={16} />{error}
        </div>
      )}

      {/* ── BOOKING MODAL ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">

            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div>
                <h3 className="font-semibold text-slate-800">Book Appointment</h3>
                <div className="flex items-center gap-1 mt-2">
                  {["Doctor", "Date", "Time", "Reason"].map((s, i) => (
                    <div key={s} className="flex items-center gap-1">
                      <div className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-medium ${step > i + 1
                          ? "bg-green-500 text-white"
                          : step === i + 1
                            ? "bg-sky-500 text-white"
                            : "bg-slate-100 text-slate-400"
                        }`}>
                        {step > i + 1 ? "✓" : i + 1}
                      </div>
                      <span className={`text-xs ${step === i + 1 ? "text-sky-600 font-medium" : "text-slate-400"}`}>
                        {s}
                      </span>
                      {i < 3 && <div className="w-4 h-px bg-slate-200 mx-1" />}
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={() => { setShowForm(false); resetForm(); }}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100"
              >
                <X size={18} className="text-slate-400" />
              </button>
            </div>

            <div className="p-6">

              {/* STEP 1 — Doctor */}
              {step === 1 && (
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-3">
                    Choose your doctor
                  </p>
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {doctors.length === 0 ? (
                      <p className="text-slate-400 text-sm text-center py-4">
                        No doctors available yet
                      </p>
                    ) : (
                      doctors.map(d => (
                        <button
                          key={d.doctor_id}
                          onClick={() => { setSelectedDoc(d); setStep(2); }}
                          className="w-full flex items-center gap-3 p-3 border border-slate-200 rounded-xl hover:border-sky-300 hover:bg-sky-50 transition-all text-left"
                        >
                          <div className="w-10 h-10 bg-gradient-to-br from-sky-500 to-navy-600 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-sm font-bold">
                              {d.first_name[0]}{d.last_name[0]}
                            </span>
                          </div>
                          <div>
                            <p className="text-slate-800 text-sm font-semibold">
                              Dr. {d.first_name} {d.last_name}
                            </p>
                            <p className="text-slate-400 text-xs">
                              {d.specialization}
                            </p>
                          </div>
                          <ChevronRight size={16} className="text-slate-300 ml-auto" />
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* STEP 2 — Date */}
              {step === 2 && (
                <div>
                  <button
                    onClick={() => setStep(1)}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mb-3"
                  >
                    <ChevronLeft size={14} /> Back
                  </button>
                  <div className="flex items-center gap-3 mb-4 p-3 bg-sky-50 rounded-xl border border-sky-100">
                    <div className="w-8 h-8 bg-sky-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-bold">
                        {selectedDoc?.first_name[0]}{selectedDoc?.last_name[0]}
                      </span>
                    </div>
                    <div>
                      <p className="text-sky-800 text-sm font-medium">
                        Dr. {selectedDoc?.first_name} {selectedDoc?.last_name}
                      </p>
                      <p className="text-sky-600 text-xs">{selectedDoc?.specialization}</p>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-slate-700 mb-3">Select a date</p>
                  <div className="grid grid-cols-7 gap-1.5">
                    {days.map((day, i) => {
                      const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                      return (
                        <button
                          key={i}
                          disabled={isWeekend}
                          onClick={() => handleSelectDate(day)}
                          className={`flex flex-col items-center p-2 rounded-xl text-xs transition-all ${isWeekend
                              ? "opacity-30 cursor-not-allowed bg-slate-50"
                              : "hover:bg-sky-500 hover:text-white border border-slate-200 hover:border-sky-500 cursor-pointer"
                            }`}
                        >
                          <span className="text-xs opacity-70">{dayNames[day.getDay()]}</span>
                          <span className="font-semibold text-sm mt-0.5">{day.getDate()}</span>
                          <span className="text-xs opacity-70">{monthNames[day.getMonth()]}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-slate-400 mt-3 text-center">
                    Mon–Fri only · 9:00 AM – 5:00 PM
                  </p>
                </div>
              )}

              {/* STEP 3 — Time Slot */}
              {step === 3 && (
                <div>
                  <button
                    onClick={() => setStep(2)}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mb-3"
                  >
                    <ChevronLeft size={14} /> Back
                  </button>
                  <p className="text-sm font-medium text-slate-700 mb-1">Available slots</p>
                  <p className="text-xs text-slate-400 mb-3">
                    {selectedDate?.toLocaleDateString("en-IN", {
                      weekday: "long", day: "numeric", month: "long"
                    })} · Dr. {selectedDoc?.last_name}
                  </p>
                  {loadingSlots ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="animate-spin text-sky-500" size={24} />
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-4 gap-2 max-h-56 overflow-y-auto">
                        {slots.map((slot, i) => (
                          <button
                            key={i}
                            disabled={!slot.available}
                            onClick={() => { setSelectedSlot(slot); setStep(4); }}
                            className={`py-2 px-1 rounded-xl text-xs font-medium transition-all ${!slot.available
                                ? "bg-slate-50 text-slate-300 cursor-not-allowed border border-slate-100 line-through"
                                : "bg-white border border-slate-200 text-slate-600 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-600"
                              }`}
                          >
                            {slot.label}
                            {slot.booked && (
                              <span className="block text-xs opacity-60 mt-0.5">Booked</span>
                            )}
                          </button>
                        ))}
                      </div>
                      {slots.filter(s => s.available).length === 0 && (
                        <p className="text-center text-slate-400 text-sm py-4">
                          No available slots. Please choose another date.
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <div className="w-3 h-3 bg-white border border-slate-200 rounded" />
                          Available
                        </span>
                        <span className="flex items-center gap-1">
                          <div className="w-3 h-3 bg-slate-100 border border-slate-100 rounded" />
                          Booked
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* STEP 4 — Reason */}
              {step === 4 && (
                <div>
                  <button
                    onClick={() => setStep(3)}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mb-3"
                  >
                    <ChevronLeft size={14} /> Back
                  </button>
                  <div className="bg-slate-50 rounded-xl p-4 mb-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Doctor</span>
                      <span className="font-medium text-slate-800">
                        Dr. {selectedDoc?.first_name} {selectedDoc?.last_name}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Date</span>
                      <span className="font-medium text-slate-800">
                        {selectedDate?.toLocaleDateString("en-IN", {
                          weekday: "short", day: "numeric", month: "long"
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Time</span>
                      <span className="font-medium text-sky-600">{selectedSlot?.label}</span>
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                      Reason for visit
                    </label>
                    <textarea
                      required
                      rows={3}
                      placeholder="Describe your symptoms or reason for visit..."
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50 resize-none"
                    />
                  </div>
                  <button
                    onClick={handleBook}
                    disabled={booking || !reason.trim()}
                    className="w-full flex items-center justify-center gap-2 bg-navy-900 hover:bg-navy-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
                  >
                    {booking
                      ? <><Loader2 size={16} className="animate-spin" /> Confirming...</>
                      : <><CheckCircle size={16} /> Confirm Appointment</>
                    }
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── CANCEL CONFIRMATION MODAL ── */}
      {cancelId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="text-center mb-5">
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <X size={22} className="text-red-500" />
              </div>
              <h3 className="font-semibold text-slate-800 text-lg">
                Cancel Appointment?
              </h3>
              <p className="text-slate-500 text-sm mt-1">
                This action cannot be undone.
                The time slot will become available for others.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setCancelId(null)}
                className="flex-1 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
              >
                Keep it
              </button>
              <button
                onClick={confirmCancel}
                disabled={cancelling}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {cancelling
                  ? <><Loader2 size={14} className="animate-spin" /> Cancelling...</>
                  : "Yes, Cancel"
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── UPCOMING ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm mb-6">
        <div className="p-5 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">
            Upcoming
            <span className="text-slate-400 font-normal ml-2 text-sm">
              ({upcoming.length})
            </span>
          </h3>
        </div>
        <div className="divide-y divide-slate-50">
          {upcoming.length === 0 ? (
            <div className="p-8 text-center">
              <Calendar className="text-slate-200 mx-auto mb-3" size={40} />
              <p className="text-slate-400 text-sm">No upcoming appointments</p>
            </div>
          ) : (
            upcoming.map(appt => (
              <div
                key={appt.appointment_id}
                className="flex items-center gap-4 p-4 hover:bg-slate-50"
              >
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Stethoscope size={20} className="text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-800 text-sm font-semibold">
                    Dr. {appt.doctor_name}
                  </p>
                  <p className="text-slate-400 text-xs mt-0.5">{appt.specialization}</p>
                  <p className="text-slate-500 text-xs mt-1 italic">"{appt.reason}"</p>
                </div>
                <div className="text-right flex-shrink-0 space-y-1">
                  <div className="flex items-center gap-1 text-slate-500 text-xs justify-end">
                    <Calendar size={11} />
                    {new Date(appt.appointment_date).toLocaleDateString("en-IN", {
                      day: "numeric", month: "short", year: "numeric"
                    })}
                  </div>
                  <div className="flex items-center gap-1 text-slate-500 text-xs justify-end">
                    <Clock size={11} />
                    {new Date(appt.appointment_date).toLocaleTimeString("en-IN", {
                      hour: "2-digit", minute: "2-digit"
                    })}
                  </div>
                  <StatusBadge status={appt.status} />
                  <button
                    onClick={() => handleCancel(appt.appointment_id)}
                    className="text-xs text-red-400 hover:text-red-600 hover:underline transition-colors block w-full text-right"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── PAST ── */}
      {past.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="p-5 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">
              Past Visits
              <span className="text-slate-400 font-normal ml-2 text-sm">
                ({past.length})
              </span>
            </h3>
          </div>
          <div className="divide-y divide-slate-50">
            {past.map(appt => (
              <div
                key={appt.appointment_id}
                className="flex items-center gap-4 p-4 opacity-70"
              >
                <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Stethoscope size={20} className="text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-700 text-sm font-medium">
                    Dr. {appt.doctor_name}
                  </p>
                  <p className="text-slate-400 text-xs">
                    {appt.specialization} · {appt.reason}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-slate-400 text-xs mb-1">
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

    </PatientLayout>
  );
}