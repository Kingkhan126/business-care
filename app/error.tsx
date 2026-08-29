"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Log server-side details for observability tooling; never render them.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-paper px-6 text-center text-ink">
      <h1 className="font-display text-2xl font-semibold">Something went wrong.</h1>
      <p className="mt-2 max-w-sm text-sm text-ink-soft">
        We hit a problem loading this page. Try again, and if it keeps happening, contact support.
      </p>
      <Button onClick={reset} className="mt-6">
        Try again
      </Button>
    </div>
  );
}
