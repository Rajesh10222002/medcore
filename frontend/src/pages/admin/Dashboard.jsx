import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import AdminLayout from "../../components/AdminLayout";
import PageWrapper from "../../components/shared/PageWrapper";
import { SkeletonCard } from "../../components/shared/SkeletonCard";
import { getAdminKPIs, adminNLQuery } from "../../api/api";
import {
  Users, UserPlus, Calendar,
  TrendingUp, CheckCircle, XCircle,
  Clock, Stethoscope, ArrowUp,
  Sparkles, Send, Loader2
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer
} from "recharts";

// Animated counter
function AnimatedNumber({ value }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const end  = parseInt(value) || 0;
    if (start === end) return;
    const step  = Math.max(1, Math.floor(end / 20));
    const timer = setInterval(() => {
      start = Math.min(start + step, end);
      setDisplay(start);
      if (start >= end) clearInterval(timer);
    }, 50);
    return () => clearInterval(timer);
  }, [value]);
  return <span>{display}</span>;
}

// Gradient KPI card
function KpiCard({ icon: Icon, label, value, gradient, iconBg, iconColor, trend, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="relative rounded-2xl p-5 overflow-hidden"
      style={{ background: gradient, boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}
    >
      <div className="absolute top-0 right-0 w-20 h-20 rounded-full blur-2xl opacity-30"
        style={{ background: iconBg }} />
      <div className="relative flex items-center justify-between mb-4">
        <span className="text-slate-500 text-sm font-medium">{label}</span>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm"
          style={{ background: iconBg }}>
          <Icon size={18} className={iconColor} />
        </div>
      </div>
      <p className="relative text-3xl font-bold text-slate-800">
        <AnimatedNumber value={value || 0} />
      </p>
      {trend && (
        <div className="relative flex items-center gap-1 mt-1">
          <ArrowUp size={11} className="text-emerald-500" />
          <span className="text-emerald-600 text-xs font-medium">{trend}</span>
        </div>
      )}
    </motion.div>
  );
}

// Custom tooltip for bar chart
function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-slate-100 px-3 py-2">
        <p className="text-slate-500 text-xs">{label}</p>
        <p className="text-violet-600 text-sm font-bold">{payload[0].value} appointments</p>
      </div>
    );
  }
  return null;
}

const STATUS_COLORS = {
  scheduled: "#6d28d9",
  completed: "#10b981",
  cancelled: "#ef4444",
};

export default function AdminDashboard() {
  const [kpis,      setKpis]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [nlQuery,   setNlQuery]   = useState("");
  const [nlAnswer,  setNlAnswer]  = useState("");
  const [nlLoading, setNlLoading] = useState(false);
  const [nlHistory, setNlHistory] = useState([]);

  useEffect(() => {
    getAdminKPIs()
      .then(res => setKpis(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const handleNLQuery = async (e) => {
    e.preventDefault();
    if (!nlQuery.trim()) return;
    const q = nlQuery.trim();
    setNlLoading(true);
    setNlQuery("");
    setNlHistory(prev => [...prev, { role: "user", text: q }]);
    try {
      const res = await adminNLQuery({ question: q });
      setNlHistory(prev => [...prev, { role: "ai", text: res.data.answer }]);
    } catch {
      setNlHistory(prev => [...prev, { role: "ai", text: "Unable to process that query right now. Please try again.", error: true }]);
    } finally {
      setNlLoading(false);
    }
  };

  if (loading) return (
    <AdminLayout>
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
      </div>
    </AdminLayout>
  );

  const pieData = (kpis?.by_status || []).map(s => ({
    name:  s.status.charAt(0).toUpperCase() + s.status.slice(1),
    value: s.count,
    color: STATUS_COLORS[s.status] || "#94a3b8"
  }));

  return (
    <AdminLayout>
      <PageWrapper>

        {/* Header */}
        <div className="flex items-center justify-between mb-7">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
            <p className="text-slate-500 text-sm mt-1">
              Live system overview — {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
        </div>

        {/* ── Row 1: Main KPI cards ── */}
        <div className="grid grid-cols-4 gap-4 mb-5">
          <KpiCard
            icon={Users}      label="Total Patients"       value={kpis?.total_patients}
            gradient="linear-gradient(135deg, #eff6ff, #dbeafe)"
            iconBg="rgba(59,130,246,0.12)"  iconColor="text-blue-600"   delay={0.05}
            trend="Registered"
          />
          <KpiCard
            icon={Stethoscope} label="Total Doctors"       value={kpis?.total_doctors}
            gradient="linear-gradient(135deg, #f0fdf4, #dcfce7)"
            iconBg="rgba(16,185,129,0.12)" iconColor="text-emerald-600" delay={0.1}
          />
          <KpiCard
            icon={Calendar}   label="Total Appointments"   value={kpis?.total_appointments}
            gradient="linear-gradient(135deg, #f5f3ff, #ede9fe)"
            iconBg="rgba(124,58,237,0.12)" iconColor="text-violet-600"  delay={0.15}
          />
          <KpiCard
            icon={TrendingUp} label="New Patients (Month)" value={kpis?.new_this_month}
            gradient="linear-gradient(135deg, #fffbeb, #fef3c7)"
            iconBg="rgba(245,158,11,0.12)" iconColor="text-amber-500"   delay={0.2}
            trend="This month"
          />
        </div>

        {/* ── Row 2: Today's stats ── */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { icon: Clock,       label: "Today's Appointments", value: kpis?.today_appointments, bg: "rgba(59,130,246,0.08)",   color: "text-blue-600",   border: "rgba(59,130,246,0.15)"   },
            { icon: CheckCircle, label: "Scheduled",            value: kpis?.scheduled,          bg: "rgba(16,185,129,0.08)",  color: "text-emerald-600", border: "rgba(16,185,129,0.15)"  },
            { icon: XCircle,     label: "Cancelled",            value: kpis?.cancelled,          bg: "rgba(239,68,68,0.08)",   color: "text-red-500",     border: "rgba(239,68,68,0.15)"   },
          ].map(({ icon: Icon, label, value, bg, color, border }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + i * 0.05 }}
              className="bg-white rounded-2xl p-5 flex items-center gap-4 border shadow-sm"
              style={{ borderColor: border }}
            >
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: bg }}>
                <Icon size={20} className={color} />
              </div>
              <div>
                <p className="text-slate-500 text-sm">{label}</p>
                <p className="text-2xl font-bold text-slate-800 mt-0.5">
                  <AnimatedNumber value={value || 0} />
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── Row 3: Charts ── */}
        <div className="grid grid-cols-3 gap-6 mb-6">

          {/* Bar chart */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5"
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold text-slate-800">Appointments</h3>
                <p className="text-slate-400 text-xs mt-0.5">Last 7 days</p>
              </div>
              <div className="px-3 py-1 rounded-full text-xs font-medium"
                style={{ background: "rgba(124,58,237,0.08)", color: "#6d28d9" }}>
                Daily trend
              </div>
            </div>
            {!kpis?.daily_appointments?.length ? (
              <div className="flex items-center justify-center h-44">
                <p className="text-slate-400 text-sm">No appointment data yet</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={kpis.daily_appointments} barCategoryGap="30%">
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    tickFormatter={d => d.slice(5)}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(124,58,237,0.04)" }} />
                  <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                    {kpis.daily_appointments.map((_, i) => (
                      <Cell
                        key={i}
                        fill={i === kpis.daily_appointments.length - 1
                          ? "#6d28d9"
                          : "rgba(124,58,237,0.25)"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </motion.div>

          {/* Pie chart */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5"
          >
            <div className="mb-5">
              <h3 className="font-bold text-slate-800">By Status</h3>
              <p className="text-slate-400 text-xs mt-0.5">All time</p>
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
                {/* Legend */}
                <div className="space-y-2 mt-2">
                  {pieData.map(({ name, value, color }) => (
                    <div key={name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                        <span className="text-slate-600 text-xs capitalize">{name}</span>
                      </div>
                      <span className="text-slate-800 text-xs font-bold">{value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </motion.div>
        </div>

        {/* ── Row 4: Top Doctors ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800">Top Doctors</h3>
              <p className="text-slate-400 text-xs mt-0.5">By appointment count</p>
            </div>
          </div>
          {!kpis?.top_doctors?.length ? (
            <div className="p-10 text-center">
              <p className="text-slate-400 text-sm">No doctors yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {kpis.top_doctors.map((doc, i) => {
                const max = kpis.top_doctors[0]?.total || 1;
                const pct = Math.round((doc.total / max) * 100);
                return (
                  <div key={i} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors">
                    {/* Rank */}
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold"
                      style={{
                        background: i === 0 ? "rgba(124,58,237,0.12)" : "rgba(148,163,184,0.1)",
                        color:      i === 0 ? "#6d28d9" : "#94a3b8"
                      }}>
                      #{i + 1}
                    </div>
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold text-white shadow-sm"
                      style={{ background: "linear-gradient(135deg, #6d28d9, #7c3aed)" }}>
                      {doc.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-800 text-sm font-semibold">Dr. {doc.name}</p>
                      <p className="text-slate-400 text-xs mt-0.5">{doc.specialization}</p>
                      {/* Progress bar */}
                      <div className="mt-1.5 h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, background: "linear-gradient(90deg, #6d28d9, #8b5cf6)" }}
                        />
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-slate-800 text-lg font-bold">{doc.total}</p>
                      <p className="text-slate-400 text-xs">appointments</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* ── Row 5: AI Analytics Query ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="rounded-2xl overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #12062a 0%, #1a0938 100%)",
            boxShadow: "0 4px 32px rgba(18,6,42,0.2)"
          }}
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-white/8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(124,58,237,0.3)", border: "1px solid rgba(124,58,237,0.4)" }}>
                <Sparkles size={18} className="text-violet-300" />
              </div>
              <div>
                <p className="text-white font-bold text-sm">AI Analytics Assistant</p>
                <p className="text-white/40 text-xs mt-0.5">Ask anything about your system data</p>
              </div>
              <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.25)" }}>
                <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-pulse" />
                <span className="text-violet-300 text-[10px] font-semibold">Live data</span>
              </div>
            </div>
          </div>

          <div className="p-6">
            {/* Suggested questions */}
            {nlHistory.length === 0 && (
              <div className="mb-5">
                <p className="text-white/30 text-xs uppercase tracking-widest font-semibold mb-3">
                  Try asking
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    "How many appointments were booked this week?",
                    "Which doctor has the most appointments?",
                    "What is the cancellation rate?",
                    "How many new patients joined this month?",
                    "Which specialization is most in demand?",
                  ].map(q => (
                    <button
                      key={q}
                      onClick={() => setNlQuery(q)}
                      className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                      style={{
                        background: "rgba(124,58,237,0.12)",
                        color: "#c4b5fd",
                        border: "1px solid rgba(124,58,237,0.2)"
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Chat history */}
            {nlHistory.length > 0 && (
              <div className="space-y-4 mb-5 max-h-72 overflow-y-auto pr-1">
                {nlHistory.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-lg px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "text-white rounded-br-sm"
                        : msg.error
                          ? "text-red-300 rounded-bl-sm"
                          : "text-white/80 rounded-bl-sm"
                    }`}
                      style={msg.role === "user"
                        ? { background: "rgba(124,58,237,0.4)", border: "1px solid rgba(124,58,237,0.4)" }
                        : { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }
                      }>
                      {msg.role === "ai" && (
                        <div className="flex items-center gap-1.5 mb-2">
                          <Sparkles size={11} className="text-violet-400" />
                          <span className="text-violet-400 text-[10px] font-semibold uppercase tracking-wide">AI Response</span>
                        </div>
                      )}
                      {msg.text}
                    </div>
                  </div>
                ))}
                {nlLoading && (
                  <div className="flex justify-start">
                    <div className="px-4 py-3 rounded-2xl rounded-bl-sm"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <div className="flex items-center gap-2">
                        <Loader2 size={13} className="animate-spin text-violet-400" />
                        <span className="text-white/40 text-xs">Analysing data...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Input */}
            <form onSubmit={handleNLQuery} className="flex gap-3">
              <input
                type="text"
                placeholder="Ask about patients, appointments, doctors..."
                value={nlQuery}
                onChange={e => setNlQuery(e.target.value)}
                disabled={nlLoading}
                className="flex-1 px-4 py-3 rounded-xl text-sm text-white placeholder-white/25 focus:outline-none disabled:opacity-50"
                style={{
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.1)"
                }}
                onFocus={e => e.target.style.borderColor = "rgba(124,58,237,0.5)"}
                onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
              />
              <button
                type="submit"
                disabled={nlLoading || !nlQuery.trim()}
                className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)" }}
              >
                {nlLoading
                  ? <Loader2 size={16} className="animate-spin text-white" />
                  : <Send size={16} className="text-white" />
                }
              </button>
              {nlHistory.length > 0 && (
                <button
                  type="button"
                  onClick={() => setNlHistory([])}
                  className="px-3 py-2 rounded-xl text-xs font-medium text-white/30 hover:text-white/60 transition-colors"
                >
                  Clear
                </button>
              )}
            </form>
          </div>
        </motion.div>

      </PageWrapper>
    </AdminLayout>
  );
}