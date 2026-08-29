import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { prisma } from "@/lib/db/prisma";
import { Tag, Plus, CheckCircle } from "lucide-react";

export const revalidate = 0;

export default async function AdminPromotionsPage() {
  const coupons = await prisma.coupon.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-6">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Coupons & Promotions</h1>
            <p className="text-xs text-slate-500 mt-1">Manage promotional discount codes and percentage/fixed deals</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-900 text-slate-200 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-4">Coupon Code</th>
                <th className="p-4">Discount Type</th>
                <th className="p-4">Discount Value</th>
                <th className="p-4">Min. Subtotal</th>
                <th className="p-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {coupons.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 transition">
                  <td className="p-4 font-mono font-bold text-teal-700 text-sm">{c.code}</td>
                  <td className="p-4 uppercase">{c.discountType}</td>
                  <td className="p-4 font-bold text-slate-900">
                    {c.discountType === "PERCENTAGE" ? `${c.discountValue}% OFF` : `$${c.discountValue.toFixed(2)} OFF`}
                  </td>
                  <td className="p-4">${c.minOrderAmount.toFixed(2)}</td>
                  <td className="p-4 text-right">
                    <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold">
                      ACTIVE
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      <Footer />
    </div>
  );
}
