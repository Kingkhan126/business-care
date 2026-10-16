import { NextResponse } from "next/server";
import { db } from "@/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  let databaseConnected = false;
  try {
    await db.$queryRaw`SELECT 1`;
    databaseConnected = true;
    // Connectivity alone does not prove the deployed schema supports writes.
    await db.documentSequence.findFirst({ select: { organizationId: true } });
    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: "connected",
      schema: "ready",
    });
  } catch {
    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        database: databaseConnected ? "connected" : "disconnected",
        schema: databaseConnected ? "not_ready" : "unknown",
      },
      { status: 503 }
    );
  }
}
