import { db } from "@/db/client";
import { BankTransactionRepository } from "../repositories/BankTransactionRepository";
import { BankAccountRepository } from "../repositories/BankAccountRepository";
import { AccountingPeriodService } from "./AccountingPeriodService";
import { CalculationEngine } from "./CalculationEngine";
import { AuditRepository } from "../repositories/AuditRepository";
import { SessionUser } from "@/types/auth";
import { assertTenantAccess } from "../authorization/tenant";
import { requirePermission } from "../authorization/permissions";
import { NotFoundError, ValidationError, ConflictError } from "@/lib/errors";
import {
  CreateBankTransactionInput,
  CategorizeTransactionInput,
} from "@/lib/validation/banking";
import {
  BankTransactionType,
  BankTransactionStatus,
  BankTransactionSource,
  Prisma,
} from "@prisma/client";

export class BankTransactionService {
  static async list(
    user: SessionUser,
    options?: {
      bankAccountId?: string;
      status?: BankTransactionStatus;
      transactionType?: BankTransactionType;
      source?: BankTransactionSource;
      startDate?: Date;
      endDate?: Date;
      search?: string;
      skip?: number;
      take?: number;
    }
  ) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "banking.read");

    return BankTransactionRepository.listByOrg(user.activeOrganizationId, options);
  }

  static async getById(user: SessionUser, id: string) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "banking.read");

    const transaction = await BankTransactionRepository.findByIdAndOrg(
      id,
      user.activeOrganizationId
    );
    if (!transaction) {
      throw new NotFoundError("Bank transaction not found");
    }
    return transaction;
  }

  static async createDirect(user: SessionUser, input: CreateBankTransactionInput) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "banking.manage");

    const account = await BankAccountRepository.findByIdAndOrg(
      input.bankAccountId,
      user.activeOrganizationId
    );
    if (!account) {
      throw new NotFoundError("Bank account not found");
    }

    const txDate = new Date(input.transactionDate);
    let amount = CalculationEngine.roundMoney(input.amount);

    // Standardize amount sign based on transaction type
    const isOutflow = ["WITHDRAWAL", "TRANSFER_OUT", "FEE"].includes(input.transactionType);
    if (isOutflow && amount > 0) {
      amount = -amount;
    } else if (!isOutflow && amount < 0) {
      amount = Math.abs(amount);
    }

    return db.$transaction(async (tx) => {
      // 1. Create BankTransaction
      const bankTx = await tx.bankTransaction.create({
        data: {
          organizationId: user.activeOrganizationId!,
          bankAccountId: input.bankAccountId,
          transactionDate: txDate,
          valueDate: input.valueDate ? new Date(input.valueDate) : null,
          description: input.description,
          reference: input.reference || null,
          amount,
          transactionType: input.transactionType,
          status: "UNMATCHED",
          source: "MANUAL",
          payee: input.payee || null,
          category: input.category || null,
          memo: input.memo || null,
          createdById: user.id,
        },
      });

      // 2. Adjust account operational balance
      await tx.bankAccount.update({
        where: { id: input.bankAccountId },
        data: {
          currentBalance: { increment: amount },
        },
      });

      // 3. Optional Direct GL Posting if targetLedgerAccountId and linkedLedgerAccountId are present
      if (input.targetLedgerAccountId && account.linkedLedgerAccountId) {
        const period = await AccountingPeriodService.assertOpenPeriod(
          user.activeOrganizationId!,
          txDate
        );

        const targetAccount = await tx.account.findFirst({
          where: {
            id: input.targetLedgerAccountId,
            organizationId: user.activeOrganizationId!,
          },
        });
        if (!targetAccount) {
          throw new NotFoundError("Target GL account not found.");
        }

        const count = await tx.journalEntry.count({
          where: { organizationId: user.activeOrganizationId! },
        });
        const journalNumber = `JE-BNK-${String(count + 1).padStart(5, "0")}`;
        const absAmount = Math.abs(amount);

        const journal = await tx.journalEntry.create({
          data: {
            organizationId: user.activeOrganizationId!,
            journalNumber,
            entryDate: txDate,
            postingDate: new Date(),
            referenceType: "BANK_TRANSACTION",
            referenceId: bankTx.id,
            description: input.description,
            source: "BANK_TRANSACTION",
            status: "POSTED",
            accountingPeriodId: period.id,
            totalDebit: absAmount,
            totalCredit: absAmount,
            createdById: user.id,
            postedById: user.id,
            postedAt: new Date(),
            lines: {
              create: [
                {
                  accountId: amount > 0 ? account.linkedLedgerAccountId : input.targetLedgerAccountId,
                  debit: absAmount,
                  credit: 0,
                  description: input.description,
                },
                {
                  accountId: amount > 0 ? input.targetLedgerAccountId : account.linkedLedgerAccountId,
                  debit: 0,
                  credit: absAmount,
                  description: input.description,
                },
              ],
            },
          },
        });

        // Update transaction status to MATCHED and link journal
        await tx.bankTransaction.update({
          where: { id: bankTx.id },
          data: {
            status: "MATCHED",
            matchedJournalEntryId: journal.id,
          },
        });
      }

      await AuditRepository.create({
        organization: { connect: { id: user.activeOrganizationId! } },
        actor: { connect: { id: user.id } },
        action: "BANK_TRANSACTION_CREATED",
        entityType: "BankTransaction",
        entityId: bankTx.id,
        metadata: {
          bankAccountId: input.bankAccountId,
          amount,
          type: input.transactionType,
          description: input.description,
        },
      });

      return bankTx;
    });
  }

  static async categorize(user: SessionUser, id: string, input: CategorizeTransactionInput) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "banking.match");

    const transaction = await BankTransactionRepository.findByIdAndOrg(
      id,
      user.activeOrganizationId
    );
    if (!transaction) {
      throw new NotFoundError("Bank transaction not found");
    }

    if (transaction.status === "RECONCILED") {
      throw new ValidationError("Cannot categorize a transaction that has already been reconciled.");
    }
    if (transaction.status === "VOIDED") {
      throw new ValidationError("Cannot categorize a voided transaction.");
    }

    const targetAccount = await db.account.findFirst({
      where: {
        id: input.targetLedgerAccountId,
        organizationId: user.activeOrganizationId,
      },
    });
    if (!targetAccount) {
      throw new NotFoundError("Target GL account not found.");
    }

    return db.$transaction(async (tx) => {
      let journalId: string | null = transaction.matchedJournalEntryId;

      // If bank account has a linked ledger account, create or link a JournalEntry
      if (transaction.bankAccount.linkedLedgerAccountId) {
        const period = await AccountingPeriodService.assertOpenPeriod(
          user.activeOrganizationId!,
          transaction.transactionDate
        );

        const count = await tx.journalEntry.count({
          where: { organizationId: user.activeOrganizationId! },
        });
        const journalNumber = `JE-CAT-${String(count + 1).padStart(5, "0")}`;
        const amountNum = Number(transaction.amount);
        const absAmount = Math.abs(amountNum);

        const journal = await tx.journalEntry.create({
          data: {
            organizationId: user.activeOrganizationId!,
            journalNumber,
            entryDate: transaction.transactionDate,
            postingDate: new Date(),
            referenceType: "BANK_TRANSACTION_CATEGORIZATION",
            referenceId: transaction.id,
            description: `${input.category}: ${transaction.description}`,
            source: "BANK_TRANSACTION",
            status: "POSTED",
            accountingPeriodId: period.id,
            totalDebit: absAmount,
            totalCredit: absAmount,
            createdById: user.id,
            postedById: user.id,
            postedAt: new Date(),
            lines: {
              create: [
                {
                  accountId: amountNum > 0 ? transaction.bankAccount.linkedLedgerAccountId : input.targetLedgerAccountId,
                  debit: absAmount,
                  credit: 0,
                  description: transaction.description,
                },
                {
                  accountId: amountNum > 0 ? input.targetLedgerAccountId : transaction.bankAccount.linkedLedgerAccountId,
                  debit: 0,
                  credit: absAmount,
                  description: transaction.description,
                },
              ],
            },
          },
        });
        journalId = journal.id;
      }

      const updated = await tx.bankTransaction.update({
        where: { id },
        data: {
          category: input.category,
          payee: input.payee || transaction.payee,
          memo: input.memo || transaction.memo,
          status: "MATCHED",
          matchedJournalEntryId: journalId,
        },
      });

      await AuditRepository.create({
        organization: { connect: { id: user.activeOrganizationId! } },
        actor: { connect: { id: user.id } },
        action: "BANK_TRANSACTION_CATEGORIZED",
        entityType: "BankTransaction",
        entityId: id,
        metadata: {
          category: input.category,
          targetLedgerAccountId: input.targetLedgerAccountId,
          journalEntryId: journalId,
        },
      });

      return updated;
    });
  }

  static async voidTransaction(user: SessionUser, id: string, reason?: string) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "banking.manage");

    const transaction = await BankTransactionRepository.findByIdAndOrg(
      id,
      user.activeOrganizationId
    );
    if (!transaction) {
      throw new NotFoundError("Bank transaction not found");
    }

    if (transaction.status === "RECONCILED") {
      throw new ValidationError("Cannot void a reconciled bank transaction.");
    }
    if (transaction.status === "VOIDED") {
      throw new ValidationError("Transaction is already voided.");
    }
    if (transaction.matchedTransferId) {
      throw new ValidationError("Cannot void an inter-account transfer leg directly. Void or cancel the bank transfer instead.");
    }

    return db.$transaction(async (tx) => {
      // 0. Re-verify transaction status under transaction boundary
      const currentTx = await tx.bankTransaction.findUnique({
        where: { id },
      });
      if (!currentTx || currentTx.status === "VOIDED") {
        throw new ValidationError("Transaction is already voided.");
      }
      if (currentTx.status === "RECONCILED") {
        throw new ValidationError("Cannot void a reconciled bank transaction.");
      }

      // 1. Reverse balance impact
      const amountNum = Number(transaction.amount);
      await tx.bankAccount.update({
        where: { id: transaction.bankAccountId },
        data: {
          currentBalance: { decrement: amountNum },
        },
      });

      // 2. If matched to a JournalEntry, reverse the journal
      if (transaction.matchedJournalEntryId) {
        const originalJournal = await tx.journalEntry.findUnique({
          where: { id: transaction.matchedJournalEntryId },
          include: { lines: true },
        });

        if (originalJournal && originalJournal.status === "POSTED") {
          const revCount = await tx.journalEntry.count({
            where: { organizationId: user.activeOrganizationId! },
          });
          const revJournalNumber = `JE-REV-${String(revCount + 1).padStart(5, "0")}`;

          const reversal = await tx.journalEntry.create({
            data: {
              organizationId: user.activeOrganizationId!,
              journalNumber: revJournalNumber,
              entryDate: new Date(),
              postingDate: new Date(),
              referenceType: "BANK_VOID_REVERSAL",
              referenceId: transaction.id,
              description: `Reversal of ${originalJournal.journalNumber} (Voided Bank Tx: ${transaction.description})`,
              source: "BANK_TRANSACTION",
              status: "POSTED",
              accountingPeriodId: originalJournal.accountingPeriodId,
              totalDebit: originalJournal.totalCredit,
              totalCredit: originalJournal.totalDebit,
              createdById: user.id,
              postedById: user.id,
              postedAt: new Date(),
              reversedEntryId: originalJournal.id,
              lines: {
                create: originalJournal.lines.map((l) => ({
                  accountId: l.accountId,
                  debit: l.credit,
                  credit: l.debit,
                  description: `Reversal: ${l.description || ""}`,
                })),
              },
            },
          });

          await tx.journalEntry.update({
            where: { id: originalJournal.id },
            data: { status: "REVERSED" },
          });
        }
      }

      // 3. Mark transaction VOIDED and clear matches
      const updated = await tx.bankTransaction.update({
        where: { id },
        data: {
          status: "VOIDED",
          memo: reason ? `${transaction.memo ? transaction.memo + " | " : ""}Voided: ${reason}` : transaction.memo,
          matchedCustomerPaymentId: null,
          matchedVendorPaymentId: null,
          matchedJournalEntryId: null,
          matchedTransferId: null,
        },
      });

      await AuditRepository.create({
        organization: { connect: { id: user.activeOrganizationId! } },
        actor: { connect: { id: user.id } },
        action: "BANK_TRANSACTION_VOIDED",
        entityType: "BankTransaction",
        entityId: id,
        metadata: { reason, amount: transaction.amount },
      });

      return updated;
    });
  }
}
