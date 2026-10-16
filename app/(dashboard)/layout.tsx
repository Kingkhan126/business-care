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

  const organization = user.activeOrganizationId
    ? await OrganizationService.getWorkspaceSummary(user)
    : { name: "Workspace", currency: "" };

  return (
    <AppShell user={user} organizationName={organization.name} currency={organization.currency}>
      {children}
    </AppShell>
  );
}
