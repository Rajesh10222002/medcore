import { useState } from "react";
import DoctorLayout from "../../components/DoctorLayout";
import { getCopilot, getDoctorPatients } from "../../api/api";
import { useEffect } from "react";
import {
  Brain, Send, Loader2,
  AlertCircle, Stethoscope, Sparkles
} from "lucide-react";

const SYMPTOM_TEMPLATES = [
  "Fever 3 days, productive cough, shortness of breath, SpO2 96%",
  "Chest pain radiating to left arm, sweating, HR 118 bpm",
  "Sudden confusion, slurred speech, facial droop, arm weakness",
  "Severe abdominal pain, nausea, vomiting, fever 38.8°C",
  "HR 118, Temp 39.2°C, WBC 18.4, Lactate 3.1, hypotension",
];

export default function Copilot() {
  const [patients,   setPatients]   = useState([]);
  const [patientId,  setPatientId]  = useState("");
  const [symptoms,   setSymptoms]   = useState("");
  const [response,   setResponse]   = useState("");
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");

  useEffect(() => {
    getDoctorPatients()
      .then(res => setPatients(res.data))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!symptoms.trim()) return;

    setLoading(true);
    setError("");
    setResponse("");

    try {
      const res = await getCopilot({
        symptoms,
        patient_id: patientId || null
      });
      setResponse(res.data.reply);
    } catch (err) {
      setError("AI Copilot unavailable. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DoctorLayout>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">AI Copilot</h1>
        <p className="text-slate-500 text-sm mt-1">
          Gemini-powered differential diagnosis · Enter symptoms for clinical decision support
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6">

        {/* Input panel */}
        <div className="col-span-1 space-y-4">

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Optional patient */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Patient (Optional)
                </label>
                <select
                  value={patientId}
                  onChange={e => setPatientId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
                >
                  <option value="">General query</option>
                  {patients.map(p => (
                    <option key={p.patient_id} value={p.patient_id}>
                      {p.first_name} {p.last_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Symptoms */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Symptoms & Findings
                </label>
                <textarea
                  required
                  rows={6}
                  placeholder="Enter symptoms, vitals, and clinical findings..."
                  value={symptoms}
                  onChange={e => setSymptoms(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !symptoms.trim()}
                className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                {loading
                  ? <><Loader2 size={16} className="animate-spin" /> Analysing...</>
                  : <><Brain size={16} /> Get Diagnosis</>
                }
              </button>
            </form>
          </div>

          {/* Symptom templates */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">
              Quick Scenarios
            </h3>
            <div className="space-y-2">
              {SYMPTOM_TEMPLATES.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setSymptoms(s)}
                  className="w-full text-left px-3 py-2 text-xs text-slate-500 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 rounded-xl transition-colors border border-slate-100 hover:border-emerald-100 leading-relaxed"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Response panel */}
        <div className="col-span-2">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm h-full min-h-96">

            <div className="flex items-center gap-3 p-5 border-b border-slate-100">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-400 rounded-xl flex items-center justify-center">
                <Sparkles size={16} className="text-white" />
              </div>
              <div>
                <p className="text-slate-800 text-sm font-semibold">
                  AI Clinical Decision Support
                </p>
                <p className="text-slate-400 text-xs">Gemini 2.5 Flash</p>
              </div>
            </div>

            <div className="p-6">
              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm">
                  <AlertCircle size={16} />{error}
                </div>
              )}

              {!response && !loading && !error && (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
                    <Stethoscope size={28} className="text-slate-300" />
                  </div>
                  <p className="text-slate-400 text-sm">
                    Enter symptoms on the left to get AI-powered differential diagnosis
                  </p>
                  <p className="text-slate-300 text-xs mt-2">
                    Powered by Google Gemini 2.5 Flash
                  </p>
                </div>
              )}

              {loading && (
                <div className="flex flex-col items-center justify-center h-64">
                  <Loader2 className="animate-spin text-emerald-500 mb-4" size={32} />
                  <p className="text-slate-500 text-sm">
                    Analysing symptoms with Gemini...
                  </p>
                </div>
              )}

              {response && !loading && (
                <div className="prose prose-sm max-w-none">
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 mb-4">
                    <p className="text-xs text-emerald-700 font-medium">
                      ⚠️ AI-generated clinical decision support only.
                      Always apply clinical judgement. Not a substitute for diagnosis.
                    </p>
                  </div>
                  <div
                        className="text-slate-700 text-sm leading-relaxed"
                        dangerouslySetInnerHTML={{
                            __html: response
                            // Headers
                            .replace(/### (.*)/g, '<h3 class="font-bold text-slate-800 text-base mt-4 mb-2">$1</h3>')
                            .replace(/## (.*)/g, '<h2 class="font-bold text-slate-800 text-lg mt-4 mb-2">$1</h2>')
                            // Bold
                            .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-slate-800">$1</strong>')
                            // Bullets
                            .replace(/^\* (.*)/gm, '<li class="ml-4 mb-1">• $1</li>')
                            .replace(/^\d+\. (.*)/gm, '<li class="ml-4 mb-1 list-decimal">$1</li>')
                            // Dividers
                            .replace(/^---$/gm, '<hr class="border-slate-200 my-3"/>')
                            // Line breaks
                            .replace(/\n\n/g, '<br/><br/>')
                        }}
                        />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DoctorLayout>
  );
}