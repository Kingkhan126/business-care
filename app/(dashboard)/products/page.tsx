import { getCurrentSessionUser } from "@/lib/auth/session";
import { ProductService } from "@/server/services/ProductService";
import { ServiceItemService } from "@/server/services/ServiceItemService";
import { ProductClientPage } from "@/components/products/ProductClientPage";

export default async function ProductsPage() {
  const user = await getCurrentSessionUser();
  let initialProducts: any[] = [];
  let initialServices: any[] = [];

  if (user) {
    try {
      const [prodRes, servRes] = await Promise.all([
        ProductService.list(user),
        ServiceItemService.list(user),
      ]);
      initialProducts = JSON.parse(JSON.stringify(prodRes.items));
      initialServices = JSON.parse(JSON.stringify(servRes.items));
    } catch {
      // Handled gracefully
    }
  }

  return <ProductClientPage initialProducts={initialProducts} initialServices={initialServices} />;
}
