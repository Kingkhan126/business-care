import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center text-slate-900 font-sans">
      <p className="font-mono text-xs font-semibold text-indigo-600 uppercase tracking-widest">404 Error</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">We couldn&apos;t find that page</h1>
      <p className="mt-2 text-sm text-slate-500 max-w-sm">
        The page you are looking for does not exist or has been moved.
      </p>
      <div className="mt-6">
        <Link href="/dashboard">
          <Button variant="primary">Return to Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
