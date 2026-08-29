import { clsx } from "clsx";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalized = status.toUpperCase();

  let colorClasses = "bg-slate-100 text-slate-800 border-slate-300";

  if (normalized === "APPROVED" || normalized === "DELIVERED" || normalized === "PAID") {
    colorClasses = "bg-emerald-100 text-emerald-800 border-emerald-300";
  } else if (normalized === "PENDING_REVIEW" || normalized === "PRESCRIPTION_VERIFICATION") {
    colorClasses = "bg-amber-100 text-amber-900 border-amber-300";
  } else if (normalized === "REJECTED" || normalized === "CANCELLED" || normalized === "FAILED") {
    colorClasses = "bg-red-100 text-red-800 border-red-300";
  } else if (normalized === "PROCESSING" || normalized === "SHIPPED") {
    colorClasses = "bg-teal-100 text-teal-800 border-teal-300";
  }

  return (
    <span
      className={clsx(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-xs",
        colorClasses,
        className
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
