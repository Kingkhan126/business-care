import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-paper px-6 text-center text-ink">
      <p className="font-mono text-sm text-ink-soft">404</p>
      <h1 className="mt-2 font-display text-2xl font-semibold">We couldn't find that page.</h1>
      <p className="mt-2 text-sm text-ink-soft">It may have moved, or the link may be incorrect.</p>
      <Link href="/dashboard" className="mt-6 font-medium text-seal">
        Go to dashboard
      </Link>
    </div>
  );
}
