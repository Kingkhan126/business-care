import { getCurrentSessionUser } from "@/lib/auth/session";
import { SupplierService } from "@/server/services/SupplierService";
import { SupplierClientPage } from "@/components/vendors/SupplierClientPage";

export default async function VendorsPage() {
  const user = await getCurrentSessionUser();
  let initialSuppliers: any[] = [];
  let initialTotal = 0;

  if (user) {
    try {
      const res = await SupplierService.list(user);
      initialSuppliers = JSON.parse(JSON.stringify(res.items));
      initialTotal = res.total;
    } catch {
      // Handled gracefully in client
    }
  }

  return <SupplierClientPage initialSuppliers={initialSuppliers} initialTotal={initialTotal} />;
}
