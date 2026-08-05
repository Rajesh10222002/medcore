import AdminLayout from "../../components/AdminLayout";
import PageWrapper from "../../components/shared/PageWrapper";
import ChangePasswordForm from "../../components/shared/ChangePasswordForm";
import { Lock } from "lucide-react";

export default function AdminSettings() {
  return (
    <AdminLayout>
      <PageWrapper>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
          <p className="text-slate-500 text-sm mt-1">Manage your account</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 max-w-lg">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center">
              <Lock size={16} className="text-violet-600" />
            </div>
            <h3 className="font-semibold text-slate-800">Change Password</h3>
          </div>
          <ChangePasswordForm accentColor="#7c3aed" ringClass="focus:ring-violet-500" />
        </div>

      </PageWrapper>
    </AdminLayout>
  );
}
