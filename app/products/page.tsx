import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { ProductCard } from "@/components/products/product-card";
import { ProductFilters } from "@/components/products/product-filters";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";

export const revalidate = 0;

interface ProductsPageProps {
  searchParams: {
    search?: string;
    category?: string;
    brand?: string;
    rx?: string;
    minPrice?: string;
    maxPrice?: string;
    inStock?: string;
    sort?: string;
  };
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const session = await getSession();
  let user = null;
  if (session?.userId) {
    user = await prisma.user.findUnique({ where: { id: session.userId } });
  }

  const { search, category, brand, rx, minPrice, maxPrice, inStock, sort } = searchParams;

  // Build Prisma query filter
  const where: any = { isVisible: true };
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { description: { contains: search } },
      { activeIngredients: { contains: search } },
      { sku: { contains: search } },
    ];
  }

  if (category) {
    const cat = await prisma.category.findUnique({ where: { slug: category } });
    if (cat) where.categoryId = cat.id;
  }

  if (brand) {
    const b = await prisma.brand.findUnique({ where: { slug: brand } });
    if (b) where.brandId = b.id;
  }

  if (rx === "rx") where.isPrescriptionRequired = true;
  if (rx === "otc") where.isPrescriptionRequired = false;
  if (inStock === "true") where.stockQuantity = { gt: 0 };

  if (minPrice || maxPrice) {
    where.price = {};
    if (minPrice) where.price.gte = parseFloat(minPrice);
    if (maxPrice) where.price.lte = parseFloat(maxPrice);
  }

  let orderBy: any = { createdAt: "desc" };
  if (sort === "price_asc") orderBy = { price: "asc" };
  if (sort === "price_desc") orderBy = { price: "desc" };
  if (sort === "rating") orderBy = { ratingAverage: "desc" };

  const products = await prisma.product.findMany({
    where,
    orderBy,
    include: { category: true, brand: true },
  });

  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });
  const brands = await prisma.brand.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header user={user} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full">
        {/* Header Breadcrumb & Search Info */}
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-slate-900">
            {search ? `Search Results for "${search}"` : category ? `Category: ${category}` : "Pharmacy Product Catalog"}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Showing {products.length} verified pharmaceutical and healthcare products
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Filter Sidebar */}
          <ProductFilters
            categories={categories}
            brands={brands}
            selectedCategory={category}
            selectedBrand={brand}
            selectedRx={rx}
            minPrice={minPrice}
            maxPrice={maxPrice}
            inStockOnly={inStock === "true"}
            sortBy={sort}
            onFilterChange={() => {}}
          />

          {/* Product Grid */}
          <div className="flex-1 w-full">
            {products.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                <p className="text-slate-500 text-sm font-medium">No products match your selected search criteria.</p>
                <a href="/products" className="inline-block mt-3 text-xs font-bold text-teal-700 hover:underline">
                  Clear All Filters
                </a>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
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
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
