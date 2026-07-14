import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import DoctorLayout from "../../components/DoctorLayout";
import { getDoctorPatients, saveClinicalNote, parseNote } from "../../api/api";
import {
  FileText, Save, Loader2,
  Sparkles, CheckCircle, Pill,
  Stethoscope, AlertCircle
} from "lucide-react";
import { showSuccess, showError } from "../../components/shared/Toast";

const NOTE_TEMPLATES = [
  {
    label: "General Checkup",
    text:  "Patient presented for routine checkup. Vitals stable. No acute complaints. Continue current management."
  },
  {
    label: "Follow-up Visit",
    text:  "Patient returns for follow-up. Previous symptoms have improved. Medication compliance reported as good."
  },
  {
    label: "Fever & Cough",
    text:  "Patient presents with fever for 3 days, productive cough, and mild breathlessness. Temp 38.9°C, HR 104 bpm, SpO2 96%. Assessment: Probable bacterial pneumonia (J18.9). Plan: Amoxicillin 500mg TDS x 7 days, Paracetamol 650mg SOS, review in 5 days."
  },
  {
    label: "Hypertension Review",
    text:  "Patient with known hypertension presents for review. BP 148/92 mmHg today. Currently on Amlodipine 5mg OD. Diagnosis: Essential hypertension (I10). Plan: Increase Amlodipine to 10mg OD, low-salt diet, review in 4 weeks."
  },
];

export default function Notes() {
  const [searchParams]              = useSearchParams();
  const preselectedPatient           = searchParams.get("patient");
  const [patients,    setPatients]  = useState([]);
  const [patientId,   setPatientId] = useState(preselectedPatient || "");
  const [noteText,    setNoteText]  = useState("");
  const [saving,      setSaving]    = useState(false);
  const [parsing,     setParsing]   = useState(false);
  const [loading,     setLoading]   = useState(true);
  const [parsed,      setParsed]    = useState(null);
  const [parseError,  setParseError] = useState("");

  useEffect(() => {
    getDoctorPatients()
      .then(res => setPatients(res.data))
      .catch(() => showError("Failed to load patients"))
      .finally(() => setLoading(false));
  }, []);

  // Clear parse results when patient or note changes
  useEffect(() => {
    setParsed(null);
    setParseError("");
  }, [patientId, noteText]);

  const handleParse = async () => {
    if (!noteText.trim()) { showError("Write a note first"); return; }
    setParsing(true);
    setParsed(null);
    setParseError("");
    try {
      const res = await parseNote({
        note_text:  noteText,
        patient_id: patientId || null
      });
      setParsed(res.data);
    } catch (err) {
      setParseError("Smart extract is unavailable right now. You can still save the note and add diagnoses manually.");
    } finally {
      setParsing(false);
    }
  };

  const handleSave = async () => {
    if (!patientId)       { showError("Please select a patient"); return; }
    if (!noteText.trim()) { showError("Please write a note");     return; }
    setSaving(true);
    try {
      await saveClinicalNote(patientId, { note_text: noteText });
      showSuccess("Note saved to patient record.");
      setNoteText("");
      setParsed(null);
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

      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Clinical Notes</h1>
        <p className="text-slate-500 text-sm mt-1">
          Write patient notes — diagnoses and medications are extracted automatically
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6">

        {/* ── Left: Note editor (2 cols) ── */}
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
                    {selectedPatient.age}y · {selectedPatient.gender} · {selectedPatient.total_visits} visit{selectedPatient.total_visits !== 1 ? "s" : ""}
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
              rows={10}
              placeholder="Write your clinical note here...

Example:
Patient presents with fever for 3 days, productive cough, and mild breathlessness.
Vitals: Temp 38.9°C, HR 104 bpm, RR 22/min, SpO2 96%.
Assessment: Probable bacterial pneumonia
Plan: Amoxicillin 500mg TDS x 7 days, Paracetamol 650mg SOS, review in 5 days."
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              className="w-full px-3 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 resize-none font-mono leading-relaxed"
            />
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-slate-400">
                {noteText.length} characters
              </span>
              <div className="flex items-center gap-2">
                {/* Smart Extract button */}
                <button
                  onClick={handleParse}
                  disabled={parsing || !noteText.trim()}
                  className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  {parsing
                    ? <><Loader2 size={15} className="animate-spin" /> Extracting...</>
                    : <><Sparkles size={15} /> Smart Extract</>
                  }
                </button>
                {/* Save button */}
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

          {/* Error message */}
          {parseError && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-start gap-3">
              <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-600 text-sm">{parseError}</p>
            </div>
          )}

          {/* Smart Extract results */}
          {parsed && (
            <div className="bg-white rounded-2xl border border-violet-100 shadow-sm overflow-hidden">

              {/* Result header */}
              <div className="flex items-center gap-2 px-5 py-4 bg-violet-50 border-b border-violet-100">
                <Sparkles size={16} className="text-violet-600" />
                <p className="text-violet-800 text-sm font-semibold">
                  Extracted from note
                </p>
                {(parsed.fhir_written?.diagnoses?.length > 0 ||
                  parsed.fhir_written?.medications?.length > 0) && (
                  <span className="ml-auto flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                    <CheckCircle size={12} />
                    Saved to patient record
                  </span>
                )}
              </div>

              <div className="p-5 grid grid-cols-2 gap-5">

                {/* Diagnoses */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Stethoscope size={15} className="text-blue-600" />
                    <p className="text-sm font-semibold text-slate-700">
                      Diagnoses
                    </p>
                  </div>
                  {!parsed.diagnoses || parsed.diagnoses.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">None found in note</p>
                  ) : (
                    <div className="space-y-2">
                      {parsed.diagnoses.map((dx, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 p-2.5 bg-blue-50 rounded-xl border border-blue-100"
                        >
                          <CheckCircle size={13} className="text-blue-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-blue-800 text-xs font-medium">{dx.display}</p>
                            {dx.icd_code && dx.icd_code !== "" && (
                              <p className="text-blue-400 text-xs mt-0.5">Code: {dx.icd_code}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Medications */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Pill size={15} className="text-green-600" />
                    <p className="text-sm font-semibold text-slate-700">
                      Medications
                    </p>
                  </div>
                  {!parsed.medications || parsed.medications.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">None found in note</p>
                  ) : (
                    <div className="space-y-2">
                      {parsed.medications.map((med, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 p-2.5 bg-green-50 rounded-xl border border-green-100"
                        >
                          <CheckCircle size={13} className="text-green-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-green-800 text-xs font-medium">{med.name}</p>
                            {(med.dosage || med.frequency) && (
                              <p className="text-green-600 text-xs mt-0.5">
                                {[med.dosage, med.frequency].filter(Boolean).join(" · ")}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom tip */}
              <div className="px-5 pb-4">
                <p className="text-xs text-slate-400">
                  Review the extracted items above. You can also add or edit them manually from the patient's detail page.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Sidebar (1 col) ── */}
        <div className="col-span-1 space-y-4">

          {/* Quick Templates */}
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

          {/* Tips card */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <FileText size={14} className="text-slate-300" />
              <p className="text-white/80 text-xs font-semibold uppercase tracking-wide">
                Writing Tips
              </p>
            </div>
            <ul className="space-y-2">
              {[
                "Include presenting complaints and duration",
                "Note vitals if recorded during the visit",
                "State your assessment clearly",
                "List medications with dosage and frequency",
              ].map((tip, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-emerald-400 text-xs mt-0.5">•</span>
                  <p className="text-white/60 text-xs leading-relaxed">{tip}</p>
                </li>
              ))}
            </ul>
          </div>

          {/* Smart Extract info — no technical details */}
          <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <Sparkles size={14} className="text-violet-600" />
              <p className="text-violet-800 text-xs font-semibold">Smart Extract</p>
            </div>
            <p className="text-violet-600 text-xs leading-relaxed">
              After writing your note, click <strong>Smart Extract</strong> to automatically pull out diagnoses and medications and add them to the patient record.
            </p>
          </div>

        </div>
      </div>
    </DoctorLayout>
  );
}