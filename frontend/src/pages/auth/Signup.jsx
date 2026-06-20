/*
  Signup Page — Patient only
  
  Fields collected:
  - first_name, last_name (identity)
  - email, password (auth)
  - date_of_birth, gender, phone (profile)
  
  NOT collected at signup:
  - blood_group (doctor adds this later)
  - medical history (progressive — added by doctor)
*/

import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { signup as signupAPI } from "../../api/api";
import { Heart, User, Mail, Lock, Phone, Calendar, ArrowRight, AlertCircle, CheckCircle } from "lucide-react";

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

  // Helper to update one field at a time
  const f = (key, value) => setForm({ ...form, [key]: value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Frontend validation
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters");
      setLoading(false);
      return;
    }

    try {
      const res = await signupAPI(form);
      const { token, name } = res.data;

      login({ name, role: "patient" }, token);
      navigate("/patient");

    } catch (err) {
      setError(err.response?.data?.error || "Signup failed. Try again.");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-800 to-navy-700 flex items-center justify-center px-4 py-8">

      {/* Background blobs */}
      <div className="absolute inset-0 opacity-5 overflow-hidden">
        <div className="absolute top-10 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-300 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg">

        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">

          {/* Top accent */}
          <div className="h-2 bg-gradient-to-r from-navy-700 via-navy-500 to-gold" />

          <div className="p-8">

            {/* Logo */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-navy-900 rounded-2xl mb-3 shadow-lg">
                <Heart className="text-white" size={24} />
              </div>
              <h1 className="text-2xl font-bold text-navy-900">
                Create Account
              </h1>
              <p className="text-slate-500 text-sm mt-1">
                Patient registration · MedCore AI
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
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                      required
                      placeholder="First name"
                      value={form.first_name}
                      onChange={(e) => f("first_name", e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-navy-500 bg-slate-50"
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
                    onChange={(e) => f("last_name", e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-navy-500 bg-slate-50"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input
                    type="email"
                    required
                    placeholder="your@email.com"
                    value={form.email}
                    onChange={(e) => f("email", e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-navy-500 bg-slate-50"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input
                    type="password"
                    required
                    placeholder="Minimum 8 characters"
                    value={form.password}
                    onChange={(e) => f("password", e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-navy-500 bg-slate-50"
                  />
                </div>
                {/* Password strength indicator */}
                {form.password && (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <div className={`h-1 flex-1 rounded-full ${form.password.length >= 8 ? "bg-green-400" : "bg-red-300"}`} />
                    <span className={`text-xs ${form.password.length >= 8 ? "text-green-600" : "text-red-500"}`}>
                      {form.password.length >= 8 ? "Strong" : "Too short"}
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
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                      type="date"
                      required
                      value={form.date_of_birth}
                      onChange={(e) => f("date_of_birth", e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-navy-500 bg-slate-50"
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
                    onChange={(e) => f("gender", e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-navy-500 bg-slate-50"
                  >
                    <option value="">Select</option>
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
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input
                    type="tel"
                    required
                    placeholder="10-digit mobile number"
                    value={form.phone}
                    onChange={(e) => f("phone", e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-navy-500 bg-slate-50"
                  />
                </div>
              </div>

              {/* Note about blood group */}
              <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                <CheckCircle className="text-blue-500 flex-shrink-0 mt-0.5" size={14} />
                <p className="text-xs text-blue-600">
                  Blood group and medical history will be added by your doctor during your first visit.
                </p>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-navy-900 hover:bg-navy-800 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Creating account...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Create Account <ArrowRight size={16} />
                  </span>
                )}
              </button>
            </form>

            <p className="text-center text-sm text-slate-500 mt-5">
              Already have an account?{" "}
              <Link to="/" className="text-navy-600 font-semibold hover:underline">
                Login
              </Link>
            </p>

          </div>
        </div>

        <p className="text-center text-xs text-white/40 mt-6">
          Impact pSiddhi 3.0 · S4-I-07 · All data is synthetic
        </p>
      </div>
    </div>
  );
}