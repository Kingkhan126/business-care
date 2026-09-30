import { getCurrentSessionUser } from "@/lib/auth/session";
import { CustomerService } from "@/server/services/CustomerService";
import { CustomerClientPage } from "@/components/customers/CustomerClientPage";

export default async function CustomersPage() {
  const user = await getCurrentSessionUser();
  let initialCustomers: any[] = [];
  let initialTotal = 0;

  if (user) {
    try {
      const res = await CustomerService.list(user);
      initialCustomers = JSON.parse(JSON.stringify(res.items));
      initialTotal = res.total;
    } catch {
      // Handled gracefully in client
    }
  }

  return <CustomerClientPage initialCustomers={initialCustomers} initialTotal={initialTotal} />;
}
