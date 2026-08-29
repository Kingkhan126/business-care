import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const brands = await prisma.brand.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { products: true } },
      },
    });
    return NextResponse.json({ brands });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch brands" }, { status: 500 });
  }
}
