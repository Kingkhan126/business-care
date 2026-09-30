import { db } from "@/db/client";
import { CSVBankFeedProvider, ParsedStatementResult } from "./CSVBankFeedProvider";
import { BankAccountRepository } from "../repositories/BankAccountRepository";
import { BankTransactionRepository } from "../repositories/BankTransactionRepository";
import { CalculationEngine } from "./CalculationEngine";
import { AuditRepository } from "../repositories/AuditRepository";
import { SessionUser } from "@/types/auth";
import { assertTenantAccess } from "../authorization/tenant";
import { requirePermission } from "../authorization/permissions";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { BankImportPreviewInput, BankImportCommitInput } from "@/lib/validation/banking";

export class BankImportService {
  static async preview(user: SessionUser, input: BankImportPreviewInput) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "banking.import");

    const account = await BankAccountRepository.findByIdAndOrg(
      input.bankAccountId,
      user.activeOrganizationId
    );
    if (!account) {
      throw new NotFoundError("Bank account not found.");
    }

    const parsed: ParsedStatementResult = CSVBankFeedProvider.parse(
      user.activeOrganizationId,
      account.id,
      input.csvContent,
      input.mapping
    );

    // Identify duplicates by fingerprint
    const allFingerprints = parsed.rows.map((r) => r.fingerprint);
    const existingFingerprints = await BankTransactionRepository.findExistingFingerprints(
      user.activeOrganizationId,
      allFingerprints
    );

    let duplicateCount = 0;
    const enrichedRows = parsed.rows.map((row) => {
      const isDuplicate = existingFingerprints.has(row.fingerprint);
      if (isDuplicate) duplicateCount++;
      return {
        ...row,
        isDuplicate,
      };
    });

    const newRowsCount = enrichedRows.length - duplicateCount;

    return {
      ...parsed,
      rows: enrichedRows,
      duplicateCount,
      newRowsCount,
      accountName: account.accountName,
      currency: account.currency,
    };
  }

  static async commit(user: SessionUser, input: BankImportCommitInput) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "banking.import");

    const account = await BankAccountRepository.findByIdAndOrg(
      input.bankAccountId,
      user.activeOrganizationId
    );
    if (!account) {
      throw new NotFoundError("Bank account not found.");
    }

    const parsed = CSVBankFeedProvider.parse(
      user.activeOrganizationId,
      account.id,
      input.csvContent,
      input.mapping
    );

    if (parsed.validRows === 0) {
      throw new ValidationError("No valid transactions found in statement file.");
    }

    // Filter duplicates
    const allFingerprints = parsed.rows.map((r) => r.fingerprint);
    const existingFingerprints = await BankTransactionRepository.findExistingFingerprints(
      user.activeOrganizationId,
      allFingerprints
    );

    const nonDuplicateRows = parsed.rows.filter((r) => !existingFingerprints.has(r.fingerprint));
    const duplicateCount = parsed.rows.length - nonDuplicateRows.length;

    return db.$transaction(async (tx) => {
      // Re-check existing fingerprints inside tx under transaction boundary
      const existingInDb = await tx.bankTransaction.findMany({
        where: {
          organizationId: user.activeOrganizationId!,
          fingerprint: { in: allFingerprints },
        },
        select: { fingerprint: true },
      });
      const existingDbSet = new Set(existingInDb.map((f) => f.fingerprint!));
      const toImport = parsed.rows.filter((r) => !existingDbSet.has(r.fingerprint));
      const actualDuplicates = parsed.rows.length - toImport.length;

      // 1. Create BankImportBatch
      const batch = await tx.bankImportBatch.create({
        data: {
          organizationId: user.activeOrganizationId!,
          bankAccountId: account.id,
          fileName: input.fileName,
          fileFormat: "CSV",
          totalRecords: parsed.rows.length,
          importedRecords: toImport.length,
          skippedDuplicates: actualDuplicates,
          status: "COMPLETED",
          importedById: user.id,
        },
      });

      // 2. Insert transactions
      let netImportedAmount = 0;
      let importedCount = 0;
      let finalDuplicates = actualDuplicates;

      if (toImport.length > 0) {
        for (const row of toImport) {
          try {
            await tx.bankTransaction.create({
              data: {
                organizationId: user.activeOrganizationId!,
                bankAccountId: account.id,
                transactionDate: row.transactionDate,
                description: row.description,
                reference: row.reference || null,
                amount: row.amount,
                transactionType: row.amount > 0 ? "DEPOSIT" : "WITHDRAWAL",
                status: "UNMATCHED",
                source: "IMPORT",
                payee: row.payee || null,
                fingerprint: row.fingerprint,
                importBatchId: batch.id,
                createdById: user.id,
              },
            });
            netImportedAmount = CalculationEngine.roundMoney(netImportedAmount + row.amount);
            importedCount++;
          } catch (err: any) {
            if (
              err.code === "P2002" ||
              err.message?.includes("Unique constraint failed") ||
              err.message?.includes("fingerprint")
            ) {
              finalDuplicates++;
              continue;
            }
            throw err;
          }
        }

        // 3. Update account operational balance
        if (netImportedAmount !== 0) {
          await tx.bankAccount.update({
            where: { id: account.id },
            data: {
              currentBalance: { increment: netImportedAmount },
            },
          });
        }

        // 4. Update batch record with final reconciled counts
        if (importedCount !== toImport.length) {
          await tx.bankImportBatch.update({
            where: { id: batch.id },
            data: {
              importedRecords: importedCount,
              skippedDuplicates: finalDuplicates,
            },
          });
        }
      }

      await AuditRepository.create({
        organization: { connect: { id: user.activeOrganizationId! } },
        actor: { connect: { id: user.id } },
        action: "BANK_STATEMENT_IMPORTED",
        entityType: "BankImportBatch",
        entityId: batch.id,
        metadata: {
          fileName: input.fileName,
          totalRows: parsed.rows.length,
          importedCount,
          duplicateCount: finalDuplicates,
          netAmount: netImportedAmount,
        },
      });

      return {
        batchId: batch.id,
        fileName: batch.fileName,
        totalRecords: batch.totalRecords,
        importedRecords: importedCount,
        skippedDuplicates: finalDuplicates,
        netImportedAmount,
      };
    });
  }
}
