import { db } from "@/db/client";
import { BankTransactionRepository } from "../repositories/BankTransactionRepository";
import { AuditRepository } from "../repositories/AuditRepository";
import { SessionUser } from "@/types/auth";
import { assertTenantAccess } from "../authorization/tenant";
import { requirePermission } from "../authorization/permissions";
import { NotFoundError, ValidationError, ConflictError } from "@/lib/errors";
import { MatchTransactionInput } from "@/lib/validation/banking";

export interface MatchCandidate {
  id: string;
  type: "CUSTOMER_PAYMENT" | "VENDOR_PAYMENT" | "JOURNAL_ENTRY" | "BANK_TRANSFER";
  referenceNumber: string;
  date: Date;
  amount: number;
  partyName?: string;
  description?: string;
  confidence: "EXACT" | "HIGH" | "MEDIUM";
  matchReason: string;
}

export class BankMatchingService {
  static async findCandidates(user: SessionUser, bankTransactionId: string): Promise<MatchCandidate[]> {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "banking.match");

    const transaction = await BankTransactionRepository.findByIdAndOrg(
      bankTransactionId,
      user.activeOrganizationId
    );
    if (!transaction) {
      throw new NotFoundError("Bank transaction not found");
    }

    const txAmount = Number(transaction.amount);
    const absAmount = Math.abs(txAmount);
    const txDate = new Date(transaction.transactionDate);
    const startDate = new Date(txDate);
    startDate.setDate(startDate.getDate() - 14);
    const endDate = new Date(txDate);
    endDate.setDate(endDate.getDate() + 14);

    const candidates: MatchCandidate[] = [];

    if (txAmount > 0) {
      // Inflow / Deposit -> Match against Customer Payments
      const customerPayments = await db.customerPayment.findMany({
        where: {
          organizationId: user.activeOrganizationId,
          amount: absAmount,
          paymentDate: { gte: startDate, lte: endDate },
          status: "COMPLETED",
        },
        include: { customer: true },
        take: 10,
      });

      for (const p of customerPayments) {
        const daysDiff = Math.abs(
          (new Date(p.paymentDate).getTime() - txDate.getTime()) / (1000 * 3600 * 24)
        );
        const refMatch =
          transaction.reference &&
          (p.paymentNumber.toLowerCase().includes(transaction.reference.toLowerCase()) ||
            (p.reference && transaction.reference.toLowerCase().includes(p.reference.toLowerCase())));

        let confidence: "EXACT" | "HIGH" | "MEDIUM" = "MEDIUM";
        let reason = `Amount matches $${absAmount.toFixed(2)} (${daysDiff.toFixed(0)} days diff)`;

        if (refMatch) {
          confidence = "EXACT";
          reason = `Exact amount and reference match: ${p.paymentNumber}`;
        } else if (daysDiff <= 3) {
          confidence = "HIGH";
          reason = `Amount matches within 3 days (${p.paymentDate.toISOString().split("T")[0]})`;
        }

        candidates.push({
          id: p.id,
          type: "CUSTOMER_PAYMENT",
          referenceNumber: p.paymentNumber,
          date: p.paymentDate,
          amount: Number(p.amount),
          partyName: p.customer.displayName,
          description: p.notes || `Customer payment from ${p.customer.displayName}`,
          confidence,
          matchReason: reason,
        });
      }
    } else {
      // Outflow / Withdrawal -> Match against Vendor Payments
      const vendorPayments = await db.vendorPayment.findMany({
        where: {
          organizationId: user.activeOrganizationId,
          amount: absAmount,
          paymentDate: { gte: startDate, lte: endDate },
          status: "COMPLETED",
        },
        include: { supplier: true },
        take: 10,
      });

      for (const p of vendorPayments) {
        const daysDiff = Math.abs(
          (new Date(p.paymentDate).getTime() - txDate.getTime()) / (1000 * 3600 * 24)
        );
        const refMatch =
          transaction.reference &&
          (p.paymentNumber.toLowerCase().includes(transaction.reference.toLowerCase()) ||
            (p.reference && transaction.reference.toLowerCase().includes(p.reference.toLowerCase())));

        let confidence: "EXACT" | "HIGH" | "MEDIUM" = "MEDIUM";
        let reason = `Amount matches $${absAmount.toFixed(2)} (${daysDiff.toFixed(0)} days diff)`;

        if (refMatch) {
          confidence = "EXACT";
          reason = `Exact amount and reference match: ${p.paymentNumber}`;
        } else if (daysDiff <= 3) {
          confidence = "HIGH";
          reason = `Amount matches within 3 days (${p.paymentDate.toISOString().split("T")[0]})`;
        }

        candidates.push({
          id: p.id,
          type: "VENDOR_PAYMENT",
          referenceNumber: p.paymentNumber,
          date: p.paymentDate,
          amount: Number(p.amount),
          partyName: p.supplier.displayName,
          description: p.notes || `Vendor payment to ${p.supplier.displayName}`,
          confidence,
          matchReason: reason,
        });
      }
    }

    // Match against existing posted GL journals linked to this bank's ledger account
    if (transaction.bankAccount.linkedLedgerAccountId) {
      const glLines = await db.journalEntryLine.findMany({
        where: {
          accountId: transaction.bankAccount.linkedLedgerAccountId,
          journalEntry: {
            organizationId: user.activeOrganizationId,
            status: "POSTED",
            entryDate: { gte: startDate, lte: endDate },
          },
          ...(txAmount > 0 ? { debit: absAmount } : { credit: absAmount }),
        },
        include: {
          journalEntry: true,
          customer: true,
          supplier: true,
        },
        take: 5,
      });

      for (const line of glLines) {
        candidates.push({
          id: line.journalEntry.id,
          type: "JOURNAL_ENTRY",
          referenceNumber: line.journalEntry.journalNumber,
          date: line.journalEntry.entryDate,
          amount: txAmount > 0 ? Number(line.debit) : Number(line.credit),
          partyName: line.customer?.displayName || line.supplier?.displayName,
          description: line.journalEntry.description,
          confidence: "HIGH",
          matchReason: `General ledger journal ${line.journalEntry.journalNumber} entry matches account and amount`,
        });
      }
    }

    // Sort candidates: EXACT first, then HIGH, then MEDIUM
    const order = { EXACT: 0, HIGH: 1, MEDIUM: 2 };
    return candidates.sort((a, b) => order[a.confidence] - order[b.confidence]);
  }

  static async matchTransaction(user: SessionUser, input: MatchTransactionInput) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "banking.match");

    const transaction = await BankTransactionRepository.findByIdAndOrg(
      input.bankTransactionId,
      user.activeOrganizationId
    );
    if (!transaction) {
      throw new NotFoundError("Bank transaction not found");
    }

    if (transaction.status === "RECONCILED") {
      throw new ValidationError("Cannot match a transaction that is already reconciled.");
    }
    if (transaction.status === "VOIDED") {
      throw new ValidationError("Cannot match a voided transaction.");
    }

    // Update match without duplicate GL entry creation
    const updateData: {
      status: "MATCHED";
      matchedCustomerPaymentId?: string | null;
      matchedVendorPaymentId?: string | null;
      matchedJournalEntryId?: string | null;
      matchedTransferId?: string | null;
    } = {
      status: "MATCHED",
    };

    if (input.targetType === "CUSTOMER_PAYMENT") {
      const payment = await db.customerPayment.findFirst({
        where: { id: input.targetId, organizationId: user.activeOrganizationId },
      });
      if (!payment) throw new NotFoundError("Customer payment not found");

      const existingMatch = await db.bankTransaction.findFirst({
        where: {
          organizationId: user.activeOrganizationId,
          matchedCustomerPaymentId: payment.id,
          id: { not: transaction.id },
          status: { not: "VOIDED" },
        },
      });
      if (existingMatch) {
        throw new ConflictError("This customer payment is already matched to another bank transaction.");
      }

      updateData.matchedCustomerPaymentId = payment.id;
    } else if (input.targetType === "VENDOR_PAYMENT") {
      const payment = await db.vendorPayment.findFirst({
        where: { id: input.targetId, organizationId: user.activeOrganizationId },
      });
      if (!payment) throw new NotFoundError("Vendor payment not found");

      const existingMatch = await db.bankTransaction.findFirst({
        where: {
          organizationId: user.activeOrganizationId,
          matchedVendorPaymentId: payment.id,
          id: { not: transaction.id },
          status: { not: "VOIDED" },
        },
      });
      if (existingMatch) {
        throw new ConflictError("This vendor payment is already matched to another bank transaction.");
      }

      updateData.matchedVendorPaymentId = payment.id;
    } else if (input.targetType === "JOURNAL_ENTRY") {
      const journal = await db.journalEntry.findFirst({
        where: { id: input.targetId, organizationId: user.activeOrganizationId },
      });
      if (!journal) throw new NotFoundError("Journal entry not found");

      const existingMatch = await db.bankTransaction.findFirst({
        where: {
          organizationId: user.activeOrganizationId,
          matchedJournalEntryId: journal.id,
          id: { not: transaction.id },
          status: { not: "VOIDED" },
        },
      });
      if (existingMatch) {
        throw new ConflictError("This journal entry is already matched to another bank transaction.");
      }

      updateData.matchedJournalEntryId = journal.id;
    } else if (input.targetType === "BANK_TRANSFER") {
      const transfer = await db.bankTransfer.findFirst({
        where: { id: input.targetId, organizationId: user.activeOrganizationId },
      });
      if (!transfer) throw new NotFoundError("Bank transfer not found");
      updateData.matchedTransferId = transfer.id;
    }

    const updatedCount = await db.bankTransaction.updateMany({
      where: {
        id: transaction.id,
        status: { notIn: ["RECONCILED", "VOIDED"] },
      },
      data: updateData,
    });
    if (updatedCount.count === 0) {
      throw new ValidationError("Bank transaction is already reconciled or voided.");
    }

    const updated = await db.bankTransaction.findUnique({
      where: { id: transaction.id },
      include: {
        matchedCustomerPayment: true,
        matchedVendorPayment: true,
        matchedJournalEntry: true,
      },
    });

    await AuditRepository.create({
      organization: { connect: { id: user.activeOrganizationId } },
      actor: { connect: { id: user.id } },
      action: "BANK_TRANSACTION_MATCHED",
      entityType: "BankTransaction",
      entityId: transaction.id,
      metadata: {
        targetType: input.targetType,
        targetId: input.targetId,
      },
    });

    return updated;
  }

  static async unmatchTransaction(user: SessionUser, bankTransactionId: string) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "banking.match");

    const transaction = await BankTransactionRepository.findByIdAndOrg(
      bankTransactionId,
      user.activeOrganizationId
    );
    if (!transaction) {
      throw new NotFoundError("Bank transaction not found");
    }

    if (transaction.status === "RECONCILED") {
      throw new ValidationError("Cannot unmatch a transaction that has already been reconciled.");
    }

    const updated = await db.bankTransaction.update({
      where: { id: transaction.id },
      data: {
        status: "UNMATCHED",
        matchedCustomerPaymentId: null,
        matchedVendorPaymentId: null,
        matchedJournalEntryId: null,
        matchedTransferId: null,
      },
    });

    await AuditRepository.create({
      organization: { connect: { id: user.activeOrganizationId } },
      actor: { connect: { id: user.id } },
      action: "BANK_TRANSACTION_UNMATCHED",
      entityType: "BankTransaction",
      entityId: transaction.id,
      metadata: {},
    });

    return updated;
  }
}
