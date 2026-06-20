import axios from "axios";

const BASE = import.meta.env.VITE_API_URL;

// Auto-attach token to every request
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── AUTH ──────────────────────────────────────────────
export const signup = (data) =>
  axios.post(`${BASE}/auth/signup`, data);
export const login = (data) =>
  axios.post(`${BASE}/auth/login`, data);

// ── PATIENTS ──────────────────────────────────────────
export const getMyProfile    = ()   => axios.get(`${BASE}/patients/me`);
export const getMyFHIR       = ()   => axios.get(`${BASE}/patients/me/fhir`);
export const getPatients     = ()   => axios.get(`${BASE}/patients`);
export const getPatient      = (id) => axios.get(`${BASE}/patients/${id}`);

// ── DOCTORS ───────────────────────────────────────────
export const getDoctors      = ()   => axios.get(`${BASE}/doctors`);

// ── APPOINTMENTS ──────────────────────────────────────
export const getMyAppointments  = ()      => axios.get(`${BASE}/appointments/mine`);
export const getAllAppointments  = ()      => axios.get(`${BASE}/appointments/all`);
export const bookAppointment    = (data)  => axios.post(`${BASE}/appointments`, data);
export const cancelAppointment  = (id)    => axios.put(`${BASE}/appointments/${id}/cancel`);
export const getAvailableSlots  = (doc, date) =>
  axios.get(`${BASE}/appointments/slots?doctor_id=${doc}&date=${date}`);

// ── DOCTOR PORTAL ─────────────────────────────────────
export const getDoctorProfile   = ()       => axios.get(`${BASE}/doctor/me`);
export const getDoctorPatients  = ()       => axios.get(`${BASE}/doctor/patients`);
export const getDoctorPatient   = (id)     => axios.get(`${BASE}/doctor/patients/${id}`);
export const saveClinicalNote   = (id, d)  => axios.post(`${BASE}/doctor/notes/${id}`, d);
export const saveVitals         = (id, d)  => axios.post(`${BASE}/doctor/vitals/${id}`, d);
export const addDiagnosis       = (id, d)  => axios.post(`${BASE}/doctor/diagnosis/${id}`, d);
export const addMedication      = (id, d)  => axios.post(`${BASE}/doctor/medication/${id}`, d);
export const addAllergy         = (id, d)  => axios.post(`${BASE}/doctor/allergy/${id}`, d);

// ── AI FEATURES ───────────────────────────────────────
export const getHealthSummaryAI    = ()       => axios.get(`${BASE}/ai/health-summary`);
export const explainLab            = (data)   => axios.post(`${BASE}/ai/explain-lab`, data);
export const checkDrugInteractions = (data)   => axios.post(`${BASE}/ai/drug-interaction`, data);
export const getPatientSummaryAI   = (id)     => axios.get(`${BASE}/ai/patient-summary/${id}`);
export const chat                  = (data)   => axios.post(`${BASE}/ai/chat`, data);
export const getSuggestedQuestions = ()       => axios.get(`${BASE}/ai/suggested-questions`);
export const getCopilot            = (data)   => axios.post(`${BASE}/ai/copilot`, data);

// ── ADMIN ─────────────────────────────────────────────
export const getAdminKPIs         = ()     => axios.get(`${BASE}/admin/kpis`);
export const getAdminPatients     = ()     => axios.get(`${BASE}/admin/patients`);
export const getAdminDoctors      = ()     => axios.get(`${BASE}/admin/doctors`);
export const createDoctor         = (data) => axios.post(`${BASE}/admin/doctors`, data);
export const getAdminAppointments = ()     => axios.get(`${BASE}/admin/appointments`);