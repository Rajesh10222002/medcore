import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DoctorLayout from "../../components/DoctorLayout";
import { getDoctorPatients } from "../../api/api";
import {
  Search, Users, User,
  Calendar, Phone, Loader2,
  ChevronRight, AlertCircle
} from "lucide-react";

function RiskBadge({ visits }) {
  if (visits >= 5) return (
    <span className="px-2 py-0.5 bg-red-50 text-red-600 border border-red-100 rounded-full text-xs font-medium">
      High Risk
    </span>
  );
  if (visits >= 3) return (
    <span className="px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-100 rounded-full text-xs font-medium">
      Medium
    </span>
  );
  return (
    <span className="px-2 py-0.5 bg-green-50 text-green-600 border border-green-100 rounded-full text-xs font-medium">
      Low Risk
    </span>
  );
}

export default function Patients() {
  const [patients, setPatients] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [error,    setError]    = useState("");
  const navigate = useNavigate();

  useEffect(() => { loadPatients(); }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      patients.filter(p =>
        `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q)
      )
    );
  }, [search, patients]);

  const loadPatients = async () => {
    try {
      setLoading(true);
      const res = await getDoctorPatients();
      setPatients(res.data);
      setFiltered(res.data);
    } catch (err) {
      setError("Failed to load patients");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <DoctorLayout>
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-emerald-500" size={32} />
      </div>
    </DoctorLayout>
  );

  return (
    <DoctorLayout>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">My Patients</h1>
          <p className="text-slate-500 text-sm mt-1">
            {patients.length} patients under your care
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm mb-4">
          <AlertCircle size={16} />{error}
        </div>
      )}

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <input
          type="text"
          placeholder="Search patients by name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total Patients", value: patients.length,
            color: "text-blue-600",    bg: "bg-blue-50"    },
          { label: "High Risk",
            value: patients.filter(p => p.total_visits >= 5).length,
            color: "text-red-600",     bg: "bg-red-50"     },
          { label: "New This Month",
            value: patients.filter(p => {
              const last = new Date(p.last_visit);
              const now  = new Date();
              return last.getMonth() === now.getMonth();
            }).length,
            color: "text-emerald-600", bg: "bg-emerald-50" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <p className="text-slate-500 text-sm mb-1">{label}</p>
            <p className={`text-3xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Patient list */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="p-5 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">
            Patient List
            <span className="text-slate-400 font-normal ml-2 text-sm">
              ({filtered.length} shown)
            </span>
          </h3>
        </div>

        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="text-slate-200 mx-auto mb-3" size={48} />
            <p className="text-slate-400">
              {search ? "No patients match your search" : "No patients yet"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filtered.map(patient => (
              <div
                key={patient.patient_id}
                onClick={() => navigate(`/doctor/patient/${patient.patient_id}`)}
                className="flex items-center gap-4 p-4 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                {/* Avatar */}
                <div className="w-11 h-11 bg-gradient-to-br from-emerald-500 to-teal-400 rounded-full flex items-center justify-center flex-shrink-0 shadow">
                  <span className="text-white text-sm font-bold">
                    {patient.first_name[0]}{patient.last_name[0]}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-slate-800 text-sm font-semibold">
                      {patient.first_name} {patient.last_name}
                    </p>
                    <RiskBadge visits={patient.total_visits} />
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-slate-400 text-xs">
                      {patient.age}y · {patient.gender}
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className="text-slate-400 text-xs flex items-center gap-1">
                      <Phone size={10} /> {patient.phone}
                    </span>
                  </div>
                </div>

                {/* Right info */}
                <div className="text-right flex-shrink-0">
                  <div className="flex items-center gap-1 text-slate-400 text-xs mb-1">
                    <Calendar size={11} />
                    Last: {patient.last_visit || "—"}
                  </div>
                  <p className="text-slate-400 text-xs">
                    {patient.total_visits} visit{patient.total_visits !== 1 ? "s" : ""}
                  </p>
                </div>

                <ChevronRight size={16} className="text-slate-300 flex-shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>
    </DoctorLayout>
  );
}