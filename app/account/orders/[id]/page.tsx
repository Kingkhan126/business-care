import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { prisma } from "@/lib/db/prisma";
import Link from "next/link";
import { ArrowLeft, Package, ShieldCheck, Pill, CheckCircle2, Clock, AlertCircle } from "lucide-react";

export const revalidate = 0;

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      items: true,
      prescription: true,
    },
  });

  if (!order) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        <Header />
        <div className="max-w-md mx-auto my-20 p-8 bg-white rounded-xl border text-center">
          <h2 className="text-xl font-bold text-slate-900">Order Not Found</h2>
          <Link href="/account/orders" className="inline-block mt-4 text-xs font-bold text-teal-700 hover:underline">
            ← Return to Orders
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const shippingAddr = JSON.parse(order.shippingAddressJson || "{}");

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-6">
        <Link href="/account/orders" className="text-xs text-slate-500 hover:text-teal-600 flex items-center">
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          Back to Order History
        </Link>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
            <div>
              <span className="text-xs text-slate-400 font-mono">ID: {order.id}</span>
              <h1 className="text-xl font-extrabold text-slate-900">{order.orderNumber}</h1>
              <p className="text-xs text-slate-500">Placed on {new Date(order.createdAt).toLocaleString()}</p>
            </div>

            <div className="text-right">
              <span
                className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  order.status === "DELIVERED"
                    ? "bg-emerald-100 text-emerald-800"
                    : order.status === "PRESCRIPTION_VERIFICATION"
                    ? "bg-amber-100 text-amber-900 border border-amber-300"
                    : order.status === "CANCELLED"
                    ? "bg-red-100 text-red-800"
                    : "bg-teal-100 text-teal-800"
                }`}
              >
                {order.status.replace("_", " ")}
              </span>
            </div>
          </div>

          {/* Prescription Status if linked */}
          {order.prescription && (
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 text-xs text-teal-900 flex items-start space-x-3">
              <ShieldCheck className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Linked Prescription: {order.prescription.fileName}</span>
                Verification Status: <strong className="uppercase">{order.prescription.status}</strong>
                {order.prescription.pharmacistNotes && (
                  <p className="mt-1 italic text-slate-600">Pharmacist Notes: "{order.prescription.pharmacistNotes}"</p>
                )}
              </div>
            </div>
          )}

          {/* Items */}
          <div>
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Order Items</h2>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs">
              {order.items.map((item) => (
                <div key={item.id} className="p-4 flex items-center justify-between bg-white">
                  <div>
                    <span className="font-bold text-slate-900 flex items-center">
                      {item.isPrescriptionRequired && <Pill className="w-3.5 h-3.5 mr-1 text-amber-600 shrink-0" />}
                      {item.productName}
                    </span>
                    <span className="text-slate-500 font-medium">${item.unitPrice.toFixed(2)} x {item.quantity}</span>
                  </div>
                  <span className="font-extrabold text-slate-900">${item.totalPrice.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Shipping Address & Carrier Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs pt-4 border-t border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 uppercase tracking-wider mb-2">Delivery Address</h3>
              <p className="font-semibold text-slate-800">{shippingAddr.fullName}</p>
              <p className="text-slate-600">{shippingAddr.street}</p>
              <p className="text-slate-600">{shippingAddr.city}, {shippingAddr.state} {shippingAddr.zipCode}</p>
              <p className="text-slate-600">Phone: {shippingAddr.phone}</p>
            </div>

            <div>
              <h3 className="font-bold text-slate-900 uppercase tracking-wider mb-2">Delivery Carrier & Payment</h3>
              <p className="text-slate-700">Carrier: <strong>{order.deliveryAgentName || "Express Pharmacy Courier"}</strong></p>
              <p className="text-slate-700">Est. Arrival: <strong>{order.estimatedDelivery || "3-5 Days"}</strong></p>
              <p className="text-slate-700 mt-1">Payment Method: <strong>{order.paymentMethod}</strong> ({order.paymentStatus})</p>
            </div>
          </div>

          {/* Total Breakdown */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5 text-xs text-slate-700">
            <div className="flex justify-between"><span>Subtotal:</span><span>${order.subtotal.toFixed(2)}</span></div>
            {order.discountAmount > 0 && <div className="flex justify-between text-emerald-700 font-medium"><span>Discount:</span><span>-${order.discountAmount.toFixed(2)}</span></div>}
            <div className="flex justify-between"><span>Shipping Fee:</span><span>${order.shippingFee.toFixed(2)}</span></div>
            <div className="flex justify-between text-sm font-extrabold text-slate-900 border-t border-slate-200 pt-2"><span>Total Paid:</span><span className="text-teal-700">${order.totalAmount.toFixed(2)}</span></div>
          </div>

          {/* Customer Support CTA */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs">
            <span className="text-slate-500">Need help with this order?</span>
            <Link href="/account/support" className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold transition">
              Contact Pharmacy Support Desk
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
