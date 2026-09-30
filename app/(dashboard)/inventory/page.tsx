import { getCurrentSessionUser } from "@/lib/auth/session";
import { InventoryService } from "@/server/services/InventoryService";
import { MasterDataService } from "@/server/services/MasterDataService";
import { ProductService } from "@/server/services/ProductService";
import { InventoryClientPage } from "@/components/inventory/InventoryClientPage";

export default async function InventoryPage() {
  const user = await getCurrentSessionUser();
  let initialItems: any[] = [];
  let initialAdjustments: any[] = [];
  let warehouses: any[] = [];
  let products: any[] = [];

  if (user) {
    try {
      const [balRes, adjRes, whRes, prodRes] = await Promise.all([
        InventoryService.listStockBalances(user),
        InventoryService.listStockAdjustments(user),
        MasterDataService.listWarehouses(user),
        ProductService.list(user),
      ]);

      initialItems = JSON.parse(JSON.stringify(balRes.items));
      initialAdjustments = JSON.parse(JSON.stringify(adjRes.items));
      warehouses = JSON.parse(JSON.stringify(whRes));
      products = JSON.parse(JSON.stringify(prodRes.items));
    } catch {
      // Handled gracefully
    }
  }

  return (
    <InventoryClientPage
      initialItems={initialItems}
      initialAdjustments={initialAdjustments}
      warehouses={warehouses}
      products={products}
    />
  );
}
