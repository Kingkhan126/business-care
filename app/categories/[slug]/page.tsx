import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { ProductCard } from "@/components/products/product-card";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import Link from "next/link";
import { Pill } from "lucide-react";

export const revalidate = 0;

export default async function CategoryPage({ params }: { params: { slug: string } }) {
  const session = await getSession();
  let user = null;
  if (session?.userId) {
    user = await prisma.user.findUnique({ where: { id: session.userId } });
  }

  const category = await prisma.category.findUnique({
    where: { slug: params.slug },
  });

  const products = await prisma.product.findMany({
    where: category ? { categoryId: category.id } : {},
    include: { category: true, brand: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header user={user} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-6">
        <div className="bg-gradient-to-r from-teal-900 to-slate-900 text-white p-6 sm:p-8 rounded-2xl shadow-sm">
          <span className="text-xs text-teal-300 font-bold uppercase tracking-wider">Department</span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
            {category ? category.name : params.slug.replace(/-/g, " ")}
          </h1>
          {category?.description && (
            <p className="text-xs sm:text-sm text-slate-300 mt-2 max-w-2xl">{category.description}</p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500 font-medium">Showing {products.length} products</span>
          <Link href="/products" className="text-xs font-bold text-teal-700 hover:underline">
            View All Pharmacy Products →
          </Link>
        </div>

        {products.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <Pill className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h2 className="text-base font-bold text-slate-800">No Products in This Category</h2>
            <p className="text-xs text-slate-500 mt-1">Browse our main catalog for available medicines.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {products.map((p) => (
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
        )}
      </main>

      <Footer />
    </div>
  );
}
