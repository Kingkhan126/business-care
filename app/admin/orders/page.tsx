import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { prisma } from "@/lib/db/prisma";
import Link from "next/link";
import { Package, Truck, ShieldCheck, CheckCircle2, Clock, Pill } from "lucide-react";

export const revalidate = 0;

export default async function AdminOrdersPage() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true, email: true } },
      items: true,
      prescription: true,
    },
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-4 gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Orders & Delivery Management</h1>
            <p className="text-xs text-slate-500 mt-1">Manage order statuses, delivery agent assignments, and customer fulfillment</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-900 text-slate-200 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-4">Order Number & Date</th>
                  <th className="p-4">Customer</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Payment</th>
                  <th className="p-4">Carrier / Agent</th>
                  <th className="p-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {orders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-slate-50 transition">
                    <td className="p-4">
                      <span className="font-bold text-slate-900 block">{ord.orderNumber}</span>
                      <span className="text-[10px] text-slate-400">{new Date(ord.createdAt).toLocaleDateString()}</span>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-slate-800">{ord.user.name}</div>
                      <div className="text-[10px] text-slate-400">{ord.user.email}</div>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          ord.status === "DELIVERED"
                            ? "bg-emerald-100 text-emerald-800"
                            : ord.status === "PRESCRIPTION_VERIFICATION"
                            ? "bg-amber-100 text-amber-900 border border-amber-300"
                            : ord.status === "CANCELLED"
                            ? "bg-red-100 text-red-800"
                            : "bg-teal-100 text-teal-800"
                        }`}
                      >
                        {ord.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="font-bold text-slate-800">{ord.paymentMethod}</span>
                      <span className="text-[10px] text-slate-500 block">({ord.paymentStatus})</span>
                    </td>
                    <td className="p-4 font-semibold text-slate-700">
                      {ord.deliveryAgentName || "Express Pharmacy Courier"}
                      <span className="text-[10px] text-slate-400 block font-normal">Est: {ord.estimatedDelivery || "Processing"}</span>
                    </td>
                    <td className="p-4 text-right font-extrabold text-slate-900">
                      ${ord.totalAmount.toFixed(2)}
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
