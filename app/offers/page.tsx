import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { ProductCard } from "@/components/products/product-card";
import { prisma } from "@/lib/db/prisma";
import { Tag, Sparkles } from "lucide-react";

export const revalidate = 0;

export default async function OffersPage() {
  const discountedProducts = await prisma.product.findMany({
    where: { salePrice: { not: null } },
    include: { category: true, brand: true },
  });

  const coupons = await prisma.coupon.findMany({ where: { isActive: true } });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-8">
        <div className="bg-gradient-to-r from-amber-900 via-amber-800 to-slate-900 text-white p-6 sm:p-8 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <span className="bg-amber-400 text-slate-950 font-extrabold text-[10px] uppercase px-2 py-0.5 rounded">
              Promotions & Special Deals
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">Pharmacy Offers & Discounts</h1>
            <p className="text-xs text-amber-200 mt-1">Save on healthcare remedies, vitamins, skincare, and devices</p>
          </div>
          <Tag className="w-12 h-12 text-amber-400 shrink-0 hidden sm:block" />
        </div>

        {/* Coupons Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {coupons.map((c) => (
            <div key={c.id} className="bg-amber-50 border border-amber-200 p-5 rounded-2xl flex items-center justify-between shadow-xs">
              <div>
                <span className="text-xs font-bold text-amber-900 block">Promo Code</span>
                <span className="text-xl font-extrabold font-mono text-teal-800 tracking-wider">{c.code}</span>
                <p className="text-xs text-amber-800 mt-1">
                  {c.discountType === "PERCENTAGE" ? `${c.discountValue}% OFF` : `$${c.discountValue.toFixed(2)} OFF`} on orders over ${c.minOrderAmount.toFixed(2)}
                </p>
              </div>
              <span className="px-3 py-1 bg-amber-400 text-slate-950 font-bold text-xs rounded-lg">Active</span>
            </div>
          ))}
        </div>

        {/* Products on Sale */}
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-4">Discounted Pharmacy Products</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {discountedProducts.map((p) => (
              <ProductCard
                key={p.id}
                id={p.id}
                name={p.name}
                slug={p.slug}
                price={p.price}
                salePrice={p.salePrice}
                stockQuantity={p.stockQuantity}
                isPrescriptionRequired={p.isPrescriptionRequired}
                dosageForm={p.dosageForm}
                imageUrl={p.imageUrl}
                ratingAverage={p.ratingAverage}
                ratingCount={p.ratingCount}
                categoryName={p.category?.name}
                brandName={p.brand?.name}
              />
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
