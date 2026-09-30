import { db } from "@/db/client";
import { BankTransferRepository } from "../repositories/BankTransferRepository";
import { BankAccountRepository } from "../repositories/BankAccountRepository";
import { AccountingPeriodService } from "./AccountingPeriodService";
import { CalculationEngine } from "./CalculationEngine";
import { AuditRepository } from "../repositories/AuditRepository";
import { SessionUser } from "@/types/auth";
import { assertTenantAccess } from "../authorization/tenant";
import { requirePermission } from "../authorization/permissions";
import { NotFoundError, ValidationError, ConflictError } from "@/lib/errors";
import { CreateBankTransferInput } from "@/lib/validation/banking";
import { BankTransferStatus, Prisma } from "@prisma/client";

export class BankTransferService {
  static async list(
    user: SessionUser,
    options?: {
      status?: BankTransferStatus;
      bankAccountId?: string;
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

    return BankTransferRepository.listByOrg(user.activeOrganizationId, options);
  }

  static async getById(user: SessionUser, id: string) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "banking.read");

    const transfer = await BankTransferRepository.findByIdAndOrg(id, user.activeOrganizationId);
    if (!transfer) {
      throw new NotFoundError("Bank transfer not found");
    }
    return transfer;
  }

  static async executeTransfer(user: SessionUser, input: CreateBankTransferInput) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "banking.transfer");

    if (input.fromBankAccountId === input.toBankAccountId) {
      throw new ValidationError("Source and destination accounts must be different.");
    }

    const amount = CalculationEngine.roundMoney(input.amount);
    const feeAmount = CalculationEngine.roundMoney(input.feeAmount || 0);

    if (amount <= 0) {
      throw new ValidationError("Transfer amount must be greater than zero.");
    }
    if (feeAmount < 0) {
      throw new ValidationError("Fee amount cannot be negative.");
    }

    const [fromAccount, toAccount] = await Promise.all([
      BankAccountRepository.findByIdAndOrg(input.fromBankAccountId, user.activeOrganizationId),
      BankAccountRepository.findByIdAndOrg(input.toBankAccountId, user.activeOrganizationId),
    ]);

    if (!fromAccount) {
      throw new NotFoundError("Source bank account not found.");
    }
    if (!toAccount) {
      throw new NotFoundError("Destination bank account not found.");
    }
    if (!fromAccount.isActive) {
      throw new ValidationError(`Source account '${fromAccount.accountName}' is inactive.`);
    }
    if (!toAccount.isActive) {
      throw new ValidationError(`Destination account '${toAccount.accountName}' is inactive.`);
    }

    const transferDate = new Date(input.transferDate);
    const period = await AccountingPeriodService.assertOpenPeriod(
      user.activeOrganizationId,
      transferDate
    );

    const totalOutflow = CalculationEngine.roundMoney(amount + feeAmount);

    try {
      return await db.$transaction(async (tx) => {
      const isSamePayload = (existing: any) => {
        const matchesFrom = existing.fromBankAccountId === input.fromBankAccountId;
        const matchesTo = existing.toBankAccountId === input.toBankAccountId;
        const matchesAmount = Math.abs(Number(existing.amount) - amount) < 0.001;
        const matchesFee = Math.abs(Number(existing.feeAmount) - feeAmount) < 0.001;
        return matchesFrom && matchesTo && matchesAmount && matchesFee;
      };

      // 0. Idempotency Check: if idempotencyKey is supplied, check for existing transfer
      if (input.idempotencyKey) {
        const existingTransfer = await tx.bankTransfer.findUnique({
          where: {
            organizationId_idempotencyKey: {
              organizationId: user.activeOrganizationId!,
              idempotencyKey: input.idempotencyKey,
            },
          },
          include: {
            fromBankAccount: true,
            toBankAccount: true,
            journalEntry: true,
          },
        });
        if (existingTransfer) {
          if (isSamePayload(existingTransfer)) {
            return existingTransfer;
          }
          throw new ConflictError(
            `Idempotency key '${input.idempotencyKey}' was already used with a different transfer payload.`
          );
        }
      }

      // 1. Generate unique transfer number
      const transferNumber = await BankTransferRepository.findNextTransferNumber(
        user.activeOrganizationId!
      );

      // 2. Adjust operational balances
      await tx.bankAccount.update({
        where: { id: fromAccount.id },
        data: { currentBalance: { decrement: totalOutflow } },
      });

      await tx.bankAccount.update({
        where: { id: toAccount.id },
        data: { currentBalance: { increment: amount } },
      });

      // 3. Create BankTransfer record
      const transfer = await tx.bankTransfer.create({
        data: {
          organizationId: user.activeOrganizationId!,
          transferNumber,
          idempotencyKey: input.idempotencyKey || null,
          fromBankAccountId: fromAccount.id,
          toBankAccountId: toAccount.id,
          amount,
          feeAmount,
          transferDate,
          reference: input.reference || null,
          memo: input.memo || null,
          status: "COMPLETED",
          createdById: user.id,
        },
      });

      // 4. Create BankTransactions on source & destination accounts
      const fromTx = await tx.bankTransaction.create({
        data: {
          organizationId: user.activeOrganizationId!,
          bankAccountId: fromAccount.id,
          transactionDate: transferDate,
          description: `Transfer to ${toAccount.accountName}`,
          reference: input.reference || transferNumber,
          amount: -amount,
          transactionType: "TRANSFER_OUT",
          status: "MATCHED",
          source: "MANUAL",
          memo: input.memo || null,
          matchedTransferId: transfer.id,
          createdById: user.id,
        },
      });

      let feeTxId: string | null = null;
      if (feeAmount > 0) {
        const feeTx = await tx.bankTransaction.create({
          data: {
            organizationId: user.activeOrganizationId!,
            bankAccountId: fromAccount.id,
            transactionDate: transferDate,
            description: `Transfer Fee for ${transferNumber}`,
            reference: input.reference || transferNumber,
            amount: -feeAmount,
            transactionType: "FEE",
            status: "MATCHED",
            source: "MANUAL",
            memo: "Transfer processing fee",
            matchedTransferId: transfer.id,
            createdById: user.id,
          },
        });
        feeTxId = feeTx.id;
      }

      const toTx = await tx.bankTransaction.create({
        data: {
          organizationId: user.activeOrganizationId!,
          bankAccountId: toAccount.id,
          transactionDate: transferDate,
          description: `Transfer from ${fromAccount.accountName}`,
          reference: input.reference || transferNumber,
          amount: amount,
          transactionType: "TRANSFER_IN",
          status: "MATCHED",
          source: "MANUAL",
          memo: input.memo || null,
          matchedTransferId: transfer.id,
          createdById: user.id,
        },
      });

      // 5. If both accounts are linked to GL, auto-post atomic balanced journal
      let journalId: string | null = null;
      if (fromAccount.linkedLedgerAccountId && toAccount.linkedLedgerAccountId) {
        // Resolve Bank Fee Expense account if feeAmount > 0
        let feeExpenseAccountId: string | null = null;
        if (feeAmount > 0) {
          const defaultExpenseMapping = await tx.accountMapping.findFirst({
            where: {
              organizationId: user.activeOrganizationId!,
              mappingKey: "DEFAULT_EXPENSE",
            },
          });
          if (defaultExpenseMapping) {
            feeExpenseAccountId = defaultExpenseMapping.accountId;
          } else {
            const fallbackExpense = await tx.account.findFirst({
              where: {
                organizationId: user.activeOrganizationId!,
                accountType: "EXPENSE",
                isActive: true,
              },
            });
            if (fallbackExpense) {
              feeExpenseAccountId = fallbackExpense.id;
            } else {
              // Fallback to source account if no expense account found
              feeExpenseAccountId = fromAccount.linkedLedgerAccountId;
            }
          }
        }

        const count = await tx.journalEntry.count({
          where: { organizationId: user.activeOrganizationId! },
        });
        const journalNumber = `JE-TRF-${String(count + 1).padStart(5, "0")}`;

        const journalLines: Prisma.JournalEntryLineUncheckedCreateWithoutJournalEntryInput[] = [
          {
            accountId: toAccount.linkedLedgerAccountId,
            debit: amount,
            credit: 0,
            description: `Bank Transfer received from ${fromAccount.accountName}`,
          },
          {
            accountId: fromAccount.linkedLedgerAccountId,
            debit: 0,
            credit: totalOutflow,
            description: `Bank Transfer sent to ${toAccount.accountName}`,
          },
        ];

        if (feeAmount > 0 && feeExpenseAccountId) {
          journalLines.push({
            accountId: feeExpenseAccountId,
            debit: feeAmount,
            credit: 0,
            description: `Bank Transfer fee for ${transferNumber}`,
          });
        }

        const journal = await tx.journalEntry.create({
          data: {
            organizationId: user.activeOrganizationId!,
            journalNumber,
            entryDate: transferDate,
            postingDate: new Date(),
            referenceType: "BANK_TRANSFER",
            referenceId: transfer.id,
            description: `Bank Transfer ${transferNumber}: ${fromAccount.accountName} -> ${toAccount.accountName}`,
            source: "BANK_TRANSFER",
            status: "POSTED",
            accountingPeriodId: period.id,
            totalDebit: totalOutflow,
            totalCredit: totalOutflow,
            createdById: user.id,
            postedById: user.id,
            postedAt: new Date(),
            lines: {
              create: journalLines,
            },
          },
        });

        journalId = journal.id;

        // Link journal back to transactions
        await tx.bankTransaction.update({
          where: { id: fromTx.id },
          data: { matchedJournalEntryId: journal.id },
        });
        await tx.bankTransaction.update({
          where: { id: toTx.id },
          data: { matchedJournalEntryId: journal.id },
        });
      }

      // 6. Update BankTransfer with transaction and journal IDs
      const updatedTransfer = await tx.bankTransfer.update({
        where: { id: transfer.id },
        data: {
          fromTransactionId: fromTx.id,
          toTransactionId: toTx.id,
          journalEntryId: journalId,
        },
        include: {
          fromBankAccount: true,
          toBankAccount: true,
          journalEntry: true,
        },
      });

      await AuditRepository.create({
        organization: { connect: { id: user.activeOrganizationId! } },
        actor: { connect: { id: user.id } },
        action: "BANK_TRANSFER_EXECUTED",
        entityType: "BankTransfer",
        entityId: transfer.id,
        metadata: {
          transferNumber,
          fromAccountId: fromAccount.id,
          toAccountId: toAccount.id,
          amount,
          feeAmount,
          journalEntryId: journalId,
        },
      });

      return updatedTransfer;
    });
    } catch (err: any) {
      if (
        err.code === "P2002" ||
        err.message?.includes("Unique constraint failed") ||
        err.message?.includes("already exists")
      ) {
        if (input.idempotencyKey) {
          const existing = await BankTransferRepository.findByIdempotency(
            user.activeOrganizationId!,
            input.idempotencyKey
          );
          if (existing) {
            // Validate payload matches
            const matchesFrom = existing.fromBankAccountId === input.fromBankAccountId;
            const matchesTo = existing.toBankAccountId === input.toBankAccountId;
            const matchesAmount = Math.abs(Number(existing.amount) - amount) < 0.001;
            const matchesFee = Math.abs(Number(existing.feeAmount) - feeAmount) < 0.001;
            if (matchesFrom && matchesTo && matchesAmount && matchesFee) {
              return existing;
            }
            throw new ConflictError(
              `Idempotency key '${input.idempotencyKey}' was already used with a different transfer payload.`
            );
          }
        }
        throw new ConflictError("A transfer with this identity or number has already been processed.");
      }
      throw err;
    }
  }
}
