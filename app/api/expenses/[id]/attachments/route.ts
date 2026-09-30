import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { ExpenseService } from "@/server/services/ExpenseService";
import { AppError, UnauthorizedError, ValidationError } from "@/lib/errors";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const attachments = await ExpenseService.listAttachments(user, params.id);
    return NextResponse.json(attachments);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      throw new ValidationError("No file was uploaded.");
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const attachment = await ExpenseService.addAttachment(user, params.id, {
      buffer,
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    });

    return NextResponse.json(attachment, { status: 201 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const { searchParams } = new URL(request.url);
    let attachmentId = searchParams.get("attachmentId");

    if (!attachmentId) {
      const body = await request.json().catch(() => ({}));
      attachmentId = body?.attachmentId;
    }

    if (!attachmentId) {
      throw new ValidationError("Attachment ID is required.");
    }

    const result = await ExpenseService.deleteAttachment(user, params.id, attachmentId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
