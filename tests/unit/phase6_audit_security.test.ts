import { describe, it, expect, vi, beforeEach } from "vitest";
import { BankAccountService } from "@/server/services/BankAccountService";
import { BankTransferService } from "@/server/services/BankTransferService";
import { BankTransactionService } from "@/server/services/BankTransactionService";
import { BankMatchingService } from "@/server/services/BankMatchingService";
import { BankReconciliationService } from "@/server/services/BankReconciliationService";
import { CSVBankFeedProvider } from "@/server/services/CSVBankFeedProvider";
import { SessionUser } from "@/types/auth";
import {
  NotFoundError,
  ValidationError,
  ConflictError,
  ForbiddenError,
} from "@/lib/errors";
import { db } from "@/db/client";

vi.mock("@/db/client", () => ({
  db: {
    $transaction: vi.fn((cb) => cb(db)),
    bankAccount: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    bankTransaction: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    bankTransfer: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    bankReconciliation: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    bankReconciliationItem: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
    },
    bankImportBatch: {
      create: vi.fn(),
    },
    account: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    accountMapping: {
      findFirst: vi.fn(),
    },
    journalEntry: {
      create: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    journalEntryLine: {
      findMany: vi.fn(),
    },
    customerPayment: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    vendorPayment: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

describe("Phase 6 — Banking Security, Isolation & Integrity Audit Suite", () => {
  const userOrgA: SessionUser = {
    id: "usr_acc_A",
    email: "accountant@org-a.com",
    name: "Accountant Org A",
    activeOrganizationId: "org_A",
    roleId: "role_accountant",
    roleName: "Accountant",
    permissions: [
      "banking.read",
      "banking.manage",
      "banking.import",
      "banking.match",
      "banking.reconcile",
      "banking.transfer",
    ],
  };

  const userOrgB: SessionUser = {
    id: "usr_acc_B",
    email: "accountant@org-b.com",
    name: "Accountant Org B",
    activeOrganizationId: "org_B",
    roleId: "role_accountant",
    roleName: "Accountant",
    permissions: [
      "banking.read",
      "banking.manage",
      "banking.import",
      "banking.match",
      "banking.reconcile",
      "banking.transfer",
    ],
  };

  const userNoPerms: SessionUser = {
    id: "usr_viewer_A",
    email: "viewer@org-a.com",
    name: "Viewer Org A",
    activeOrganizationId: "org_A",
    roleId: "role_viewer",
    roleName: "Viewer",
    permissions: ["banking.read"], // Missing manage, transfer, reconcile, match
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Cross-Tenant Ledger Account Linking Rejection
  it("Audit 1: Cross-Tenant Defense — Rejects linking bank account to another organization's ledger account", async () => {
    // Org A tries to link a ledger account that belongs to Org B
    (db.bankAccount.findFirst as any).mockResolvedValue(null); // No name duplicate
    (db.account.findFirst as any).mockResolvedValue(null); // Not found in Org A

    await expect(
      BankAccountService.create(userOrgA, {
        accountName: "Attacker Account",
        accountType: "CHECKING",
        linkedLedgerAccountId: "ledger_acc_org_B",
      })
    ).rejects.toThrow("Linked GL ledger account not found.");
  });

  // 2. Inactive Ledger Account Linking Rejection
  it("Audit 2: Account Integrity — Rejects linking bank account to an inactive ledger account", async () => {
    (db.bankAccount.findFirst as any).mockResolvedValue(null);
    (db.account.findFirst as any).mockResolvedValue({
      id: "ledger_inactive_1",
      organizationId: "org_A",
      accountType: "ASSET",
      isActive: false, // Inactive
    });

    await expect(
      BankAccountService.create(userOrgA, {
        accountName: "Inactive Link Account",
        accountType: "CHECKING",
        linkedLedgerAccountId: "ledger_inactive_1",
      })
    ).rejects.toThrow("Cannot link an inactive ledger account.");
  });

  // 3. Bank Account Deletion Restrictions
  it("Audit 3: Deletion Restrictions — Rejects deletion of bank account with existing transactions", async () => {
    (db.bankAccount.findFirst as any).mockResolvedValue({
      id: "bank_acc_with_tx",
      organizationId: "org_A",
      accountName: "Operating Checking",
    });
    (db.bankTransaction.count as any).mockResolvedValue(5); // Has 5 transactions
    (db.bankReconciliation.count as any).mockResolvedValue(0);
    (db.bankTransfer.count as any).mockResolvedValue(0);

    await expect(
      BankAccountService.delete(userOrgA, "bank_acc_with_tx")
    ).rejects.toThrow(
      "Cannot delete bank account with existing transactions, reconciliations, or transfers."
    );
  });

  // 4. Clean Bank Account Deletion Permitted
  it("Audit 4: Deletion Allowed — Successfully deletes pristine bank account with 0 transactions/reconciliations", async () => {
    (db.bankAccount.findFirst as any).mockResolvedValue({
      id: "bank_acc_empty",
      organizationId: "org_A",
      accountName: "Empty Petty Cash",
    });
    (db.bankTransaction.count as any).mockResolvedValue(0);
    (db.bankReconciliation.count as any).mockResolvedValue(0);
    (db.bankTransfer.count as any).mockResolvedValue(0);
    (db.bankAccount.delete as any).mockResolvedValue({ id: "bank_acc_empty" });

    const result = await BankAccountService.delete(userOrgA, "bank_acc_empty");
    expect(result.success).toBe(true);
    expect(db.bankAccount.delete).toHaveBeenCalledWith({
      where: { id: "bank_acc_empty" },
    });
  });

  // 5. Cross-Tenant Bank Account Access Matrix
  it("Audit 5: Cross-Tenant Isolation — Org A user cannot read, update, or delete Org B bank accounts", async () => {
    (db.bankAccount.findFirst as any).mockResolvedValue(null); // org_B account not in org_A

    await expect(BankAccountService.getById(userOrgA, "acc_org_B")).rejects.toThrow(
      NotFoundError
    );
    await expect(
      BankAccountService.update(userOrgA, "acc_org_B", { accountName: "Hacked Name" })
    ).rejects.toThrow(NotFoundError);
    await expect(BankAccountService.delete(userOrgA, "acc_org_B")).rejects.toThrow(
      NotFoundError
    );
  });

  // 6. Cross-Tenant Transfer Rejection
  it("Audit 6: Transfer Cross-Tenant Defense — Rejects transfer between accounts across different organizations", async () => {
    // fromAccount is in org A, toAccount is in org B (findFirst returns null for org A)
    (db.bankAccount.findFirst as any)
      .mockResolvedValueOnce({
        id: "acc_org_A",
        organizationId: "org_A",
        accountName: "Org A Bank",
        isActive: true,
      })
      .mockResolvedValueOnce(null); // toAccount not found in org A

    await expect(
      BankTransferService.executeTransfer(userOrgA, {
        fromBankAccountId: "acc_org_A",
        toBankAccountId: "acc_org_B",
        amount: 500,
        transferDate: "2026-09-25",
      })
    ).rejects.toThrow("Destination bank account not found.");
  });

  // 7. Transfer Leg Direct Voiding Rejection
  it("Audit 7: Transfer Leg Immutability — Prevents direct voiding of an inter-account transfer transaction", async () => {
    (db.bankTransaction.findFirst as any).mockResolvedValue({
      id: "tx_transfer_leg_1",
      organizationId: "org_A",
      matchedTransferId: "trf_12345", // Linked to a transfer!
      status: "MATCHED",
      amount: -1000,
    });

    await expect(
      BankTransactionService.voidTransaction(userOrgA, "tx_transfer_leg_1", "Unauthorized void")
    ).rejects.toThrow(
      "Cannot void an inter-account transfer leg directly. Void or cancel the bank transfer instead."
    );
  });

  // 8. Reconciled Transaction Lock
  it("Audit 8: Reconciliation Lock — Prevents unmatching or voiding a RECONCILED transaction", async () => {
    (db.bankTransaction.findFirst as any).mockResolvedValue({
      id: "tx_reconciled_1",
      organizationId: "org_A",
      status: "RECONCILED",
      amount: 250,
    });

    await expect(
      BankMatchingService.unmatchTransaction(userOrgA, "tx_reconciled_1")
    ).rejects.toThrow("Cannot unmatch a transaction that has already been reconciled.");

    await expect(
      BankTransactionService.voidTransaction(userOrgA, "tx_reconciled_1")
    ).rejects.toThrow("Cannot void a reconciled bank transaction.");
  });

  // 9. Reconciliation Overlapping Period Rejection
  it("Audit 9: Reconciliation Period Integrity — Rejects overlapping reconciliation periods", async () => {
    (db.bankAccount.findFirst as any).mockResolvedValue({
      id: "bank_acc_1",
      organizationId: "org_A",
      openingBalance: 1000,
    });
    (db.bankReconciliation.findFirst as any)
      .mockResolvedValueOnce(null) // 1. Check for open reconciliation → none found
      .mockResolvedValueOnce({
        // 2. Overlap check (status in [COMPLETED, OPEN]) → found overlap!
        id: "rec_overlapping",
        reconciliationNumber: "REC-2026-00001",
        statementStartDate: new Date("2026-01-01"),
        statementEndDate: new Date("2026-01-31"),
      });

    await expect(
      BankReconciliationService.startReconciliation(userOrgA, {
        bankAccountId: "bank_acc_1",
        statementStartDate: "2026-01-15",
        statementEndDate: "2026-02-15",
        statementEndingBalance: 2000,
      })
    ).rejects.toThrow("Reconciliation period overlaps with reconciliation");
  });

  // 10. CSV Formula Injection Defense
  it("Audit 10: CSV Security — Sanitizes formula injection prefixes (=, +, -, @)", () => {
    const rawMaliciousCsv = `Date,Description,Amount\n2026-09-25,"=cmd|' /C calc'!A0",150.00\n2026-09-25,"+HYPERLINK(""http://evil.com"")",-50.00\n2026-09-25,"@SUM(1,2)",25.00`;

    const parsed = CSVBankFeedProvider.parse("org_A", "bank_1", rawMaliciousCsv, {
      hasHeader: true,
      dateColumn: "Date",
      descriptionColumn: "Description",
      amountColumn: "Amount",
    });

    expect(parsed.validRows).toBe(3);
    // Malicious cells must be escaped with single quote
    expect(parsed.rows[0].description).toBe(`'=cmd|' /C calc'!A0`);
    expect(parsed.rows[1].description).toBe(`'+HYPERLINK("http://evil.com")`);
    expect(parsed.rows[2].description).toBe(`'@SUM(1,2)`);
  });

  // 11. CSV Max Rows Guard
  it("Audit 11: CSV Security — Rejects oversized CSV files exceeding 5,000 rows", () => {
    let hugeCsv = "Date,Description,Amount\n";
    for (let i = 0; i < 5001; i++) {
      hugeCsv += `2026-09-25,Test Row ${i},10.00\n`;
    }

    expect(() =>
      CSVBankFeedProvider.parse("org_A", "bank_1", hugeCsv, {
        hasHeader: true,
        dateColumn: "Date",
        descriptionColumn: "Description",
        amountColumn: "Amount",
      })
    ).toThrow("CSV file exceeds maximum limit of 5,000 rows per batch.");
  });

  // 12. Server-Side RBAC Enforcement
  it("Audit 12: Server-Side RBAC — Rejects unauthorized operations without correct permissions", async () => {
    // userNoPerms only has banking.read
    await expect(
      BankAccountService.create(userNoPerms, {
        accountName: "Unauthorized Account",
        accountType: "CHECKING",
      })
    ).rejects.toThrow(ForbiddenError);

    await expect(
      BankTransferService.executeTransfer(userNoPerms, {
        fromBankAccountId: "acc_1",
        toBankAccountId: "acc_2",
        amount: 100,
        transferDate: "2026-09-25",
      })
    ).rejects.toThrow(ForbiddenError);

    await expect(
      BankReconciliationService.startReconciliation(userNoPerms, {
        bankAccountId: "acc_1",
        statementStartDate: "2026-09-01",
        statementEndDate: "2026-09-30",
        statementEndingBalance: 500,
      })
    ).rejects.toThrow(ForbiddenError);

    await expect(
      BankMatchingService.matchTransaction(userNoPerms, {
        bankTransactionId: "tx_1",
        targetType: "CUSTOMER_PAYMENT",
        targetId: "pay_1",
      })
    ).rejects.toThrow(ForbiddenError);
  });
});
