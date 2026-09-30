import { db } from "@/db/client";
import { JournalRepository } from "../repositories/JournalRepository";
import { AccountingPeriodService } from "./AccountingPeriodService";
import { CalculationEngine } from "./CalculationEngine";
import { SessionUser } from "@/types/auth";
import { assertTenantAccess } from "../authorization/tenant";
import { requirePermission } from "../authorization/permissions";
import { NotFoundError, ValidationError, ConflictError } from "@/lib/errors";
import { JournalEntryInput } from "@/lib/validation/accounting";
import { JournalStatus, JournalSource } from "@prisma/client";

export class JournalEntryService {
  static async list(
    user: SessionUser,
    options?: {
      status?: JournalStatus;
      source?: JournalSource;
      search?: string;
      startDate?: Date;
      endDate?: Date;
      skip?: number;
      take?: number;
    }
  ) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "accounting.read");

    return JournalRepository.listByOrg(user.activeOrganizationId, options);
  }

  static async getById(user: SessionUser, id: string) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "accounting.read");

    const journal = await JournalRepository.findByIdAndOrg(id, user.activeOrganizationId);
    if (!journal) {
      throw new NotFoundError("Journal Entry not found");
    }
    return journal;
  }

  static async createManualJournal(user: SessionUser, input: JournalEntryInput) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "accounting.manage");

    const entryDate = new Date(input.entryDate);
    const period = await AccountingPeriodService.assertOpenPeriod(user.activeOrganizationId, entryDate);

    // Validate lines & double-entry balance
    if (!input.lines || input.lines.length < 2) {
      throw new ValidationError("Journal entry must contain at least 2 detail lines.");
    }

    let totalDebit = 0;
    let totalCredit = 0;

    for (const l of input.lines) {
      const account = await db.account.findFirst({
        where: { id: l.accountId, organizationId: user.activeOrganizationId },
      });
      if (!account) {
        throw new NotFoundError(`Account not found in your organization.`);
      }
      if (!account.isActive) {
        throw new ValidationError(`Account '${account.accountCode} - ${account.accountName}' is inactive.`);
      }
      if (!account.allowPosting) {
        throw new ValidationError(`Account '${account.accountCode} - ${account.accountName}' prohibits direct posting.`);
      }

      const debitVal = typeof l.debit === "number" ? l.debit : Number(l.debit || 0);
      const creditVal = typeof l.credit === "number" ? l.credit : Number(l.credit || 0);

      if (debitVal > 0 && creditVal > 0) {
        throw new ValidationError(`Line item cannot specify both debit and credit amounts.`);
      }

      totalDebit = CalculationEngine.roundMoney(totalDebit + debitVal);
      totalCredit = CalculationEngine.roundMoney(totalCredit + creditVal);
    }

    if (totalDebit !== totalCredit) {
      throw new ValidationError(
        `Journal entry is unbalanced. Total Debits (${totalDebit.toFixed(2)}) must equal Total Credits (${totalCredit.toFixed(2)}).`
      );
    }

    if (totalDebit <= 0) {
      throw new ValidationError("Journal entry total must be greater than zero.");
    }

    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      try {
        return await db.$transaction(async (tx) => {
          const count = await tx.journalEntry.count({ where: { organizationId: user.activeOrganizationId! } });
          const journalNumber = `JE-${String(count + 1 + attempts).padStart(6, "0")}`;

          const existing = await tx.journalEntry.findFirst({
            where: { journalNumber, organizationId: user.activeOrganizationId! },
          });
          if (existing) {
            throw new Error("AUTO_NUMBER_COLLISION");
          }

          const journal = await tx.journalEntry.create({
            data: {
              organizationId: user.activeOrganizationId!,
              journalNumber,
              entryDate,
              postingDate: new Date(),
              referenceType: input.referenceType || "MANUAL",
              referenceId: input.referenceId || null,
              description: input.description || input.memo || "Manual Journal Entry",
              source: "MANUAL",
              status: "DRAFT",
              accountingPeriodId: period.id,
              totalDebit,
              totalCredit,
              createdById: user.id,
              lines: {
                create: input.lines.map((l) => ({
                  accountId: l.accountId,
                  description: l.description || input.description,
                  debit: l.debit || 0,
                  credit: l.credit || 0,
                  reference: l.reference || null,
                  customerId: l.customerId || null,
                  supplierId: l.supplierId || null,
                  productId: l.productId || null,
                })),
              },
            },
            include: { lines: { include: { account: true } } },
          });

          await tx.auditLog.create({
            data: {
              organizationId: user.activeOrganizationId!,
              actorId: user.id,
              action: "journal.created",
              entityType: "JournalEntry",
              entityId: journal.id,
              metadata: { journalNumber, totalDebit },
            },
          });

          return journal;
        });
      } catch (err: any) {
        if (err.message === "AUTO_NUMBER_COLLISION") {
          attempts++;
          continue;
        }
        throw err;
      }
    }

    throw new ConflictError("Failed to generate a unique journal number. Please try again.");
  }

  static async postJournal(user: SessionUser, id: string) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "accounting.post");

    return db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "JournalEntry" WHERE id = ${id} AND "organizationId" = ${user.activeOrganizationId!} FOR UPDATE`;

      const journal = await tx.journalEntry.findFirst({
        where: { id, organizationId: user.activeOrganizationId! },
        include: { lines: true },
      });

      if (!journal) throw new NotFoundError("Journal entry not found");

      if (journal.status !== "DRAFT") {
        throw new ValidationError(`Only DRAFT journal entries can be posted. Current status is '${journal.status}'.`);
      }

      await AccountingPeriodService.assertOpenPeriod(user.activeOrganizationId!, journal.entryDate, tx);

      const updated = await tx.journalEntry.update({
        where: { id },
        data: {
          status: "POSTED",
          postedById: user.id,
          postedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: user.activeOrganizationId!,
          actorId: user.id,
          action: "journal.posted",
          entityType: "JournalEntry",
          entityId: id,
          metadata: { journalNumber: journal.journalNumber, totalDebit: Number(journal.totalDebit) },
        },
      });

      return updated;
    });
  }

  static async reverseJournal(user: SessionUser, id: string, reason?: string) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "accounting.reverse");

    return db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "JournalEntry" WHERE id = ${id} AND "organizationId" = ${user.activeOrganizationId!} FOR UPDATE`;

      const original = await tx.journalEntry.findFirst({
        where: { id, organizationId: user.activeOrganizationId! },
        include: { lines: true, reversingEntry: true },
      });

      if (!original) throw new NotFoundError("Original journal entry not found");

      if (original.status !== "POSTED") {
        throw new ValidationError(`Only POSTED journal entries can be reversed. Current status is '${original.status}'.`);
      }

      if (original.reversingEntry) {
        throw new ConflictError(`Journal entry '${original.journalNumber}' has already been reversed.`);
      }

      const reversalDate = new Date();
      const period = await AccountingPeriodService.assertOpenPeriod(user.activeOrganizationId!, reversalDate, tx);

      let attempts = 0;
      let journalNumber = "";
      while (attempts < 5) {
        const count = await tx.journalEntry.count({ where: { organizationId: user.activeOrganizationId! } });
        journalNumber = `JE-${String(count + 1 + attempts).padStart(6, "0")}`;
        const existing = await tx.journalEntry.findFirst({
          where: { journalNumber, organizationId: user.activeOrganizationId! },
        });
        if (!existing) break;
        attempts++;
      }

      const reversalJournal = await tx.journalEntry.create({
        data: {
          organizationId: user.activeOrganizationId!,
          journalNumber,
          entryDate: reversalDate,
          postingDate: reversalDate,
          referenceType: original.referenceType,
          referenceId: original.referenceId,
          description: `Reversal of ${original.journalNumber}: ${reason || original.description}`,
          source: original.source,
          status: "POSTED",
          accountingPeriodId: period.id,
          totalDebit: original.totalCredit,
          totalCredit: original.totalDebit,
          createdById: user.id,
          postedById: user.id,
          postedAt: reversalDate,
          reversedEntryId: original.id,
          lines: {
            create: original.lines.map((l) => ({
              accountId: l.accountId,
              description: `Reversal: ${l.description || ""}`,
              debit: l.credit, // Swap debit and credit
              credit: l.debit,
              reference: l.reference,
              customerId: l.customerId,
              supplierId: l.supplierId,
              productId: l.productId,
            })),
          },
        },
        include: { lines: true },
      });

      await tx.journalEntry.update({
        where: { id: original.id },
        data: { status: "REVERSED" },
      });

      await tx.auditLog.create({
        data: {
          organizationId: user.activeOrganizationId!,
          actorId: user.id,
          action: "journal.reversed",
          entityType: "JournalEntry",
          entityId: original.id,
          metadata: { originalJournalNumber: original.journalNumber, reversalJournalNumber: journalNumber },
        },
      });

      return reversalJournal;
    });
  }
}
