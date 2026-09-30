import { db } from "@/db/client";
import { PeriodRepository } from "../repositories/PeriodRepository";
import { SessionUser } from "@/types/auth";
import { assertTenantAccess } from "../authorization/tenant";
import { requirePermission } from "../authorization/permissions";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { PeriodStatus } from "@prisma/client";

export class AccountingPeriodService {
  static async list(user: SessionUser, options?: { fiscalYear?: number; status?: PeriodStatus }) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "accounting.read");

    return PeriodRepository.listByOrg(user.activeOrganizationId, options);
  }

  static async generateFiscalYearPeriods(user: SessionUser, fiscalYear: number) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "accounting.close_period");

    const org = await db.organization.findUnique({
      where: { id: user.activeOrganizationId },
    });
    if (!org) throw new NotFoundError("Organization not found");

    const startMonth = org.fiscalYearStart || 1; // 1-12
    const existing = await PeriodRepository.listByOrg(user.activeOrganizationId, { fiscalYear });
    if (existing.length > 0) {
      return existing;
    }

    const periods = [];
    for (let p = 0; p < 12; p++) {
      const monthIndex = (startMonth - 1 + p) % 12;
      const yearOffset = Math.floor((startMonth - 1 + p) / 12);
      const actualYear = fiscalYear + yearOffset;

      const startDate = new Date(actualYear, monthIndex, 1);
      const endDate = new Date(actualYear, monthIndex + 1, 0, 23, 59, 59, 999);
      const monthName = startDate.toLocaleString("en-US", { month: "short" });

      periods.push({
        organizationId: user.activeOrganizationId,
        fiscalYear,
        periodNumber: p + 1,
        name: `${monthName} ${actualYear}`,
        startDate,
        endDate,
        status: "OPEN" as PeriodStatus,
      });
    }

    await db.accountingPeriod.createMany({
      data: periods,
    });

    return PeriodRepository.listByOrg(user.activeOrganizationId, { fiscalYear });
  }

  static async assertOpenPeriod(organizationId: string, entryDate: Date, txPrisma?: any) {
    const runner = txPrisma || db;

    if (txPrisma) {
      try {
        const rawLocked: any[] = await txPrisma.$queryRaw`
          SELECT id, status, name FROM "AccountingPeriod" 
          WHERE "organizationId" = ${organizationId} 
          AND "startDate" <= ${entryDate} 
          AND "endDate" >= ${entryDate} 
          FOR UPDATE
        `;
        if (rawLocked && rawLocked.length > 0) {
          const period = rawLocked[0];
          if (period.status !== "OPEN") {
            throw new ValidationError(
              `Accounting period '${period.name}' is ${period.status}. Posting into a closed/locked period is prohibited.`
            );
          }
          return period;
        }
      } catch (err: any) {
        if (err instanceof ValidationError) throw err;
        // Fallback to standard query if raw lock query fails
      }
    }

    const period = await PeriodRepository.findPeriodByDate(organizationId, entryDate);
    if (!period) {
      // Auto-initialize current year period if none exists
      const fiscalYear = entryDate.getFullYear();
      const startDate = new Date(fiscalYear, entryDate.getMonth(), 1);
      const endDate = new Date(fiscalYear, entryDate.getMonth() + 1, 0, 23, 59, 59, 999);
      const monthName = startDate.toLocaleString("en-US", { month: "short" });

      return runner.accountingPeriod.create({
        data: {
          organizationId,
          fiscalYear,
          periodNumber: entryDate.getMonth() + 1,
          name: `${monthName} ${fiscalYear}`,
          startDate,
          endDate,
          status: "OPEN",
        },
      });
    }

    if (period.status !== "OPEN") {
      throw new ValidationError(
        `Accounting period '${period.name}' is ${period.status}. Posting into a closed/locked period is prohibited.`
      );
    }

    return period;
  }

  static async closePeriod(user: SessionUser, periodId: string) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "accounting.close_period");

    return db.$transaction(async (tx) => {
      try {
        await tx.$queryRaw`SELECT id FROM "AccountingPeriod" WHERE id = ${periodId} AND "organizationId" = ${user.activeOrganizationId!} FOR UPDATE`;
      } catch {
        // Fallback
      }

      const period = await tx.accountingPeriod.findFirst({
        where: { id: periodId, organizationId: user.activeOrganizationId! },
      });
      if (!period) throw new NotFoundError("Accounting period not found");

      if (period.status === "CLOSED") {
        throw new ValidationError(`Period '${period.name}' is already closed.`);
      }

      const updated = await tx.accountingPeriod.update({
        where: { id: periodId },
        data: {
          status: "CLOSED",
          closedAt: new Date(),
          closedById: user.id,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: user.activeOrganizationId!,
          actorId: user.id,
          action: "accounting_period.closed",
          entityType: "AccountingPeriod",
          entityId: periodId,
          metadata: { periodName: period.name, fiscalYear: period.fiscalYear },
        },
      });

      return updated;
    });
  }

  static async reopenPeriod(user: SessionUser, periodId: string) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "accounting.close_period");

    const period = await db.accountingPeriod.findFirst({
      where: { id: periodId, organizationId: user.activeOrganizationId! },
    });
    if (!period) throw new NotFoundError("Accounting period not found");

    const updated = await db.accountingPeriod.update({
      where: { id: periodId },
      data: {
        status: "OPEN",
        closedAt: null,
        closedById: null,
      },
    });

    await db.auditLog.create({
      data: {
        organizationId: user.activeOrganizationId!,
        actorId: user.id,
        action: "accounting_period.reopened",
        entityType: "AccountingPeriod",
        entityId: periodId,
        metadata: { periodName: period.name, fiscalYear: period.fiscalYear },
      },
    });

    return updated;
  }
}
