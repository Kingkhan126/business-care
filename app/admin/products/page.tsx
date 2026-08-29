"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Pill, Eye, EyeOff, Plus, Search, Edit3, Trash2 } from "lucide-react";

export default function AdminProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetch("/api/products");
      const data = await res.json();
      if (data.products) setProducts(data.products);
    } catch {}
  };

  const toggleVisibility = async (id: string, currentVisibility: boolean) => {
    const isVisible = !currentVisibility;
    setLoading(true);

    try {
      const res = await fetch("/api/admin/products/toggle-visibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isVisible }),
      });
      if (res.ok) {
        setProducts((prev) =>
          prev.map((p) => (p.id === id ? { ...p, isVisible } : p))
        );
      }
    } catch {
      alert("Failed to toggle product visibility.");
    } finally {
      setLoading(false);
    }
  };

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-4 gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Products & Catalog Management</h1>
            <p className="text-xs text-slate-500 mt-1">Manage medicines, stock, pricing, and hide/show products from the website</p>
          </div>

          <div className="flex items-center space-x-3">
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-900 text-slate-200 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-4">Product Name & SKU</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Rx Required</th>
                  <th className="p-4">Price</th>
                  <th className="p-4">Stock</th>
                  <th className="p-4 text-center">Website Visibility</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition">
                    <td className="p-4">
                      <div className="font-bold text-slate-900">{p.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">SKU: {p.sku}</div>
                    </td>
                    <td className="p-4 text-slate-600">{p.category?.name}</td>
                    <td className="p-4">
                      {p.isPrescriptionRequired ? (
                        <span className="bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded text-[10px] font-bold">
                          Rx Required
                        </span>
                      ) : (
                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px]">
                          OTC
                        </span>
                      )}
                    </td>
                    <td className="p-4 font-bold text-slate-900">
                      ${p.price.toFixed(2)}
                      {p.salePrice && <span className="text-[10px] text-red-600 font-bold block">Sale: ${p.salePrice.toFixed(2)}</span>}
                    </td>
                    <td className="p-4">
                      <span className={`font-bold ${p.stockQuantity <= 10 ? "text-red-600" : "text-emerald-700"}`}>
                        {p.stockQuantity} units
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => toggleVisibility(p.id, p.isVisible !== false)}
                        disabled={loading}
                        className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition flex items-center justify-center space-x-1 mx-auto ${
                          p.isVisible !== false
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                            : "bg-slate-200 text-slate-600 border border-slate-300"
                        }`}
                      >
                        {p.isVisible !== false ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        <span>{p.isVisible !== false ? "Visible" : "Hidden"}</span>
                      </button>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => toggleVisibility(p.id, p.isVisible !== false)}
                        className="text-xs text-teal-700 hover:underline font-bold"
                      >
                        {p.isVisible !== false ? "Hide" : "Show"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
