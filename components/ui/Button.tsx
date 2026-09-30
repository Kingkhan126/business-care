import * as React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", isLoading = false, children, disabled, ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:opacity-50 disabled:pointer-events-none rounded-lg";

    const variants = {
      primary:
        "bg-gradient-to-b from-indigo-500 to-indigo-700 text-white bevel-raised hover:from-indigo-400 hover:to-indigo-600 hover:shadow-glow-indigo active:shadow-glass-inset active:from-indigo-600 active:to-indigo-800",
      secondary:
        "glass-surface text-slate-300 hover:bg-white/10 border border-white/10",
      outline:
        "border border-white/10 bg-transparent text-slate-300 hover:bg-white/5 hover:border-indigo-500/20",
      ghost:
        "text-slate-400 hover:bg-white/5 hover:text-slate-200",
      danger:
        "bg-gradient-to-b from-red-500 to-red-700 text-white bevel-raised hover:from-red-400 hover:to-red-600 hover:shadow-[0_0_20px_rgba(239,68,68,0.3)]",
    };

    const sizes = {
      sm: "h-8 px-3 text-xs",
      md: "h-10 px-4 text-sm",
      lg: "h-12 px-6 text-base",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
