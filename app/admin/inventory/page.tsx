import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { prisma } from "@/lib/db/prisma";
import { AlertTriangle, CheckCircle2, Pill } from "lucide-react";

export const revalidate = 0;

export default async function AdminInventoryPage() {
  const products = await prisma.product.findMany({
    orderBy: { stockQuantity: "asc" },
    include: { category: true },
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Inventory & Stock Control</h1>
          <p className="text-xs text-slate-500 mt-1">Track medicine stock quantities, low-stock triggers, and batch availability</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-900 text-slate-200 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-4">Product & SKU</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Dosage Form</th>
                  <th className="p-4">Stock Status</th>
                  <th className="p-4 text-right">Quantity in Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition">
                    <td className="p-4">
                      <span className="font-bold text-slate-900 block">{p.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">SKU: {p.sku}</span>
                    </td>
                    <td className="p-4 text-slate-600">{p.category.name}</td>
                    <td className="p-4 font-mono text-[10px]">{p.dosageForm || "N/A"}</td>
                    <td className="p-4">
                      {p.stockQuantity <= 10 ? (
                        <span className="bg-red-100 text-red-800 border border-red-200 px-2 py-0.5 rounded text-[10px] font-bold flex items-center w-fit">
                          <AlertTriangle className="w-3 h-3 mr-1 text-red-600" />
                          Low Stock Alert
                        </span>
                      ) : (
                        <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold flex items-center w-fit">
                          <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                          Optimal Stock
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right font-extrabold text-sm text-slate-900">
                      {p.stockQuantity} units
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
