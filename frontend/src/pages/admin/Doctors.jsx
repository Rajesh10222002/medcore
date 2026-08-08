import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import AdminLayout from "../../components/AdminLayout";
import PageWrapper from "../../components/shared/PageWrapper";
import { SkeletonTable } from "../../components/shared/SkeletonCard";
import EmptyState from "../../components/shared/EmptyState";
import Modal from "../../components/shared/Modal";
import { getAdminDoctors, createDoctor, getSpecialties, createSpecialty } from "../../api/api";
import { showSuccess, showError } from "../../components/shared/Toast";
import {
  UserPlus, Stethoscope, Plus,
  CheckCircle, Loader2,
  Mail, Phone, Award, ChevronRight
} from "lucide-react";

export default function AdminDoctors() {
  const navigate = useNavigate();
  const [doctors,   setDoctors]   = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [showNewSpecialty, setShowNewSpecialty] = useState(false);
  const [newSpecialty, setNewSpecialty] = useState("");
  const [addingSpecialty, setAddingSpecialty] = useState(false);
  const [form, setForm] = useState({
    first_name: "", last_name: "", email: "",
    password: "", specialization: "", license_number: "", phone: ""
  });

  useEffect(() => { loadDoctors(); loadSpecialties(); }, []);

  const loadDoctors = () => {
    getAdminDoctors()
      .then(res => setDoctors(res.data))
      .catch(() => showError("Failed to load doctors"))
      .finally(() => setLoading(false));
  };

  const loadSpecialties = () => {
    getSpecialties()
      .then(res => setSpecialties(res.data))
      .catch(() => showError("Failed to load specialties"));
  };

  const handleAddSpecialty = async () => {
    const name = newSpecialty.trim();
    if (!name) return;
    setAddingSpecialty(true);
    try {
      await createSpecialty({ name });
      showSuccess(`"${name}" added to specialties`);
      setNewSpecialty("");
      setShowNewSpecialty(false);
      loadSpecialties();
      f("specialization", name);
    } catch (err) {
      showError(err.response?.data?.error || "Failed to add specialty");
    } finally {
      setAddingSpecialty(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createDoctor(form);
      showSuccess(`Dr. ${form.first_name} ${form.last_name} created successfully.`);
      setShowForm(false);
      setForm({
        first_name: "", last_name: "", email: "",
        password: "", specialization: "", license_number: "", phone: ""
      });
      loadDoctors();
    } catch (err) {
      showError(err.response?.data?.error || "Failed to create doctor");
    } finally {
      setSaving(false);
    }
  };

  const f = (key, val) => setForm({ ...form, [key]: val });

  if (loading) return (
    <AdminLayout><SkeletonTable rows={4} /></AdminLayout>
  );

  return (
    <AdminLayout>
      <PageWrapper>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Manage Doctors</h1>
            <p className="text-slate-500 text-sm mt-1">
              {doctors.length} doctors registered
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-violet-500 hover:bg-violet-600 text-white text-sm font-medium rounded-xl transition-colors shadow-lg"
          >
            <Plus size={16} /> Add Doctor
          </button>
        </div>

        {/* Create doctor modal */}
        <AnimatePresence>
          {showForm && (
            <Modal title="Add New Doctor" onClose={() => setShowForm(false)} maxWidth="max-w-lg">
                <form onSubmit={handleCreate} className="space-y-4">

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                        First Name *
                      </label>
                      <input
                        required
                        placeholder="First name"
                        value={form.first_name}
                        onChange={e => f("first_name", e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                        Last Name *
                      </label>
                      <input
                        required
                        placeholder="Last name"
                        value={form.last_name}
                        onChange={e => f("last_name", e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                      Email *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="doctor@medcore.ai"
                      value={form.email}
                      onChange={e => f("email", e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                      Password *
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Minimum 8 characters"
                      value={form.password}
                      onChange={e => f("password", e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                        Specialization *
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowNewSpecialty(v => !v)}
                        className="text-xs font-medium text-violet-600 hover:text-violet-700 flex items-center gap-0.5"
                      >
                        <Plus size={12} /> New
                      </button>
                    </div>
                    {showNewSpecialty && (
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          placeholder="e.g. Endocrinology"
                          value={newSpecialty}
                          onChange={e => setNewSpecialty(e.target.value)}
                          className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50"
                        />
                        <button
                          type="button"
                          disabled={addingSpecialty}
                          onClick={handleAddSpecialty}
                          className="px-3 py-2 bg-violet-500 hover:bg-violet-600 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
                        >
                          {addingSpecialty ? <Loader2 size={14} className="animate-spin" /> : "Add"}
                        </button>
                      </div>
                    )}
                    <select
                      required
                      value={form.specialization}
                      onChange={e => f("specialization", e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50"
                    >
                      <option value="">Select specialization...</option>
                      {specialties.map(s => (
                        <option key={s.specialty_id} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                        License Number *
                      </label>
                      <input
                        required
                        placeholder="MCI-2024-XXXXX"
                        value={form.license_number}
                        onChange={e => f("license_number", e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                        Phone *
                      </label>
                      <input
                        required
                        placeholder="10-digit number"
                        value={form.phone}
                        onChange={e => f("phone", e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full flex items-center justify-center gap-2 bg-violet-500 hover:bg-violet-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
                  >
                    {saving
                      ? <><Loader2 size={16} className="animate-spin" /> Creating...</>
                      : <><CheckCircle size={16} /> Create Doctor Account</>
                    }
                  </button>
                </form>
            </Modal>
          )}
        </AnimatePresence>

        {/* Doctors list */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="p-5 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">Doctor Accounts</h3>
          </div>
          {doctors.length === 0 ? (
            <EmptyState
              icon={Stethoscope}
              title="No doctors yet"
              message='Click "Add Doctor" to create the first doctor account'
            />
          ) : (
            <div className="divide-y divide-slate-50">
              {doctors.map((doc, i) => (
                <motion.div
                  key={doc.doctor_id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i, 10) * 0.04 }}
                  onClick={() => navigate(`/admin/doctors/${doc.doctor_id}`)}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-4 p-4 hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <div className="w-11 h-11 bg-gradient-to-br from-emerald-500 to-teal-400 rounded-full flex items-center justify-center flex-shrink-0 shadow">
                    <span className="text-white text-sm font-bold">
                      {doc.first_name[0]}{doc.last_name[0]}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-800 text-sm font-semibold">
                      Dr. {doc.first_name} {doc.last_name}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-slate-400 text-xs flex items-center gap-1">
                        <Stethoscope size={10} /> {doc.specialization}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="text-slate-400 text-xs flex items-center gap-1">
                        <Award size={10} /> {doc.license_number}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="text-slate-400 text-xs flex items-center gap-1">
                        <Mail size={10} /> {doc.email}
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-slate-800 text-sm font-bold">
                      {doc.total_appointments}
                    </p>
                    <p className="text-slate-400 text-xs">appointments</p>
                    <p className="text-slate-400 text-xs mt-0.5">
                      Since {doc.created_at}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-slate-300 flex-shrink-0" />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </PageWrapper>
    </AdminLayout>
  );
}