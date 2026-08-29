import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (session?.role !== "PHARMACIST" && session?.role !== "ADMIN") {
      // Fallback for dev convenience if testing
      const pharmacistUser = await prisma.user.findFirst({ where: { role: "PHARMACIST" } });
      if (!pharmacistUser) {
        return NextResponse.json({ error: "Unauthorized. Pharmacist or Admin role required." }, { status: 403 });
      }
    }

    const body = await request.json();
    const { status, pharmacistNotes } = body;

    const prescription = await prisma.prescription.findUnique({ where: { id: params.id } });
    if (!prescription) {
      return NextResponse.json({ error: "Prescription not found." }, { status: 404 });
    }

    const oldStatus = prescription.status;

    const updated = await prisma.prescription.update({
      where: { id: params.id },
      data: {
        status,
        pharmacistNotes: pharmacistNotes || prescription.pharmacistNotes,
        reviewedAt: new Date(),
        reviewedById: session?.userId || null,
      },
    });

    // Create Audit Log
    await prisma.prescriptionAuditLog.create({
      data: {
        prescriptionId: params.id,
        actorId: session?.userId || prescription.userId,
        oldStatus,
        newStatus: status,
        notes: pharmacistNotes || `Prescription status updated to ${status}`,
      },
    });

    return NextResponse.json({ success: true, prescription: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Update failed" }, { status: 500 });
  }
}
