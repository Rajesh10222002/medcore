import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import DoctorLayout from "../../components/DoctorLayout";
import PageWrapper from "../../components/shared/PageWrapper";
import { SkeletonCard } from "../../components/shared/SkeletonCard";
import EmptyState from "../../components/shared/EmptyState";
import Modal from "../../components/shared/Modal";
import {
  getDoctorPatient, saveVitals,
  getPatientSummaryAI, checkDrugInteractions,
  addDiagnosis, addMedication, addAllergy,
  setBloodGroup, getBloodGroup
} from "../../api/api";
import { showSuccess, showError } from "../../components/shared/Toast";
import {
  ArrowLeft, FileText, Pill,
  Activity, AlertTriangle, Loader2,
  CheckCircle, AlertCircle, Plus,
  Sparkles, ShieldAlert,
  ChevronDown, ChevronUp, Calendar,
  Heart, Wind, Thermometer, Droplets, UserX
} from "lucide-react";

// ── Vitals card ─────────────────────────
function VitalCard({ icon: Icon, label, value, unit, color, bg }) {
  return (
    <div className={`${bg} rounded-xl p-3 text-center`}>
      <Icon size={16} className={`${color} mx-auto mb-1`} />
      <p className={`text-lg font-bold ${color}`}>{value || "—"}</p>
      <p className="text-xs text-slate-500">{unit}</p>
      <p className="text-xs text-slate-400 mt-0.5">{label}</p>
    </div>
  );
}

const BACK_TARGETS = {
  schedule:  { to: "/doctor/schedule",  label: "Back to Schedule"  },
  dashboard: { to: "/doctor",           label: "Back to Dashboard" },
};

export default function PatientDetail() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { to: backTarget, label: backLabel } =
    BACK_TARGETS[searchParams.get("from")] || { to: "/doctor/patients", label: "Back to Patients" };

  // ── STATE ──────────────────────────────
  const [patient,        setPatient]        = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [showVitals,     setShowVitals]     = useState(false);
  const [savingVitals,   setSavingVitals]   = useState(false);
  const [vitalsForm,     setVitalsForm]     = useState({
    heart_rate: "", systolic_bp: "", diastolic_bp: "",
    temperature: "", respiratory_rate: "", oxygen_saturation: ""
  });
  const [aiSummary,      setAiSummary]      = useState("");
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [drugCheck,      setDrugCheck]      = useState(null);
  const [checkingDrugs,  setCheckingDrugs]  = useState(false);
  const [showVitalsHistory, setShowVitalsHistory] = useState(false);

  // Add modals
  const [showAddDiagnosis,  setShowAddDiagnosis]  = useState(false);
  const [showAddMedication, setShowAddMedication] = useState(false);
  const [showAddAllergy,    setShowAddAllergy]     = useState(false);
  const [showBloodGroup,    setShowBloodGroup]     = useState(false);

  // Add forms
  const [diagnosisForm,  setDiagnosisForm]  = useState({ display: "", code: "" });
  const [medicationForm, setMedicationForm] = useState({ name: "", dosage: "", frequency: "" });
  const [allergyForm,    setAllergyForm]    = useState({ name: "", severity: "mild" });
  const [bloodGroupForm, setBloodGroupForm] = useState({ blood_group: "" });
  const [saving,         setSaving]         = useState(false);

  // Blood group state
  const [bloodGroup,     setBloodGroup_]    = useState(null);
  const [savingBG,       setSavingBG]       = useState(false);

  // ── LOAD ───────────────────────────────
  useEffect(() => { loadPatient(); }, [id]);

  // Auto-load AI summary after patient data loads
  useEffect(() => {
    if (id) {
      setLoadingSummary(true);
      getPatientSummaryAI(id)
        .then(res => setAiSummary(res.data.summary))
        .catch(() => setAiSummary(""))
        .finally(() => setLoadingSummary(false));
    }
  }, [id]);

  // Auto-load blood group
  useEffect(() => {
    if (id) {
      getBloodGroup(id)
        .then(res => setBloodGroup_(res.data.blood_group))
        .catch(() => {});
    }
  }, [id]);

  const loadPatient = async () => {
    try {
      setLoading(true);
      const res = await getDoctorPatient(id);
      setPatient(res.data);
    } catch {
      showError("Failed to load patient details");
    } finally {
      setLoading(false);
    }
  };

  // ── VITALS ─────────────────────────────
  const handleSaveVitals = async (e) => {
    e.preventDefault();
    setSavingVitals(true);
    try {
      await saveVitals(id, vitalsForm);
      showSuccess("Vitals recorded successfully.");
      setShowVitals(false);
      setVitalsForm({
        heart_rate: "", systolic_bp: "", diastolic_bp: "",
        temperature: "", respiratory_rate: "", oxygen_saturation: ""
      });
      loadPatient();
    } catch {
      showError("Failed to save vitals");
    } finally {
      setSavingVitals(false);
    }
  };

  // ── ADD DIAGNOSIS ──────────────────────
  const handleAddDiagnosis = async () => {
    if (!diagnosisForm.display.trim()) {
      showError("Diagnosis name required"); return;
    }
    setSaving(true);
    try {
      await addDiagnosis(id, diagnosisForm);
      showSuccess("Diagnosis added successfully.");
      setShowAddDiagnosis(false);
      setDiagnosisForm({ display: "", code: "" });
      loadPatient();
    } catch {
      showError("Failed to add diagnosis");
    } finally {
      setSaving(false);
    }
  };

  // ── ADD MEDICATION ─────────────────────
  const handleAddMedication = async () => {
    if (!medicationForm.name.trim()) {
      showError("Medication name required"); return;
    }
    setSaving(true);
    try {
      await addMedication(id, medicationForm);
      showSuccess("Medication added successfully.");
      setShowAddMedication(false);
      setMedicationForm({ name: "", dosage: "", frequency: "" });
      loadPatient();
    } catch {
      showError("Failed to add medication");
    } finally {
      setSaving(false);
    }
  };

  // ── ADD ALLERGY ────────────────────────
  const handleAddAllergy = async () => {
    if (!allergyForm.name.trim()) {
      showError("Allergy name required"); return;
    }
    setSaving(true);
    try {
      await addAllergy(id, allergyForm);
      showSuccess("Allergy added successfully.");
      setShowAddAllergy(false);
      setAllergyForm({ name: "", severity: "mild" });
      loadPatient();
    } catch {
      showError("Failed to add allergy");
    } finally {
      setSaving(false);
    }
  };

  // ── BLOOD GROUP ────────────────────────
  const handleSaveBloodGroup = async () => {
    if (!bloodGroupForm.blood_group) {
      showError("Please select a blood group"); return;
    }
    setSavingBG(true);
    try {
      await setBloodGroup(id, bloodGroupForm);
      showSuccess(`Blood group ${bloodGroupForm.blood_group} saved to patient record.`);
      setBloodGroup_(bloodGroupForm.blood_group);
      setShowBloodGroup(false);
      setBloodGroupForm({ blood_group: "" });
    } catch {
      showError("Failed to save blood group");
    } finally {
      setSavingBG(false);
    }
  };

  // ── AI ─────────────────────────────────
  const generateSummary = async () => {
    setLoadingSummary(true);
    try {
      const res = await getPatientSummaryAI(id);
      setAiSummary(res.data.summary);
    } catch {
      setAiSummary("Unable to generate summary.");
    } finally {
      setLoadingSummary(false);
    }
  };

  const checkDrugs = async () => {
    if (!patient?.fhir?.medications?.length) return;
    setCheckingDrugs(true);
    try {
      const meds = patient.fhir.medications.map(m => m.name);
      const res  = await checkDrugInteractions({ medications: meds });
      setDrugCheck(res.data);
    } catch {
      showError("Drug check unavailable");
    } finally {
      setCheckingDrugs(false);
    }
  };

  // ── VITALS GROUPING ────────────────────
  const observations = patient?.fhir?.observations || [];

  // Group by date
  const groupedVitals = observations.reduce((acc, obs) => {
    const dateKey = obs.date?.slice(0, 10) || "Unknown date";
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(obs);
    return acc;
  }, {});

  // Sort dates newest first
  const sortedDates = Object.keys(groupedVitals).sort((a, b) =>
    b.localeCompare(a)
  );

  const latestDate   = sortedDates[0];
  const latestVitals = latestDate ? groupedVitals[latestDate] : [];
  const historyDates = sortedDates.slice(1);

  // Map vital name to card config
  const vitalConfig = {
    "Heart rate":               { icon: Heart,       color: "text-red-600",    bg: "bg-red-50",    unit: "bpm"  },
    "Systolic blood pressure":  { icon: Activity,    color: "text-blue-600",   bg: "bg-blue-50",   unit: "mmHg" },
    "Diastolic blood pressure": { icon: Activity,    color: "text-blue-500",   bg: "bg-blue-50",   unit: "mmHg" },
    "Body temperature":         { icon: Thermometer, color: "text-orange-600", bg: "bg-orange-50", unit: "°C"   },
    "Respiratory rate":         { icon: Wind,        color: "text-sky-600",    bg: "bg-sky-50",    unit: "/min" },
    "Oxygen saturation":        { icon: Droplets,    color: "text-purple-600", bg: "bg-purple-50", unit: "%"    },
  };

  // ── LOADING ────────────────────────────
  if (loading) return (
    <DoctorLayout>
      <div className="h-4 w-32 bg-slate-100 rounded animate-pulse mb-6" />
      <SkeletonCard />
      <div className="grid grid-cols-2 gap-6 mt-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </DoctorLayout>
  );

  // ── NOT FOUND ──────────────────────────
  if (!patient) return (
    <DoctorLayout>
      <PageWrapper>
        <button
          onClick={() => navigate("/doctor/patients")}
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
              onClick={() => navigate("/doctor/patients")}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium rounded-xl transition-colors"
            >
              Back to Patients
            </button>
          }
        />
      </PageWrapper>
    </DoctorLayout>
  );

  return (
    <DoctorLayout title={`${patient.first_name} ${patient.last_name}`} subtitle="Full clinical view">
      <PageWrapper>

      {/* Back */}
      <button
        onClick={() => navigate(backTarget)}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm mb-6 transition-colors"
      >
        <ArrowLeft size={16} /> {backLabel}
      </button>

      {/* Patient header */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-4">
        <div className="flex items-center gap-5 flex-wrap">
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-400 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
            <span className="text-white text-xl font-bold">
              {patient?.first_name?.[0]}{patient?.last_name?.[0]}
            </span>
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-800">
              {patient?.first_name} {patient?.last_name}
            </h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-slate-500 text-sm">
                {(() => {
                  // If backend returns 0, calculate from date_of_birth
                  if (patient?.age && patient.age > 0) return `${patient.age} years`;
                  if (patient?.date_of_birth) {
                    const dob  = new Date(patient.date_of_birth);
                    const today = new Date();
                    const age   = today.getFullYear() - dob.getFullYear() -
                      (today < new Date(today.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0);
                    return age > 0 ? `${age} years` : "Age unknown";
                  }
                  return "Age unknown";
                })()} · {patient?.gender}
              </span>
              <span className="text-slate-300">·</span>
              <span className="text-slate-500 text-sm">{patient?.phone}</span>
              <span className="text-slate-300">·</span>
              <span className="text-slate-500 text-sm">{patient?.email}</span>
              {/* Blood group badge */}
              {bloodGroup && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-100">
                    <Heart size={11} /> {bloodGroup}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
            <button
              onClick={() => setShowVitals(true)}
              className="flex items-center gap-2 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <Plus size={15} /> Vitals
            </button>
            <button
              onClick={() => setShowAddDiagnosis(true)}
              className="flex items-center gap-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <Plus size={15} /> Diagnosis
            </button>
            <button
              onClick={() => setShowAddMedication(true)}
              className="flex items-center gap-2 px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <Plus size={15} /> Medication
            </button>
            <button
              onClick={() => setShowAddAllergy(true)}
              className="flex items-center gap-2 px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <Plus size={15} /> Allergy
            </button>
            <button
              onClick={() => setShowBloodGroup(true)}
              className="flex items-center gap-2 px-3 py-2 bg-rose-500 hover:bg-rose-600 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <Heart size={15} /> Blood Group
            </button>
            <button
              onClick={() => navigate(`/doctor/notes?patient=${id}`)}
              className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <FileText size={15} /> Note
            </button>
          </div>
        </div>
      </div>

      {/* AI Summary */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-gradient-to-r from-slate-900 to-emerald-900 rounded-2xl p-5 mb-6"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-emerald-400" />
            <p className="text-white/80 text-xs font-semibold uppercase tracking-wide">
              AI Clinical Summary
            </p>
          </div>
          <button
            onClick={generateSummary}
            disabled={loadingSummary}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {loadingSummary
              ? <><Loader2 size={12} className="animate-spin" /> Generating...</>
              : <><Sparkles size={12} /> Generate Summary</>
            }
          </button>
        </div>
        {aiSummary ? (
          <div
            className="text-white/90 text-sm leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: aiSummary
                .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>')
                .replace(/\n/g, "<br/>")
            }}
          />
        ) : (
          <p className="text-white/40 text-sm italic">
            Click "Generate Summary" for an AI-powered clinical overview.
          </p>
        )}
      </motion.div>

      {/* ── VITALS SECTION ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm mb-6">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
              <Activity size={16} className="text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Vitals & Observations</h3>
              {latestDate && (
                <p className="text-xs text-slate-400 mt-0.5">
                  Latest: {new Date(latestDate).toLocaleDateString("en-IN", {
                    day: "numeric", month: "short", year: "numeric"
                  })}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowVitals(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-medium rounded-lg transition-colors"
          >
            <Plus size={12} /> Record Vitals
          </button>
        </div>

        {latestVitals.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No vitals recorded yet"
            message='Click "Record Vitals" to add the first reading'
            className="py-8"
            size={32}
          />
        ) : (
          <div className="p-5">
            {/* Latest vitals as cards */}
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Latest Reading — {new Date(latestDate).toLocaleDateString("en-IN", {
                day: "numeric", month: "long", year: "numeric"
              })}
            </p>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {latestVitals.map((obs, i) => {
                const cfg = vitalConfig[obs.name] || {
                  icon: Activity, color: "text-slate-600",
                  bg: "bg-slate-50", unit: obs.unit
                };
                return (
                  <VitalCard
                    key={i}
                    icon={cfg.icon}
                    label={obs.name}
                    value={obs.value}
                    unit={obs.unit || cfg.unit}
                    color={cfg.color}
                    bg={cfg.bg}
                  />
                );
              })}
            </div>

            {/* History toggle */}
            {historyDates.length > 0 && (
              <div>
                <button
                  onClick={() => setShowVitalsHistory(!showVitalsHistory)}
                  className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 transition-colors"
                >
                  {showVitalsHistory
                    ? <><ChevronUp size={14} /> Hide previous readings</>
                    : <><ChevronDown size={14} /> View {historyDates.length} previous reading{historyDates.length > 1 ? "s" : ""}</>
                  }
                </button>

                <AnimatePresence>
                  {showVitalsHistory && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 space-y-3"
                    >
                      {historyDates.map(date => (
                        <div key={date} className="border border-slate-100 rounded-xl p-4">
                          <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1">
                            <Calendar size={11} />
                            {new Date(date).toLocaleDateString("en-IN", {
                              day: "numeric", month: "short", year: "numeric"
                            })}
                          </p>
                          <div className="grid grid-cols-3 gap-2">
                            {groupedVitals[date].map((obs, i) => (
                              <div key={i} className="flex justify-between text-xs py-1 border-b border-slate-50">
                                <span className="text-slate-500">{obs.name}</span>
                                <span className="text-slate-800 font-medium">
                                  {obs.value} {obs.unit}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-2 gap-6">

        {/* Diagnoses */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                <FileText size={16} className="text-blue-600" />
              </div>
              <h3 className="font-semibold text-slate-800">Diagnoses</h3>
              <span className="text-xs text-slate-400">
                {patient?.fhir?.conditions?.length || 0}
              </span>
            </div>
            <button
              onClick={() => setShowAddDiagnosis(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-medium rounded-lg transition-colors"
            >
              <Plus size={12} /> Add
            </button>
          </div>
          <div className="divide-y divide-slate-50 max-h-52 overflow-y-auto">
            {patient?.fhir?.conditions?.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No diagnoses recorded"
                message='Click "Add" to record a diagnosis'
                className="py-6"
                size={28}
              />
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
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
                <Pill size={16} className="text-green-600" />
              </div>
              <h3 className="font-semibold text-slate-800">Medications</h3>
              <span className="text-xs text-slate-400">
                {patient?.fhir?.medications?.length || 0}
              </span>
            </div>
            <button
              onClick={() => setShowAddMedication(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-green-50 hover:bg-green-100 text-green-600 text-xs font-medium rounded-lg transition-colors"
            >
              <Plus size={12} /> Add
            </button>
          </div>
          <div className="divide-y divide-slate-50 max-h-52 overflow-y-auto">
            {patient?.fhir?.medications?.length === 0 ? (
              <EmptyState
                icon={Pill}
                title="No medications recorded"
                message='Click "Add" to prescribe a medication'
                className="py-6"
                size={28}
              />
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

        {/* Drug checker */}
        {patient?.fhir?.medications?.length >= 2 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm col-span-2">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
                  <ShieldAlert size={16} className="text-amber-600" />
                </div>
                <h3 className="font-semibold text-slate-800">Drug Interaction Check</h3>
              </div>
              <button
                onClick={checkDrugs}
                disabled={checkingDrugs}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {checkingDrugs
                  ? <><Loader2 size={12} className="animate-spin" /> Checking...</>
                  : <><ShieldAlert size={12} /> Check Interactions</>
                }
              </button>
            </div>
            {drugCheck && (
              <div className="p-4 space-y-2">
                {drugCheck.safe ? (
                  <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl p-3">
                    <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
                    <p className="text-green-700 text-sm">{drugCheck.summary}</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl p-3">
                      <AlertCircle size={16} className="text-red-600 flex-shrink-0" />
                      <p className="text-red-700 text-sm font-medium">{drugCheck.summary}</p>
                    </div>
                    {drugCheck.interactions?.map((inter, i) => (
                      <div key={i} className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                        <p className="text-amber-800 text-sm font-medium">{inter.drugs}</p>
                        <p className="text-amber-600 text-xs mt-1">{inter.description}</p>
                        <span className={`inline-block mt-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                          inter.severity === "severe"   ? "bg-red-100 text-red-600"
                          : inter.severity === "moderate" ? "bg-amber-100 text-amber-700"
                          : "bg-yellow-100 text-yellow-700"
                        }`}>
                          {inter.severity}
                        </span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Allergies */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
                <AlertTriangle size={16} className="text-red-600" />
              </div>
              <h3 className="font-semibold text-slate-800">Allergies</h3>
              <span className="text-xs text-slate-400">
                {patient?.fhir?.allergies?.length || 0}
              </span>
            </div>
            <button
              onClick={() => setShowAddAllergy(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-medium rounded-lg transition-colors"
            >
              <Plus size={12} /> Add
            </button>
          </div>
          <div className="divide-y divide-slate-50">
            {patient?.fhir?.allergies?.length === 0 ? (
              <EmptyState
                icon={AlertTriangle}
                title="No allergies recorded"
                message='Click "Add" to record an allergy'
                className="py-6"
                size={28}
              />
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
              <EmptyState
                icon={FileText}
                title="No notes yet"
                className="py-8"
                size={28}
                action={
                  <button
                    onClick={() => navigate(`/doctor/notes?patient=${id}`)}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium rounded-xl transition-colors"
                  >
                    Write First Note
                  </button>
                }
              />
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
              <EmptyState
                icon={Calendar}
                title="No visits recorded"
                className="py-8"
                size={28}
              />
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

      {/* ── VITALS MODAL ── */}
      <AnimatePresence>
        {showVitals && (
          <Modal title="Record Vitals" onClose={() => setShowVitals(false)}>
            <form onSubmit={handleSaveVitals} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "heart_rate",        label: "Heart Rate",       unit: "bpm",  placeholder: "60-100"    },
                  { key: "systolic_bp",        label: "Systolic BP",      unit: "mmHg", placeholder: "90-140"    },
                  { key: "diastolic_bp",       label: "Diastolic BP",     unit: "mmHg", placeholder: "60-90"     },
                  { key: "temperature",        label: "Temperature",      unit: "°C",   placeholder: "36.5-37.5" },
                  { key: "respiratory_rate",   label: "Respiratory Rate", unit: "/min", placeholder: "12-20"     },
                  { key: "oxygen_saturation",  label: "SpO2",             unit: "%",    placeholder: "95-100"    },
                ].map(({ key, label, unit, placeholder }) => (
                  <div key={key}>
                    <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
                      {label} <span className="text-slate-400 normal-case font-normal">({unit})</span>
                    </label>
                    <input
                      type="number" step="0.1" placeholder={placeholder}
                      value={vitalsForm[key]}
                      onChange={e => setVitalsForm({ ...vitalsForm, [key]: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
                    />
                  </div>
                ))}
              </div>
              <button
                type="submit" disabled={savingVitals}
                className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors mt-2"
              >
                {savingVitals
                  ? <><Loader2 size={16} className="animate-spin" /> Saving...</>
                  : <><CheckCircle size={16} /> Save Vitals</>
                }
              </button>
            </form>
          </Modal>
        )}
      </AnimatePresence>

      {/* ── ADD DIAGNOSIS MODAL ── */}
      <AnimatePresence>
        {showAddDiagnosis && (
          <Modal title="Add Diagnosis" onClose={() => setShowAddDiagnosis(false)}>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Diagnosis Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Community Acquired Pneumonia"
                  value={diagnosisForm.display}
                  onChange={e => setDiagnosisForm({ ...diagnosisForm, display: e.target.value })}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                  ICD Code <span className="text-slate-400 font-normal normal-case">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. J18.9"
                  value={diagnosisForm.code}
                  onChange={e => setDiagnosisForm({ ...diagnosisForm, code: e.target.value })}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                />
              </div>
              <button
                onClick={handleAddDiagnosis}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors"
              >
                {saving
                  ? <><Loader2 size={16} className="animate-spin" /> Saving...</>
                  : <><CheckCircle size={16} /> Save Diagnosis</>
                }
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* ── ADD MEDICATION MODAL ── */}
      <AnimatePresence>
        {showAddMedication && (
          <Modal title="Add Medication" onClose={() => setShowAddMedication(false)}>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Medication Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Amoxicillin"
                  value={medicationForm.name}
                  onChange={e => setMedicationForm({ ...medicationForm, name: e.target.value })}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Dosage <span className="text-slate-400 font-normal normal-case">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 500mg"
                  value={medicationForm.dosage}
                  onChange={e => setMedicationForm({ ...medicationForm, dosage: e.target.value })}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Frequency <span className="text-slate-400 font-normal normal-case">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. TDS x 7 days"
                  value={medicationForm.frequency}
                  onChange={e => setMedicationForm({ ...medicationForm, frequency: e.target.value })}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-slate-50"
                />
              </div>
              <button
                onClick={handleAddMedication}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors"
              >
                {saving
                  ? <><Loader2 size={16} className="animate-spin" /> Saving...</>
                  : <><CheckCircle size={16} /> Save Medication</>
                }
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* ── ADD ALLERGY MODAL ── */}
      <AnimatePresence>
        {showAddAllergy && (
          <Modal title="Add Allergy" onClose={() => setShowAddAllergy(false)}>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Allergy Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Penicillin"
                  value={allergyForm.name}
                  onChange={e => setAllergyForm({ ...allergyForm, name: e.target.value })}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Severity
                </label>
                <select
                  value={allergyForm.severity}
                  onChange={e => setAllergyForm({ ...allergyForm, severity: e.target.value })}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-slate-50"
                >
                  <option value="mild">Mild</option>
                  <option value="moderate">Moderate</option>
                  <option value="severe">Severe</option>
                </select>
              </div>
              <button
                onClick={handleAddAllergy}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors"
              >
                {saving
                  ? <><Loader2 size={16} className="animate-spin" /> Saving...</>
                  : <><CheckCircle size={16} /> Save Allergy</>
                }
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* ── Blood Group Modal ── */}
      <AnimatePresence>
        {showBloodGroup && (
          <Modal title="Set Blood Group" onClose={() => setShowBloodGroup(false)}>
            <div className="space-y-4">
              <p className="text-slate-500 text-sm">
                Select the patient's blood group. This will be saved to their health record and visible to them.
              </p>
              {/* Blood group grid */}
              <div className="grid grid-cols-4 gap-2">
                {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(bg => (
                  <button
                    key={bg}
                    onClick={() => setBloodGroupForm({ blood_group: bg })}
                    className={`py-3 rounded-xl text-sm font-bold transition-all ${
                      bloodGroupForm.blood_group === bg
                        ? "bg-rose-500 text-white shadow-lg shadow-rose-200"
                        : "bg-slate-50 text-slate-600 border border-slate-200 hover:border-rose-300 hover:bg-rose-50"
                    }`}
                  >
                    {bg}
                  </button>
                ))}
              </div>
              {/* Current blood group */}
              {bloodGroup && (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-rose-50 rounded-xl border border-rose-100">
                  <Heart size={14} className="text-rose-500" />
                  <p className="text-rose-700 text-sm">
                    Current blood group: <strong>{bloodGroup}</strong>
                  </p>
                </div>
              )}
              <button
                onClick={handleSaveBloodGroup}
                disabled={savingBG || !bloodGroupForm.blood_group}
                className="w-full flex items-center justify-center gap-2 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors"
              >
                {savingBG
                  ? <><Loader2 size={16} className="animate-spin" /> Saving...</>
                  : <><Heart size={16} /> Save Blood Group</>
                }
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      </PageWrapper>
    </DoctorLayout>
  );
}