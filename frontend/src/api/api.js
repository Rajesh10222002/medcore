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
export const changePassword = (data) =>
  axios.put(`${BASE}/auth/change-password`, data);

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
export const getDoctorAnalytics = ()       => axios.get(`${BASE}/doctor/analytics`);
export const getDoctorPatients  = (params) => axios.get(`${BASE}/doctor/patients`, { params });
export const getDoctorPatient   = (id)     => axios.get(`${BASE}/doctor/patients/${id}`);
export const saveClinicalNote   = (id, d)  => axios.post(`${BASE}/doctor/notes/${id}`, d);
export const saveVitals         = (id, d)  => axios.post(`${BASE}/doctor/vitals/${id}`, d);
export const addDiagnosis       = (id, d)  => axios.post(`${BASE}/doctor/diagnosis/${id}`, d);
export const addMedication      = (id, d)  => axios.post(`${BASE}/doctor/medication/${id}`, d);
export const addAllergy         = (id, d)  => axios.post(`${BASE}/doctor/allergy/${id}`, d);
export const setBloodGroup      = (id, d)  => axios.post(`${BASE}/doctor/blood-group/${id}`, d);
export const getBloodGroup      = (id)     => axios.get(`${BASE}/doctor/blood-group/${id}`);

// ── AI FEATURES ───────────────────────────────────────
export const getHealthSummaryAI    = ()       => axios.get(`${BASE}/ai/health-summary`);
export const explainLab            = (data)   => axios.post(`${BASE}/ai/explain-lab`, data);
export const checkDrugInteractions = (data)   => axios.post(`${BASE}/ai/drug-interaction`, data);
export const getPatientSummaryAI   = (id)     => axios.get(`${BASE}/ai/patient-summary/${id}`);
export const chat                  = (data)   => axios.post(`${BASE}/ai/chat`, data);
export const getSuggestedQuestions = ()       => axios.get(`${BASE}/ai/suggested-questions`);
export const getCopilot            = (data)   => axios.post(`${BASE}/ai/copilot`, data);
export const parseNote             = (data)   => axios.post(`${BASE}/ai/parse-note`, data);
export const suggestSpecialty      = (data)   => axios.post(`${BASE}/ai/suggest-specialty`, data);

// ── ADMIN ─────────────────────────────────────────────
export const getAdminKPIs         = ()       => axios.get(`${BASE}/admin/kpis`);
export const getAdminPatients     = (params) => axios.get(`${BASE}/admin/patients`, { params });
export const getAdminPatientDetail = (id)    => axios.get(`${BASE}/admin/patients/${id}`);
export const getAdminDoctors      = ()       => axios.get(`${BASE}/admin/doctors`);
export const getAdminDoctorDetail = (id)     => axios.get(`${BASE}/admin/doctors/${id}`);
export const createDoctor         = (data)   => axios.post(`${BASE}/admin/doctors`, data);
export const getAdminAppointments = (params) => axios.get(`${BASE}/admin/appointments`, { params });
// ── SCHEDULE (Doctor leave & calendar) ────────────────
export const getScheduleCalendar = ()         => axios.get(`${BASE}/doctor/schedule/calendar`);
export const getScheduleLeaves   = ()         => axios.get(`${BASE}/doctor/schedule/leaves`);
export const getDayDetail        = (date)     => axios.get(`${BASE}/doctor/schedule/day/${date}`);
export const addLeave            = (data)     => axios.post(`${BASE}/doctor/schedule/leave`, data);
export const deleteLeave         = (id)       => axios.delete(`${BASE}/doctor/schedule/leave/${id}`);

export const adminNLQuery = (data) => axios.post(`${BASE}/admin/nl-query`, data);

// ── SPECIALTIES ────────────────────────────────────────
export const getSpecialties  = ()     => axios.get(`${BASE}/admin/specialties`);
export const createSpecialty = (data) => axios.post(`${BASE}/admin/specialties`, data);

// ── APPOINTMENT TYPES ──────────────────────────────────
export const getAppointmentTypes = () => axios.get(`${BASE}/appointment-types`);

// ── PATIENT FEEDBACK ───────────────────────────────────
export const submitFeedback       = (appointmentId, data) =>
  axios.post(`${BASE}/patients/appointments/${appointmentId}/feedback`, data);
export const getMyDoctorFeedback  = ()   => axios.get(`${BASE}/doctor/me/feedback`);
export const getAdminDoctorFeedback = (id) => axios.get(`${BASE}/admin/doctors/${id}/feedback`);

// ── REFERRALS ──────────────────────────────────────────
export const createReferral         = (patientId, data) =>
  axios.post(`${BASE}/doctor/patients/${patientId}/referrals`, data);
export const getIncomingReferrals   = ()   => axios.get(`${BASE}/doctor/referrals/incoming`);
export const acceptReferral         = (id) => axios.put(`${BASE}/doctor/referrals/${id}/accept`);
export const declineReferral        = (id, data) => axios.put(`${BASE}/doctor/referrals/${id}/decline`, data);
export const getMyReferrals         = ()   => axios.get(`${BASE}/patients/me/referrals`);