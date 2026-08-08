import { motion } from "framer-motion";

/*
  EmptyState — shared "nothing here yet" placeholder.
  variant="plain"  → small icon + text (list/table sections)
  variant="dashed" → icon in a dashed box, for hero-style empty states with a CTA
*/
export default function EmptyState({
  icon: Icon, title, message, action,
  variant = "plain", size = 48, className = "py-12",
  iconClassName = "text-slate-200"
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className={`${className} text-center`}
    >
      {Icon && (
        variant === "dashed" ? (
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(100,116,139,0.05)", border: "1px dashed rgba(100,116,139,0.2)" }}>
            <Icon size={26} className="text-slate-300" />
          </div>
        ) : (
          <Icon className={`${iconClassName} mx-auto mb-3`} size={size} />
        )
      )}
      {title && <p className="text-slate-400 text-sm font-medium">{title}</p>}
      {message && <p className="text-slate-300 text-xs mt-1">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </motion.div>
  );
}
