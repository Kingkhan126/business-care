import { apiErrorResponse } from "@/lib/errors/http";
import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { AccountMappingService } from "@/server/services/AccountMappingService";
import { AccountMappingSchema } from "@/lib/validation/accounting";
import { AppError, UnauthorizedError } from "@/lib/errors";

export async function GET() {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const mappings = await AccountMappingService.listMappings(user);
    return NextResponse.json({ success: true, data: mappings });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const body = await request.json();
    const validated = AccountMappingSchema.parse(body);

    const mapping = await AccountMappingService.setMapping(user, validated.mappingKey as any, validated.accountId);
    return NextResponse.json({ success: true, data: mapping }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
