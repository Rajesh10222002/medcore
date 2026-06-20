/*
  Toast — helper functions for showing
  professional toast notifications.
  Replaces all success/error state banners.
*/
import toast from "react-hot-toast";

export const showSuccess = (msg) => toast.success(msg);
export const showError   = (msg) => toast.error(msg);
export const showLoading = (msg) => toast.loading(msg);
export const dismiss     = (id)  => toast.dismiss(id);