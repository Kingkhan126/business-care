import * as React from "react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  label: string;
  value: string | number;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  helperText?: string;
  error?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, options, helperText, error, id, children, ...props }, ref) => {
    const generatedId = React.useId();
    const selectId = id || generatedId;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={selectId} className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            "block w-full rounded-lg border border-white/10 glass-input py-2 px-3 text-sm text-slate-200 transition-all focus:border-indigo-500/40 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60",
            error && "border-red-500/50 focus:border-red-500/60 focus:ring-red-500/30",
            className
          )}
          {...props}
        >
          {options.map((opt) => (
            <option key={String(opt.value)} value={opt.value} disabled={opt.disabled} className="bg-slate-900 text-slate-200">
              {opt.label}
            </option>
          ))}
          {children}
        </select>
        {error ? (
          <p className="text-xs font-medium text-red-400">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-slate-500">{helperText}</p>
        ) : null}
      </div>
    );
  }
);
Select.displayName = "Select";
