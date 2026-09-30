import * as React from "react";
import { cn } from "@/lib/utils";
import { AlertOctagon, RotateCw } from "lucide-react";
import { Button } from "./Button";

export interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this information. Please try again or contact support.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50/50 p-8 text-center sm:p-12",
        className
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 mb-4">
        <AlertOctagon className="h-6 w-6" />
      </div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-slate-600 leading-relaxed">{description}</p>
      {onRetry && (
        <div className="mt-6">
          <Button variant="outline" onClick={onRetry} className="gap-2">
            <RotateCw className="h-4 w-4" />
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}
