import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const categorySlug = searchParams.get("category") || "";
    const brandSlug = searchParams.get("brand") || "";
    const rx = searchParams.get("rx") || "all"; // all | otc | rx
    const minPrice = searchParams.get("minPrice");
    const maxPrice = searchParams.get("maxPrice");
    const inStock = searchParams.get("inStock") === "true";
    const sort = searchParams.get("sort") || "featured";
    const isFeatured = searchParams.get("featured") === "true";

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
        { activeIngredients: { contains: search } },
        { sku: { contains: search } },
      ];
    }

    if (categorySlug) {
      const cat = await prisma.category.findUnique({ where: { slug: categorySlug } });
      if (cat) {
        where.categoryId = cat.id;
      }
    }

    if (brandSlug) {
      const brand = await prisma.brand.findUnique({ where: { slug: brandSlug } });
      if (brand) {
        where.brandId = brand.id;
      }
    }

    if (rx === "rx") {
      where.isPrescriptionRequired = true;
    } else if (rx === "otc") {
      where.isPrescriptionRequired = false;
    }

    if (inStock) {
      where.stockQuantity = { gt: 0 };
    }

    if (isFeatured) {
      where.isFeatured = true;
    }

    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = parseFloat(minPrice);
      if (maxPrice) where.price.lte = parseFloat(maxPrice);
    }

    let orderBy: any = { createdAt: "desc" };
    if (sort === "price_asc") orderBy = { price: "asc" };
    if (sort === "price_desc") orderBy = { price: "desc" };
    if (sort === "rating") orderBy = { ratingAverage: "desc" };
    if (sort === "featured") orderBy = { isFeatured: "desc" };

    const products = await prisma.product.findMany({
      where,
      orderBy,
      include: {
        category: true,
        brand: true,
      },
    });

    return NextResponse.json({ products });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch products" }, { status: 500 });
  }
}
