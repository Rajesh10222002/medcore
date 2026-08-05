import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";

// Auth
import Login    from "./pages/auth/Login";
import Signup   from "./pages/auth/Signup";

// Patient
import Dashboard        from "./pages/patient/Dashboard";
import Appointments     from "./pages/patient/Appointments";
import History          from "./pages/patient/History";
import Chatbot          from "./pages/patient/Chatbot";
import PatientSettings  from "./pages/patient/Settings";

// Doctor
import DoctorDashboard  from "./pages/doctor/Dashboard";
import Patients      from "./pages/doctor/Patients";
import PatientDetail from "./pages/doctor/PatientDetail";
import Notes         from "./pages/doctor/Notes";
import Copilot       from "./pages/doctor/Copilot";
import Schedule      from "./pages/doctor/Schedule";
import DoctorSettings from "./pages/doctor/Settings";

// Admin
import AdminDashboard    from "./pages/admin/Dashboard";
import AdminPatients     from "./pages/admin/Patients";
import AdminPatientDetail from "./pages/admin/PatientDetail";
import AdminDoctors      from "./pages/admin/Doctors";
import AdminDoctorDetail from "./pages/admin/DoctorDetail";
import AdminAppointments from "./pages/admin/Appointments";
import AdminSettings     from "./pages/admin/Settings";

function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-white/60 text-sm">Loading MedCore AI...</p>
      </div>
    </div>
  );
  if (!user) return <Navigate to="/" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
    <Routes location={location} key={location.pathname}>
      {/* Public */}
      <Route path="/"       element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      {/* Patient */}
      <Route path="/patient" element={
        <ProtectedRoute role="patient"><Dashboard /></ProtectedRoute>
      }/>
      <Route path="/patient/appointments" element={
        <ProtectedRoute role="patient"><Appointments /></ProtectedRoute>
      }/>
      <Route path="/patient/history" element={
        <ProtectedRoute role="patient"><History /></ProtectedRoute>
      }/>
      <Route path="/patient/chatbot" element={
        <ProtectedRoute role="patient"><Chatbot /></ProtectedRoute>
      }/>
      <Route path="/patient/settings" element={
        <ProtectedRoute role="patient"><PatientSettings /></ProtectedRoute>
      }/>

      {/* Doctor */}
      <Route path="/doctor" element={
        <ProtectedRoute role="doctor"><DoctorDashboard /></ProtectedRoute>
      }/>
      <Route path="/doctor/patients" element={
        <ProtectedRoute role="doctor"><Patients /></ProtectedRoute>
      }/>
      <Route path="/doctor/patient/:id" element={
        <ProtectedRoute role="doctor"><PatientDetail /></ProtectedRoute>
      }/>
      <Route path="/doctor/notes" element={
        <ProtectedRoute role="doctor"><Notes /></ProtectedRoute>
      }/>
      <Route path="/doctor/schedule" element={
        <ProtectedRoute role="doctor"><Schedule /></ProtectedRoute>
      }/>
      <Route path="/doctor/copilot" element={
        <ProtectedRoute role="doctor"><Copilot /></ProtectedRoute>
      }/>
      <Route path="/doctor/settings" element={
        <ProtectedRoute role="doctor"><DoctorSettings /></ProtectedRoute>
      }/>

      {/* Admin */}
      <Route path="/admin" element={
        <ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>
      }/>
      <Route path="/admin/patients" element={
        <ProtectedRoute role="admin"><AdminPatients /></ProtectedRoute>
      }/>
      <Route path="/admin/patients/:id" element={
        <ProtectedRoute role="admin"><AdminPatientDetail /></ProtectedRoute>
      }/>
      <Route path="/admin/doctors" element={
        <ProtectedRoute role="admin"><AdminDoctors /></ProtectedRoute>
      }/>
      <Route path="/admin/doctors/:id" element={
        <ProtectedRoute role="admin"><AdminDoctorDetail /></ProtectedRoute>
      }/>
      <Route path="/admin/appointments" element={
        <ProtectedRoute role="admin"><AdminAppointments /></ProtectedRoute>
      }/>
      <Route path="/admin/settings" element={
        <ProtectedRoute role="admin"><AdminSettings /></ProtectedRoute>
      }/>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}