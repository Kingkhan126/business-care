import * as React from "react";
import { cn } from "@/lib/utils";
import { FolderOpen } from "lucide-react";
import { Button } from "./Button";

export interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 glass-panel p-8 text-center sm:p-12 shadow-glass-sm",
        className
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl glass-surface border border-white/10 text-indigo-400 mb-4 shadow-glass-md animate-float-3d">
        {icon || <FolderOpen className="h-7 w-7 drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]" />}
      </div>
      <h3 className="text-base font-semibold text-slate-100 text-depth">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-slate-400 leading-relaxed text-depth-subtle">{description}</p>
      {actionLabel && onAction && (
        <div className="mt-6">
          <Button onClick={onAction}>{actionLabel}</Button>
        </div>
      )}
    </div>
  );
}
