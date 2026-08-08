import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";

/*
  Modal — shared dialog wrapper.
  Closes on Escape and backdrop click, focuses the first
  focusable element on open, and exposes dialog a11y attributes.
*/
export default function Modal({ title, onClose, children, maxWidth = "max-w-md" }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  useEffect(() => {
    const el = dialogRef.current?.querySelector("input, select, textarea, button");
    el?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={`bg-white rounded-2xl shadow-2xl w-full ${maxWidth} overflow-hidden`}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          {typeof title === "string" ? (
            <h3 className="font-semibold text-slate-800">{title}</h3>
          ) : (
            <div className="flex items-center gap-3">{title}</div>
          )}
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 flex-shrink-0"
          >
            <X size={18} className="text-slate-400" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </motion.div>
    </div>
  );
}
