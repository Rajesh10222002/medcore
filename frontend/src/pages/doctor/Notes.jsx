import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import DoctorLayout from "../../components/DoctorLayout";
import { getDoctorPatients, saveClinicalNote } from "../../api/api";
import { FileText, Save, Loader2 } from "lucide-react";
import { showSuccess, showError } from "../../components/shared/Toast";

const NOTE_TEMPLATES = [
  {
    label: "General Checkup",
    text:  "Patient presented for routine checkup. Vitals stable. No acute complaints. Continue current management."
  },
  {
    label: "Follow-up",
    text:  "Patient returns for follow-up. Previous symptoms have improved. Medication compliance reported as good."
  },
  {
    label: "New Complaint",
    text:  "Patient presents with new complaint of [symptom] for [duration]. Examination findings: [findings]. Assessment: [diagnosis]. Plan: [management]."
  },
];

export default function Notes() {
  const [searchParams]            = useSearchParams();
  const preselectedPatient         = searchParams.get("patient");
  const [patients,  setPatients]  = useState([]);
  const [patientId, setPatientId] = useState(preselectedPatient || "");
  const [noteText,  setNoteText]  = useState("");
  const [saving,    setSaving]    = useState(false);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    getDoctorPatients()
      .then(res => setPatients(res.data))
      .catch(() => showError("Failed to load patients"))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!patientId)       { showError("Please select a patient"); return; }
    if (!noteText.trim()) { showError("Please write a note");     return; }
    setSaving(true);
    try {
      await saveClinicalNote(patientId, { note_text: noteText });
      showSuccess("Note saved successfully.");
      setNoteText("");
    } catch (err) {
      showError(err.response?.data?.error || "Failed to save note");
    } finally {
      setSaving(false);
    }
  };

  const selectedPatient = patients.find(
    p => p.patient_id === parseInt(patientId)
  );

  return (
    <DoctorLayout>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Clinical Notes</h1>
        <p className="text-slate-500 text-sm mt-1">
          Write patient notes — saved automatically to medical records
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6">

        {/* Note editor */}
        <div className="col-span-2 space-y-4">

          {/* Patient selector */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">
              Select Patient
            </label>
            <select
              value={patientId}
              onChange={e => setPatientId(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
            >
              <option value="">Choose a patient...</option>
              {patients.map(p => (
                <option key={p.patient_id} value={p.patient_id}>
                  {p.first_name} {p.last_name} — {p.age}y {p.gender}
                </option>
              ))}
            </select>

            {selectedPatient && (
              <div className="mt-3 flex items-center gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-bold">
                    {selectedPatient.first_name[0]}{selectedPatient.last_name[0]}
                  </span>
                </div>
                <div>
                  <p className="text-emerald-800 text-sm font-medium">
                    {selectedPatient.first_name} {selectedPatient.last_name}
                  </p>
                  <p className="text-emerald-600 text-xs">
                    {selectedPatient.age}y · {selectedPatient.gender} · {selectedPatient.total_visits} visits
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Note textarea */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">
              Clinical Note
            </label>
            <textarea
              rows={12}
              placeholder="Write your clinical note here...

Example:
Patient presents with fever for 3 days, productive cough, and mild breathlessness.
Vitals: Temp 38.9°C, HR 104 bpm, RR 22/min, SpO2 96%.
Examination: Reduced air entry in right lower zone.
Assessment: Probable bacterial pneumonia (J18.9)
Plan: Amoxicillin 500mg TDS x 7 days, Paracetamol 650mg SOS, review in 5 days."
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              className="w-full px-3 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 resize-none font-mono leading-relaxed"
            />
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-slate-400">
                {noteText.length} characters
              </span>
              <button
                onClick={handleSave}
                disabled={saving || !noteText.trim() || !patientId}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {saving
                  ? <><Loader2 size={16} className="animate-spin" /> Saving...</>
                  : <><Save size={16} /> Save Note</>
                }
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="col-span-1 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">
              Quick Templates
            </h3>
            <div className="space-y-2">
              {NOTE_TEMPLATES.map((tmpl, i) => (
                <button
                  key={i}
                  onClick={() => setNoteText(tmpl.text)}
                  className="w-full text-left px-3 py-2.5 text-xs text-slate-600 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 rounded-xl transition-colors border border-slate-100 hover:border-emerald-100"
                >
                  {tmpl.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-900 to-emerald-900 rounded-2xl p-5">
            <p className="text-white/80 text-xs font-semibold uppercase tracking-wide mb-2">
              💡 Tips
            </p>
            <p className="text-white/70 text-xs leading-relaxed">
              Use templates as a starting point and customise for each patient.
              Be specific with symptoms, findings, and treatment plan.
            </p>
          </div>
        </div>
      </div>
    </DoctorLayout>
  );
}