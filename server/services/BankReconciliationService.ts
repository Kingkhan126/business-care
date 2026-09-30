import { db } from "@/db/client";
import { BankReconciliationRepository } from "../repositories/BankReconciliationRepository";
import { BankAccountRepository } from "../repositories/BankAccountRepository";
import { CalculationEngine } from "./CalculationEngine";
import { AuditRepository } from "../repositories/AuditRepository";
import { SessionUser } from "@/types/auth";
import { assertTenantAccess } from "../authorization/tenant";
import { requirePermission } from "../authorization/permissions";
import { NotFoundError, ValidationError, ConflictError } from "@/lib/errors";
import { StartReconciliationInput } from "@/lib/validation/banking";
import { ReconciliationStatus, Prisma } from "@prisma/client";

export class BankReconciliationService {
  static async list(
    user: SessionUser,
    options?: {
      bankAccountId?: string;
      status?: ReconciliationStatus;
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
    requirePermission(user, "banking.read");

    return BankReconciliationRepository.listByOrg(user.activeOrganizationId, options);
  }

  static async getById(user: SessionUser, id: string) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "banking.read");

    const reconciliation = await BankReconciliationRepository.findByIdAndOrg(
      id,
      user.activeOrganizationId
    );
    if (!reconciliation) {
      throw new NotFoundError("Bank reconciliation session not found");
    }
    return reconciliation;
  }

  static async startReconciliation(user: SessionUser, input: StartReconciliationInput) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "banking.reconcile");

    const account = await BankAccountRepository.findByIdAndOrg(
      input.bankAccountId,
      user.activeOrganizationId
    );
    if (!account) {
      throw new NotFoundError("Bank account not found.");
    }

    const statementEndingBalance = CalculationEngine.roundMoney(input.statementEndingBalance);
    const startDate = new Date(input.statementStartDate);
    const endDate = new Date(input.statementEndDate);

    if (endDate < startDate) {
      throw new ValidationError("Statement end date cannot be earlier than statement start date.");
    }

    return db.$transaction(async (tx) => {
      // Database row lock on the BankAccount to serialize concurrent reconciliation creations
      if (typeof (tx as any).$queryRaw === "function") {
        await (tx as any).$queryRaw`SELECT id FROM "BankAccount" WHERE id = ${account.id} FOR UPDATE`.catch(() => {});
      }

      // 1. Check if an open reconciliation already exists for this account
      const existingOpen = await tx.bankReconciliation.findFirst({
        where: {
          organizationId: user.activeOrganizationId!,
          bankAccountId: account.id,
          status: "OPEN",
        },
      });
      if (existingOpen) {
        throw new ConflictError(
          `An open reconciliation (${existingOpen.reconciliationNumber}) is already in progress for this account. Please complete or void it before starting a new one.`
        );
      }

      // 2. Check for overlapping periods with COMPLETED or OPEN reconciliations
      const overlapping = await tx.bankReconciliation.findFirst({
        where: {
          organizationId: user.activeOrganizationId!,
          bankAccountId: account.id,
          status: { in: ["COMPLETED", "OPEN"] },
          statementStartDate: { lte: endDate },
          statementEndDate: { gte: startDate },
        },
      });
      if (overlapping) {
        throw new ConflictError(
          `Reconciliation period overlaps with reconciliation ${overlapping.reconciliationNumber} (${overlapping.statementStartDate.toISOString().split("T")[0]} to ${overlapping.statementEndDate.toISOString().split("T")[0]}).`
        );
      }

      // 3. Determine statement beginning balance
      const latestCompleted = await tx.bankReconciliation.findFirst({
        where: {
          organizationId: user.activeOrganizationId!,
          bankAccountId: account.id,
          status: "COMPLETED",
        },
        orderBy: { statementEndDate: "desc" },
      });
      const statementBeginningBalance = latestCompleted
        ? Number(latestCompleted.statementEndingBalance)
        : Number(account.openingBalance);

      const reconciliationNumber = await BankReconciliationRepository.findNextReconciliationNumber(
        user.activeOrganizationId!
      );

      const initialDifference = CalculationEngine.roundMoney(
        statementEndingBalance - statementBeginningBalance
      );

      // 4. Create reconciliation session
      const reconciliation = await tx.bankReconciliation.create({
        data: {
          organizationId: user.activeOrganizationId!,
          bankAccountId: account.id,
          reconciliationNumber,
          statementStartDate: startDate,
          statementEndDate: endDate,
          statementBeginningBalance,
          statementEndingBalance,
          reconciledBalance: statementBeginningBalance,
          difference: initialDifference,
          status: "OPEN",
          notes: input.notes || null,
        },
      });

      // 2. Find eligible unreconciled transactions up to statementEndDate
      const candidates = await tx.bankTransaction.findMany({
        where: {
          organizationId: user.activeOrganizationId!,
          bankAccountId: account.id,
          transactionDate: { lte: endDate },
          status: { notIn: ["VOIDED", "RECONCILED"] },
        },
        orderBy: { transactionDate: "asc" },
      });

      // 3. Create reconciliation items
      if (candidates.length > 0) {
        await tx.bankReconciliationItem.createMany({
          data: candidates.map((c) => ({
            organizationId: user.activeOrganizationId!,
            reconciliationId: reconciliation.id,
            bankTransactionId: c.id,
            isCleared: false,
          })),
        });
      }

      await AuditRepository.create({
        organization: { connect: { id: user.activeOrganizationId! } },
        actor: { connect: { id: user.id } },
        action: "BANK_RECONCILIATION_STARTED",
        entityType: "BankReconciliation",
        entityId: reconciliation.id,
        metadata: {
          reconciliationNumber,
          bankAccountId: account.id,
          beginningBalance: statementBeginningBalance,
          endingBalance: statementEndingBalance,
          candidateCount: candidates.length,
        },
      });

      return BankReconciliationRepository.findByIdAndOrg(reconciliation.id, user.activeOrganizationId!);
    });
  }

  static async toggleItemCleared(
    user: SessionUser,
    reconciliationId: string,
    bankTransactionId: string,
    isCleared: boolean
  ) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "banking.reconcile");

    const reconciliation = await BankReconciliationRepository.findByIdAndOrg(
      reconciliationId,
      user.activeOrganizationId
    );
    if (!reconciliation) {
      throw new NotFoundError("Bank reconciliation not found");
    }
    if (reconciliation.status !== "OPEN") {
      throw new ValidationError("Cannot modify items of a closed or voided reconciliation.");
    }

    const item = await db.bankReconciliationItem.findFirst({
      where: {
        reconciliationId,
        bankTransactionId,
        organizationId: user.activeOrganizationId,
      },
      include: { bankTransaction: true },
    });
    if (!item) {
      throw new NotFoundError("Reconciliation item not found.");
    }

    return db.$transaction(async (tx) => {
      // Row lock on BankReconciliation to serialize item updates against concurrent completion
      if (typeof (tx as any).$queryRaw === "function") {
        await (tx as any).$queryRaw`SELECT id FROM "BankReconciliation" WHERE id = ${reconciliationId} FOR UPDATE`.catch(() => {});
      }

      // Re-verify reconciliation is still open under transaction lock
      const currentRec = await tx.bankReconciliation.findUnique({
        where: { id: reconciliationId },
      });
      if (!currentRec || currentRec.status !== "OPEN") {
        throw new ConflictError("Cannot modify items of a closed or voided reconciliation.");
      }

      // 1. Update item status
      await tx.bankReconciliationItem.update({
        where: { id: item.id },
        data: {
          isCleared,
          clearedAt: isCleared ? new Date() : null,
        },
      });

      // 2. Fetch all cleared items to recalculate balances
      const clearedItems = await tx.bankReconciliationItem.findMany({
        where: {
          reconciliationId,
          isCleared: true,
        },
        include: { bankTransaction: true },
      });

      let clearedDepositsCount = 0;
      let clearedDepositsTotal = 0;
      let clearedWithdrawalsCount = 0;
      let clearedWithdrawalsTotal = 0;

      for (const ci of clearedItems) {
        const amt = Number(ci.bankTransaction.amount);
        if (amt >= 0) {
          clearedDepositsCount++;
          clearedDepositsTotal = CalculationEngine.roundMoney(clearedDepositsTotal + amt);
        } else {
          clearedWithdrawalsCount++;
          clearedWithdrawalsTotal = CalculationEngine.roundMoney(clearedWithdrawalsTotal + Math.abs(amt));
        }
      }

      const beginningBalance = Number(currentRec.statementBeginningBalance);
      const endingBalance = Number(currentRec.statementEndingBalance);

      const reconciledBalance = CalculationEngine.roundMoney(
        beginningBalance + clearedDepositsTotal - clearedWithdrawalsTotal
      );
      const difference = CalculationEngine.roundMoney(endingBalance - reconciledBalance);

      // 3. Update reconciliation summary
      const updated = await tx.bankReconciliation.update({
        where: { id: reconciliationId },
        data: {
          clearedDepositsCount,
          clearedDepositsTotal,
          clearedWithdrawalsCount,
          clearedWithdrawalsTotal,
          reconciledBalance,
          difference,
        },
        include: {
          bankAccount: true,
          items: {
            include: { bankTransaction: true },
            orderBy: { bankTransaction: { transactionDate: "asc" } },
          },
        },
      });

      return updated;
    });
  }

  static async completeReconciliation(
    user: SessionUser,
    reconciliationId: string,
    notes?: string | null
  ) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "banking.reconcile");

    const reconciliation = await BankReconciliationRepository.findByIdAndOrg(
      reconciliationId,
      user.activeOrganizationId
    );
    if (!reconciliation) {
      throw new NotFoundError("Bank reconciliation not found");
    }
    if (reconciliation.status !== "OPEN") {
      throw new ValidationError("Reconciliation session is not open.");
    }

    const difference = Number(reconciliation.difference);
    if (Math.abs(difference) > 0.001) {
      throw new ValidationError(
        `Reconciliation cannot be completed with an unresolved difference. Current difference: $${difference.toFixed(2)}.`
      );
    }

    return db.$transaction(async (tx) => {
      // Row lock on BankReconciliation to serialize completion against concurrent toggles
      if (typeof (tx as any).$queryRaw === "function") {
        await (tx as any).$queryRaw`SELECT id FROM "BankReconciliation" WHERE id = ${reconciliationId} FOR UPDATE`.catch(() => {});
      }

      // Re-verify status inside transaction to prevent race conditions
      const currentRec = await tx.bankReconciliation.findUnique({
        where: { id: reconciliationId },
      });
      if (!currentRec || currentRec.status !== "OPEN") {
        throw new ConflictError("Reconciliation session is no longer open.");
      }

      // Re-verify difference directly from currently cleared items under the row lock
      const clearedItems = await tx.bankReconciliationItem.findMany({
        where: {
          reconciliationId,
          isCleared: true,
        },
        include: { bankTransaction: true },
      });

      let clearedDepositsTotal = 0;
      let clearedWithdrawalsTotal = 0;
      for (const item of clearedItems) {
        const amt = Number(item.bankTransaction.amount);
        if (amt >= 0) {
          clearedDepositsTotal = CalculationEngine.roundMoney(clearedDepositsTotal + amt);
        } else {
          clearedWithdrawalsTotal = CalculationEngine.roundMoney(clearedWithdrawalsTotal + Math.abs(amt));
        }
      }

      const beginningBalance = Number(currentRec.statementBeginningBalance);
      const endingBalance = Number(currentRec.statementEndingBalance);
      const computedReconciled = CalculationEngine.roundMoney(
        beginningBalance + clearedDepositsTotal - clearedWithdrawalsTotal
      );
      const computedDiff = CalculationEngine.roundMoney(endingBalance - computedReconciled);

      if (Math.abs(computedDiff) > 0.001) {
        throw new ValidationError(
          `Reconciliation cannot be completed with an unresolved difference. Current difference: $${computedDiff.toFixed(2)}.`
        );
      }

      const now = new Date();

      // 1. Mark reconciliation COMPLETED
      const completed = await tx.bankReconciliation.update({
        where: { id: reconciliationId },
        data: {
          status: "COMPLETED",
          completedAt: now,
          completedById: user.id,
          notes: notes !== undefined ? notes : currentRec.notes,
        },
      });

      // 2. Lock all cleared transactions as RECONCILED
      const clearedTxIds = clearedItems.map((i) => i.bankTransactionId);

      if (clearedTxIds.length > 0) {
        await tx.bankTransaction.updateMany({
          where: {
            id: { in: clearedTxIds },
            organizationId: user.activeOrganizationId!,
          },
          data: {
            status: "RECONCILED",
            reconciliationId,
            clearedAt: now,
          },
        });
      }

      await AuditRepository.create({
        organization: { connect: { id: user.activeOrganizationId! } },
        actor: { connect: { id: user.id } },
        action: "BANK_RECONCILIATION_COMPLETED",
        entityType: "BankReconciliation",
        entityId: reconciliation.id,
        metadata: {
          reconciliationNumber: reconciliation.reconciliationNumber,
          endingBalance: reconciliation.statementEndingBalance,
          clearedItemsCount: clearedTxIds.length,
        },
      });

      return completed;
    });
  }

  static async voidReconciliation(user: SessionUser, reconciliationId: string, reason?: string) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "banking.reconcile");

    const reconciliation = await BankReconciliationRepository.findByIdAndOrg(
      reconciliationId,
      user.activeOrganizationId
    );
    if (!reconciliation) {
      throw new NotFoundError("Bank reconciliation not found");
    }
    if (reconciliation.status !== "COMPLETED") {
      throw new ValidationError("Only completed reconciliations can be voided.");
    }

    // Guard: Prevent voiding if a subsequent completed reconciliation exists
    const newerReconciliation = await db.bankReconciliation.findFirst({
      where: {
        organizationId: user.activeOrganizationId,
        bankAccountId: reconciliation.bankAccountId,
        status: "COMPLETED",
        statementEndDate: { gt: reconciliation.statementEndDate },
      },
    });
    if (newerReconciliation) {
      throw new ValidationError(
        `Cannot void this reconciliation because a newer completed reconciliation (${newerReconciliation.reconciliationNumber}) exists.`
      );
    }

    return db.$transaction(async (tx) => {
      // 1. Mark reconciliation as VOIDED
      const voided = await tx.bankReconciliation.update({
        where: { id: reconciliationId },
        data: {
          status: "VOIDED",
          notes: reason ? `${reconciliation.notes ? reconciliation.notes + " | " : ""}Voided: ${reason}` : reconciliation.notes,
        },
      });

      // 2. Unlock transactions back to MATCHED / UNMATCHED
      const lockedTransactions = await tx.bankTransaction.findMany({
        where: {
          reconciliationId,
          organizationId: user.activeOrganizationId!,
        },
      });

      for (const t of lockedTransactions) {
        const hasMatch = Boolean(
          t.matchedCustomerPaymentId ||
            t.matchedVendorPaymentId ||
            t.matchedJournalEntryId ||
            t.matchedTransferId
        );

        await tx.bankTransaction.update({
          where: { id: t.id },
          data: {
            status: hasMatch ? "MATCHED" : "UNMATCHED",
            reconciliationId: null,
            clearedAt: null,
          },
        });
      }

      await AuditRepository.create({
        organization: { connect: { id: user.activeOrganizationId! } },
        actor: { connect: { id: user.id } },
        action: "BANK_RECONCILIATION_VOIDED",
        entityType: "BankReconciliation",
        entityId: reconciliation.id,
        metadata: { reason },
      });

      return voided;
    });
  }
}
