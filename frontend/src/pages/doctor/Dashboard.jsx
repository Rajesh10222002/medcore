import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import DoctorLayout from "../../components/DoctorLayout";
import PageWrapper from "../../components/shared/PageWrapper";
import { SkeletonCard, SkeletonTable } from "../../components/shared/SkeletonCard";
import EmptyState from "../../components/shared/EmptyState";
import AnimatedNumber from "../../components/shared/AnimatedNumber";
import { showError } from "../../components/shared/Toast";
import {
  getDoctorProfile, getScheduleCalendar,
  getScheduleLeaves, getDoctorPatients, getDayDetail,
  getDoctorAnalytics
} from "../../api/api";
import {
  Users, CalendarDays, Clock, CalendarOff,
  FileText, Brain, ChevronRight,
  TrendingUp, TrendingDown, BarChart3
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer
} from "recharts";

const STATUS_COLORS = {
  scheduled: "#2563eb",
  completed: "#059669",
  cancelled: "#dc2626",
};

function AnalyticsTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-slate-100 px-3 py-2">
        <p className="text-slate-500 text-xs">{label}</p>
        <p className="text-emerald-600 text-sm font-bold">{payload[0].value} patients</p>
      </div>
    );
  }
  return null;
}

function StatCard({ icon: Icon, label, value, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-slate-500 text-sm font-medium">{label}</span>
        <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center">
          <Icon size={16} className="text-emerald-600" />
        </div>
      </div>
      <p className="text-3xl font-bold text-slate-800"><AnimatedNumber value={value} /></p>
    </motion.div>
  );
}

function QuickAction({ icon: Icon, label, desc, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-md transition-all text-left w-full group"
    >
      <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
        <Icon size={18} className="text-emerald-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-slate-800 text-sm font-semibold">{label}</p>
        <p className="text-slate-400 text-xs mt-0.5">{desc}</p>
      </div>
      <ChevronRight size={15} className="text-slate-300 group-hover:text-slate-400 transition-colors flex-shrink-0" />
    </button>
  );
}

export default function DoctorDashboard() {
  const navigate = useNavigate();
  const [profile,   setProfile]   = useState(null);
  const [calendar,  setCalendar]  = useState([]);
  const [leaves,    setLeaves]    = useState([]);
  const [totalPatients, setTotalPatients] = useState(0);
  const [todayAppts, setTodayAppts] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [profRes, calRes, leavesRes, patientsRes, analyticsRes] = await Promise.all([
          getDoctorProfile(),
          getScheduleCalendar(),
          getScheduleLeaves(),
          getDoctorPatients({ per_page: 1 }),
          getDoctorAnalytics(),
        ]);
        setProfile(profRes.data);
        setCalendar(calRes.data);
        setLeaves(leavesRes.data);
        setTotalPatients(patientsRes.data.stats?.total || 0);
        setAnalytics(analyticsRes.data);

        const todayStr = new Date().toISOString().split("T")[0];
        const dayRes = await getDayDetail(todayStr);
        setTodayAppts(dayRes.data.appointments || []);
      } catch {
        showError("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return (
    <DoctorLayout>
      <div className="mb-6">
        <div className="h-7 w-56 bg-slate-200 rounded-lg animate-pulse mb-2" />
        <div className="h-4 w-40 bg-slate-100 rounded-lg animate-pulse" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
      </div>
      <SkeletonTable rows={4} />
    </DoctorLayout>
  );

  const today       = calendar[0];
  const next7Days   = calendar.slice(0, 7);
  const weekTotal   = next7Days.reduce((sum, d) => sum + (d.appointments?.total || 0), 0);

  const now  = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const monthlyPatients = analytics?.monthly_patients || [];
  const pieData = (analytics?.by_status || []).map(s => ({
    name:  s.status.charAt(0).toUpperCase() + s.status.slice(1),
    value: s.count,
    color: STATUS_COLORS[s.status] || "#94a3b8"
  }));
  const totalThisMonth = analytics?.total_this_month || 0;
  const totalLastMonth = analytics?.total_last_month || 0;
  const trendUp   = totalThisMonth >= totalLastMonth;
  const trendDiff = Math.abs(totalThisMonth - totalLastMonth);

  return (
    <DoctorLayout>
      <PageWrapper>

        <div className="mb-7">
          <h1 className="text-2xl font-bold text-slate-800">
            {greeting}, Dr. {profile?.last_name}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Here's what's happening in your practice today
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard icon={CalendarDays} label="Today's Appointments" value={today?.appointments?.total || 0} delay={0.05} />
          <StatCard icon={Clock}        label="This Week"            value={weekTotal} delay={0.1} />
          <StatCard icon={Users}        label="Total Patients"       value={totalPatients} delay={0.15} />
          <StatCard icon={CalendarOff}  label="Upcoming Leaves"      value={leaves.length} delay={0.2} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Today's schedule */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-800">Today's Schedule</h3>
                <p className="text-slate-400 text-xs mt-0.5">
                  {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
                </p>
              </div>
              <button
                onClick={() => navigate("/doctor/schedule")}
                className="flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700"
              >
                View schedule <ChevronRight size={13} />
              </button>
            </div>
            {todayAppts.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="No appointments today"
                message="Enjoy the free time or catch up on notes"
                className="py-12"
              />
            ) : (
              <div className="divide-y divide-slate-50">
                {todayAppts.map(appt => (
                  <div
                    key={appt.appointment_id}
                    onClick={() => navigate(`/doctor/patient/${appt.patient_id}?from=dashboard`)}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ background: "linear-gradient(135deg, #059669, #047857)" }}>
                      {appt.patient_name?.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-800 text-sm font-semibold">{appt.patient_name}</p>
                      <p className="text-slate-400 text-xs mt-0.5 truncate">"{appt.reason}"</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      appt.status === "scheduled" ? "bg-blue-50 text-blue-600" :
                      appt.status === "completed" ? "bg-green-50 text-green-600" :
                      "bg-red-50 text-red-500"
                    }`}>
                      {appt.status}
                    </span>
                    <ChevronRight size={16} className="text-slate-300 flex-shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="col-span-1 space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 px-1">
              Quick Actions
            </p>
            <QuickAction icon={Users}       label="My Patients"    desc="View patient list"      onClick={() => navigate("/doctor/patients")} />
            <QuickAction icon={CalendarDays} label="My Schedule"    desc="Leaves & calendar"      onClick={() => navigate("/doctor/schedule")} />
            <QuickAction icon={FileText}    label="Clinical Notes" desc="Write & extract"        onClick={() => navigate("/doctor/notes")} />
            <QuickAction icon={Brain}       label="AI Copilot"     desc="Differential diagnosis" onClick={() => navigate("/doctor/copilot")} />
          </div>
        </div>

        {/* ── My Practice Analytics ── */}
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={16} className="text-emerald-600" />
            <h2 className="font-bold text-slate-800">My Practice Analytics</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Monthly patient trend */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5"
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-bold text-slate-800">Patients Per Month</h3>
                  <p className="text-slate-400 text-xs mt-0.5">Last 6 months</p>
                </div>
                {(totalThisMonth > 0 || totalLastMonth > 0) && (
                  <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                    trendUp ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"
                  }`}>
                    {trendUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {trendDiff} vs last month
                  </div>
                )}
              </div>
              {!monthlyPatients.some(m => m.count > 0) ? (
                <div className="flex items-center justify-center h-44">
                  <p className="text-slate-400 text-sm">No completed appointments yet</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={monthlyPatients} barCategoryGap="30%">
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                      tickFormatter={m => m.slice(5)}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                      allowDecimals={false}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<AnalyticsTooltip />} cursor={{ fill: "rgba(5,150,105,0.04)" }} />
                    <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                      {monthlyPatients.map((_, i) => (
                        <Cell
                          key={i}
                          fill={i === monthlyPatients.length - 1 ? "#059669" : "rgba(5,150,105,0.25)"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </motion.div>

            {/* This month's status breakdown */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5"
            >
              <div className="mb-5">
                <h3 className="font-bold text-slate-800">This Month</h3>
                <p className="text-slate-400 text-xs mt-0.5">Appointment status</p>
              </div>
              {!pieData.length ? (
                <div className="flex items-center justify-center h-44">
                  <p className="text-slate-400 text-sm">No data yet</p>
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={140}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={65}
                        paddingAngle={3}
                      >
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v, n) => [v, n]}
                        contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "12px" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 mt-2">
                    {pieData.map(({ name, value, color }) => (
                      <div key={name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                          <span className="text-slate-600 text-xs">{name}</span>
                        </div>
                        <span className="text-slate-800 text-xs font-bold">{value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          </div>
        </div>

      </PageWrapper>
    </DoctorLayout>
  );
}
