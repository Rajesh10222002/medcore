import PatientLayout from "../../components/PatientLayout";
import PageWrapper from "../../components/shared/PageWrapper";
import ChangePasswordForm from "../../components/shared/ChangePasswordForm";
import { Lock } from "lucide-react";

export default function PatientSettings() {
  return (
    <PatientLayout>
      <PageWrapper>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
          <p className="text-slate-500 text-sm mt-1">Manage your account</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 max-w-lg">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(33,118,174,0.1)" }}>
              <Lock size={16} className="text-sky-600" />
            </div>
            <h3 className="font-semibold text-slate-800">Change Password</h3>
          </div>
          <ChangePasswordForm accentColor="#2176AE" ringClass="focus:ring-sky-500" />
        </div>

      </PageWrapper>
    </PatientLayout>
  );
}
