import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const settings = await prisma.siteSetting.findMany({ orderBy: { key: "asc" } });
    return NextResponse.json({ settings });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Fetch failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { key, value } = await request.json();
    if (!key) return NextResponse.json({ error: "Setting key required" }, { status: 400 });

    const setting = await prisma.siteSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value, label: key.replace(/_/g, " ").toUpperCase() },
    });

    return NextResponse.json({ success: true, setting });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Update failed" }, { status: 500 });
  }
}
