"use server";

import { revalidatePath } from "next/cache";
import { getSessionTokenFromCookie, verifySessionToken } from "@/lib/auth/session";

/** Invalidate the browser's cached dashboard after an authenticated document save. */
export async function refreshDashboardAfterSave() {
  const token = await getSessionTokenFromCookie();
  const session = token ? await verifySessionToken(token) : null;
  if (session?.activeOrganizationId) revalidatePath("/dashboard");
}
