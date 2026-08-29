import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { ProductCard } from "@/components/products/product-card";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import {
  Pill,
  FileUp,
  ShieldCheck,
  RotateCw,
  Tag,
  Search,
  Sparkles,
  Heart,
  Truck,
  CheckCircle,
} from "lucide-react";

export const revalidate = 0;

export default async function HomePage() {
  const session = await getSession();
  let user = null;
  if (session?.userId) {
    user = await prisma.user.findUnique({ where: { id: session.userId } });
  }

  // Fetch Categories & Featured Products & Site Settings
  const categories = await prisma.category.findMany({ where: { isVisible: true }, take: 12, orderBy: { name: "asc" } });
  const featuredProducts = await prisma.product.findMany({
    take: 8,
    where: { isFeatured: true, isVisible: true },
    include: { category: true, brand: true },
  });
  const rxProducts = await prisma.product.findMany({
    take: 4,
    where: { isPrescriptionRequired: true, isVisible: true },
    include: { category: true, brand: true },
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header user={user} />

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-teal-900 via-slate-900 to-teal-950 text-white py-12 md:py-20 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#2dd4bf_1px,transparent_1px)] [background-size:16px_16px]"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center space-x-2 bg-teal-800/80 border border-teal-600/50 px-3 py-1.5 rounded-full text-xs font-semibold text-teal-200">
              <ShieldCheck className="w-4 h-4 text-teal-300" />
              <span>Licensed Online Pharmacy Platform</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Your Trusted Source for <span className="text-teal-400">Genuine Medicines</span> & Healthcare
            </h1>

            <p className="text-sm sm:text-base text-slate-300 max-w-2xl leading-relaxed">
              Order prescription medicines, over-the-counter health remedies, vitamins, skincare, baby care, and medical devices delivered directly to your doorstep.
            </p>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/prescriptions/upload"
                className="bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold px-5 py-3 rounded-xl shadow-lg transition flex items-center space-x-2 text-sm"
              >
                <FileUp className="w-4 h-4" />
                <span>Upload Doctor Prescription</span>
              </Link>
              <Link
                href="/products"
                className="bg-slate-800 hover:bg-slate-700 text-white font-semibold px-5 py-3 rounded-xl border border-slate-700 transition text-sm flex items-center space-x-2"
              >
                <Search className="w-4 h-4 text-teal-400" />
                <span>Browse Pharmacy Catalog</span>
              </Link>
            </div>

            {/* Micro Highlights */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-800 text-xs text-slate-300">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-teal-400 shrink-0" />
                <span>Licensed Pharmacist Verification</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-teal-400 shrink-0" />
                <span>100% Authentic Products</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-teal-400 shrink-0" />
                <span>Fast Home Delivery</span>
              </div>
            </div>
          </div>

          {/* Hero Card Banner */}
          <div className="lg:col-span-5 bg-white/10 backdrop-blur-md border border-white/15 p-6 rounded-2xl text-white space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                <Pill className="w-6 h-6 rotate-45" />
              </div>
              <div>
                <h3 className="font-bold text-base">Prescription Order Process</h3>
                <p className="text-xs text-slate-300">Fast 3-step verification workflow</p>
              </div>
            </div>

            <ol className="space-y-3 text-xs text-slate-200">
              <li className="flex items-start space-x-2">
                <span className="w-5 h-5 rounded-full bg-teal-500 text-slate-950 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                <span>Upload doctor's prescription image or PDF</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="w-5 h-5 rounded-full bg-teal-500 text-slate-950 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                <span>Licensed Pharmacist reviews dosage & authenticity</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="w-5 h-5 rounded-full bg-teal-500 text-slate-950 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">3</span>
                <span>Approved medicine order packaged & shipped safely</span>
              </li>
            </ol>

            <Link
              href="/prescriptions/upload"
              className="block text-center w-full py-2.5 bg-white text-slate-900 hover:bg-slate-100 font-bold rounded-xl text-xs transition"
            >
              Start Prescription Verification →
            </Link>
          </div>
        </div>
      </section>

      {/* Product Categories Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Explore Product Categories</h2>
            <p className="text-xs sm:text-sm text-slate-500">Shop by pharmaceutical and healthcare department</p>
          </div>
          <Link href="/products" className="text-xs font-bold text-teal-700 hover:underline">
            View All Categories →
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/categories/${cat.slug}`}
              className="group bg-white p-4 rounded-xl border border-slate-200 hover:border-teal-400 hover:shadow-md transition text-center flex flex-col items-center justify-between"
            >
              <div className="w-14 h-14 rounded-full bg-teal-50 group-hover:bg-teal-100 flex items-center justify-center text-teal-700 mb-3 transition">
                <Pill className="w-7 h-7" />
              </div>
              <h3 className="text-xs font-bold text-slate-800 group-hover:text-teal-700 line-clamp-2">
                {cat.name}
              </h3>
            </Link>
          ))}
        </div>
      </section>

      {/* Refill Reminder Callout */}
      <section className="bg-teal-900 text-white py-8 border-y border-teal-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shrink-0">
              <RotateCw className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Never Run Out of Chronic Medicines</h3>
              <p className="text-xs text-teal-200">
                Set up automated refill reminders for monthly hypertension, diabetes, or cholesterol medications.
              </p>
            </div>
          </div>
          <Link
            href="/account/refill-reminders"
            className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs transition shrink-0"
          >
            Manage Refill Schedule
          </Link>
        </div>
      </section>

      {/* Featured Products */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Featured Healthcare & OTC Products</h2>
            <p className="text-xs sm:text-sm text-slate-500">Popular medicines, vitamins, skincare, and devices</p>
          </div>
          <Link href="/products" className="text-xs font-bold text-teal-700 hover:underline">
            Browse All ({featuredProducts.length}) →
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          {featuredProducts.map((product) => (
            <ProductCard
              key={product.id}
              id={product.id}
              name={product.name}
              slug={product.slug}
              price={product.price}
              salePrice={product.salePrice}
              stockQuantity={product.stockQuantity}
              isPrescriptionRequired={product.isPrescriptionRequired}
              dosageForm={product.dosageForm}
              imageUrl={product.imageUrl}
              ratingAverage={product.ratingAverage}
              ratingCount={product.ratingCount}
              categoryName={product.category?.name}
              brandName={product.brand?.name}
            />
          ))}
        </div>
      </section>

      {/* Rx Prescription Highlight Section */}
      <section className="bg-slate-100 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <span className="text-xs font-extrabold text-amber-800 uppercase tracking-wider bg-amber-100 border border-amber-300 px-2 py-0.5 rounded">
                Prescription Verified
              </span>
              <h2 className="text-xl font-bold text-slate-900 mt-1">Prescription Medicines Catalog</h2>
            </div>
            <Link href="/categories/prescription-medicines" className="text-xs font-bold text-teal-700 hover:underline">
              View Rx Catalog →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {rxProducts.map((product) => (
              <ProductCard
                key={product.id}
                id={product.id}
                name={product.name}
                slug={product.slug}
                price={product.price}
                salePrice={product.salePrice}
                stockQuantity={product.stockQuantity}
                isPrescriptionRequired={product.isPrescriptionRequired}
                dosageForm={product.dosageForm}
                imageUrl={product.imageUrl}
                ratingAverage={product.ratingAverage}
                ratingCount={product.ratingCount}
                categoryName={product.category?.name}
                brandName={product.brand?.name}
              />
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
