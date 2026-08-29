import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import {
  Pill,
  ShieldCheck,
  Star,
  ShoppingBag,
  Heart,
  AlertTriangle,
  FileText,
  CheckCircle,
  RotateCw,
} from "lucide-react";
import Link from "next/link";

export const revalidate = 0;

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  let user = null;
  if (session?.userId) {
    user = await prisma.user.findUnique({ where: { id: session.userId } });
  }

  const product = await prisma.product.findUnique({
    where: { id: params.id },
    include: {
      category: true,
      brand: true,
      reviews: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!product) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        <Header user={user} />
        <div className="max-w-md mx-auto my-20 p-8 bg-white rounded-xl border text-center">
          <h2 className="text-xl font-bold text-slate-900">Product Not Found</h2>
          <p className="text-xs text-slate-500 mt-2">The medicine or product requested does not exist.</p>
          <Link href="/products" className="inline-block mt-4 text-xs font-bold text-teal-700 hover:underline">
            ← Return to Product Catalog
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const displayPrice = product.salePrice && product.salePrice < product.price ? product.salePrice : product.price;
  const isDiscounted = product.salePrice && product.salePrice < product.price;
  const inStock = product.stockQuantity > 0;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header user={user} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-8">
        {/* Breadcrumb */}
        <div className="text-xs text-slate-500 flex items-center space-x-2">
          <Link href="/products" className="hover:text-teal-600">Products</Link>
          <span>/</span>
          {product.category && (
            <Link href={`/categories/${product.category.slug}`} className="hover:text-teal-600">
              {product.category.name}
            </Link>
          )}
          <span>/</span>
          <span className="text-slate-900 font-semibold truncate max-w-xs">{product.name}</span>
        </div>

        {/* Product Details Header Grid */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 shadow-sm">
          {/* Image */}
          <div className="lg:col-span-5 relative aspect-square bg-slate-50 rounded-xl overflow-hidden border border-slate-200">
            {product.isPrescriptionRequired && (
              <span className="absolute top-3 left-3 bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold px-2.5 py-1 rounded-md z-10 flex items-center shadow-xs">
                <Pill className="w-3.5 h-3.5 mr-1 text-amber-700" />
                Prescription Required (Rx)
              </span>
            )}
            {product.imageUrl ? (
              <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-300">
                <Pill className="w-20 h-20" />
              </div>
            )}
          </div>

          {/* Details */}
          <div className="lg:col-span-7 space-y-5">
            <div>
              <div className="flex items-center space-x-2 text-xs text-slate-500 mb-1">
                {product.brand && <span className="font-bold text-slate-700">{product.brand.name}</span>}
                {product.dosageForm && (
                  <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-mono">
                    {product.dosageForm}
                  </span>
                )}
                <span className="ml-auto text-[11px] text-slate-400 font-mono">SKU: {product.sku}</span>
              </div>

              <h1 className="text-2xl font-extrabold text-slate-900 leading-snug">{product.name}</h1>

              {/* Rating */}
              <div className="flex items-center space-x-2 mt-2">
                <div className="flex items-center">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <span className="text-sm font-bold text-slate-900 ml-1">{product.ratingAverage.toFixed(1)}</span>
                </div>
                <span className="text-xs text-slate-400">({product.ratingCount} customer reviews)</span>
              </div>
            </div>

            {/* Price & Stock */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <div className="flex items-baseline space-x-2">
                  <span className="text-2xl font-extrabold text-slate-900">${displayPrice.toFixed(2)}</span>
                  {isDiscounted && (
                    <span className="text-sm text-slate-400 line-through">${product.price.toFixed(2)}</span>
                  )}
                </div>
                <span className={`text-xs font-semibold block mt-0.5 ${inStock ? "text-emerald-700" : "text-red-600"}`}>
                  {inStock ? `In Stock (${product.stockQuantity} units available)` : "Currently Out of Stock"}
                </span>
              </div>

              {/* Rx Warning or Verification note */}
              {product.isPrescriptionRequired && (
                <div className="text-right text-xs text-amber-900">
                  <span className="font-bold block">Pharmacist Review Required</span>
                  <span>Must upload valid physician prescription</span>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="text-xs text-slate-600 leading-relaxed space-y-2">
              <h3 className="font-bold text-slate-800 text-sm">Product Description</h3>
              <p>{product.description}</p>
            </div>

            {/* Active Ingredients & Dosage Form */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {product.activeIngredients && (
                <div className="bg-teal-50/60 p-3 rounded-lg border border-teal-100">
                  <span className="font-bold text-teal-900 block mb-0.5">Active Ingredients:</span>
                  <span className="text-teal-800">{product.activeIngredients}</span>
                </div>
              )}
              {product.dosageForm && (
                <div className="bg-teal-50/60 p-3 rounded-lg border border-teal-100">
                  <span className="font-bold text-teal-900 block mb-0.5">Form & Dosage:</span>
                  <span className="text-teal-800">{product.dosageForm}</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-4 pt-2">
              <a
                href="/cart"
                className="flex-1 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-sm text-center shadow-md transition"
              >
                Add to Cart
              </a>
              {product.isPrescriptionRequired && (
                <Link
                  href="/prescriptions/upload"
                  className="px-4 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs flex items-center space-x-1.5 transition shadow-sm"
                >
                  <FileText className="w-4 h-4" />
                  <span>Upload Prescription</span>
                </Link>
              )}
              <Link
                href="/account/refill-reminders"
                className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center space-x-1"
                title="Set Refill Reminder"
              >
                <RotateCw className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* Directions & Safety Warnings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {product.usageInstructions && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center">
                <CheckCircle className="w-4 h-4 text-emerald-600 mr-2" />
                Usage & Dosage Instructions
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">{product.usageInstructions}</p>
            </div>
          )}

          {product.warnings && (
            <div className="bg-amber-50/70 p-6 rounded-2xl border border-amber-200 shadow-xs space-y-2">
              <h3 className="text-sm font-bold text-amber-900 flex items-center">
                <AlertTriangle className="w-4 h-4 text-amber-700 mr-2" />
                Important Warnings & Precautions
              </h3>
              <p className="text-xs text-amber-800 leading-relaxed">{product.warnings}</p>
            </div>
          )}
        </div>

        {/* Customer Reviews & Ratings */}
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Verified Customer Reviews</h2>
              <p className="text-xs text-slate-500">Feedback from verified pharmacy customers</p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-extrabold text-slate-900">{product.ratingAverage.toFixed(1)}</span>
              <span className="text-xs text-slate-400 font-medium"> / 5.0</span>
            </div>
          </div>

          <div className="space-y-4">
            {product.reviews.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No customer reviews yet. Be the first to leave a review!</p>
            ) : (
              product.reviews.map((rev) => (
                <div key={rev.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">{rev.user.name}</span>
                    <div className="flex items-center">
                      {[...Array(rev.rating)].map((_, i) => (
                        <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                  </div>
                  <p className="text-slate-600">{rev.comment}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
