import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="border-b border-line bg-white/60 px-6 py-4">
        <nav className="mx-auto flex max-w-6xl items-center gap-6 text-sm font-medium">
          <span className="font-display text-base font-semibold">Admin</span>
          <Link href="/admin" className="text-ink-soft hover:text-ink">
            Overview
          </Link>
          <Link href="/admin/applications" className="text-ink-soft hover:text-ink">
            Applications
          </Link>
          <Link href="/admin/users" className="text-ink-soft hover:text-ink">
            Users
          </Link>
          <form action="/api/auth/logout" method="post" className="ml-auto">
            <button className="text-ink-soft hover:text-ink">Log out</button>
          </form>
        </nav>
      </div>
      {children}
    </div>
  );
}
