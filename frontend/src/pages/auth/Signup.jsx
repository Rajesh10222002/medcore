import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { signup as signupAPI } from "../../api/api";
import {
  Heart, User, Mail, Lock,
  Phone, Calendar, ArrowRight,
  AlertCircle, CheckCircle, Sparkles,
  Shield, Activity
} from "lucide-react";

export default function Signup() {
  const [form, setForm] = useState({
    first_name: "", last_name: "",
    email: "", password: "",
    date_of_birth: "", gender: "", phone: ""
  });
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);
  const { login }             = useAuth();
  const navigate              = useNavigate();

  const f = (key, val) => setForm({ ...form, [key]: val });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await signupAPI(form);
      const { token, name } = res.data;
      login({ name, role: "patient" }, token);
      navigate("/patient");
    } catch (err) {
      setError(err.response?.data?.error || "Signup failed. Please try again.");
    }
    setLoading(false);
  };

  const pwStrength = form.password.length === 0 ? null
    : form.password.length < 6 ? "weak"
    : form.password.length < 8 ? "medium"
    : "strong";

  return (
    <div className="min-h-screen flex">

      {/* ── LEFT PANEL ── */}
      <div className="hidden lg:flex lg:w-2/5 flex-col relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0D2137 0%, #0F2A45 50%, #0D1F35 100%)" }}>

        {/* Background pattern */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)",
            backgroundSize: "24px 24px"
          }} />

        {/* Glow */}
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-15 blur-3xl"
          style={{ background: "radial-gradient(circle, #2176AE, transparent)" }} />
        <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full opacity-10 blur-3xl"
          style={{ background: "radial-gradient(circle, #10b981, transparent)" }} />

        <div className="relative flex flex-col h-full px-10 py-10">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #2176AE, #1A4A7A)" }}>
              <Heart size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-lg">MedCore <span className="text-sky-400">AI</span></h1>
              <p className="text-white/30 text-xs">Patient Portal</p>
            </div>
          </div>

          {/* Headline */}
          <div className="flex-1 flex flex-col justify-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5 w-fit"
              style={{ background: "rgba(33,118,174,0.15)", border: "1px solid rgba(33,118,174,0.25)" }}>
              <Sparkles size={11} className="text-sky-400" />
              <span className="text-sky-400 text-xs font-medium">Free patient registration</span>
            </div>

            <h2 className="text-white text-3xl font-bold leading-tight mb-4">
              Your Health Journey
              <span className="block text-transparent bg-clip-text"
                style={{ backgroundImage: "linear-gradient(90deg, #38bdf8, #34d399)" }}>
                Starts Here
              </span>
            </h2>
            <p className="text-white/45 text-sm leading-relaxed mb-8">
              Create your patient account to book appointments,
              view your clinical history, and chat with our AI health assistant.
            </p>

            {/* What you get */}
            <div className="space-y-3">
              {[
                { icon: Calendar,  color: "text-sky-400",     bg: "bg-sky-400/10",     text: "Book appointments with doctors online"       },
                { icon: Activity,  color: "text-emerald-400", bg: "bg-emerald-400/10", text: "View your vitals, diagnoses & medications"    },
                { icon: Sparkles,  color: "text-violet-400",  bg: "bg-violet-400/10",  text: "AI health assistant powered by your records"  },
                { icon: Shield,    color: "text-amber-400",   bg: "bg-amber-400/10",   text: "FHIR-compliant secure health records"         },
              ].map(({ icon: Icon, color, bg, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                    <Icon size={14} className={color} />
                  </div>
                  <p className="text-white/50 text-sm">{text}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-white/20 text-xs">
            All patient data used in this project is 100% synthetic.
          </p>
        </div>
      </div>

      {/* ── RIGHT PANEL — Form ── */}
      <div className="w-full lg:w-3/5 flex items-center justify-center bg-[#f8fafc] px-6 py-10 overflow-y-auto">
        <div className="w-full max-w-lg">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-6 justify-center">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #0D2137, #1A4A7A)" }}>
              <Heart size={18} className="text-white" />
            </div>
            <h1 className="text-slate-800 font-bold text-xl">MedCore <span className="text-sky-500">AI</span></h1>
          </div>

          {/* Header */}
          <div className="mb-7">
            <h2 className="text-slate-800 text-2xl font-bold">Create your account</h2>
            <p className="text-slate-500 text-sm mt-1">
              Patient registration · takes less than 2 minutes
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Name row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                  First Name
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100">
                    <User size={13} className="text-slate-400" />
                  </div>
                  <input
                    required
                    placeholder="First name"
                    value={form.first_name}
                    onChange={e => f("first_name", e.target.value)}
                    className="w-full pl-12 pr-3 py-3 border border-slate-200 rounded-2xl text-sm focus:outline-none bg-white shadow-sm"
                    onFocus={e => e.target.style.boxShadow = "0 0 0 3px rgba(33,118,174,0.12)"}
                    onBlur={e => e.target.style.boxShadow = ""}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Last Name
                </label>
                <input
                  required
                  placeholder="Last name"
                  value={form.last_name}
                  onChange={e => f("last_name", e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-sm focus:outline-none bg-white shadow-sm"
                  onFocus={e => e.target.style.boxShadow = "0 0 0 3px rgba(33,118,174,0.12)"}
                  onBlur={e => e.target.style.boxShadow = ""}
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100">
                  <Mail size={13} className="text-slate-400" />
                </div>
                <input
                  type="email"
                  required
                  placeholder="your@email.com"
                  value={form.email}
                  onChange={e => f("email", e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-2xl text-sm focus:outline-none bg-white shadow-sm"
                  onFocus={e => e.target.style.boxShadow = "0 0 0 3px rgba(33,118,174,0.12)"}
                  onBlur={e => e.target.style.boxShadow = ""}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                Password
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100">
                  <Lock size={13} className="text-slate-400" />
                </div>
                <input
                  type="password"
                  required
                  placeholder="Minimum 8 characters"
                  value={form.password}
                  onChange={e => f("password", e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-2xl text-sm focus:outline-none bg-white shadow-sm"
                  onFocus={e => e.target.style.boxShadow = "0 0 0 3px rgba(33,118,174,0.12)"}
                  onBlur={e => e.target.style.boxShadow = ""}
                />
              </div>
              {/* Strength bar */}
              {pwStrength && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex gap-1 flex-1">
                    {["weak","medium","strong"].map((level, i) => {
                      const active = pwStrength === "weak"   ? i === 0
                                   : pwStrength === "medium" ? i <= 1
                                   : true;
                      return (
                        <div key={level} className={`h-1 flex-1 rounded-full transition-all ${
                          active
                            ? pwStrength === "weak"   ? "bg-red-400"
                            : pwStrength === "medium" ? "bg-amber-400"
                            : "bg-emerald-400"
                            : "bg-slate-200"
                        }`} />
                      );
                    })}
                  </div>
                  <span className={`text-xs font-medium ${
                    pwStrength === "weak"   ? "text-red-500"
                    : pwStrength === "medium" ? "text-amber-500"
                    : "text-emerald-600"
                  }`}>
                    {pwStrength === "weak" ? "Too short" : pwStrength === "medium" ? "Almost" : "Strong"}
                  </span>
                </div>
              )}
            </div>

            {/* DOB + Gender */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Date of Birth
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100">
                    <Calendar size={13} className="text-slate-400" />
                  </div>
                  <input
                    type="date"
                    required
                    value={form.date_of_birth}
                    onChange={e => f("date_of_birth", e.target.value)}
                    className="w-full pl-12 pr-3 py-3 border border-slate-200 rounded-2xl text-sm focus:outline-none bg-white shadow-sm"
                    onFocus={e => e.target.style.boxShadow = "0 0 0 3px rgba(33,118,174,0.12)"}
                    onBlur={e => e.target.style.boxShadow = ""}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Gender
                </label>
                <select
                  required
                  value={form.gender}
                  onChange={e => f("gender", e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-sm focus:outline-none bg-white shadow-sm"
                  onFocus={e => e.target.style.boxShadow = "0 0 0 3px rgba(33,118,174,0.12)"}
                  onBlur={e => e.target.style.boxShadow = ""}
                >
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                Phone Number
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100">
                  <Phone size={13} className="text-slate-400" />
                </div>
                <input
                  type="tel"
                  required
                  placeholder="10-digit mobile number"
                  value={form.phone}
                  onChange={e => f("phone", e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-2xl text-sm focus:outline-none bg-white shadow-sm"
                  onFocus={e => e.target.style.boxShadow = "0 0 0 3px rgba(33,118,174,0.12)"}
                  onBlur={e => e.target.style.boxShadow = ""}
                />
              </div>
            </div>

            {/* Info note */}
            <div className="flex items-start gap-3 p-3.5 rounded-2xl"
              style={{ background: "rgba(33,118,174,0.06)", border: "1px solid rgba(33,118,174,0.12)" }}>
              <CheckCircle size={15} className="text-sky-500 flex-shrink-0 mt-0.5" />
              <p className="text-sky-700 text-xs leading-relaxed">
                Blood group and medical history will be added by your doctor during your first visit. No medical information is needed at signup.
              </p>
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
              className="w-full flex items-center justify-center gap-2 text-white font-semibold py-3.5 rounded-2xl transition-all duration-200 disabled:opacity-60 mt-1"
              style={{
                background: "linear-gradient(135deg, #2176AE, #1A4A7A)",
                boxShadow: "0 4px 24px rgba(33,118,174,0.35)"
              }}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating account...
                </>
              ) : (
                <>
                  Create Account
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-5">
            Already have an account?{" "}
            <Link to="/" className="font-semibold hover:underline" style={{ color: "#2176AE" }}>
              Sign in
            </Link>
          </p>

          <p className="text-center text-xs text-slate-400 mt-6">
            Impact pSiddhi 3.0 · S4-I-07 · All data is synthetic
          </p>
        </div>
      </div>
    </div>
  );
}