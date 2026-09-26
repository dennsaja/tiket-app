"use client";

import toast from "react-hot-toast";
import { CheckCircle, XCircle, AlertTriangle, Info } from "lucide-react";

function showToast(
  message: string,
  type: "success" | "error" | "warning" | "info" = "info"
) {
  const icons = {
    success: <CheckCircle className="h-4 w-4 text-green-500" />,
    error: <XCircle className="h-4 w-4 text-red-500" />,
    warning: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
    info: <Info className="h-4 w-4 text-blue-500" />,
  };

  return toast(message, {
    icon: icons[type],
    style: {
      background: "#fff",
      color: "#111827",
      border: "1px solid #e5e7eb",
      borderRadius: "6px",
      fontSize: "13px",
      padding: "10px 14px",
    },
  });
}

const showSuccess = (message: string) =>
  toast.success(message, {
    style: {
      background: "#fff",
      color: "#111827",
      border: "1px solid #e5e7eb",
      borderRadius: "6px",
      fontSize: "13px",
    },
  });

const showError = (message: string) =>
  toast.error(message, {
    style: {
      background: "#fff",
      color: "#111827",
      border: "1px solid #e5e7eb",
      borderRadius: "6px",
      fontSize: "13px",
    },
  });

const showLoading = (message: string) =>
  toast.loading(message, {
    style: {
      background: "#fff",
      color: "#111827",
      border: "1px solid #e5e7eb",
      borderRadius: "6px",
      fontSize: "13px",
    },
  });

const dismissToast = (id: string) => toast.dismiss(id);

export { showToast, showSuccess, showError, showLoading, dismissToast };
export { toast };
