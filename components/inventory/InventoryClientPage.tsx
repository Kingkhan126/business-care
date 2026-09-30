"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Tabs, TabList, TabTrigger, TabContent } from "@/components/ui/Tabs";
import { Dialog } from "@/components/ui/Dialog";
import { Boxes, Sliders, History, Building } from "lucide-react";
import { StockAdjustmentInput } from "@/lib/validation/master_data";

interface InventoryItem {
  id: string;
  quantity: number | string;
  product: { id: string; name: string; sku: string; reorderLevel?: number | string | null };
  warehouse: { id: string; name: string; code: string };
}

interface AdjustmentItem {
  id: string;
  adjustmentType: string;
  quantityChange: number | string;
  previousQuantity: number | string;
  newQuantity: number | string;
  reason: string;
  createdAt: string | Date;
  product: { name: string; sku: string };
  warehouse: { name: string; code: string };
  createdBy: { name: string };
}

interface WarehouseItem {
  id: string;
  name: string;
  code: string;
  isDefault: boolean;
}

interface ProductItem {
  id: string;
  name: string;
  sku: string;
}

interface InventoryClientPageProps {
  initialItems: InventoryItem[];
  initialAdjustments: AdjustmentItem[];
  warehouses: WarehouseItem[];
  products: ProductItem[];
}

export function InventoryClientPage({
  initialItems,
  initialAdjustments,
  warehouses,
  products,
}: InventoryClientPageProps) {
  const [items, setItems] = React.useState<InventoryItem[]>(initialItems);
  const [adjustments, setAdjustments] = React.useState<AdjustmentItem[]>(initialAdjustments);
  const [isAdjustDialogOpen, setIsAdjustDialogOpen] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const [form, setForm] = React.useState<Partial<StockAdjustmentInput>>({
    productId: products[0]?.id || "",
    warehouseId: warehouses[0]?.id || "",
    adjustmentType: "INITIAL_STOCK",
    quantityChange: 10,
    reason: "Initial warehouse inventory count",
  });

  const fetchInventory = async () => {
    try {
      const resBal = await fetch("/api/inventory");
      if (resBal.ok) {
        const dataBal = await resBal.json();
        setItems(dataBal.items || []);
      }
      const resAdj = await fetch("/api/inventory?type=adjustments");
      if (resAdj.ok) {
        const dataAdj = await resAdj.json();
        setAdjustments(dataAdj.items || []);
      }
    } catch {
      // Ignore
    }
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      const res = await fetch("/api/inventory/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Stock adjustment failed");
      }

      setIsAdjustDialogOpen(false);
      fetchInventory();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Error adjusting stock");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Inventory & Stock Balances
          </h1>
          <p className="text-xs text-slate-500">
            Real-time stock balance tracking, warehouse locations, and transaction-audited stock adjustments.
          </p>
        </div>
        <Button onClick={() => setIsAdjustDialogOpen(true)} className="flex items-center gap-1.5 text-xs font-semibold">
          <Sliders className="h-4 w-4" /> Perform Stock Adjustment
        </Button>
      </div>

      <Tabs defaultValue="balances">
        <TabList className="bg-slate-100 p-1 rounded-lg">
          <TabTrigger value="balances" className="text-xs">
            Stock Balances ({items.length})
          </TabTrigger>
          <TabTrigger value="history" className="text-xs">
            Adjustment History ({adjustments.length})
          </TabTrigger>
        </TabList>

        {/* Balances Tab */}
        <TabContent value="balances">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Boxes className="h-5 w-5 text-indigo-600" /> Current Stock Balances by Warehouse
              </CardTitle>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  No inventory balances recorded yet. Click Perform Stock Adjustment to record stock.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Product Name</TableHead>
                      <TableHead>Warehouse</TableHead>
                      <TableHead>Stock Level</TableHead>
                      <TableHead>Stock Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => {
                      const qty = Number(item.quantity);
                      const reorder = item.product.reorderLevel ? Number(item.product.reorderLevel) : 0;
                      const isLowStock = qty <= reorder && qty > 0;
                      const isOutOfStock = qty <= 0;

                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-xs font-semibold text-indigo-600">
                            {item.product.sku}
                          </TableCell>
                          <TableCell className="font-medium text-slate-900">{item.product.name}</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1 font-mono text-xs text-slate-600">
                              <Building className="h-3 w-3 text-slate-400" /> {item.warehouse.name} ({item.warehouse.code})
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-xs font-bold text-slate-900">{qty}</TableCell>
                          <TableCell>
                            {isOutOfStock ? (
                              <Badge variant="error">Out of Stock</Badge>
                            ) : isLowStock ? (
                              <Badge variant="warning">Low Stock</Badge>
                            ) : (
                              <Badge variant="success">In Stock</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabContent>

        {/* History Tab */}
        <TabContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-5 w-5 text-indigo-600" /> Stock Adjustment Audit Trail
              </CardTitle>
            </CardHeader>
            <CardContent>
              {adjustments.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  No stock adjustments recorded yet.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Warehouse</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Change</TableHead>
                      <TableHead>New Balance</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Actor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {adjustments.map((adj) => (
                      <TableRow key={adj.id}>
                        <TableCell className="text-[11px] text-slate-500 font-mono">
                          {new Date(adj.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="font-medium text-xs text-slate-900">
                          {adj.product.name} ({adj.product.sku})
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">{adj.warehouse.name}</TableCell>
                        <TableCell>
                          <Badge variant="default">{adj.adjustmentType}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs font-bold">
                          {Number(adj.quantityChange) > 0 ? `+${adj.quantityChange}` : adj.quantityChange}
                        </TableCell>
                        <TableCell className="font-mono text-xs font-bold text-slate-900">
                          {adj.newQuantity}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">{adj.reason}</TableCell>
                        <TableCell className="text-xs text-slate-500">{adj.createdBy.name}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabContent>
      </Tabs>

      {/* Stock Adjustment Modal */}
      <Dialog
        isOpen={isAdjustDialogOpen}
        onClose={() => setIsAdjustDialogOpen(false)}
        title="Perform Stock Adjustment"
        description="Modify stock quantity with transaction audit log."
      >
        <form onSubmit={handleAdjustSubmit} className="space-y-4 text-xs">
          {errorMsg && <div className="p-3 text-red-600 bg-red-50 rounded border border-red-200">{errorMsg}</div>}
          
          <div>
            <label className="block font-medium text-slate-700 mb-1">Product *</label>
            <select
              className="block w-full rounded-md border border-slate-300 bg-white py-2 px-3 text-xs text-slate-900"
              value={form.productId}
              onChange={(e) => setForm({ ...form, productId: e.target.value })}
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Warehouse *</label>
            <select
              className="block w-full rounded-md border border-slate-300 bg-white py-2 px-3 text-xs text-slate-900"
              value={form.warehouseId}
              onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Adjustment Type *</label>
              <select
                className="block w-full rounded-md border border-slate-300 bg-white py-2 px-3 text-xs text-slate-900"
                value={form.adjustmentType}
                onChange={(e) => setForm({ ...form, adjustmentType: e.target.value as any })}
              >
                <option value="INITIAL_STOCK">Initial Stock</option>
                <option value="CORRECTION">Correction</option>
                <option value="DAMAGE">Damage (-)</option>
                <option value="LOSS">Loss (-)</option>
                <option value="FOUND">Found (+)</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Quantity Change (+/-) *</label>
              <Input
                type="number"
                step="0.0001"
                required
                value={form.quantityChange}
                onChange={(e) => setForm({ ...form, quantityChange: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Reason *</label>
            <Input
              required
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Physical inventory recount..."
            />
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button type="button" variant="ghost" onClick={() => setIsAdjustDialogOpen(false)}>Cancel</Button>
            <Button type="submit">Submit Adjustment</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
