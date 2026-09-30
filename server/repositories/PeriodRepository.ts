import { db } from "@/db/client";
import { PeriodStatus } from "@prisma/client";

export class PeriodRepository {
  static async listByOrg(
    organizationId: string,
    options?: { fiscalYear?: number; status?: PeriodStatus }
  ) {
    return db.accountingPeriod.findMany({
      where: {
        organizationId,
        ...(options?.fiscalYear && { fiscalYear: options.fiscalYear }),
        ...(options?.status && { status: options.status }),
      },
      orderBy: [{ fiscalYear: "desc" }, { periodNumber: "asc" }],
    });
  }

  static async findPeriodByDate(organizationId: string, targetDate: Date) {
    return db.accountingPeriod.findFirst({
      where: {
        organizationId,
        startDate: { lte: targetDate },
        endDate: { gte: targetDate },
      },
    });
  }
}
