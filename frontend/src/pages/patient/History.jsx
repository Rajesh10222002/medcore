import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PatientLayout from "../../components/PatientLayout";
import PageWrapper from "../../components/shared/PageWrapper";
import { SkeletonTable } from "../../components/shared/SkeletonCard";
import { showError } from "../../components/shared/Toast";
import { explainLab } from "../../api/api";
import axios from "axios";
import {
  FileText, Pill, Activity,
  AlertTriangle, RefreshCw,
  Sparkles, Loader2, ChevronDown
} from "lucide-react";

const TABS = [
  { key: "conditions",   label: "Diagnoses",   icon: FileText,       color: "blue"   },
  { key: "medications",  label: "Medications", icon: Pill,           color: "green"  },
  { key: "observations", label: "Vitals & Labs",icon: Activity,      color: "purple" },
  { key: "allergies",    label: "Allergies",   icon: AlertTriangle,  color: "red"    },
];

const colorMap = {
  blue:   { bg: "bg-blue-50",   icon: "text-blue-600",   badge: "bg-blue-50 text-blue-600 border-blue-100"   },
  green:  { bg: "bg-green-50",  icon: "text-green-600",  badge: "bg-green-50 text-green-600 border-green-100" },
  purple: { bg: "bg-purple-50", icon: "text-purple-600", badge: "bg-purple-50 text-purple-600 border-purple-100" },
  red:    { bg: "bg-red-50",    icon: "text-red-600",    badge: "bg-red-50 text-red-600 border-red-100"       },
};

// Lab result row with Explain button
function LabRow({ obs }) {
  const [explanation, setExplanation] = useState("");
  const [loading,     setLoading]     = useState(false);
  const [expanded,    setExpanded]    = useState(false);

  const handleExplain = async () => {
    if (explanation) { setExpanded(!expanded); return; }
    setLoading(true);
    try {
      const res = await explainLab({
        name:  obs.name,
        value: obs.value,
        unit:  obs.unit
      });
      setExplanation(res.data.explanation);
      setExpanded(true);
    } catch {
      showError("Could not explain this result");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border-b border-slate-50 last:border-b-0">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-800 text-sm font-medium">{obs.name}</p>
          {obs.date && <p className="text-slate-400 text-xs mt-0.5">{obs.date?.slice(0,10)}</p>}
        </div>
        <div className="flex items-center gap-3">
          {obs.value && (
            <span className="text-slate-800 text-sm font-bold">
              {obs.value}
              <span className="text-slate-400 font-normal text-xs ml-1">{obs.unit}</span>
            </span>
          )}
          <button
            onClick={handleExplain}
            disabled={loading}
            className="flex items-center gap-1 px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-600 text-xs font-medium rounded-lg transition-colors border border-purple-100"
          >
            {loading
              ? <Loader2 size={12} className="animate-spin" />
              : <Sparkles size={12} />
            }
            {loading ? "..." : explanation ? (expanded ? "Hide" : "Show") : "Explain"}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {expanded && explanation && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 bg-purple-50 border border-purple-100 rounded-xl px-3 py-2.5"
          >
            <div className="flex items-start gap-2">
              <Sparkles size={12} className="text-purple-500 flex-shrink-0 mt-0.5" />
              <p className="text-purple-700 text-xs leading-relaxed">{explanation}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function History() {
  const [fhirData, setFhirData] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [activeTab, setActiveTab] = useState("conditions");

  useEffect(() => { loadFHIR(); }, []);

  const loadFHIR = async () => {
    try {
      setLoading(true);
      const res = await axios.get(
        `${import.meta.env.VITE_API_URL}/patients/me/fhir`,
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );
      setFhirData(res.data);
    } catch (err) {
      showError("Failed to load clinical history");
    } finally {
      setLoading(false);
    }
  };

  const activeData = fhirData?.[activeTab] || [];
  const activeTab_ = TABS.find(t => t.key === activeTab);
  const colors     = colorMap[activeTab_?.color || "blue"];

  if (loading) return (
    <PatientLayout>
      <div className="mb-6">
        <div className="h-8 w-56 bg-slate-200 rounded-lg animate-pulse mb-2" />
        <div className="h-4 w-40 bg-slate-100 rounded-lg animate-pulse" />
      </div>
      <SkeletonTable rows={5} />
    </PatientLayout>
  );

  return (
    <PatientLayout>
      <PageWrapper>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Clinical History</h1>
            <p className="text-slate-500 text-sm mt-1">
              Your medical records — updated by your doctor after each visit
            </p>
          </div>
          <button
            onClick={loadFHIR}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-500 hover:text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {TABS.map((tab, i) => {
            const count  = fhirData?.[tab.key]?.length || 0;
            const colors = colorMap[tab.color];
            return (
              <motion.button
                key={tab.key}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                onClick={() => setActiveTab(tab.key)}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  activeTab === tab.key
                    ? `${colors.bg} border-current shadow-sm`
                    : "bg-white border-slate-100 hover:border-slate-200"
                }`}
              >
                <div className={`w-8 h-8 ${colors.bg} rounded-lg flex items-center justify-center mb-2`}>
                  <tab.icon size={16} className={colors.icon} />
                </div>
                <p className="text-slate-800 text-lg font-bold">{count}</p>
                <p className="text-slate-500 text-xs">{tab.label}</p>
              </motion.button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          {/* Tab header */}
          <div className="flex border-b border-slate-100">
            {TABS.map(tab => {
              const colors_ = colorMap[tab.color];
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-all border-b-2 ${
                    activeTab === tab.key
                      ? `${colors_.icon} border-current`
                      : "text-slate-400 border-transparent hover:text-slate-600"
                  }`}
                >
                  <tab.icon size={15} />
                  {tab.label}
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    activeTab === tab.key ? colors_.bg : "bg-slate-100 text-slate-400"
                  }`}>
                    {fhirData?.[tab.key]?.length || 0}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {activeData.length === 0 ? (
                <div className="p-12 text-center">
                  <div className={`w-14 h-14 ${colors.bg} rounded-2xl flex items-center justify-center mx-auto mb-3`}>
                    {activeTab_?.icon && <activeTab_.icon size={24} className={colors.icon} />}
                  </div>
                  <p className="text-slate-500 text-sm font-medium">
                    No {activeTab_?.label.toLowerCase()} recorded yet
                  </p>
                  <p className="text-slate-300 text-xs mt-1">
                    Your doctor will add these after your visit
                  </p>
                </div>
              ) : (
                <div>
                  {activeTab === "observations" ? (
                    // Lab results with Explain button
                    activeData.map((obs, i) => (
                      <LabRow key={i} obs={obs} />
                    ))
                  ) : activeTab === "conditions" ? (
                    // Timeline view for diagnoses
                    <div className="p-4 space-y-0">
                      {activeData.map((c, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.06 }}
                          className="flex gap-4 pb-4"
                        >
                          <div className="flex flex-col items-center">
                            <div className="w-3 h-3 bg-blue-500 rounded-full mt-1 flex-shrink-0" />
                            {i < activeData.length - 1 && (
                              <div className="w-px flex-1 bg-slate-200 mt-1" />
                            )}
                          </div>
                          <div className="flex-1 pb-2">
                            <p className="text-slate-800 text-sm font-medium">{c.display}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {c.code && <span className="text-slate-400 text-xs">ICD: {c.code}</span>}
                              {c.date && <span className="text-slate-400 text-xs">· {c.date?.slice(0,10)}</span>}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : activeTab === "medications" ? (
                    activeData.map((m, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.06 }}
                        className="flex items-center justify-between p-4 border-b border-slate-50 last:border-b-0"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0">
                            <Pill size={16} className="text-green-600" />
                          </div>
                          <div>
                            <p className="text-slate-800 text-sm font-medium">{m.name}</p>
                            {m.date && <p className="text-slate-400 text-xs mt-0.5">{m.date?.slice(0,10)}</p>}
                          </div>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          m.status === "active"
                            ? "bg-green-50 text-green-600 border-green-100"
                            : "bg-slate-50 text-slate-500 border-slate-100"
                        }`}>
                          {m.status || "unknown"}
                        </span>
                      </motion.div>
                    ))
                  ) : (
                    // Allergies
                    activeData.map((a, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.06 }}
                        className="flex items-center justify-between p-4 border-b border-slate-50 last:border-b-0"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0">
                            <AlertTriangle size={16} className="text-red-500" />
                          </div>
                          <p className="text-slate-800 text-sm font-medium">{a.name}</p>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium border bg-red-50 text-red-600 border-red-100">
                          {a.severity || "unknown"}
                        </span>
                      </motion.div>
                    ))
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Info note */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-4 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-2"
        >
          <span className="text-lg">ℹ️</span>
          <p className="text-xs text-slate-500">
            Your clinical records are updated by your doctor after each visit.
            Contact your doctor if you notice any missing information.
          </p>
        </motion.div>

      </PageWrapper>
    </PatientLayout>
  );
}