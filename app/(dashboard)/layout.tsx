import { redirect } from "next/navigation";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { AppShell } from "@/components/layout/AppShell";
import { OrganizationService } from "@/server/services/OrganizationService";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentSessionUser();

  if (!user) {
    redirect("/login");
  }

  let orgName = "Acme Global Enterprises";
  let currency = "USD";

  try {
    const org = await OrganizationService.getOrganization(user);
    orgName = org.name;
    currency = org.currency;
  } catch {
    // Fallback if organization fetch fails
  }

  return (
    <AppShell user={user} organizationName={orgName} currency={currency}>
      {children}
    </AppShell>
  );
}
