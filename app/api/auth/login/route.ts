import { NextResponse } from "next/server";
import { AuthService } from "@/server/services/AuthService";
import { setSessionCookie } from "@/lib/auth/session";
import { LoginSchema } from "@/lib/validation/auth";
import { AppError } from "@/lib/errors";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = LoginSchema.parse(body);

    const result = await AuthService.login(validated);
    await setSessionCookie(result.token);

    return NextResponse.json({
      success: true,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
      },
      activeOrganizationId: result.activeOrganizationId,
    });
  } catch (err: unknown) {
    console.error("[Login API Error]:", err);
    if (err instanceof AppError || (err && typeof err === "object" && "statusCode" in err)) {
      const appErr = err as AppError;
      return NextResponse.json(
        { success: false, error: appErr.message, code: appErr.code },
        { status: appErr.statusCode || 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Authentication failed. Please verify your credentials or register." },
      { status: 400 }
    );
  }
}
