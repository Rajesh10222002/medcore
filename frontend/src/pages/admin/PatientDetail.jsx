import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AdminLayout from "../../components/AdminLayout";
import PageWrapper from "../../components/shared/PageWrapper";
import { SkeletonCard } from "../../components/shared/SkeletonCard";
import EmptyState from "../../components/shared/EmptyState";
import { showError } from "../../components/shared/Toast";
import { getAdminPatientDetail } from "../../api/api";
import {
  ArrowLeft, FileText, Pill,
  Activity, AlertTriangle, Calendar,
  Phone, Mail, User, UserX
} from "lucide-react";

export default function AdminPatientDetail() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getAdminPatientDetail(id)
      .then(res => setPatient(res.data))
      .catch(() => showError("Failed to load patient details"))
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

  if (!patient) return (
    <AdminLayout>
      <PageWrapper>
        <button
          onClick={() => navigate("/admin/patients")}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm mb-6 transition-colors"
        >
          <ArrowLeft size={16} /> Back to Patients
        </button>
        <EmptyState
          icon={UserX}
          title="Patient not found"
          message="This patient may have been removed, or the link is incorrect."
          className="py-20"
          action={
            <button
              onClick={() => navigate("/admin/patients")}
              className="px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white text-xs font-medium rounded-xl transition-colors"
            >
              Back to Patients
            </button>
          }
        />
      </PageWrapper>
    </AdminLayout>
  );

  return (
    <AdminLayout title={`${patient.first_name} ${patient.last_name}`} subtitle="Full clinical view">
      <PageWrapper>

        <button
          onClick={() => navigate("/admin/patients")}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm mb-6 transition-colors"
        >
          <ArrowLeft size={16} /> Back to Patients
        </button>

        {/* Patient header */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-4">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-400 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
              <span className="text-white text-xl font-bold">
                {patient?.first_name?.[0]}{patient?.last_name?.[0]}
              </span>
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-slate-800">
                {patient?.first_name} {patient?.last_name}
              </h1>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="text-slate-500 text-sm flex items-center gap-1">
                  <User size={12} /> {patient?.age} years · {patient?.gender}
                </span>
                <span className="text-slate-300">·</span>
                <span className="text-slate-500 text-sm flex items-center gap-1">
                  <Phone size={12} /> {patient?.phone}
                </span>
                <span className="text-slate-300">·</span>
                <span className="text-slate-500 text-sm flex items-center gap-1">
                  <Mail size={12} /> {patient?.email}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">

          {/* Diagnoses */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-3 p-5 border-b border-slate-100">
              <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                <FileText size={16} className="text-blue-600" />
              </div>
              <h3 className="font-semibold text-slate-800">Diagnoses</h3>
              <span className="text-xs text-slate-400">
                {patient?.fhir?.conditions?.length || 0}
              </span>
            </div>
            <div className="divide-y divide-slate-50 max-h-52 overflow-y-auto">
              {patient?.fhir?.conditions?.length === 0 ? (
                <EmptyState icon={FileText} title="No diagnoses recorded" className="py-6" size={28} />
              ) : (
                patient?.fhir?.conditions?.map((c, i) => (
                  <div key={i} className="p-4">
                    <p className="text-slate-800 text-sm font-medium">{c.display}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {c.code && <p className="text-slate-400 text-xs">ICD: {c.code}</p>}
                      {c.date && <p className="text-slate-400 text-xs">· {c.date?.slice(0,10)}</p>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Medications */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-3 p-5 border-b border-slate-100">
              <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
                <Pill size={16} className="text-green-600" />
              </div>
              <h3 className="font-semibold text-slate-800">Medications</h3>
              <span className="text-xs text-slate-400">
                {patient?.fhir?.medications?.length || 0}
              </span>
            </div>
            <div className="divide-y divide-slate-50 max-h-52 overflow-y-auto">
              {patient?.fhir?.medications?.length === 0 ? (
                <EmptyState icon={Pill} title="No medications recorded" className="py-6" size={28} />
              ) : (
                patient?.fhir?.medications?.map((m, i) => (
                  <div key={i} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-slate-800 text-sm font-medium">{m.name}</p>
                      {m.date && <p className="text-slate-400 text-xs mt-0.5">{m.date?.slice(0,10)}</p>}
                    </div>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full border ${
                      m.status === "active"
                        ? "bg-green-50 text-green-600 border-green-100"
                        : "bg-slate-50 text-slate-500 border-slate-100"
                    }`}>
                      {m.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Allergies */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-3 p-5 border-b border-slate-100">
              <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
                <AlertTriangle size={16} className="text-red-600" />
              </div>
              <h3 className="font-semibold text-slate-800">Allergies</h3>
              <span className="text-xs text-slate-400">
                {patient?.fhir?.allergies?.length || 0}
              </span>
            </div>
            <div className="divide-y divide-slate-50">
              {patient?.fhir?.allergies?.length === 0 ? (
                <EmptyState icon={AlertTriangle} title="No allergies recorded" className="py-6" size={28} />
              ) : (
                patient?.fhir?.allergies?.map((a, i) => (
                  <div key={i} className="p-4 flex items-center justify-between">
                    <p className="text-slate-800 text-sm font-medium">{a.name}</p>
                    <span className="text-xs text-red-600 bg-red-50 border border-red-100 px-2.5 py-0.5 rounded-full">
                      {a.severity}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Vitals */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-3 p-5 border-b border-slate-100">
              <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
                <Activity size={16} className="text-purple-600" />
              </div>
              <h3 className="font-semibold text-slate-800">Vitals & Observations</h3>
              <span className="text-xs text-slate-400">
                {patient?.fhir?.observations?.length || 0}
              </span>
            </div>
            <div className="divide-y divide-slate-50">
              {patient?.fhir?.observations?.length === 0 ? (
                <EmptyState icon={Activity} title="No vitals recorded yet" className="py-6" size={28} />
              ) : (
                patient?.fhir?.observations?.map((obs, i) => (
                  <div key={i} className="p-4 flex items-center justify-between">
                    <p className="text-slate-800 text-sm font-medium">{obs.name}</p>
                    <span className="text-slate-600 text-sm">{obs.value} {obs.unit}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Clinical notes */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm col-span-2">
            <div className="flex items-center gap-3 p-5 border-b border-slate-100">
              <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
                <FileText size={16} className="text-amber-600" />
              </div>
              <h3 className="font-semibold text-slate-800">Clinical Notes</h3>
              <span className="text-xs text-slate-400 ml-auto">
                {patient?.notes?.length || 0} notes
              </span>
            </div>
            <div className="divide-y divide-slate-50">
              {patient?.notes?.length === 0 ? (
                <EmptyState icon={FileText} title="No notes yet" className="py-8" size={28} />
              ) : (
                patient?.notes?.map(note => (
                  <div key={note.note_id} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        {note.note_type}
                      </span>
                      <span className="text-xs text-slate-400">{note.created_at?.slice(0,10)}</span>
                    </div>
                    <p className="text-slate-700 text-sm leading-relaxed">{note.note_text}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Visit history */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm col-span-2">
            <div className="flex items-center gap-3 p-5 border-b border-slate-100">
              <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                <Calendar size={16} className="text-slate-500" />
              </div>
              <h3 className="font-semibold text-slate-800">Visit History</h3>
              <span className="text-xs text-slate-400 ml-auto">
                {patient?.appointments?.length || 0} recent visits
              </span>
            </div>
            <div className="divide-y divide-slate-50">
              {patient?.appointments?.length === 0 ? (
                <EmptyState icon={Calendar} title="No visits recorded" className="py-8" size={28} />
              ) : (
                patient?.appointments?.map(appt => (
                  <div key={appt.appointment_id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-slate-800 text-sm font-medium">
                        {appt.appointment_date?.slice(0, 10)}
                      </p>
                      <p className="text-slate-400 text-xs mt-0.5">{appt.reason}</p>
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
      </PageWrapper>
    </AdminLayout>
  );
}
