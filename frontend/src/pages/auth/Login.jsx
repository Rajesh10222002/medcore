/*
  Login Page
  
  WHY: Entry point for all users.
  After login → redirected based on role:
    patient → /patient
    doctor  → /doctor
    admin   → /admin
  
  STATE:
  - form = stores email + password input values
  - error = shows error message if login fails
  - loading = disables button while API call is happening
*/

import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { login as loginAPI } from "../../api/api";
import { Heart, Mail, Lock, ArrowRight, AlertCircle } from "lucide-react";

export default function Login() {
  const [form, setForm]       = useState({ email: "", password: "" });
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const { login }             = useAuth();
  const navigate              = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    // e.preventDefault() stops the form from refreshing the page
    
    setLoading(true);
    setError("");

    try {
      const res = await loginAPI(form);
      // Calls POST /api/auth/login with email + password
      // await = wait for response before continuing

      const { token, role, name } = res.data;
      // Destructure = extract these 3 values from response

      login({ name, role }, token);
      // Save to AuthContext + localStorage

      // Redirect based on role
      if      (role === "patient") navigate("/patient");
      else if (role === "doctor")  navigate("/doctor");
      else if (role === "admin")   navigate("/admin");

    } catch (err) {
      // err.response.data.error = error message from Flask
      setError(err.response?.data?.error || "Login failed. Try again.");
      // ?. = optional chaining — avoids crash if response is undefined
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-800 to-navy-700 flex items-center justify-center px-4">

      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-blue-300 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">

          {/* Top accent */}
          <div className="h-2 bg-gradient-to-r from-navy-700 via-navy-500 to-gold" />

          <div className="p-8">

            {/* Logo */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-navy-900 rounded-2xl mb-4 shadow-lg">
                <Heart className="text-white" size={28} />
              </div>
              <h1 className="text-2xl font-bold text-navy-900">
                MedCore <span className="text-navy-500">AI</span>
              </h1>
              <p className="text-slate-500 text-sm mt-1">
                Healthcare Patient Management System
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="email"
                    required
                    placeholder="your@email.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent bg-slate-50"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="password"
                    required
                    placeholder="Enter your password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent bg-slate-50"
                  />
                </div>
              </div>

              {/* Error message */}
              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-navy-900 hover:bg-navy-800 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl mt-2"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Logging in...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Login <ArrowRight size={16} />
                  </span>
                )}
              </button>
            </form>

            {/* Signup link */}
            <p className="text-center text-sm text-slate-500 mt-6">
              New patient?{" "}
              <Link
                to="/signup"
                className="text-navy-600 font-semibold hover:text-navy-500 hover:underline"
              >
                Create account
              </Link>
            </p>

            {/* Demo credentials */}
            <div className="mt-6 bg-slate-50 border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">
                Demo Credentials
              </p>
              <div className="space-y-1 text-xs text-slate-500">
                <p><span className="font-medium text-slate-700">Admin:</span> admin@medcore.ai / admin123</p>
                <p><span className="font-medium text-slate-700">Doctor:</span> Created by admin</p>
                <p><span className="font-medium text-slate-700">Patient:</span> Sign up below</p>
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-white/40 mt-6">
          Impact pSiddhi 3.0 · S4-I-07 · All data is synthetic
        </p>

      </div>
    </div>
  );
}