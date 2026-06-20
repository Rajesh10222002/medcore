import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import AdminLayout from "../../components/AdminLayout";
import PageWrapper from "../../components/shared/PageWrapper";
import { SkeletonTable } from "../../components/shared/SkeletonCard";
import { getAdminAppointments } from "../../api/api";
import {
  Calendar, Search, Clock,
  User, Stethoscope, Filter
} from "lucide-react";

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
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(a =>
        a.patient_name?.toLowerCase().includes(q) ||
        a.doctor_name?.toLowerCase().includes(q) ||
        a.reason?.toLowerCase().includes(q)
      );
    }
    setFiltered(result);
  }, [search, statusFilter, appointments]);

  if (loading) return (
    <AdminLayout><SkeletonTable rows={6} /></AdminLayout>
  );

  return (
    <AdminLayout>
      <PageWrapper>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">All Appointments</h1>
          <p className="text-slate-500 text-sm mt-1">
            {appointments.length} total appointments
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search by patient, doctor or reason..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 shadow-sm"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 shadow-sm"
          >
            <option value="all">All Status</option>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "Scheduled", count: appointments.filter(a => a.status === "scheduled").length, color: "text-blue-600",  bg: "bg-blue-50"  },
            { label: "Completed", count: appointments.filter(a => a.status === "completed").length, color: "text-green-600", bg: "bg-green-50" },
            { label: "Cancelled", count: appointments.filter(a => a.status === "cancelled").length, color: "text-red-600",   bg: "bg-red-50"   },
          ].map(({ label, count, color, bg }) => (
            <div key={label} className={`${bg} rounded-2xl p-4 text-center border border-slate-100`}>
              <p className={`text-2xl font-bold ${color}`}>{count}</p>
              <p className="text-slate-500 text-sm">{label}</p>
            </div>
          ))}
        </div>

        {/* Appointments table */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Appointment Records</h3>
            <span className="text-xs text-slate-400">{filtered.length} shown</span>
          </div>
          {filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Calendar className="text-slate-200 mx-auto mb-3" size={48} />
              <p className="text-slate-400 text-sm">No appointments found</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {filtered.map((appt, i) => (
                <motion.div
                  key={appt.appointment_id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Calendar size={18} className="text-violet-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-slate-800 text-sm font-semibold flex items-center gap-1">
                        <User size={12} className="text-slate-400" />
                        {appt.patient_name}
                      </span>
                      <span className="text-slate-300">→</span>
                      <span className="text-slate-600 text-sm flex items-center gap-1">
                        <Stethoscope size={12} className="text-slate-400" />
                        Dr. {appt.doctor_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-slate-400 text-xs">{appt.specialization}</span>
                      <span className="text-slate-300">·</span>
                      <span className="text-slate-400 text-xs italic">"{appt.reason}"</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 space-y-1">
                    <div className="flex items-center gap-1 text-slate-400 text-xs justify-end">
                      <Clock size={11} />
                      {new Date(appt.appointment_date).toLocaleDateString("en-IN", {
                        day: "numeric", month: "short", year: "numeric"
                      })}
                    </div>
                    <div className="flex items-center gap-1 text-slate-400 text-xs justify-end">
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
      </PageWrapper>
    </AdminLayout>
  );
}