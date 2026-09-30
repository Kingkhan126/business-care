import { db } from "@/db/client";
import { AccountMappingService } from "./AccountMappingService";
import { AccountingPeriodService } from "./AccountingPeriodService";
import { CalculationEngine } from "./CalculationEngine";
import { AuditRepository } from "../repositories/AuditRepository";
import { ExpenseAuditAction } from "@/lib/audit/expenseEvents";
import { SessionUser } from "@/types/auth";
import { assertTenantAccess } from "../authorization/tenant";
import { requirePermission } from "../authorization/permissions";
import { NotFoundError, ValidationError, ConflictError } from "@/lib/errors";
import {
  ExpenseStatus,
  ExpenseType,
  ExpensePaymentType,
  BankTransactionType,
  BankTransactionStatus,
  BankTransactionSource,
} from "@prisma/client";

export class ExpensePostingService {
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
      throw new ConflictError(`Accounting event '${eventType}' for ${sourceType} '${sourceId}' has already been processed.`);
    }

    return null;
  }

  /**
   * Safely handles race collisions on AccountingEvent unique constraint.
   */
  private static async handleUniqueCollision(
    organizationId: string,
    sourceType: string,
    sourceId: string,
    eventType: string
  ) {
    const existing = await db.accountingEvent.findUnique({
      where: {
        organizationId_sourceType_sourceId_eventType: {
          organizationId,
          sourceType,
          sourceId,
          eventType,
        },
      },
    });

    if (existing && existing.journalEntryId) {
      return db.journalEntry.findUnique({
        where: { id: existing.journalEntryId },
        include: { lines: { include: { account: true } } },
      });
    }

    throw new ConflictError(`Accounting event '${eventType}' for ${sourceType} '${sourceId}' was processed concurrently.`);
  }

  /**
   * Posts an approved Expense to the General Ledger.
   *
   * Direct Business Expense Paid Immediately:
   *   DR: Expense Account(s)
   *   DR: Input Tax Recoverable (if tax > 0)
   *   CR: Bank/Cash Asset Account
   *
   * Employee Reimbursement Claim:
   *   DR: Expense Account(s)
   *   DR: Input Tax Recoverable (if tax > 0)
   *   CR: Employee Reimbursements Payable
   */
  static async postExpense(user: SessionUser, expenseId: string) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "expense.post");

    const orgId = user.activeOrganizationId;

    try {
      return await db.$transaction(async (tx) => {
        // 1. Database Row Lock for Concurrency Serialization
        if (typeof (tx as any).$queryRaw === "function") {
          await (tx as any).$queryRaw`SELECT id FROM "Expense" WHERE id = ${expenseId} FOR UPDATE`.catch(() => {});
        }

        const expense = await tx.expense.findFirst({
          where: { id: expenseId, organizationId: orgId },
          include: {
            lines: {
              include: {
                category: {
                  include: { linkedExpenseAccount: true },
                },
              },
            },
            category: {
              include: { linkedExpenseAccount: true },
            },
            bankAccount: {
              include: { linkedLedgerAccount: true },
            },
            claimant: true,
            supplier: true,
          },
        });

        if (!expense) {
          throw new NotFoundError("Expense not found");
        }

        // Idempotency: If already posted and journal exists, return existing journal
        if (expense.status === ExpenseStatus.POSTED || expense.status === ExpenseStatus.PAID) {
          const existingEvent = await tx.accountingEvent.findUnique({
            where: {
              organizationId_sourceType_sourceId_eventType: {
                organizationId: orgId,
                sourceType: "Expense",
                sourceId: expense.id,
                eventType: "EXPENSE_POSTED",
              },
            },
          });
          if (existingEvent?.journalEntryId) {
            return tx.journalEntry.findUnique({
              where: { id: existingEvent.journalEntryId },
              include: { lines: { include: { account: true } } },
            });
          }
        }

        if (expense.status !== ExpenseStatus.APPROVED) {
          throw new ValidationError(
            `Expense ${expense.expenseNumber} in status '${expense.status}' cannot be posted. Expected APPROVED.`
          );
        }

        // 2. Check and Lock Accounting Event for Idempotency
        const existingJournal = await this.checkAndLockEvent(tx, orgId, "Expense", expense.id, "EXPENSE_POSTED");
        if (existingJournal) return existingJournal;

        // 3. Authoritative In-Transaction Period Lock Verification
        const period = await AccountingPeriodService.assertOpenPeriod(orgId, expense.expenseDate, tx);

        // 4. Resolve Default Expense Account Fallback
        const defaultExpenseAccount = await AccountMappingService.resolveAccount(orgId, "DEFAULT_EXPENSE");
        const taxAccount = await AccountMappingService.resolveAccount(orgId, "TAX_RECOVERABLE");

        // 5. Construct Debit Lines (Expense Categories)
        const journalLines: Array<{
          accountId: string;
          description: string;
          debit: number;
          credit: number;
          supplierId?: string | null;
        }> = [];

        let computedDebitTotal = 0;

        for (const line of expense.lines) {
          const lineSubtotal = Number(line.subtotal);
          if (lineSubtotal <= 0) continue;

          // Category on line, or fallback to header category, or fallback to default expense mapping
          const targetAccount =
            line.category?.linkedExpenseAccount ||
            expense.category?.linkedExpenseAccount ||
            defaultExpenseAccount;

          journalLines.push({
            accountId: targetAccount.id,
            description: `${line.description} (${expense.expenseNumber})`,
            debit: lineSubtotal,
            credit: 0,
            supplierId: expense.supplierId || null,
          });
          computedDebitTotal += lineSubtotal;
        }

        // 6. Tax Debit Line
        const taxTotal = Number(expense.taxTotal);
        if (taxTotal > 0) {
          journalLines.push({
            accountId: taxAccount.id,
            description: `Input Tax Recoverable for Expense ${expense.expenseNumber}`,
            debit: taxTotal,
            credit: 0,
            supplierId: expense.supplierId || null,
          });
          computedDebitTotal += taxTotal;
        }

        computedDebitTotal = CalculationEngine.roundMoney(computedDebitTotal);
        const expectedTotal = Number(expense.total);

        // Verify balance alignment between calculated lines and document total
        if (Math.abs(computedDebitTotal - expectedTotal) > 0.01) {
          throw new ValidationError(
            `Financial imbalance: Calculated debits (${computedDebitTotal}) do not match document total (${expectedTotal}).`
          );
        }

        // 7. Construct Credit Line
        if (expense.expenseType === ExpenseType.EMPLOYEE_CLAIM) {
          // Employee Reimbursement Liability
          const payableAccount = await AccountMappingService.resolveAccount(
            orgId,
            "EMPLOYEE_REIMBURSEMENTS_PAYABLE"
          );

          journalLines.push({
            accountId: payableAccount.id,
            description: `Employee Reimbursement Liability for ${expense.claimant?.name || "Employee"} (${expense.expenseNumber})`,
            debit: 0,
            credit: computedDebitTotal,
            supplierId: expense.supplierId || null,
          });
        } else {
          // Direct Business Expense
          if (expense.paymentType === ExpensePaymentType.PAID_IMMEDIATELY) {
            let creditAccount = expense.bankAccount?.linkedLedgerAccount;
            if (!creditAccount) {
              creditAccount = await AccountMappingService.resolveAccount(orgId, "BANK");
            }

            journalLines.push({
              accountId: creditAccount.id,
              description: `Cash/Bank Disbursement for Expense ${expense.expenseNumber}`,
              debit: 0,
              credit: computedDebitTotal,
              supplierId: expense.supplierId || null,
            });
          } else {
            // Incurred on Account (Accounts Payable)
            const apAccount = await AccountMappingService.resolveAccount(orgId, "ACCOUNTS_PAYABLE");
            journalLines.push({
              accountId: apAccount.id,
              description: `Accounts Payable for Expense ${expense.expenseNumber}`,
              debit: 0,
              credit: computedDebitTotal,
              supplierId: expense.supplierId || null,
            });
          }
        }

        // 8. Generate Sequential Journal Entry Number
        const count = await tx.journalEntry.count({ where: { organizationId: orgId } });
        const journalNumber = `JE-${String(count + 1).padStart(6, "0")}`;

        // 9. Persist Journal Entry
        const journal = await tx.journalEntry.create({
          data: {
            organizationId: orgId,
            journalNumber,
            entryDate: expense.expenseDate,
            postingDate: new Date(),
            referenceType: "Expense",
            referenceId: expense.id,
            description: `Expense ${expense.expenseNumber}: ${expense.description}`,
            source: "EXPENSE",
            status: "POSTED",
            accountingPeriodId: period.id,
            totalDebit: computedDebitTotal,
            totalCredit: computedDebitTotal,
            createdById: user.id,
            postedById: user.id,
            postedAt: new Date(),
            lines: { create: journalLines },
          },
          include: { lines: { include: { account: true } } },
        });

        // 10. Record Accounting Event for Idempotency
        await tx.accountingEvent.create({
          data: {
            organizationId: orgId,
            eventType: "EXPENSE_POSTED",
            sourceType: "Expense",
            sourceId: expense.id,
            journalEntryId: journal.id,
          },
        });

        // 11. Update Expense State to POSTED (or PAID if paid immediately)
        const isPaidImmediately =
          expense.expenseType === ExpenseType.DIRECT_BUSINESS &&
          expense.paymentType === ExpensePaymentType.PAID_IMMEDIATELY;

        const newStatus = isPaidImmediately ? ExpenseStatus.PAID : ExpenseStatus.POSTED;

        await tx.expense.update({
          where: { id: expense.id },
          data: {
            status: newStatus,
            journalEntryId: journal.id,
            postedAt: new Date(),
            ...(newStatus === ExpenseStatus.PAID && { paidAt: new Date() }),
          },
        });

        // 12. For immediate payment, record BankTransaction and update BankAccount operational balance
        if (isPaidImmediately && expense.bankAccountId) {
          await tx.bankTransaction.create({
            data: {
              organizationId: orgId,
              bankAccountId: expense.bankAccountId,
              transactionDate: expense.expenseDate,
              description: `Direct payment for expense ${expense.expenseNumber}`,
              reference: expense.expenseNumber,
              amount: -computedDebitTotal,
              transactionType: BankTransactionType.WITHDRAWAL,
              status: BankTransactionStatus.MATCHED,
              source: BankTransactionSource.MANUAL,
              payee: expense.supplier?.displayName || null,
              category: "Expense Payment",
              matchedJournalEntryId: journal.id,
              createdById: user.id,
            },
          });

          await tx.bankAccount.update({
            where: { id: expense.bankAccountId },
            data: {
              currentBalance: { decrement: computedDebitTotal },
            },
          });
        }

        // 13. Audit Logging
        await tx.auditLog.create({
          data: {
            organizationId: orgId,
            actorId: user.id,
            action: ExpenseAuditAction.EXPENSE_POSTED,
            entityType: "Expense",
            entityId: expense.id,
            metadata: {
              expenseNumber: expense.expenseNumber,
              journalNumber: journal.journalNumber,
              total: computedDebitTotal,
              paidImmediately: isPaidImmediately,
            },
          },
        });

        if (isPaidImmediately) {
          await tx.auditLog.create({
            data: {
              organizationId: orgId,
              actorId: user.id,
              action: ExpenseAuditAction.EXPENSE_PAID,
              entityType: "Expense",
              entityId: expense.id,
              metadata: {
                expenseNumber: expense.expenseNumber,
                bankAccountId: expense.bankAccountId,
                total: computedDebitTotal,
                directImmediate: true,
              },
            },
          });
        }

        return journal;
      });
    } catch (err: any) {
      if (err.code === "P2002" || err.message?.includes("Unique constraint failed")) {
        return this.handleUniqueCollision(orgId, "Expense", expenseId, "EXPENSE_POSTED");
      }
      throw err;
    }
  }
}
