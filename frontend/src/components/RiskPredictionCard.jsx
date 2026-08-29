import { useState, useEffect } from "react";
import axios from "axios";
import { Activity, TrendingUp, CalendarX } from "lucide-react";

const TIER_STYLES = {
  "Low Risk":    { bg: "bg-emerald-50", color: "text-emerald-600", border: "border-emerald-100" },
  "Medium Risk": { bg: "bg-amber-50",   color: "text-amber-600",   border: "border-amber-100"   },
  "High Risk":   { bg: "bg-red-50",     color: "text-red-600",     border: "border-red-100"     },
};

function RiskRow({ icon: Icon, label, risk }) {
  const isHigh = risk.level === "High";
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isHigh ? "bg-red-50" : "bg-emerald-50"}`}>
        <Icon size={14} className={isHigh ? "text-red-500" : "text-emerald-600"} />
      </div>
      <span className="flex-1 text-slate-600 text-sm">{label}</span>
      {risk.probability != null && (
        <span className="text-slate-400 text-xs">{Math.round(risk.probability * 100)}%</span>
      )}
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
        isHigh
          ? "bg-red-50 text-red-600 border border-red-100"
          : "bg-emerald-50 text-emerald-600 border border-emerald-100"
      }`}>
        {risk.level} Risk
      </span>
    </div>
  );
}

// Renders nothing while loading and nothing if the patient has no
// ML predictions yet (not an error state — most patients won't
// until the ML training script has run for them).
export default function RiskPredictionCard({ patientId, role, apiBaseUrl }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const url = role === "doctor"
      ? `${apiBaseUrl}/doctor/patients/${patientId}/risk`
      : `${apiBaseUrl}/patients/me/risk`;

    setLoading(true);
    axios.get(url)
      .then(res => { if (!cancelled) setData(res.data); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [patientId, role, apiBaseUrl]);

  if (loading || !data?.has_predictions) return null;

  const tierStyle = TIER_STYLES[data.risk_tier] || TIER_STYLES["Low Risk"];

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-violet-50 rounded-lg flex items-center justify-center">
            <Activity size={16} className="text-violet-600" />
          </div>
          <h3 className="font-semibold text-slate-800">ML Risk Predictions</h3>
        </div>
        {data.risk_tier && (
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${tierStyle.bg} ${tierStyle.color} border ${tierStyle.border}`}>
            {data.risk_tier}
          </span>
        )}
      </div>
      <p className="text-slate-400 text-xs mb-1">Databricks-trained models — informational, not a diagnosis</p>
      <div className="divide-y divide-slate-50">
        {data.readmission_risk && (
          <RiskRow icon={TrendingUp} label="Readmission Risk" risk={data.readmission_risk} />
        )}
        {data.no_show_risk && (
          <RiskRow icon={CalendarX} label="No-Show Risk" risk={data.no_show_risk} />
        )}
      </div>
    </div>
  );
}
