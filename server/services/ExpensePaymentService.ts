import { db } from "@/db/client";
import { ExpenseRepository } from "../repositories/ExpenseRepository";
import { AccountMappingService } from "./AccountMappingService";
import { AccountingPeriodService } from "./AccountingPeriodService";
import { CalculationEngine } from "./CalculationEngine";
import { ExpensePostingService } from "./ExpensePostingService";
import { ExpenseAuditAction } from "@/lib/audit/expenseEvents";
import { SessionUser } from "@/types/auth";
import { assertTenantAccess } from "../authorization/tenant";
import { requirePermission } from "../authorization/permissions";
import { NotFoundError, ValidationError, ConflictError } from "@/lib/errors";
import { PayExpenseInput, PayExpenseSchema } from "@/lib/validation/expense";
import {
  ExpenseStatus,
  ExpenseType,
  JournalSource,
  BankTransactionType,
  BankTransactionStatus,
  BankTransactionSource,
} from "@prisma/client";

export class ExpensePaymentService {
  /**
   * Helper to check idempotency and record accounting event lock.
   */
  private static async checkAndLockEvent(
    tx: any,
    organizationId: string,
    sourceType: string,
    sourceId: string,
    eventType: string
  ) {
    const existing = await tx.accountingEvent.findUnique({
      where: {
        organizationId_sourceType_sourceId_eventType: {
          organizationId,
          sourceType,
          sourceId,
          eventType,
        },
      },
    });

    if (existing) {
      if (existing.journalEntryId) {
        return await tx.journalEntry.findUnique({
          where: { id: existing.journalEntryId },
          include: { lines: { include: { account: true } } },
        });
      }
      throw new ConflictError(
        `Accounting event '${eventType}' for ${sourceType} '${sourceId}' has already been processed.`
      );
    }

    return null;
  }

  /**
   * Settles an approved/posted expense via bank/cash disbursement.
   *
   * Employee Reimbursement Claim:
   *   DR: Employee Reimbursements Payable
   *   CR: Bank / Cash Asset Account
   *
   * Direct Business Expense (incurred on account):
   *   DR: Accounts Payable
   *   CR: Bank / Cash Asset Account
   *
   * Creates Phase 6 BankTransaction (WITHDRAWAL), adjusts BankAccount.currentBalance,
   * transitions expense status to PAID, and records audit trail.
   */
  static async payExpense(user: SessionUser, expenseId: string, rawInput: PayExpenseInput) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "expense.pay");

    const input = PayExpenseSchema.parse(rawInput);
    const orgId = user.activeOrganizationId;

    // Verify bank account exists, belongs to tenant, and is active
    const bankAccount = await db.bankAccount.findFirst({
      where: {
        id: input.bankAccountId,
        organizationId: orgId,
        isActive: true,
      },
      include: { linkedLedgerAccount: true },
    });

    if (!bankAccount) {
      throw new NotFoundError("Active bank account not found in your organization.");
    }

    // Inspect initial expense state
    const initialExpense = await ExpenseRepository.findByIdAndOrg(expenseId, orgId);
    if (!initialExpense) {
      throw new NotFoundError("Expense not found");
    }

    if (initialExpense.status === ExpenseStatus.PAID) {
      return initialExpense; // Idempotent success
    }

    if (initialExpense.status === ExpenseStatus.VOIDED) {
      throw new ConflictError(`Expense ${initialExpense.expenseNumber} is voided and cannot be paid.`);
    }

    if (
      initialExpense.status === ExpenseStatus.DRAFT ||
      initialExpense.status === ExpenseStatus.SUBMITTED ||
      initialExpense.status === ExpenseStatus.REJECTED
    ) {
      throw new ValidationError(
        `Expense ${initialExpense.expenseNumber} in status '${initialExpense.status}' cannot be paid. Must be APPROVED or POSTED.`
      );
    }

    // If APPROVED, auto-post to General Ledger first
    if (initialExpense.status === ExpenseStatus.APPROVED) {
      await ExpensePostingService.postExpense(user, expenseId);
    }

    return db.$transaction(async (tx) => {
      // 1. Concurrency row lock
      if (typeof (tx as any).$queryRaw === "function") {
        await (tx as any).$queryRaw`SELECT id FROM "Expense" WHERE id = ${expenseId} FOR UPDATE`.catch(() => {});
      }

      const expense = await ExpenseRepository.findByIdAndOrg(expenseId, orgId, tx);
      if (!expense) {
        throw new NotFoundError("Expense not found");
      }

      if (expense.status === ExpenseStatus.PAID) {
        return expense; // Idempotent
      }

      if (expense.status !== ExpenseStatus.POSTED) {
        throw new ValidationError(
          `Expense ${expense.expenseNumber} in status '${expense.status}' cannot be paid. Expected POSTED.`
        );
      }

      // 2. Authoritative Period Verification
      const paymentDate = input.paymentDate ? new Date(input.paymentDate) : new Date();
      const period = await AccountingPeriodService.assertOpenPeriod(orgId, paymentDate, tx);

      // 3. Accounting Event Idempotency Check
      const eventType =
        expense.expenseType === ExpenseType.EMPLOYEE_CLAIM
          ? "EXPENSE_REIMBURSED"
          : "EXPENSE_PAID";

      const existingEvent = await tx.accountingEvent.findUnique({
        where: {
          organizationId_sourceType_sourceId_eventType: {
            organizationId: orgId,
            sourceType: "Expense",
            sourceId: expense.id,
            eventType,
          },
        },
      });

      if (existingEvent?.journalEntryId) {
        return expense;
      }

      // 4. Resolve Accounts
      const totalAmount = CalculationEngine.roundMoney(Number(expense.total));
      if (totalAmount <= 0) {
        throw new ValidationError("Expense amount must be greater than zero to execute payment.");
      }

      let debitAccount;
      if (expense.expenseType === ExpenseType.EMPLOYEE_CLAIM) {
        debitAccount = await AccountMappingService.resolveAccount(
          orgId,
          "EMPLOYEE_REIMBURSEMENTS_PAYABLE"
        );
      } else {
        debitAccount = await AccountMappingService.resolveAccount(orgId, "ACCOUNTS_PAYABLE");
      }

      const creditAccount =
        bankAccount.linkedLedgerAccount ||
        (await AccountMappingService.resolveAccount(orgId, "BANK"));

      // 5. Generate Sequential Journal Entry Number
      let attempts = 0;
      let journalNumber = "";
      while (attempts < 5) {
        const count = await tx.journalEntry.count({ where: { organizationId: orgId } });
        journalNumber = `JE-${String(count + 1 + attempts).padStart(6, "0")}`;
        const existing = await tx.journalEntry.findFirst({
          where: { journalNumber, organizationId: orgId },
        });
        if (!existing) break;
        attempts++;
      }

      const journalSource =
        expense.expenseType === ExpenseType.EMPLOYEE_CLAIM
          ? JournalSource.EMPLOYEE_REIMBURSEMENT
          : JournalSource.EXPENSE;

      const description =
        expense.expenseType === ExpenseType.EMPLOYEE_CLAIM
          ? `Reimbursement for expense ${expense.expenseNumber} (${expense.claimant?.name || "Employee"})`
          : `Payment for expense ${expense.expenseNumber}`;

      // 6. Create Payment / Reimbursement Journal Entry
      const journal = await tx.journalEntry.create({
        data: {
          organizationId: orgId,
          journalNumber,
          entryDate: paymentDate,
          postingDate: new Date(),
          referenceType: "Expense",
          referenceId: expense.id,
          description,
          source: journalSource,
          status: "POSTED",
          accountingPeriodId: period.id,
          totalDebit: totalAmount,
          totalCredit: totalAmount,
          createdById: user.id,
          postedById: user.id,
          postedAt: new Date(),
          lines: {
            create: [
              {
                accountId: debitAccount.id,
                description: `${description} - Liability Settlement`,
                debit: totalAmount,
                credit: 0,
                supplierId: expense.supplierId || null,
              },
              {
                accountId: creditAccount.id,
                description: `${description} - Bank Disbursement`,
                debit: 0,
                credit: totalAmount,
                supplierId: expense.supplierId || null,
              },
            ],
          },
        },
        include: { lines: true },
      });

      // 7. Record Phase 6 Bank Transaction (Outflow = Negative)
      const bankTx = await tx.bankTransaction.create({
        data: {
          organizationId: orgId,
          bankAccountId: bankAccount.id,
          transactionDate: paymentDate,
          description,
          reference: input.reference || expense.expenseNumber,
          amount: -totalAmount,
          transactionType: BankTransactionType.WITHDRAWAL,
          status: BankTransactionStatus.MATCHED,
          source: BankTransactionSource.MANUAL,
          payee: expense.claimant?.name || expense.supplier?.displayName || null,
          category:
            expense.expenseType === ExpenseType.EMPLOYEE_CLAIM
              ? "Employee Reimbursement"
              : "Expense Payment",
          matchedJournalEntryId: journal.id,
          createdById: user.id,
        },
      });

      // 8. Adjust BankAccount Operational Balance
      await tx.bankAccount.update({
        where: { id: bankAccount.id },
        data: {
          currentBalance: { decrement: totalAmount },
        },
      });

      // 9. Record Accounting Event
      await tx.accountingEvent.create({
        data: {
          organizationId: orgId,
          eventType,
          sourceType: "Expense",
          sourceId: expense.id,
          journalEntryId: journal.id,
        },
      });

      // 10. Update Expense to PAID
      const updatedExpense = await tx.expense.update({
        where: { id: expense.id },
        data: {
          status: ExpenseStatus.PAID,
          paidAt: paymentDate,
          bankAccountId: bankAccount.id,
          reimbursementJournalId: journal.id,
        },
        include: {
          category: true,
          supplier: true,
          claimant: { select: { id: true, name: true, email: true } },
          bankAccount: true,
          lines: true,
          journalEntry: true,
          reimbursementJournal: true,
        },
      });

      // 11. Audit Trail Logging
      const auditAction =
        expense.expenseType === ExpenseType.EMPLOYEE_CLAIM
          ? ExpenseAuditAction.EXPENSE_REIMBURSED
          : ExpenseAuditAction.EXPENSE_PAID;

      await tx.auditLog.create({
        data: {
          organizationId: orgId,
          actorId: user.id,
          action: auditAction,
          entityType: "Expense",
          entityId: expense.id,
          metadata: {
            expenseNumber: expense.expenseNumber,
            amount: totalAmount,
            bankAccountId: bankAccount.id,
            journalNumber: journal.journalNumber,
            bankTransactionId: bankTx.id,
          },
        },
      });

      return updatedExpense;
    });
  }

  /**
   * Voids an expense.
   * If the expense was posted or paid, creates balanced reversing journal entries,
   * reverses bank balance adjustments and bank transactions, and marks the expense VOIDED.
   */
  static async voidExpense(user: SessionUser, expenseId: string, reason?: string) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "expense.manage");

    const orgId = user.activeOrganizationId;

    return db.$transaction(async (tx) => {
      // 1. Concurrency row lock
      if (typeof (tx as any).$queryRaw === "function") {
        await (tx as any).$queryRaw`SELECT id FROM "Expense" WHERE id = ${expenseId} FOR UPDATE`.catch(() => {});
      }

      const expense = await ExpenseRepository.findByIdAndOrg(expenseId, orgId, tx);
      if (!expense) {
        throw new NotFoundError("Expense not found");
      }

      if (expense.status === ExpenseStatus.VOIDED) {
        throw new ConflictError(`Expense ${expense.expenseNumber} is already voided.`);
      }

      // Case A: Unposted expense (DRAFT, SUBMITTED, REJECTED, APPROVED with no GL journals)
      if (
        (expense.status === ExpenseStatus.DRAFT ||
          expense.status === ExpenseStatus.SUBMITTED ||
          expense.status === ExpenseStatus.REJECTED ||
          expense.status === ExpenseStatus.APPROVED) &&
        !expense.journalEntryId &&
        !expense.reimbursementJournalId
      ) {
        const updated = await tx.expense.update({
          where: { id: expense.id },
          data: {
            status: ExpenseStatus.VOIDED,
            notes: reason
              ? expense.notes
                ? `${expense.notes}\nVoided: ${reason}`
                : `Voided: ${reason}`
              : expense.notes,
          },
          include: { category: true, lines: true },
        });

        await tx.auditLog.create({
          data: {
            organizationId: orgId,
            actorId: user.id,
            action: ExpenseAuditAction.EXPENSE_VOIDED,
            entityType: "Expense",
            entityId: expense.id,
            metadata: { expenseNumber: expense.expenseNumber, reason },
          },
        });

        return updated;
      }

      // Case B: Posted or Paid expense — requires General Ledger reversal
      const reversalDate = new Date();
      const period = await AccountingPeriodService.assertOpenPeriod(orgId, reversalDate, tx);

      // Helper to reverse a JournalEntry
      const reverseEntry = async (journalId: string, descriptionPrefix: string) => {
        const original = await tx.journalEntry.findUnique({
          where: { id: journalId },
          include: { lines: true, reversingEntry: true },
        });

        if (!original || original.status !== "POSTED" || original.reversingEntry) {
          return null;
        }

        let attempts = 0;
        let journalNumber = "";
        while (attempts < 5) {
          const count = await tx.journalEntry.count({ where: { organizationId: orgId } });
          journalNumber = `JE-REV-${String(count + 1 + attempts).padStart(5, "0")}`;
          const existing = await tx.journalEntry.findFirst({
            where: { journalNumber, organizationId: orgId },
          });
          if (!existing) break;
          attempts++;
        }

        const reversal = await tx.journalEntry.create({
          data: {
            organizationId: orgId,
            journalNumber,
            entryDate: reversalDate,
            postingDate: reversalDate,
            referenceType: "Expense",
            referenceId: expense.id,
            description: `Reversal of ${original.journalNumber}: ${descriptionPrefix} (${reason || "Voided expense"})`,
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
                debit: l.credit,
                credit: l.debit,
                reference: l.reference,
                customerId: l.customerId,
                supplierId: l.supplierId,
                productId: l.productId,
              })),
            },
          },
        });

        await tx.journalEntry.update({
          where: { id: original.id },
          data: { status: "REVERSED" },
        });

        return reversal;
      };

      // 1. Reverse reimbursement journal if present
      if (expense.reimbursementJournalId) {
        await reverseEntry(expense.reimbursementJournalId, "Reimbursement Settlement");
      }

      // 2. Reverse initial posting journal if present
      if (expense.journalEntryId) {
        await reverseEntry(expense.journalEntryId, "Expense Accrual");
      }

      // 3. Reverse bank transaction and bank balance impact if matched
      const matchedJournals = [expense.journalEntryId, expense.reimbursementJournalId].filter(
        Boolean
      ) as string[];

      if (matchedJournals.length > 0) {
        const bankTransactions = await tx.bankTransaction.findMany({
          where: {
            organizationId: orgId,
            matchedJournalEntryId: { in: matchedJournals },
            status: { not: BankTransactionStatus.VOIDED },
          },
        });

        for (const bt of bankTransactions) {
          if (bt.status === BankTransactionStatus.RECONCILED) {
            throw new ValidationError(
              "Cannot void expense because associated bank transaction has already been reconciled."
            );
          }

          // Balance adjustment: Outflows are negative amounts, so decrementing a negative adds money back
          await tx.bankAccount.update({
            where: { id: bt.bankAccountId },
            data: {
              currentBalance: { decrement: Number(bt.amount) },
            },
          });

          await tx.bankTransaction.update({
            where: { id: bt.id },
            data: {
              status: BankTransactionStatus.VOIDED,
              memo: reason
                ? bt.memo
                  ? `${bt.memo} | Voided with expense: ${reason}`
                  : `Voided with expense: ${reason}`
                : bt.memo,
              matchedJournalEntryId: null,
            },
          });
        }
      }

      // 4. Transition Expense to VOIDED
      const updatedExpense = await tx.expense.update({
        where: { id: expense.id },
        data: {
          status: ExpenseStatus.VOIDED,
          notes: reason
            ? expense.notes
              ? `${expense.notes}\nVoided: ${reason}`
              : `Voided: ${reason}`
            : expense.notes,
        },
        include: {
          category: true,
          supplier: true,
          claimant: { select: { id: true, name: true, email: true } },
          bankAccount: true,
          lines: true,
          journalEntry: true,
          reimbursementJournal: true,
        },
      });

      // 5. Audit Log
      await tx.auditLog.create({
        data: {
          organizationId: orgId,
          actorId: user.id,
          action: ExpenseAuditAction.EXPENSE_VOIDED,
          entityType: "Expense",
          entityId: expense.id,
          metadata: {
            expenseNumber: expense.expenseNumber,
            reason,
            total: Number(expense.total),
          },
        },
      });

      return updatedExpense;
    });
  }
}
