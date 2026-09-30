import * as React from "react";
import { cn } from "@/lib/utils";
import { Info, CheckCircle2, AlertTriangle, AlertCircle } from "lucide-react";

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "info" | "success" | "warning" | "error";
  title?: string;
}

export function Alert({ className, variant = "info", title, children, ...props }: AlertProps) {
  const icons = {
    info: <Info className="h-5 w-5 text-sky-400 drop-shadow-[0_0_6px_rgba(56,189,248,0.5)]" />,
    success: <CheckCircle2 className="h-5 w-5 text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.5)]" />,
    warning: <AlertTriangle className="h-5 w-5 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]" />,
    error: <AlertCircle className="h-5 w-5 text-red-400 drop-shadow-[0_0_6px_rgba(248,113,113,0.5)]" />,
  };

  const styles = {
    info: "bg-sky-500/10 border-sky-500/20 text-sky-200",
    success: "bg-emerald-500/10 border-emerald-500/20 text-emerald-200",
    warning: "bg-amber-500/10 border-amber-500/20 text-amber-200",
    error: "bg-red-500/10 border-red-500/20 text-red-200",
  };

  return (
    <div
      role="alert"
      className={cn("flex gap-3 rounded-xl border p-4 text-sm leading-relaxed backdrop-blur-md shadow-glass-sm", styles[variant], className)}
      {...props}
    >
      <div className="flex-shrink-0 mt-0.5">{icons[variant]}</div>
      <div className="space-y-1">
        {title && <h5 className="font-semibold text-sm leading-tight text-white">{title}</h5>}
        <div className="text-xs sm:text-sm leading-normal opacity-90">{children}</div>
      </div>
    </div>
  );
}
