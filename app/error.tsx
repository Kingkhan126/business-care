"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/ErrorState";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Global Error Caught:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6">
      <ErrorState
        title="Application Error Occurred"
        description="We encountered an unexpected problem loading this section. You may try again or contact support."
        onRetry={reset}
      />
    </div>
  );
}
