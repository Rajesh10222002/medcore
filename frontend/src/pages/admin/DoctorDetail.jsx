import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AdminLayout from "../../components/AdminLayout";
import PageWrapper from "../../components/shared/PageWrapper";
import { SkeletonCard } from "../../components/shared/SkeletonCard";
import EmptyState from "../../components/shared/EmptyState";
import { showError } from "../../components/shared/Toast";
import { getAdminDoctorDetail, getAdminDoctorFeedback } from "../../api/api";
import {
  ArrowLeft, Stethoscope, Award,
  Phone, Mail, Calendar,
  CheckCircle, XCircle, Clock, UserX, Star
} from "lucide-react";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function AdminDoctorDetail() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const [doctor,   setDoctor]   = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([getAdminDoctorDetail(id), getAdminDoctorFeedback(id)])
      .then(([dRes, fRes]) => { setDoctor(dRes.data); setFeedback(fRes.data); })
      .catch(() => showError("Failed to load doctor details"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <AdminLayout>
      <div className="h-4 w-32 bg-slate-100 rounded animate-pulse mb-6" />
      <SkeletonCard />
      <div className="grid grid-cols-2 gap-6 mt-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </AdminLayout>
  );

  if (!doctor) return (
    <AdminLayout>
      <PageWrapper>
        <button
          onClick={() => navigate("/admin/doctors")}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm mb-6 transition-colors"
        >
          <ArrowLeft size={16} /> Back to Doctors
        </button>
        <EmptyState
          icon={UserX}
          title="Doctor not found"
          message="This doctor may have been removed, or the link is incorrect."
          className="py-20"
          action={
            <button
              onClick={() => navigate("/admin/doctors")}
              className="px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white text-xs font-medium rounded-xl transition-colors"
            >
              Back to Doctors
            </button>
          }
        />
      </PageWrapper>
    </AdminLayout>
  );

  return (
    <AdminLayout title={`Dr. ${doctor.first_name} ${doctor.last_name}`} subtitle="Profile & schedule">
      <PageWrapper>

        <button
          onClick={() => navigate("/admin/doctors")}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm mb-6 transition-colors"
        >
          <ArrowLeft size={16} /> Back to Doctors
        </button>

        {/* Doctor header */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-4">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-400 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
              <span className="text-white text-xl font-bold">
                {doctor?.first_name?.[0]}{doctor?.last_name?.[0]}
              </span>
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-slate-800">
                Dr. {doctor?.first_name} {doctor?.last_name}
              </h1>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="text-slate-500 text-sm flex items-center gap-1">
                  <Stethoscope size={12} /> {doctor?.specialization}
                </span>
                <span className="text-slate-300">·</span>
                <span className="text-slate-500 text-sm flex items-center gap-1">
                  <Award size={12} /> {doctor?.license_number}
                </span>
                <span className="text-slate-300">·</span>
                <span className="text-slate-500 text-sm flex items-center gap-1">
                  <Phone size={12} /> {doctor?.phone}
                </span>
                <span className="text-slate-300">·</span>
                <span className="text-slate-500 text-sm flex items-center gap-1">
                  <Mail size={12} /> {doctor?.email}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          {[
            { icon: Calendar,    label: "Total",     value: doctor?.stats?.total,     color: "text-violet-600",  bg: "bg-violet-50"  },
            { icon: Clock,       label: "Scheduled", value: doctor?.stats?.scheduled, color: "text-blue-600",    bg: "bg-blue-50"    },
            { icon: CheckCircle, label: "Completed", value: doctor?.stats?.completed, color: "text-emerald-600", bg: "bg-emerald-50" },
            { icon: XCircle,     label: "Cancelled", value: doctor?.stats?.cancelled, color: "text-red-500",     bg: "bg-red-50"     },
            { icon: Star,        label: "Avg Rating", value: doctor?.avg_rating ?? "—", color: "text-amber-500",  bg: "bg-amber-50"   },
          ].map(({ icon: Icon, label, value, color, bg }) => (
            <div key={label} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-500 text-xs font-medium">{label}</span>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${bg}`}>
                  <Icon size={15} className={color} />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-800">{value ?? 0}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-6">

          {/* Weekly schedule */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-3 p-5 border-b border-slate-100">
              <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                <Clock size={16} className="text-slate-500" />
              </div>
              <h3 className="font-semibold text-slate-800">Weekly Schedule</h3>
            </div>
            <div className="divide-y divide-slate-50">
              {doctor?.schedule?.length === 0 ? (
                <EmptyState icon={Clock} title="No schedule configured" className="py-6" size={28} />
              ) : (
                doctor?.schedule?.map(s => (
                  <div key={s.day_of_week} className="p-4 flex items-center justify-between">
                    <span className="text-slate-800 text-sm font-medium">
                      {DAY_LABELS[s.day_of_week] || s.day_of_week}
                    </span>
                    <span className="text-slate-500 text-sm">
                      {s.start_time?.slice(0,5)} – {s.end_time?.slice(0,5)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent appointments */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-3 p-5 border-b border-slate-100">
              <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                <Calendar size={16} className="text-slate-500" />
              </div>
              <h3 className="font-semibold text-slate-800">Recent Appointments</h3>
            </div>
            <div className="divide-y divide-slate-50">
              {doctor?.recent_appointments?.length === 0 ? (
                <EmptyState icon={Calendar} title="No appointments yet" className="py-6" size={28} />
              ) : (
                doctor?.recent_appointments?.map(appt => (
                  <div key={appt.appointment_id} className="p-4 flex items-center justify-between">
                    <div>
                      <button
                        onClick={() => navigate(`/admin/patients/${appt.patient_id}`)}
                        className="text-slate-800 text-sm font-medium hover:text-violet-600 transition-colors"
                      >
                        {appt.patient_name}
                      </button>
                      <p className="text-slate-400 text-xs mt-0.5">
                        {appt.appointment_date?.slice(0, 10)} · {appt.reason}
                      </p>
                    </div>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium capitalize ${
                      appt.status === "scheduled" ? "bg-blue-50 text-blue-600" :
                      appt.status === "completed" ? "bg-green-50 text-green-600" :
                      "bg-red-50 text-red-500"
                    }`}>
                      {appt.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Patient feedback */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm mt-6">
          <div className="flex items-center gap-3 p-5 border-b border-slate-100">
            <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
              <Star size={16} className="text-amber-500" />
            </div>
            <h3 className="font-semibold text-slate-800">
              Patient Feedback
              {feedback?.feedback_count > 0 && (
                <span className="text-slate-400 font-normal ml-2 text-sm">
                  ({feedback.feedback_count}, avg {feedback.avg_rating})
                </span>
              )}
            </h3>
          </div>
          <div className="divide-y divide-slate-50">
            {!feedback?.feedback?.length ? (
              <EmptyState icon={Star} title="No feedback yet" className="py-6" size={28} />
            ) : (
              feedback.feedback.map((f, i) => (
                <div key={i} className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-800 text-sm font-medium">{f.patient_name}</span>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map(n => (
                        <Star
                          key={n}
                          size={12}
                          className={n <= f.rating ? "text-amber-400 fill-amber-400" : "text-slate-200"}
                        />
                      ))}
                    </div>
                  </div>
                  {f.comment && <p className="text-slate-500 text-xs mt-1">{f.comment}</p>}
                  <p className="text-slate-300 text-xs mt-1">{f.created_at?.slice(0, 10)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </PageWrapper>
    </AdminLayout>
  );
}
