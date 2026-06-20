import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import AdminLayout from "../../components/AdminLayout";
import PageWrapper from "../../components/shared/PageWrapper";
import { SkeletonCard } from "../../components/shared/SkeletonCard";
import { getAdminKPIs } from "../../api/api";
import {
  Users, UserPlus, Calendar,
  TrendingUp, Activity, CheckCircle,
  XCircle, Clock, Loader2
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer, Legend
} from "recharts";

const COLORS = ["#6d28d9", "#10b981", "#ef4444", "#f59e0b"];

function KpiCard({ icon: Icon, label, value, color, bg, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-slate-500 text-sm font-medium">{label}</span>
        <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center`}>
          <Icon size={18} className={color} />
        </div>
      </div>
      <p className="text-3xl font-bold text-slate-800">{value}</p>
    </motion.div>
  );
}

export default function AdminDashboard() {
  const [kpis,    setKpis]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminKPIs()
      .then(res => setKpis(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <AdminLayout>
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
      </div>
    </AdminLayout>
  );

  return (
    <AdminLayout>
      <PageWrapper>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">
            Overview of MedCore AI system
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <KpiCard icon={Users}      label="Total Patients"      value={kpis?.total_patients}     color="text-blue-600"   bg="bg-blue-50"   delay={0.05} />
          <KpiCard icon={UserPlus}   label="Total Doctors"       value={kpis?.total_doctors}      color="text-emerald-600" bg="bg-emerald-50" delay={0.1} />
          <KpiCard icon={Calendar}   label="Total Appointments"  value={kpis?.total_appointments} color="text-violet-600"  bg="bg-violet-50"  delay={0.15} />
          <KpiCard icon={TrendingUp} label="New Patients (Month)" value={kpis?.new_this_month}    color="text-amber-600"  bg="bg-amber-50"   delay={0.2} />
        </div>

        {/* Second row */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
              <Clock size={22} className="text-blue-600" />
            </div>
            <div>
              <p className="text-slate-500 text-sm">Today's Appointments</p>
              <p className="text-2xl font-bold text-slate-800">{kpis?.today_appointments}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
            <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
              <CheckCircle size={22} className="text-green-600" />
            </div>
            <div>
              <p className="text-slate-500 text-sm">Scheduled</p>
              <p className="text-2xl font-bold text-slate-800">{kpis?.scheduled}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
            <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center">
              <XCircle size={22} className="text-red-500" />
            </div>
            <div>
              <p className="text-slate-500 text-sm">Cancelled</p>
              <p className="text-2xl font-bold text-slate-800">{kpis?.cancelled}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">

          {/* Bar chart — appointments last 7 days */}
          <div className="col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h3 className="font-semibold text-slate-800 mb-4">
              Appointments — Last 7 Days
            </h3>
            {kpis?.daily_appointments?.length === 0 ? (
              <div className="flex items-center justify-center h-40">
                <p className="text-slate-400 text-sm">No appointment data yet</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={kpis?.daily_appointments}>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickFormatter={d => d.slice(5)}
                  />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    formatter={(v) => [v, "Appointments"]}
                    labelFormatter={l => `Date: ${l}`}
                  />
                  <Bar dataKey="count" fill="#6d28d9" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Pie chart — by status */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h3 className="font-semibold text-slate-800 mb-4">
              By Status
            </h3>
            {kpis?.by_status?.length === 0 ? (
              <div className="flex items-center justify-center h-40">
                <p className="text-slate-400 text-sm">No data yet</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={kpis?.by_status}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    label={({ status, percent }) =>
                      `${status} ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {kpis?.by_status?.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Top doctors */}
          <div className="col-span-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className="p-5 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Top Doctors by Appointments</h3>
            </div>
            <div className="divide-y divide-slate-50">
              {kpis?.top_doctors?.length === 0 ? (
                <p className="text-center text-slate-400 text-sm p-6">
                  No doctors yet
                </p>
              ) : (
                kpis?.top_doctors?.map((doc, i) => (
                  <div key={i} className="flex items-center gap-4 p-4">
                    <div className="w-8 h-8 bg-violet-50 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-violet-600 text-xs font-bold">
                        #{i + 1}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="text-slate-800 text-sm font-medium">
                        Dr. {doc.name}
                      </p>
                      <p className="text-slate-400 text-xs">{doc.specialization}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-800 text-sm font-bold">
                        {doc.total}
                      </p>
                      <p className="text-slate-400 text-xs">appointments</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </PageWrapper>
    </AdminLayout>
  );
}