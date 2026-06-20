import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import AdminLayout from "../../components/AdminLayout";
import PageWrapper from "../../components/shared/PageWrapper";
import { SkeletonTable } from "../../components/shared/SkeletonCard";
import { getAdminPatients } from "../../api/api";
import { Users, Search, Calendar, Mail, Phone } from "lucide-react";

export default function AdminPatients() {
  const [patients, setPatients] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");

  useEffect(() => {
    getAdminPatients()
      .then(res => { setPatients(res.data); setFiltered(res.data); })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(patients.filter(p =>
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.phone?.includes(q)
    ));
  }, [search, patients]);

  if (loading) return (
    <AdminLayout><SkeletonTable rows={6} /></AdminLayout>
  );

  return (
    <AdminLayout>
      <PageWrapper>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">All Patients</h1>
            <p className="text-slate-500 text-sm mt-1">
              {patients.length} registered patients
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search by name, email or phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 shadow-sm"
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">
              Patient Registry
            </h3>
            <span className="text-xs text-slate-400">
              {filtered.length} shown
            </span>
          </div>

          {filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="text-slate-200 mx-auto mb-3" size={48} />
              <p className="text-slate-400 text-sm">No patients found</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {filtered.map((p, i) => (
                <motion.div
                  key={p.patient_id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-400 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm font-bold">
                      {p.first_name[0]}{p.last_name[0]}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-800 text-sm font-semibold">
                      {p.first_name} {p.last_name}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-slate-400 text-xs">
                        {p.age}y · {p.gender}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="text-slate-400 text-xs flex items-center gap-1">
                        <Mail size={10} /> {p.email}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="text-slate-400 text-xs flex items-center gap-1">
                        <Phone size={10} /> {p.phone}
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-slate-500 text-xs flex items-center gap-1 justify-end">
                      <Calendar size={11} />
                      Joined {p.created_at}
                    </p>
                    <p className="text-slate-400 text-xs mt-0.5">
                      {p.total_appointments} appointment{p.total_appointments !== 1 ? "s" : ""}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </PageWrapper>
    </AdminLayout>
  );
}