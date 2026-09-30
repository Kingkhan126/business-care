import { db } from "@/db/client";
import { BankAccountRepository } from "../repositories/BankAccountRepository";
import { AccountingPeriodService } from "./AccountingPeriodService";
import { CalculationEngine } from "./CalculationEngine";
import { AuditRepository } from "../repositories/AuditRepository";
import { SessionUser } from "@/types/auth";
import { assertTenantAccess } from "../authorization/tenant";
import { requirePermission } from "../authorization/permissions";
import { NotFoundError, ValidationError, ConflictError } from "@/lib/errors";
import { CreateBankAccountInput, UpdateBankAccountInput } from "@/lib/validation/banking";
import { BankAccountType, Prisma } from "@prisma/client";

export class BankAccountService {
  static async list(
    user: SessionUser,
    options?: {
      accountType?: BankAccountType;
      isActive?: boolean;
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

    return BankAccountRepository.listByOrg(user.activeOrganizationId, options);
  }

  static async getById(user: SessionUser, id: string) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "banking.read");

    const account = await BankAccountRepository.findByIdAndOrg(id, user.activeOrganizationId);
    if (!account) {
      throw new NotFoundError("Bank account not found");
    }

    // Compute live GL Ledger Balance for the linked account, if any
    let ledgerBalance = 0;
    if (account.linkedLedgerAccountId) {
      const glLines = await db.journalEntryLine.findMany({
        where: {
          accountId: account.linkedLedgerAccountId,
          journalEntry: {
            organizationId: user.activeOrganizationId,
            status: "POSTED",
          },
        },
        select: { debit: true, credit: true },
      });

      for (const line of glLines) {
        ledgerBalance = CalculationEngine.roundMoney(
          ledgerBalance + Number(line.debit) - Number(line.credit)
        );
      }
    }

    return {
      ...account,
      ledgerBalance,
      variance: CalculationEngine.roundMoney(Number(account.currentBalance) - ledgerBalance),
    };
  }

  static async create(user: SessionUser, input: CreateBankAccountInput) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "banking.manage");

    // Check duplicate account name
    const existing = await BankAccountRepository.findByNameAndOrg(
      input.accountName,
      user.activeOrganizationId
    );
    if (existing) {
      throw new ConflictError(`A bank or cash account named '${input.accountName}' already exists.`);
    }

    // Validate linked ledger account if provided
    if (input.linkedLedgerAccountId) {
      const glAccount = await db.account.findFirst({
        where: {
          id: input.linkedLedgerAccountId,
          organizationId: user.activeOrganizationId,
        },
      });
      if (!glAccount) {
        throw new NotFoundError("Linked GL ledger account not found.");
      }
      if (!glAccount.isActive) {
        throw new ValidationError("Cannot link an inactive ledger account.");
      }
      if (glAccount.accountType !== "ASSET" && glAccount.accountType !== "LIABILITY") {
        throw new ValidationError("Bank account must link to an Asset or Liability (Credit Card) ledger account.");
      }
    }

    const openingBalance = CalculationEngine.roundMoney(input.openingBalance || 0);
    const openingBalanceDate = input.openingBalanceDate
      ? new Date(input.openingBalanceDate)
      : new Date();

    try {
      return await db.$transaction(async (tx) => {
        // 1. Create BankAccount
        const bankAccount = await tx.bankAccount.create({
          data: {
            organizationId: user.activeOrganizationId!,
            accountName: input.accountName,
            accountType: input.accountType || "CHECKING",
            accountNumberMasked: input.accountNumberMasked || null,
            routingNumber: input.routingNumber || null,
            institutionName: input.institutionName || null,
            currency: input.currency || "USD",
            openingBalance,
            openingBalanceDate,
            currentBalance: openingBalance,
            linkedLedgerAccountId: input.linkedLedgerAccountId || null,
            description: input.description || null,
          },
          include: {
            linkedLedgerAccount: true,
          },
        });

        // 2. If opening balance !== 0, create opening BankTransaction
        if (openingBalance !== 0) {
          await tx.bankTransaction.create({
            data: {
              organizationId: user.activeOrganizationId!,
              bankAccountId: bankAccount.id,
              transactionDate: openingBalanceDate,
              description: "Opening Balance",
              amount: openingBalance,
              transactionType: openingBalance > 0 ? "DEPOSIT" : "WITHDRAWAL",
              status: "UNMATCHED",
              source: "MANUAL",
              memo: "Initial account balance upon setup",
              createdById: user.id,
            },
          });

          // 3. If createOpeningBalanceJournal is requested and ledger account is linked
          if (input.createOpeningBalanceJournal && input.linkedLedgerAccountId) {
            const period = await AccountingPeriodService.assertOpenPeriod(
              user.activeOrganizationId!,
              openingBalanceDate
            );

            // Find Equity account (OWNER_EQUITY mapping or account code starting with 3000/3100)
            let equityAccountId: string | null = null;
            const mapping = await tx.accountMapping.findFirst({
              where: {
                organizationId: user.activeOrganizationId!,
                mappingKey: "OWNER_EQUITY",
              },
            });
            if (mapping) {
              equityAccountId = mapping.accountId;
            } else {
              const fallbackEquity = await tx.account.findFirst({
                where: {
                  organizationId: user.activeOrganizationId!,
                  accountType: "EQUITY",
                  isActive: true,
                },
              });
              if (fallbackEquity) {
                equityAccountId = fallbackEquity.id;
              }
            }

            if (equityAccountId) {
              const count = await tx.journalEntry.count({
                where: { organizationId: user.activeOrganizationId! },
              });
              const journalNumber = `JE-OPN-${String(count + 1).padStart(5, "0")}`;
              const absAmount = Math.abs(openingBalance);

              await tx.journalEntry.create({
                data: {
                  organizationId: user.activeOrganizationId!,
                  journalNumber,
                  entryDate: openingBalanceDate,
                  postingDate: new Date(),
                  referenceType: "BANK_OPENING_BALANCE",
                  referenceId: bankAccount.id,
                  description: `Opening balance for ${bankAccount.accountName}`,
                  source: "SYSTEM",
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
                        accountId: input.linkedLedgerAccountId,
                        debit: openingBalance > 0 ? absAmount : 0,
                        credit: openingBalance < 0 ? absAmount : 0,
                        description: `Opening Balance - ${bankAccount.accountName}`,
                      },
                      {
                        accountId: equityAccountId,
                        debit: openingBalance < 0 ? absAmount : 0,
                        credit: openingBalance > 0 ? absAmount : 0,
                        description: `Opening Balance Offset - ${bankAccount.accountName}`,
                      },
                    ],
                  },
                },
              });
            }
          }
        }

        await AuditRepository.create({
          organization: { connect: { id: user.activeOrganizationId! } },
          actor: { connect: { id: user.id } },
          action: "BANK_ACCOUNT_CREATED",
          entityType: "BankAccount",
          entityId: bankAccount.id,
          metadata: {
            accountName: bankAccount.accountName,
            accountType: bankAccount.accountType,
            openingBalance,
            linkedLedgerAccountId: bankAccount.linkedLedgerAccountId,
          },
        });

        return bankAccount;
      });
    } catch (err: any) {
      if (
        err.code === "P2002" ||
        err.message?.includes("Unique constraint failed") ||
        err.message?.includes("already exists")
      ) {
        throw new ConflictError(`A bank or cash account named '${input.accountName}' already exists.`);
      }
      throw err;
    }
  }

  static async update(user: SessionUser, id: string, input: UpdateBankAccountInput) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "banking.manage");

    const account = await BankAccountRepository.findByIdAndOrg(id, user.activeOrganizationId);
    if (!account) {
      throw new NotFoundError("Bank account not found");
    }

    if (input.accountName && input.accountName !== account.accountName) {
      const existing = await BankAccountRepository.findByNameAndOrg(
        input.accountName,
        user.activeOrganizationId
      );
      if (existing && existing.id !== id) {
        throw new ConflictError(`Account name '${input.accountName}' is already taken.`);
      }
    }

    if (input.linkedLedgerAccountId) {
      const glAccount = await db.account.findFirst({
        where: {
          id: input.linkedLedgerAccountId,
          organizationId: user.activeOrganizationId,
        },
      });
      if (!glAccount) {
        throw new NotFoundError("Linked GL ledger account not found.");
      }
      if (!glAccount.isActive) {
        throw new ValidationError("Cannot link an inactive ledger account.");
      }
      if (glAccount.accountType !== "ASSET" && glAccount.accountType !== "LIABILITY") {
        throw new ValidationError("Bank account must link to an Asset or Liability (Credit Card) ledger account.");
      }
    }

    const updated = await BankAccountRepository.update(id, user.activeOrganizationId, {
      accountName: input.accountName,
      accountType: input.accountType,
      accountNumberMasked: input.accountNumberMasked,
      routingNumber: input.routingNumber,
      institutionName: input.institutionName,
      linkedLedgerAccountId: input.linkedLedgerAccountId,
      description: input.description,
      isActive: input.isActive,
    });

    await AuditRepository.create({
      organization: { connect: { id: user.activeOrganizationId } },
      actor: { connect: { id: user.id } },
      action: "BANK_ACCOUNT_UPDATED",
      entityType: "BankAccount",
      entityId: id,
      metadata: input as any,
    });

    return updated;
  }

  static async getCashPosition(user: SessionUser) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "banking.read");

    const accounts = await db.bankAccount.findMany({
      where: {
        organizationId: user.activeOrganizationId,
        isActive: true,
      },
      include: {
        linkedLedgerAccount: true,
      },
    });

    let totalBank = 0;
    let totalCash = 0;
    let totalCreditCard = 0;

    for (const acc of accounts) {
      const bal = Number(acc.currentBalance);
      if (acc.accountType === "CASH") {
        totalCash = CalculationEngine.roundMoney(totalCash + bal);
      } else if (acc.accountType === "CREDIT_CARD") {
        totalCreditCard = CalculationEngine.roundMoney(totalCreditCard + bal);
      } else {
        totalBank = CalculationEngine.roundMoney(totalBank + bal);
      }
    }

    const netLiquidity = CalculationEngine.roundMoney(totalBank + totalCash - totalCreditCard);

    // Unmatched and active reconciliations counters
    const [unmatchedCount, openReconciliationsCount] = await Promise.all([
      db.bankTransaction.count({
        where: {
          organizationId: user.activeOrganizationId,
          status: "UNMATCHED",
        },
      }),
      db.bankReconciliation.count({
        where: {
          organizationId: user.activeOrganizationId,
          status: "OPEN",
        },
      }),
    ]);

    return {
      totalBank,
      totalCash,
      totalCreditCard,
      netLiquidity,
      totalAccounts: accounts.length,
      unmatchedTransactionsCount: unmatchedCount,
      openReconciliationsCount,
      accounts: accounts.map((a) => ({
        id: a.id,
        accountName: a.accountName,
        accountType: a.accountType,
        institutionName: a.institutionName,
        currency: a.currency,
        currentBalance: Number(a.currentBalance),
        linkedLedgerAccountName: a.linkedLedgerAccount?.accountName || null,
      })),
    };
  }

  static async delete(user: SessionUser, id: string) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "banking.manage");

    const account = await BankAccountRepository.findByIdAndOrg(id, user.activeOrganizationId);
    if (!account) {
      throw new NotFoundError("Bank account not found");
    }

    // Verify deletion restrictions: cannot delete if transactions, reconciliations, or transfers exist
    const [txCount, recCount, transferFromCount, transferToCount] = await Promise.all([
      db.bankTransaction.count({ where: { bankAccountId: id, organizationId: user.activeOrganizationId } }),
      db.bankReconciliation.count({ where: { bankAccountId: id, organizationId: user.activeOrganizationId } }),
      db.bankTransfer.count({ where: { fromBankAccountId: id, organizationId: user.activeOrganizationId } }),
      db.bankTransfer.count({ where: { toBankAccountId: id, organizationId: user.activeOrganizationId } }),
    ]);

    if (txCount > 0 || recCount > 0 || transferFromCount > 0 || transferToCount > 0) {
      throw new ValidationError(
        "Cannot delete bank account with existing transactions, reconciliations, or transfers. Please deactivate the account instead."
      );
    }

    await db.bankAccount.delete({
      where: { id },
    });

    await AuditRepository.create({
      organization: { connect: { id: user.activeOrganizationId } },
      actor: { connect: { id: user.id } },
      action: "BANK_ACCOUNT_DELETED",
      entityType: "BankAccount",
      entityId: id,
      metadata: { accountName: account.accountName },
    });

    return { success: true };
  }

  static async recalculateBalance(user: SessionUser, id: string) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "banking.manage");

    const account = await BankAccountRepository.findByIdAndOrg(id, user.activeOrganizationId);
    if (!account) {
      throw new NotFoundError("Bank account not found");
    }

    return db.$transaction(async (tx) => {
      const txs = await tx.bankTransaction.findMany({
        where: {
          bankAccountId: id,
          organizationId: user.activeOrganizationId!,
          status: { not: "VOIDED" },
        },
        select: { amount: true },
      });

      let calculated = Number(account.openingBalance);
      for (const t of txs) {
        calculated = CalculationEngine.roundMoney(calculated + Number(t.amount));
      }

      const updated = await tx.bankAccount.update({
        where: { id },
        data: { currentBalance: calculated },
      });

      await AuditRepository.create({
        organization: { connect: { id: user.activeOrganizationId! } },
        actor: { connect: { id: user.id } },
        action: "BANK_ACCOUNT_BALANCE_RECALCULATED",
        entityType: "BankAccount",
        entityId: id,
        metadata: {
          previousBalance: Number(account.currentBalance),
          recalculatedBalance: calculated,
          transactionCount: txs.length,
        },
      });

      return updated;
    });
  }
}
