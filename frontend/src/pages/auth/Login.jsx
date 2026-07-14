import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { login as loginAPI } from "../../api/api";
import {
  Mail, Lock, ArrowRight,
  AlertCircle, Heart, Activity,
  Shield, Stethoscope, Sparkles
} from "lucide-react";

// Left panel feature cards
const features = [
  {
    icon:  Activity,
    color: "text-sky-400",
    bg:    "bg-sky-400/10",
    title: "Real-time Monitoring",
    desc:  "Live vitals tracking and instant anomaly alerts"
  },
  {
    icon:  Sparkles,
    color: "text-emerald-400",
    bg:    "bg-emerald-400/10",
    title: "AI Clinical Support",
    desc:  "Differential diagnosis and smart note extraction"
  },
  {
    icon:  Shield,
    color: "text-violet-400",
    bg:    "bg-violet-400/10",
    title: "FHIR Interoperability",
    desc:  "Standards-compliant health data exchange"
  },
];

// Floating stat badges on the left panel
const stats = [
  { value: "100+", label: "Patients" },
  { value: "3",    label: "Portals"  },
  { value: "8",    label: "AI Tools" },
];

export default function Login() {
  const [form,    setForm]    = useState({ email: "", password: "" });
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);
  const { login }             = useAuth();
  const navigate              = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await loginAPI(form);
      const { token, role, name } = res.data;
      login({ name, role }, token);
      if      (role === "patient") navigate("/patient");
      else if (role === "doctor")  navigate("/doctor");
      else if (role === "admin")   navigate("/admin");
    } catch (err) {
      setError(err.response?.data?.error || "Invalid credentials. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex">

      {/* ── LEFT PANEL — Brand ── */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 flex-col relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0D2137 0%, #0F2A45 40%, #1A1035 100%)" }}>

        {/* Background grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "40px 40px"
          }} />

        {/* Glow orbs */}
        <div className="absolute top-0 left-0 w-96 h-96 rounded-full opacity-10 blur-3xl"
          style={{ background: "radial-gradient(circle, #2176AE, transparent)" }} />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full opacity-10 blur-3xl"
          style={{ background: "radial-gradient(circle, #7c3aed, transparent)" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full opacity-5 blur-3xl"
          style={{ background: "radial-gradient(circle, #10b981, transparent)" }} />

        {/* Content */}
        <div className="relative flex flex-col h-full px-12 py-10">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-xl"
              style={{ background: "linear-gradient(135deg, #2176AE, #1A4A7A)" }}>
              <Heart size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-xl leading-tight">
                MedCore <span className="text-sky-400">AI</span>
              </h1>
              <p className="text-white/30 text-xs">Healthcare Patient Management</p>
            </div>
          </div>

          {/* Main headline */}
          <div className="flex-1 flex flex-col justify-center max-w-lg">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6 w-fit"
              style={{ background: "rgba(33,118,174,0.15)", border: "1px solid rgba(33,118,174,0.25)" }}>
              <Sparkles size={12} className="text-sky-400" />
              <span className="text-sky-400 text-xs font-medium">Impact pSiddhi 3.0 · S4-I-07</span>
            </div>

            <h2 className="text-white text-4xl font-bold leading-tight mb-4">
              Intelligent Healthcare
              <span className="block text-transparent bg-clip-text"
                style={{ backgroundImage: "linear-gradient(90deg, #38bdf8, #818cf8)" }}>
                at Your Fingertips
              </span>
            </h2>
            <p className="text-white/50 text-base leading-relaxed mb-10">
              A unified platform connecting patients, doctors, and administrators
              with AI-powered clinical decision support and real-time health analytics.
            </p>

            {/* Feature cards */}
            <div className="space-y-3">
              {features.map(({ icon: Icon, color, bg, title, desc }) => (
                <div key={title}
                  className="flex items-center gap-4 p-4 rounded-2xl"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                    <Icon size={16} className={color} />
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{title}</p>
                    <p className="text-white/40 text-xs mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-6 pb-2">
            {stats.map(({ value, label }) => (
              <div key={label} className="text-center">
                <p className="text-white text-2xl font-bold">{value}</p>
                <p className="text-white/30 text-xs">{label}</p>
              </div>
            ))}
            <div className="h-8 w-px bg-white/10 mx-2" />
            <p className="text-white/20 text-xs leading-relaxed">
              All patient data is<br />100% synthetic
            </p>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL — Login Form ── */}
      <div className="w-full lg:w-1/2 xl:w-2/5 flex items-center justify-center bg-[#f8fafc] px-6 py-10">
        <div className="w-full max-w-md">

          {/* Mobile logo — only shows on small screens */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #0D2137, #1A4A7A)" }}>
              <Heart size={18} className="text-white" />
            </div>
            <h1 className="text-slate-800 font-bold text-xl">
              MedCore <span className="text-sky-500">AI</span>
            </h1>
          </div>

          {/* Form header */}
          <div className="mb-8">
            <h2 className="text-slate-800 text-2xl font-bold">Welcome back</h2>
            <p className="text-slate-500 text-sm mt-1">
              Sign in to your account to continue
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(13,33,55,0.06)" }}>
                  <Mail size={15} className="text-slate-400" />
                </div>
                <input
                  type="email"
                  required
                  placeholder="your@email.com"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  className="w-full pl-14 pr-4 py-3.5 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:border-transparent bg-white shadow-sm transition-all"
                  style={{ "--tw-ring-color": "#2176AE" }}
                  onFocus={e => e.target.style.boxShadow = "0 0 0 3px rgba(33,118,174,0.12)"}
                  onBlur={e => e.target.style.boxShadow = ""}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">
                Password
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(13,33,55,0.06)" }}>
                  <Lock size={15} className="text-slate-400" />
                </div>
                <input
                  type="password"
                  required
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  className="w-full pl-14 pr-4 py-3.5 border border-slate-200 rounded-2xl text-sm focus:outline-none bg-white shadow-sm transition-all"
                  onFocus={e => e.target.style.boxShadow = "0 0 0 3px rgba(33,118,174,0.12)"}
                  onBlur={e => e.target.style.boxShadow = ""}
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-3 bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-2xl text-sm">
                <AlertCircle size={16} className="flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 text-white font-semibold py-3.5 rounded-2xl transition-all duration-200 shadow-lg disabled:opacity-60 mt-2"
              style={{
                background: loading
                  ? "linear-gradient(135deg, #1A4A7A, #0D2137)"
                  : "linear-gradient(135deg, #2176AE, #1A4A7A)",
                boxShadow: "0 4px 24px rgba(33,118,174,0.35)"
              }}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-slate-400 text-xs">or</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Signup link */}
          <div className="text-center">
            <p className="text-slate-500 text-sm">
              New patient?{" "}
              <Link to="/signup"
                className="font-semibold hover:underline"
                style={{ color: "#2176AE" }}>
                Create your account
              </Link>
            </p>
          </div>

          {/* Demo credentials */}
          <div className="mt-8 rounded-2xl overflow-hidden border border-slate-200">
            <div className="px-4 py-2.5 bg-slate-800">
              <p className="text-white/60 text-xs font-semibold uppercase tracking-wide">
                Demo Credentials
              </p>
            </div>
            <div className="p-4 bg-white space-y-2">
              {[
                { role: "Admin",   icon: Shield,      color: "text-violet-600", email: "admin@medcore.ai",  pass: "admin123"  },
                { role: "Doctor",  icon: Stethoscope, color: "text-emerald-600", email: "doctor@medcore.ai", pass: "admin123"  },
                { role: "Patient", icon: Heart,       color: "text-sky-600",    email: "Sign up below",     pass: ""          },
              ].map(({ role, icon: Icon, color, email, pass }) => (
                <div key={role}
                  className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => {
                    if (email !== "Sign up below") {
                      setForm({ email, password: pass });
                    }
                  }}>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${color === "text-violet-600" ? "bg-violet-50" : color === "text-emerald-600" ? "bg-emerald-50" : "bg-sky-50"}`}>
                    <Icon size={13} className={color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-700 text-xs font-semibold">{role}</p>
                    <p className="text-slate-400 text-[10px] truncate">
                      {email}{pass ? ` · ${pass}` : ""}
                    </p>
                  </div>
                  {email !== "Sign up below" && (
                    <span className="text-[10px] text-slate-300 flex-shrink-0">click to fill</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-slate-400 mt-6">
            Impact pSiddhi 3.0 · S4-I-07 · MedCore AI · All data is synthetic
          </p>
        </div>
      </div>
    </div>
  );
}