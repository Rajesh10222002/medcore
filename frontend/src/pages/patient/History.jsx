import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PatientLayout from "../../components/PatientLayout";
import PageWrapper from "../../components/shared/PageWrapper";
import { SkeletonTable } from "../../components/shared/SkeletonCard";
import EmptyState from "../../components/shared/EmptyState";
import { showError } from "../../components/shared/Toast";
import { explainLab, getMyFHIR } from "../../api/api";
import {
  FileText, Pill, Activity, AlertTriangle,
  RefreshCw, Sparkles, Loader2, Heart,
  CheckCircle, Calendar, Info
} from "lucide-react";

const TABS = [
  { key: "conditions",   label: "Diagnoses",    icon: FileText,      color: "blue"   },
  { key: "medications",  label: "Medications",  icon: Pill,          color: "green"  },
  { key: "observations", label: "Vitals & Labs", icon: Activity,     color: "purple" },
  { key: "allergies",    label: "Allergies",    icon: AlertTriangle, color: "red"    },
];

const colorMap = {
  blue:   { bg: "rgba(59,130,246,0.08)",  text: "#2563eb", border: "rgba(59,130,246,0.2)",  iconBg: "bg-blue-50",   icon: "text-blue-600"   },
  green:  { bg: "rgba(16,185,129,0.08)",  text: "#059669", border: "rgba(16,185,129,0.2)",  iconBg: "bg-green-50",  icon: "text-green-600"  },
  purple: { bg: "rgba(124,58,237,0.08)",  text: "#7c3aed", border: "rgba(124,58,237,0.2)",  iconBg: "bg-purple-50", icon: "text-purple-600" },
  red:    { bg: "rgba(239,68,68,0.08)",   text: "#dc2626", border: "rgba(239,68,68,0.2)",   iconBg: "bg-red-50",    icon: "text-red-600"    },
};

// ── Lab row with AI explain ───────────────────────────────
function LabRow({ obs, i }) {
  const [explanation, setExplanation] = useState("");
  const [loading,     setLoading]     = useState(false);
  const [expanded,    setExpanded]    = useState(false);

  const handleExplain = async () => {
    if (explanation) { setExpanded(e => !e); return; }
    setLoading(true);
    try {
      const res = await explainLab({ name: obs.name, value: obs.value, unit: obs.unit });
      setExplanation(res.data.explanation);
      setExpanded(true);
    } catch {
      showError("Could not explain this result");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(i, 8) * 0.05 }}
      className="px-5 py-4 border-b border-slate-50 last:border-b-0"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-purple-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <Activity size={15} className="text-purple-600" />
          </div>
          <div>
            <p className="text-slate-800 text-sm font-semibold">{obs.name}</p>
            {obs.date && (
              <p className="text-slate-400 text-xs mt-0.5 flex items-center gap-1">
                <Calendar size={10} /> {obs.date?.slice(0, 10)}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {obs.value && (
            <div className="text-right">
              <span className="text-slate-800 text-base font-bold">{obs.value}</span>
              <span className="text-slate-400 text-xs ml-1">{obs.unit}</span>
            </div>
          )}
          <button
            onClick={handleExplain}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all"
            style={{
              background: expanded ? "rgba(124,58,237,0.12)" : "rgba(124,58,237,0.06)",
              color: "#7c3aed",
              border: "1px solid rgba(124,58,237,0.15)"
            }}
          >
            {loading
              ? <Loader2 size={11} className="animate-spin" />
              : <Sparkles size={11} />
            }
            {loading ? "Explaining..." : explanation ? (expanded ? "Hide" : "Show") : "Explain"}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {expanded && explanation && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 rounded-2xl px-4 py-3"
            style={{ background: "rgba(124,58,237,0.05)", border: "1px solid rgba(124,58,237,0.12)" }}
          >
            <div className="flex items-start gap-2">
              <Sparkles size={12} className="text-purple-500 flex-shrink-0 mt-0.5" />
              <p className="text-purple-700 text-xs leading-relaxed">{explanation}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────
export default function History() {
  const [fhirData,  setFhirData]  = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState("conditions");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadFHIR(); }, []);

  const loadFHIR = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await getMyFHIR();
      setFhirData(res.data);
    } catch {
      showError("Failed to load clinical history");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const activeData = fhirData?.[activeTab] || [];
  const activeTab_ = TABS.find(t => t.key === activeTab);
  const c          = colorMap[activeTab_?.color || "blue"];

  if (loading) return (
    <PatientLayout>
      <div className="mb-6">
        <div className="h-7 w-56 bg-slate-200 rounded-lg animate-pulse mb-2" />
        <div className="h-4 w-40 bg-slate-100 rounded-lg animate-pulse" />
      </div>
      <SkeletonTable rows={5} />
    </PatientLayout>
  );

  return (
    <PatientLayout>
      <PageWrapper>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Clinical History</h1>
            <p className="text-slate-500 text-sm mt-1">
              Your medical records — updated by your doctor after each visit
            </p>
          </div>
          <button
            onClick={() => loadFHIR(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {/* ── Summary stat cards ── */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {TABS.map((tab, i) => {
            const count  = fhirData?.[tab.key]?.length || 0;
            const cm     = colorMap[tab.color];
            const active = activeTab === tab.key;
            return (
              <motion.button
                key={tab.key}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 8) * 0.05 }}
                onClick={() => setActiveTab(tab.key)}
                className={`p-4 rounded-2xl text-left transition-all relative overflow-hidden ${active ? "" : "bg-white"}`}
                style={{
                  background: active ? cm.bg : undefined,
                  border:     `1px solid ${active ? cm.border : "rgba(226,232,240,1)"}`,
                  boxShadow:  active ? `0 4px 20px ${cm.bg}` : "0 1px 4px rgba(0,0,0,0.04)"
                }}
              >
                <div className={`w-9 h-9 ${cm.iconBg} rounded-xl flex items-center justify-center mb-3`}>
                  <tab.icon size={16} className={cm.icon} />
                </div>
                <p className="text-2xl font-bold text-slate-800">{count}</p>
                <p className="text-slate-500 text-xs mt-0.5">{tab.label}</p>
                {active && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                    style={{ background: cm.text }} />
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Blood group card if available */}
        {fhirData?.blood_group && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 flex items-center gap-3 px-5 py-3.5 rounded-2xl"
            style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.12)" }}
          >
            <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <Heart size={16} className="text-red-500" />
            </div>
            <div>
              <p className="text-slate-500 text-xs uppercase tracking-wide font-semibold">Blood Group</p>
              <p className="text-red-600 text-lg font-bold">{fhirData.blood_group}</p>
            </div>
          </motion.div>
        )}

        {/* ── Tab content card ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

          {/* Tab bar */}
          <div className="flex border-b border-slate-100 overflow-x-auto">
            {TABS.map(tab => {
              const cm     = colorMap[tab.color];
              const active = activeTab === tab.key;
              const count  = fhirData?.[tab.key]?.length || 0;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className="flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-all whitespace-nowrap border-b-2 flex-shrink-0"
                  style={{
                    color:       active ? cm.text : "#94a3b8",
                    borderColor: active ? cm.text : "transparent"
                  }}
                >
                  <tab.icon size={15} />
                  {tab.label}
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${active ? "" : "bg-slate-100"}`}
                    style={active
                      ? { background: cm.bg, color: cm.text }
                      : { color: "#94a3b8" }
                    }
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              {activeData.length === 0 ? (
                <EmptyState
                  icon={activeTab_?.icon}
                  title={`No ${activeTab_?.label.toLowerCase()} on record`}
                  message="Your doctor will update these after your next visit"
                  className="py-16"
                />
              ) : (

                // ── Conditions — timeline ──
                activeTab === "conditions" ? (
                  <div className="p-5 space-y-0">
                    {activeData.map((cond, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(i, 8) * 0.05 }}
                        className="flex gap-4 pb-5 last:pb-0"
                      >
                        <div className="flex flex-col items-center pt-1">
                          <div className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ background: "#2563eb" }} />
                          {i < activeData.length - 1 && (
                            <div className="w-px flex-1 bg-slate-200 mt-1.5" />
                          )}
                        </div>
                        <div className="flex-1 pb-1">
                          <p className="text-slate-800 text-sm font-semibold">{cond.display}</p>
                          <div className="flex items-center gap-3 mt-1">
                            {cond.code && (
                              <span className="text-xs px-2 py-0.5 rounded-lg font-medium"
                                style={{ background: "rgba(59,130,246,0.08)", color: "#2563eb" }}>
                                ICD: {cond.code}
                              </span>
                            )}
                            {cond.date && (
                              <span className="text-slate-400 text-xs flex items-center gap-1">
                                <Calendar size={10} /> {cond.date?.slice(0, 10)}
                              </span>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                // ── Medications ──
                ) : activeTab === "medications" ? (
                  <div className="divide-y divide-slate-50">
                    {activeData.map((med, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(i, 8) * 0.05 }}
                        className="flex items-center gap-4 px-5 py-4"
                      >
                        <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0">
                          <Pill size={16} className="text-green-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-800 text-sm font-semibold">{med.name}</p>
                          {med.date && (
                            <p className="text-slate-400 text-xs mt-0.5 flex items-center gap-1">
                              <Calendar size={10} /> {med.date?.slice(0, 10)}
                            </p>
                          )}
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold capitalize flex-shrink-0"
                          style={med.status === "active"
                            ? { background: "rgba(16,185,129,0.08)", color: "#059669", border: "1px solid rgba(16,185,129,0.2)" }
                            : { background: "#f8fafc", color: "#94a3b8", border: "1px solid #e2e8f0" }
                          }>
                          {med.status || "unknown"}
                        </span>
                      </motion.div>
                    ))}
                  </div>

                // ── Vitals & Labs ──
                ) : activeTab === "observations" ? (
                  <div className="divide-y divide-slate-50">
                    {activeData.map((obs, i) => (
                      <LabRow key={i} obs={obs} i={i} />
                    ))}
                  </div>

                // ── Allergies ──
                ) : (
                  <div className="divide-y divide-slate-50">
                    {activeData.map((allergy, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(i, 8) * 0.05 }}
                        className="flex items-center gap-4 px-5 py-4"
                      >
                        <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0">
                          <AlertTriangle size={16} className="text-red-500" />
                        </div>
                        <p className="flex-1 text-slate-800 text-sm font-semibold">{allergy.name}</p>
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold capitalize flex-shrink-0"
                          style={{
                            background: allergy.severity === "severe"   ? "rgba(239,68,68,0.08)"
                                      : allergy.severity === "moderate" ? "rgba(245,158,11,0.08)"
                                      : "rgba(16,185,129,0.08)",
                            color:      allergy.severity === "severe"   ? "#dc2626"
                                      : allergy.severity === "moderate" ? "#d97706"
                                      : "#059669",
                            border: `1px solid ${
                                      allergy.severity === "severe"   ? "rgba(239,68,68,0.2)"
                                      : allergy.severity === "moderate" ? "rgba(245,158,11,0.2)"
                                      : "rgba(16,185,129,0.2)"}`
                          }}>
                          {allergy.severity || "unknown"}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                )
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Info note */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-4 flex items-center gap-3 px-4 py-3 rounded-2xl"
          style={{ background: "rgba(148,163,184,0.06)", border: "1px solid rgba(148,163,184,0.15)" }}
        >
          <Info size={14} className="text-slate-400 flex-shrink-0" />
          <p className="text-xs text-slate-500">
            Clinical records are updated by your doctor after each visit. Contact your doctor if you notice any missing or incorrect information.
          </p>
        </motion.div>

      </PageWrapper>
    </PatientLayout>
  );
}