import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: Request) {
  try {
    const { id, isVisible } = await request.json();
    if (!id) return NextResponse.json({ error: "Product ID required" }, { status: 400 });

    const updated = await prisma.product.update({
      where: { id },
      data: { isVisible },
    });

    return NextResponse.json({ success: true, product: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Toggle failed" }, { status: 500 });
  }
}
