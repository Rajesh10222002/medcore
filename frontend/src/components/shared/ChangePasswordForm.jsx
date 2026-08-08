import { useState } from "react";
import { Lock, CheckCircle, Loader2 } from "lucide-react";
import { changePassword } from "../../api/api";
import { showSuccess, showError } from "./Toast";

export default function ChangePasswordForm({ accentColor = "#2176AE", ringClass = "focus:ring-sky-500" }) {
  const [form, setForm] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [saving, setSaving] = useState(false);

  const f = (key, val) => setForm({ ...form, [key]: val });

  const newPwTooShort = form.new_password.length > 0 && form.new_password.length < 8;
  const pwMismatch     = form.confirm_password.length > 0 && form.new_password !== form.confirm_password;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.new_password.length < 8) {
      showError("New password must be at least 8 characters");
      return;
    }
    if (form.new_password !== form.confirm_password) {
      showError("New password and confirmation don't match");
      return;
    }
    setSaving(true);
    try {
      await changePassword({
        current_password: form.current_password,
        new_password:     form.new_password,
      });
      showSuccess("Password updated successfully");
      setForm({ current_password: "", new_password: "", confirm_password: "" });
    } catch (err) {
      showError(err.response?.data?.error || "Failed to update password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
          Current Password
        </label>
        <input
          type="password"
          required
          value={form.current_password}
          onChange={e => f("current_password", e.target.value)}
          className={`w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 ${ringClass} bg-slate-50`}
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
          New Password
        </label>
        <input
          type="password"
          required
          placeholder="Minimum 8 characters"
          value={form.new_password}
          onChange={e => f("new_password", e.target.value)}
          className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 ${ringClass} bg-slate-50 ${
            newPwTooShort ? "border-red-300" : "border-slate-200"
          }`}
        />
        {newPwTooShort && (
          <p className="text-red-500 text-xs mt-1.5">Must be at least 8 characters</p>
        )}
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
          Confirm New Password
        </label>
        <input
          type="password"
          required
          value={form.confirm_password}
          onChange={e => f("confirm_password", e.target.value)}
          className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 ${ringClass} bg-slate-50 ${
            pwMismatch ? "border-red-300" : "border-slate-200"
          }`}
        />
        {pwMismatch && (
          <p className="text-red-500 text-xs mt-1.5">Passwords don't match</p>
        )}
      </div>
      <button
        type="submit"
        disabled={saving || newPwTooShort || pwMismatch}
        className="flex items-center justify-center gap-2 text-white font-semibold py-2.5 px-5 rounded-xl transition-all disabled:opacity-50"
        style={{ background: accentColor }}
      >
        {saving
          ? <><Loader2 size={16} className="animate-spin" /> Updating...</>
          : <><Lock size={16} /> Update Password</>
        }
      </button>
    </form>
  );
}
