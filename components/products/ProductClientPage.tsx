"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Tabs, TabList, TabTrigger, TabContent } from "@/components/ui/Tabs";
import { Dialog } from "@/components/ui/Dialog";
import { Package, Plus, Tag } from "lucide-react";
import { ProductInput, ServiceInput } from "@/lib/validation/master_data";

interface ProductItem {
  id: string;
  sku: string;
  name: string;
  description?: string | null;
  trackInventory: boolean;
  costPrice: number | string;
  sellingPrice: number | string;
  currency: string;
  status: "ACTIVE" | "INACTIVE";
  category?: { name: string } | null;
  unitOfMeasure?: { name: string; symbol: string } | null;
}

interface ServiceItem {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  costPrice: number | string;
  sellingPrice: number | string;
  currency: string;
  status: "ACTIVE" | "INACTIVE";
  category?: { name: string } | null;
}

interface ProductClientPageProps {
  initialProducts: ProductItem[];
  initialServices: ServiceItem[];
}

export function ProductClientPage({ initialProducts, initialServices }: ProductClientPageProps) {
  const [products, setProducts] = React.useState<ProductItem[]>(initialProducts);
  const [services, setServices] = React.useState<ServiceItem[]>(initialServices);
  const [isProductDialogOpen, setIsProductDialogOpen] = React.useState(false);
  const [isServiceDialogOpen, setIsServiceDialogOpen] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const [productForm, setProductForm] = React.useState<Partial<ProductInput>>({
    sku: "",
    name: "",
    description: "",
    costPrice: 0,
    sellingPrice: 0,
    trackInventory: true,
    allowNegativeStock: false,
    currency: "PKR",
  });

  const [serviceForm, setServiceForm] = React.useState<Partial<ServiceInput>>({
    code: "",
    name: "",
    description: "",
    costPrice: 0,
    sellingPrice: 0,
    currency: "PKR",
  });

  const fetchProducts = async () => {
    try {
      const res = await fetch("/api/products");
      if (res.ok) {
        const data = await res.json();
        setProducts(data.items || []);
      }
    } catch {
      // Ignore
    }
  };

  const fetchServices = async () => {
    try {
      const res = await fetch("/api/services");
      if (res.ok) {
        const data = await res.json();
        setServices(data.items || []);
      }
    } catch {
      // Ignore
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productForm),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create product");

      setIsProductDialogOpen(false);
      setProductForm({ sku: "", name: "", description: "", costPrice: 0, sellingPrice: 0, trackInventory: true, currency: "PKR" });
      fetchProducts();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Error creating product");
    }
  };

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      const res = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(serviceForm),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create service");

      setIsServiceDialogOpen(false);
      setServiceForm({ code: "", name: "", description: "", costPrice: 0, sellingPrice: 0, currency: "PKR" });
      fetchServices();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Error creating service");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Products & Services Catalog
          </h1>
          <p className="text-xs text-slate-400">
            Manage physical products, SKUs, inventory tracking flags, and non-stock service items.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setIsServiceDialogOpen(true)} variant="secondary" className="text-xs font-semibold">
            <Plus className="h-4 w-4" /> Add Service
          </Button>
          <Button onClick={() => setIsProductDialogOpen(true)} className="text-xs font-semibold">
            <Plus className="h-4 w-4" /> Add Physical Product
          </Button>
        </div>
      </div>

      <Tabs defaultValue="products">
        <TabList className="bg-slate-800/80 border border-slate-700/60 p-1 rounded-lg">
          <TabTrigger value="products" className="text-xs text-slate-300">
            Physical Products ({products.length})
          </TabTrigger>
          <TabTrigger value="services" className="text-xs text-slate-300">
            Non-Stock Services ({services.length})
          </TabTrigger>
        </TabList>

        {/* Physical Products Tab */}
        <TabContent value="products">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-5 w-5 text-indigo-400" /> Physical Product Catalog
              </CardTitle>
            </CardHeader>
            <CardContent>
              {products.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  No physical products found. Click Add Physical Product to create your first item.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Product Name</TableHead>
                      <TableHead>Cost Price</TableHead>
                      <TableHead>Selling Price</TableHead>
                      <TableHead>Track Inventory</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-xs font-semibold text-indigo-400">
                          {p.sku}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-white">{p.name}</span>
                            {p.category && <span className="text-[11px] text-slate-300">{p.category.name}</span>}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-slate-300">PKR {Number(p.costPrice).toFixed(2)}</TableCell>
                        <TableCell className="font-mono text-xs font-semibold text-emerald-400">PKR {Number(p.sellingPrice).toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={p.trackInventory ? "info" : "default"}>
                            {p.trackInventory ? "Tracked" : "Non-tracked"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={p.status === "ACTIVE" ? "success" : "default"}>
                            {p.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabContent>

        {/* Services Tab */}
        <TabContent value="services">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Tag className="h-5 w-5 text-indigo-400" /> Non-Stock Services
              </CardTitle>
            </CardHeader>
            <CardContent>
              {services.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No services found. Click Add Service to create your first service item.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service Code</TableHead>
                      <TableHead>Service Name</TableHead>
                      <TableHead>Cost Price</TableHead>
                      <TableHead>Selling Rate</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {services.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono text-xs font-semibold text-indigo-400">
                          {s.code}
                        </TableCell>
                        <TableCell className="font-medium text-white">{s.name}</TableCell>
                        <TableCell className="font-mono text-xs text-slate-300">PKR {Number(s.costPrice).toFixed(2)}</TableCell>
                        <TableCell className="font-mono text-xs font-semibold text-emerald-400">PKR {Number(s.sellingPrice).toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={s.status === "ACTIVE" ? "success" : "default"}>
                            {s.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabContent>
      </Tabs>

      {/* Add Product Modal */}
      <Dialog
        isOpen={isProductDialogOpen}
        onClose={() => setIsProductDialogOpen(false)}
        title="Add Physical Product"
        description="Create a physical item with optional inventory tracking."
      >
        <form onSubmit={handleCreateProduct} className="space-y-4 text-xs">
          {errorMsg && <div className="p-3 text-red-600 bg-red-50 rounded border border-red-200">{errorMsg}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-200 mb-1">SKU *</label>
              <Input required value={productForm.sku} onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })} placeholder="PROD-001" />
            </div>
            <div>
              <label className="block font-medium text-slate-200 mb-1">Product Name *</label>
              <Input required value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} placeholder="Wireless Mouse" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-200 mb-1">Cost Price (PKR)</label>
              <Input type="number" step="0.01" value={productForm.costPrice} onChange={(e) => setProductForm({ ...productForm, costPrice: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <label className="block font-medium text-slate-200 mb-1">Selling Price (PKR)</label>
              <Input type="number" step="0.01" value={productForm.sellingPrice} onChange={(e) => setProductForm({ ...productForm, sellingPrice: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button type="button" variant="ghost" onClick={() => setIsProductDialogOpen(false)}>Cancel</Button>
            <Button type="submit">Save Product</Button>
          </div>
        </form>
      </Dialog>

      {/* Add Service Modal */}
      <Dialog
        isOpen={isServiceDialogOpen}
        onClose={() => setIsServiceDialogOpen(false)}
        title="Add Service Item"
        description="Create a non-stock service (consulting, labor, fee)."
      >
        <form onSubmit={handleCreateService} className="space-y-4 text-xs">
          {errorMsg && <div className="p-3 text-red-600 bg-red-50 rounded border border-red-200">{errorMsg}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-200 mb-1">Service Code *</label>
              <Input required value={serviceForm.code} onChange={(e) => setServiceForm({ ...serviceForm, code: e.target.value })} placeholder="SRV-CONSULT" />
            </div>
            <div>
              <label className="block font-medium text-slate-200 mb-1">Service Name *</label>
              <Input required value={serviceForm.name} onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })} placeholder="IT Support (Hourly)" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-200 mb-1">Cost Price (PKR)</label>
              <Input type="number" step="0.01" value={serviceForm.costPrice} onChange={(e) => setServiceForm({ ...serviceForm, costPrice: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <label className="block font-medium text-slate-200 mb-1">Selling Rate (PKR)</label>
              <Input type="number" step="0.01" value={serviceForm.sellingPrice} onChange={(e) => setServiceForm({ ...serviceForm, sellingPrice: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button type="button" variant="ghost" onClick={() => setIsServiceDialogOpen(false)}>Cancel</Button>
            <Button type="submit">Save Service</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
