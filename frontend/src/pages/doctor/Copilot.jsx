import { useState, useEffect } from "react";
import DoctorLayout from "../../components/DoctorLayout";
import { getCopilot, getDoctorPatients } from "../../api/api";
import {
  Brain, Loader2, AlertCircle,
  Stethoscope, Sparkles,
  Activity, AlertTriangle, Search
} from "lucide-react";

const SYMPTOM_TEMPLATES = [
  { label: "Respiratory",   text: "Fever 3 days, productive cough, shortness of breath, SpO2 96%, RR 22/min" },
  { label: "Cardiac",       text: "Chest pain radiating to left arm, diaphoresis, HR 118 bpm, BP 90/60" },
  { label: "Neuro",         text: "Sudden confusion, slurred speech, facial droop, left arm weakness, onset 45 min ago" },
  { label: "Abdominal",     text: "Severe RIF pain, nausea, vomiting, fever 38.8°C, guarding, rebound tenderness" },
  { label: "Sepsis screen", text: "HR 118, Temp 39.2°C, WBC 18.4, Lactate 3.1, hypotension, altered mental status" },
];

// ── Markdown renderer ─────────────────────
function MarkdownBlock({ text }) {
  if (!text) return null;

  // Parse the AI response into structured sections
  const lines = text.split("\n");
  const elements = [];
  let i = 0;
  let listBuffer = [];

  const flushList = (key) => {
    if (listBuffer.length > 0) {
      elements.push(
        <ul key={`list-${key}`} className="space-y-1 my-3">
          {listBuffer.map((item, j) => (
            <li key={j} className="flex items-start gap-2 text-sm text-slate-700">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
              <span dangerouslySetInnerHTML={{ __html: formatInline(item) }} />
            </li>
          ))}
        </ul>
      );
      listBuffer = [];
    }
  };

  const formatInline = (s) =>
    s
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-slate-800">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');

  while (i < lines.length) {
    const line = lines[i].trim();

    if (!line) {
      flushList(i);
      i++;
      continue;
    }

    // H3
    if (line.startsWith("### ")) {
      flushList(i);
      elements.push(
        <h3 key={i} className="flex items-center gap-2 font-bold text-slate-800 text-sm mt-5 mb-2 pb-1.5 border-b border-slate-100">
          <span className="w-1 h-4 bg-emerald-500 rounded-full flex-shrink-0" />
          {line.slice(4)}
        </h3>
      );
      i++; continue;
    }

    // H2
    if (line.startsWith("## ")) {
      flushList(i);
      elements.push(
        <h2 key={i} className="font-bold text-slate-800 text-base mt-5 mb-2">
          {line.slice(3)}
        </h2>
      );
      i++; continue;
    }

    // Numbered list item
    if (/^\d+\.\s/.test(line)) {
      flushList(i);
      const content = line.replace(/^\d+\.\s/, "");
      const num     = line.match(/^(\d+)/)[1];
      elements.push(
        <div key={i} className="flex items-start gap-3 my-2">
          <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
            {num}
          </span>
          <p className="text-sm text-slate-700 leading-relaxed flex-1"
            dangerouslySetInnerHTML={{ __html: formatInline(content) }} />
        </div>
      );
      i++; continue;
    }

    // Bullet
    if (line.startsWith("- ") || line.startsWith("* ")) {
      listBuffer.push(line.slice(2));
      i++; continue;
    }

    // Horizontal rule
    if (line === "---") {
      flushList(i);
      elements.push(<hr key={i} className="border-slate-100 my-3" />);
      i++; continue;
    }

    // Bold-only line (section label)
    if (line.startsWith("**") && line.endsWith("**") && !line.slice(2, -2).includes("**")) {
      flushList(i);
      elements.push(
        <p key={i} className="font-bold text-slate-800 text-sm mt-3 mb-1">{line.slice(2, -2)}</p>
      );
      i++; continue;
    }

    // Regular paragraph
    flushList(i);
    elements.push(
      <p key={i} className="text-sm text-slate-700 leading-relaxed my-1.5"
        dangerouslySetInnerHTML={{ __html: formatInline(line) }} />
    );
    i++;
  }

  flushList("end");
  return <div>{elements}</div>;
}

// ─────────────────────────────────────────
export default function Copilot() {
  const [patients,  setPatients]  = useState([]);
  const [patientId, setPatientId] = useState("");
  const [symptoms,  setSymptoms]  = useState("");
  const [response,  setResponse]  = useState("");
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");

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
      const res = await getCopilot({ symptoms, patient_id: patientId || null });
      setResponse(res.data.reply);
    } catch {
      setError("AI Copilot is temporarily unavailable. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DoctorLayout>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">AI Copilot</h1>
        <p className="text-slate-500 text-sm mt-1">
          AI-powered differential diagnosis · Enter symptoms for clinical decision support
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6">

        {/* ── LEFT: Input panel ── */}
        <div className="col-span-1 space-y-4">

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Patient selector */}
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
                  Symptoms & Clinical Findings
                </label>
                <textarea
                  required
                  rows={7}
                  placeholder={"Enter symptoms, vitals, and clinical findings...\n\nExample:\nFever 3 days, productive cough\nSpO2 96%, HR 104 bpm\nTemp 38.9°C"}
                  value={symptoms}
                  onChange={e => setSymptoms(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 resize-none font-mono leading-relaxed"
                />
                <p className="text-xs text-slate-400 mt-1 text-right">{symptoms.length} chars</p>
              </div>

              <button
                type="submit"
                disabled={loading || !symptoms.trim()}
                className="w-full flex items-center justify-center gap-2 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #059669, #047857)" }}
              >
                {loading
                  ? <><Loader2 size={16} className="animate-spin" /> Analysing...</>
                  : <><Brain size={16} /> Get Diagnosis</>
                }
              </button>
            </form>
          </div>

          {/* Quick scenario templates */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Quick Scenarios
            </h3>
            <div className="space-y-1.5">
              {SYMPTOM_TEMPLATES.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setSymptoms(s.text)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-xs rounded-xl transition-all border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50 group"
                >
                  <span className="w-16 text-[10px] font-bold text-slate-400 group-hover:text-emerald-600 uppercase tracking-wide flex-shrink-0">
                    {s.label}
                  </span>
                  <span className="text-slate-500 group-hover:text-emerald-700 truncate leading-relaxed">
                    {s.text.slice(0, 45)}...
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT: Response panel ── */}
        <div className="col-span-2">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
            style={{ minHeight: "520px" }}>

            {/* Panel header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100"
              style={{ background: "linear-gradient(135deg, #f0fdf4, #dcfce7)" }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #059669, #047857)" }}>
                <Sparkles size={16} className="text-white" />
              </div>
              <div>
                <p className="text-slate-800 text-sm font-bold">AI Clinical Decision Support</p>
                <p className="text-slate-500 text-xs">Differential diagnosis · Investigations · Red flags</p>
              </div>
              {response && !loading && (
                <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                  style={{ background: "rgba(5,150,105,0.1)", border: "1px solid rgba(5,150,105,0.2)" }}>
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                  <span className="text-emerald-700 text-[10px] font-semibold">Ready</span>
                </div>
              )}
            </div>

            <div className="p-6">
              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm mb-4">
                  <AlertCircle size={15} className="flex-shrink-0" /> {error}
                </div>
              )}

              {/* Empty state */}
              {!response && !loading && !error && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                    style={{ background: "rgba(5,150,105,0.06)", border: "1px dashed rgba(5,150,105,0.2)" }}>
                    <Stethoscope size={26} className="text-slate-300" />
                  </div>
                  <p className="text-slate-500 text-sm font-medium mb-1">Ready for clinical analysis</p>
                  <p className="text-slate-400 text-xs max-w-xs leading-relaxed">
                    Enter presenting symptoms and vitals on the left, or pick a quick scenario to see differential diagnosis, investigations, and red flags.
                  </p>
                  <div className="grid grid-cols-3 gap-3 mt-6 w-full max-w-sm">
                    {[
                      { icon: Activity,     label: "Differentials",    color: "text-blue-500",   bg: "bg-blue-50"   },
                      { icon: Search,       label: "Investigations",   color: "text-violet-500", bg: "bg-violet-50" },
                      { icon: AlertTriangle, label: "Red Flags",       color: "text-red-500",    bg: "bg-red-50"    },
                    ].map(({ icon: Icon, label, color, bg }) => (
                      <div key={label} className={`${bg} rounded-xl p-3 text-center`}>
                        <Icon size={18} className={`${color} mx-auto mb-1`} />
                        <p className="text-slate-600 text-xs font-medium">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Loading */}
              {loading && (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="relative mb-5">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                      style={{ background: "linear-gradient(135deg, #059669, #047857)" }}>
                      <Brain size={24} className="text-white" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-400 rounded-full flex items-center justify-center">
                      <Loader2 size={12} className="animate-spin text-white" />
                    </div>
                  </div>
                  <p className="text-slate-700 text-sm font-semibold mb-1">Analysing symptoms...</p>
                  <p className="text-slate-400 text-xs">Generating differential diagnoses</p>
                  <div className="flex gap-1.5 mt-4">
                    {[0, 150, 300].map(d => (
                      <div key={d} className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce"
                        style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                </div>
              )}

              {/* Response */}
              {response && !loading && (
                <div>
                  {/* Disclaimer */}
                  <div className="flex items-start gap-3 p-3.5 rounded-xl mb-5"
                    style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)" }}>
                    <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-amber-700 text-xs leading-relaxed">
                      AI-generated decision support only. Always apply clinical judgement.
                      This is not a substitute for professional diagnosis.
                    </p>
                  </div>

                  {/* Rendered markdown response */}
                  <div className="max-w-none">
                    <MarkdownBlock text={response} />
                  </div>

                  {/* New query button */}
                  <div className="mt-6 pt-4 border-t border-slate-100">
                    <button
                      onClick={() => { setResponse(""); setSymptoms(""); setPatientId(""); }}
                      className="flex items-center gap-2 text-sm text-slate-500 hover:text-emerald-600 transition-colors"
                    >
                      <Brain size={14} />
                      New clinical query
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DoctorLayout>
  );
}