import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import DoctorLayout from "../../components/DoctorLayout";
import PageWrapper from "../../components/shared/PageWrapper";
import { SkeletonTable } from "../../components/shared/SkeletonCard";
import EmptyState from "../../components/shared/EmptyState";
import Pagination from "../../components/shared/Pagination";
import Modal from "../../components/shared/Modal";
import { showError, showSuccess } from "../../components/shared/Toast";
import { getDoctorPatients, getIncomingReferrals, acceptReferral, declineReferral } from "../../api/api";
import {
  Search, Users,
  Calendar, Phone,
  ChevronRight, Share2, Check, X, Loader2
} from "lucide-react";

const PER_PAGE = 20;

function VisitBadge({ visits }) {
  if (visits >= 5) return (
    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-full text-xs font-medium">
      Frequent
    </span>
  );
  if (visits >= 3) return (
    <span className="px-2 py-0.5 bg-slate-50 text-slate-500 border border-slate-200 rounded-full text-xs font-medium">
      Regular
    </span>
  );
  return (
    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full text-xs font-medium">
      New
    </span>
  );
}

export default function Patients() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [patients, setPatients] = useState([]);
  const [total,    setTotal]    = useState(0);
  const [stats,    setStats]    = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState(searchParams.get("search") || "");
  const [page,     setPage]     = useState(parseInt(searchParams.get("page")) || 1);

  const [referrals,        setReferrals]        = useState([]);
  const [referralActionId, setReferralActionId] = useState(null);
  const [declineTarget,    setDeclineTarget]     = useState(null);
  const [declineReasonText, setDeclineReasonText] = useState("");

  const skipReset = useRef(true);

  useEffect(() => { loadReferrals(); }, []);

  const loadReferrals = () => {
    getIncomingReferrals()
      .then(res => setReferrals(res.data))
      .catch(() => {});
  };

  const handleAcceptReferral = async (referralId) => {
    setReferralActionId(referralId);
    try {
      await acceptReferral(referralId);
      showSuccess("Referral accepted — patient added to your list.");
      loadReferrals();
    } catch {
      showError("Failed to accept referral");
    } finally {
      setReferralActionId(null);
    }
  };

  const confirmDeclineReferral = async () => {
    const referralId = declineTarget.referral_id;
    setReferralActionId(referralId);
    try {
      await declineReferral(referralId, { decline_reason: declineReasonText.trim() });
      showSuccess("Referral declined.");
      setDeclineTarget(null);
      setDeclineReasonText("");
      loadReferrals();
    } catch {
      showError("Failed to decline referral");
    } finally {
      setReferralActionId(null);
    }
  };

  useEffect(() => {
    if (skipReset.current) { skipReset.current = false; return; }
    setPage(1);
  }, [search]);

  useEffect(() => {
    const params = {};
    if (search) params.search = search;
    if (page > 1) params.page = String(page);
    setSearchParams(params, { replace: true });
  }, [search, page]);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      getDoctorPatients({ page, per_page: PER_PAGE, search })
        .then(res => {
          setPatients(res.data.items);
          setTotal(res.data.total);
          setStats(res.data.stats);
        })
        .catch(() => showError("Failed to load patients"))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [page, search]);

  if (loading && patients.length === 0) return (
    <DoctorLayout>
      <div className="mb-6">
        <div className="h-7 w-40 bg-slate-200 rounded-lg animate-pulse mb-2" />
        <div className="h-4 w-56 bg-slate-100 rounded-lg animate-pulse" />
      </div>
      <SkeletonTable rows={5} />
    </DoctorLayout>
  );

  return (
    <DoctorLayout>
      <PageWrapper>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">My Patients</h1>
          <p className="text-slate-500 text-sm mt-1">
            {stats?.total ?? 0} patients under your care
          </p>
        </div>
      </div>

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
          { label: "Total Patients",    value: stats?.total,          color: "text-blue-600",    bg: "bg-blue-50"    },
          { label: "Frequent Visitors", value: stats?.frequent,       color: "text-blue-600",    bg: "bg-blue-50"    },
          { label: "New This Month",    value: stats?.new_this_month, color: "text-emerald-600", bg: "bg-emerald-50" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <p className="text-slate-500 text-sm mb-1">{label}</p>
            <p className={`text-3xl font-bold ${color}`}>{value ?? 0}</p>
          </div>
        ))}
      </div>

      {/* Incoming Referrals */}
      {referrals.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm mb-6">
          <div className="p-5 border-b border-slate-100 flex items-center gap-2">
            <Share2 size={16} className="text-indigo-500" />
            <h3 className="font-semibold text-slate-800">Incoming Referrals</h3>
            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold">
              {referrals.length}
            </span>
          </div>
          <div className="divide-y divide-slate-50">
            {referrals.map(r => (
              <div
                key={r.referral_id}
                onClick={() => navigate(`/doctor/patient/${r.patient_id}`)}
                className="flex items-center gap-4 p-4 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Share2 size={15} className="text-indigo-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-800 text-sm font-semibold">{r.patient_name}</p>
                  <p className="text-slate-400 text-xs mt-0.5">
                    Referred by Dr. {r.referring_doctor_name} · click to view full patient record
                  </p>
                  {r.reason && <p className="text-slate-500 text-xs mt-1 italic truncate">"{r.reason}"</p>}
                </div>
                <div className="flex gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                  <button
                    disabled={referralActionId === r.referral_id}
                    onClick={() => handleAcceptReferral(r.referral_id)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    {referralActionId === r.referral_id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Accept
                  </button>
                  <button
                    disabled={referralActionId === r.referral_id}
                    onClick={() => setDeclineTarget(r)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-600 text-xs font-semibold rounded-lg transition-colors"
                  >
                    <X size={12} /> Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Decline referral modal */}
      {declineTarget && (
        <Modal title="Decline Referral" onClose={() => { setDeclineTarget(null); setDeclineReasonText(""); }}>
          <div className="space-y-3">
            <p className="text-slate-500 text-sm">
              Declining referral for <span className="font-semibold text-slate-700">{declineTarget.patient_name}</span> from
              Dr. {declineTarget.referring_doctor_name}. Let them know why (optional) — the patient sees this too.
            </p>
            <textarea
              rows={3}
              placeholder="e.g. Fully booked this month, please try Dr. X instead"
              value={declineReasonText}
              onChange={e => setDeclineReasonText(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-slate-50 resize-none"
            />
            <button
              disabled={referralActionId === declineTarget.referral_id}
              onClick={confirmDeclineReferral}
              className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors"
            >
              {referralActionId === declineTarget.referral_id
                ? <><Loader2 size={16} className="animate-spin" /> Declining...</>
                : <><X size={16} /> Decline Referral</>
              }
            </button>
          </div>
        </Modal>
      )}

      {/* Patient list */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="p-5 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">
            Patient List
            <span className="text-slate-400 font-normal ml-2 text-sm">
              ({total} shown)
            </span>
          </h3>
        </div>

        {patients.length === 0 ? (
          <EmptyState
            icon={Users}
            title={search ? "No patients match your search" : "No patients yet"}
          />
        ) : (
          <div className="divide-y divide-slate-50">
            {patients.map(patient => (
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
                    <VisitBadge visits={patient.total_visits} />
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

        <Pagination page={page} perPage={PER_PAGE} total={total} onChange={setPage} />
      </div>
      </PageWrapper>
    </DoctorLayout>
  );
}
