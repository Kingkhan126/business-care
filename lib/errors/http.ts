import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from ".";

/** Never serialize database errors, submitted values, or stack traces to clients. */
export function apiErrorResponse(error: unknown) {
  // Next.js uses thrown signals for dynamic rendering and navigation.
  if (error && typeof error === "object" && "digest" in error && typeof error.digest === "string" &&
      /^(DYNAMIC_SERVER_USAGE|NEXT_REDIRECT|NEXT_NOT_FOUND)(;|$)/.test(error.digest)) throw error;
  if (error instanceof ZodError) {
    return NextResponse.json({
      success: false,
      error: "Please correct the highlighted fields.",
      code: "VALIDATION_ERROR",
      details: error.issues.map(({ path, message }) => ({ path, message })),
    }, { status: 400 });
  }
  if (error instanceof SyntaxError) {
    return NextResponse.json({ success: false, error: "Invalid JSON request body", code: "VALIDATION_ERROR" }, { status: 400 });
  }
  if (error instanceof AppError) {
    return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: error.statusCode });
  }
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : undefined;
  const databaseCode = error && typeof error === "object" && "meta" in error && error.meta && typeof error.meta === "object" && "code" in error.meta ? String(error.meta.code) : undefined;
  if (code === "P2021" || code === "P2022" || (code === "P2010" && (databaseCode === "42P01" || databaseCode === "42703"))) {
    console.error("Database schema is not ready; apply committed migrations", { code, databaseCode });
    return NextResponse.json({ success: false, error: "The service is being updated. Please try again shortly.", code: "DATABASE_NOT_READY" }, { status: 503 });
  }
  if (code === "P2002") {
    return NextResponse.json({ success: false, error: "A record with these details already exists.", code: "CONFLICT" }, { status: 409 });
  }
  if (code === "P2034" || code === "P2028") {
    return NextResponse.json({ success: false, error: "The operation could not complete. Please retry.", code: "CONFLICT" }, { status: 409 });
  }
  console.error("API request failed", { type: error instanceof Error ? error.name : "UnknownError", code });
  return NextResponse.json({ success: false, error: "Internal server error", code: "INTERNAL_SERVER_ERROR" }, { status: 500 });
}
