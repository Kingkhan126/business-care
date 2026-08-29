import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    // Default to sample customer if guest upload
    let userId = session?.userId;
    if (!userId) {
      const defaultCust = await prisma.user.findFirst({ where: { role: "CUSTOMER" } });
      userId = defaultCust?.id || "guest-user-id";
    }

    const formData = await request.formData();
    const patientName = formData.get("patientName") as string;
    const patientAgeStr = formData.get("patientAge") as string;
    const notes = formData.get("notes") as string;
    const file = formData.get("file") as File;

    if (!patientName || !file) {
      return NextResponse.json(
        { error: "Patient name and prescription file are required." },
        { status: 400 }
      );
    }

    const patientAge = patientAgeStr ? parseInt(patientAgeStr, 10) : null;
    const fileName = file.name;
    const fileMimeType = file.type || "application/octet-stream";
    const fileUrl = `/storage/prescriptions/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;

    const prescription = await prisma.prescription.create({
      data: {
        userId,
        patientName,
        patientAge,
        fileUrl,
        fileName,
        fileMimeType,
        status: "PENDING_REVIEW",
        pharmacistNotes: notes || null,
      },
    });

    // Create audit trail
    await prisma.prescriptionAuditLog.create({
      data: {
        prescriptionId: prescription.id,
        actorId: userId,
        oldStatus: null,
        newStatus: "PENDING_REVIEW",
        notes: "Prescription document uploaded by customer.",
      },
    });

    return NextResponse.json({
      success: true,
      prescriptionId: prescription.id,
      status: prescription.status,
      message: "Prescription submitted for pharmacist verification.",
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Upload failed" }, { status: 500 });
  }
}
