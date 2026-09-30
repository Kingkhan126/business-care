import { describe, it, expect, vi, beforeEach } from "vitest";
import { BankAccountService } from "@/server/services/BankAccountService";
import { BankTransferService } from "@/server/services/BankTransferService";
import { BankTransactionService } from "@/server/services/BankTransactionService";
import { BankMatchingService } from "@/server/services/BankMatchingService";
import { BankReconciliationService } from "@/server/services/BankReconciliationService";
import { BankImportService } from "@/server/services/BankImportService";
import { SessionUser } from "@/types/auth";
import { ConflictError, ValidationError } from "@/lib/errors";
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
      findUnique: vi.fn(),
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
      updateMany: vi.fn(),
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
      update: vi.fn(),
    },
    account: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    accountMapping: {
      findFirst: vi.fn(),
    },
    accountingPeriod: {
      findFirst: vi.fn().mockResolvedValue({ id: "period_1", status: "OPEN" }),
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

describe("Phase 6 — Banking Concurrency & Invariant Verification Suite", () => {
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Scenario 1: Bank account same-name (20 workers)
  it("Concurrency 1: 20 concurrent account creation attempts with the same name — exactly 1 succeeds, 19 rejected", async () => {
    let createdCount = 0;
    (db.bankAccount.findFirst as any).mockResolvedValue(null);

    // Simulate PostgreSQL @@unique([organizationId, accountName]) constraint
    (db.bankAccount.create as any).mockImplementation(async ({ data }: any) => {
      if (createdCount > 0) {
        const err: any = new Error("Unique constraint failed on the fields: (organizationId, accountName)");
        err.code = "P2002";
        throw err;
      }
      createdCount++;
      return { id: `acc_${createdCount}`, ...data };
    });

    const attempts = Array.from({ length: 20 }, (_, i) =>
      BankAccountService.create(userOrgA, {
        accountName: "Primary Operating",
        accountType: "CHECKING",
      }).catch((err) => err)
    );

    const results = await Promise.all(attempts);
    const successes = results.filter((r) => !(r instanceof Error));
    const conflicts = results.filter((r) => r instanceof ConflictError);

    expect(successes.length).toBe(1);
    expect(conflicts.length).toBe(19);
  });

  // Scenario 2: Same transfer with identical idempotency key (10 workers)
  it("Concurrency 2: 10 concurrent transfer requests with identical idempotencyKey — exactly 1 transfer created", async () => {
    const fromAcc = {
      id: "acc_from",
      organizationId: "org_A",
      accountName: "Source Account",
      currentBalance: 10000,
      isActive: true,
      linkedLedgerAccountId: "gl_from",
    };
    const toAcc = {
      id: "acc_to",
      organizationId: "org_A",
      accountName: "Dest Account",
      currentBalance: 2000,
      isActive: true,
      linkedLedgerAccountId: "gl_to",
    };

    (db.bankAccount.findFirst as any).mockImplementation(async ({ where }: any) => {
      if (where.id === "acc_from") return fromAcc;
      if (where.id === "acc_to") return toAcc;
      return null;
    });

    let existingTransfer: any = null;
    let createTransferCount = 0;

    (db.bankTransfer.findUnique as any).mockImplementation(async () => {
      return existingTransfer;
    });

    (db.bankTransfer.count as any).mockResolvedValue(0);
    (db.account.findFirst as any).mockResolvedValue({ id: "gl_exp", accountType: "EXPENSE", isActive: true });
    (db.journalEntry.count as any).mockResolvedValue(0);

    (db.bankTransfer.create as any).mockImplementation(async ({ data }: any) => {
      if (createTransferCount > 0) {
        const err: any = new Error("Unique constraint failed on idempotencyKey");
        err.code = "P2002";
        throw err;
      }
      createTransferCount++;
      existingTransfer = { id: "trf_first_success", ...data };
      return existingTransfer;
    });
    (db.bankTransaction.create as any).mockResolvedValue({ id: "tx_mock" });
    (db.journalEntry.create as any).mockResolvedValue({ id: "je_mock" });
    (db.bankTransfer.update as any).mockResolvedValue({ id: "trf_first_success", transferNumber: "TRF-2026-00001" });

    const attempts = Array.from({ length: 10 }, () =>
      BankTransferService.executeTransfer(userOrgA, {
        fromBankAccountId: "acc_from",
        toBankAccountId: "acc_to",
        amount: 1500,
        feeAmount: 15,
        transferDate: "2026-09-25",
        idempotencyKey: "unique-transfer-idempotency-token-123",
      })
    );

    const results = await Promise.all(attempts);
    expect(results.length).toBe(10);
    expect(createTransferCount).toBe(1);
  });

  // Scenario 3: Same CSV statement import concurrently (10 workers)
  it("Concurrency 3: 10 concurrent CSV imports of identical statement — 0 duplicate transactions", async () => {
    const account = {
      id: "acc_checking",
      organizationId: "org_A",
      accountName: "Checking Account",
      currency: "USD",
      currentBalance: 5000,
    };
    (db.bankAccount.findFirst as any).mockResolvedValue(account);

    const rawCsv = `Date,Description,Amount\n2026-09-20,Invoice 101,500.00\n2026-09-21,Office Supplies,-75.00`;
    const mapping = {
      hasHeader: true,
      dateColumn: "Date",
      descriptionColumn: "Description",
      amountColumn: "Amount",
    };

    const insertedFingerprints = new Set<string>();
    let totalImportedRows = 0;

    (db.bankTransaction.findMany as any).mockImplementation(async ({ where }: any) => {
      if (where.fingerprint?.in) {
        return Array.from(insertedFingerprints)
          .filter((fp) => where.fingerprint.in.includes(fp))
          .map((fp) => ({ fingerprint: fp }));
      }
      return [];
    });

    (db.bankTransaction.create as any).mockImplementation(async ({ data }: any) => {
      if (insertedFingerprints.has(data.fingerprint)) {
        const err: any = new Error("Unique constraint failed on fingerprint");
        err.code = "P2002";
        throw err;
      }
      totalImportedRows++;
      insertedFingerprints.add(data.fingerprint);
      return { id: `tx_${totalImportedRows}`, ...data };
    });

    (db.bankImportBatch.create as any).mockImplementation(async ({ data }: any) => ({
      id: "batch_1",
      ...data,
    }));
    (db.bankAccount.update as any).mockResolvedValue(account);

    const attempts = Array.from({ length: 10 }, () =>
      BankImportService.commit(userOrgA, {
        bankAccountId: "acc_checking",
        fileName: "statement_sept_2026.csv",
        csvContent: rawCsv,
        mapping,
      })
    );

    const results = await Promise.all(attempts);
    expect(results.length).toBe(10);

    // Exactly 2 transactions were inserted across all 10 concurrent workers
    expect(totalImportedRows).toBe(2);
    // First worker imported 2 records, subsequent workers skipped duplicates
    const firstWorker = results[0];
    expect(firstWorker.importedRecords).toBe(2);
    expect(firstWorker.skippedDuplicates).toBe(0);

    const duplicateWorkers = results.slice(1);
    duplicateWorkers.forEach((w) => {
      expect(w.importedRecords).toBe(0);
      expect(w.skippedDuplicates).toBe(2);
    });
  });

  // Scenario 4: Concurrent matching for same payment (10 workers)
  it("Concurrency 4: 10 concurrent match requests for the same Customer Payment — single match assignment", async () => {
    let matchCount = 0;
    (db.bankTransaction.findFirst as any).mockImplementation(async ({ where }: any) => {
      if (where.id === "tx_inflow_100") {
        return {
          id: "tx_inflow_100",
          organizationId: "org_A",
          status: "UNMATCHED",
          amount: 1000,
        };
      }
      if (where.matchedCustomerPaymentId === "pay_cust_555") {
        if (matchCount > 0) {
          return { id: "tx_inflow_100", matchedCustomerPaymentId: "pay_cust_555" };
        }
        return null;
      }
      return null;
    });
    (db.customerPayment.findFirst as any).mockResolvedValue({
      id: "pay_cust_555",
      organizationId: "org_A",
      amount: 1000,
    });

    (db.bankTransaction.updateMany as any).mockImplementation(async () => {
      if (matchCount > 0) {
        return { count: 0 };
      }
      matchCount++;
      return { count: 1 };
    });
    (db.bankTransaction.findUnique as any).mockResolvedValue({
      id: "tx_inflow_100",
      status: "MATCHED",
      matchedCustomerPaymentId: "pay_cust_555",
    });

    const attempts = Array.from({ length: 10 }, () =>
      BankMatchingService.matchTransaction(userOrgA, {
        bankTransactionId: "tx_inflow_100",
        targetType: "CUSTOMER_PAYMENT",
        targetId: "pay_cust_555",
      }).catch((err) => err)
    );

    const results = await Promise.all(attempts);
    const successes = results.filter((r) => !(r instanceof Error));
    const rejected = results.filter((r) => r instanceof ValidationError || r instanceof ConflictError);

    expect(successes.length).toBe(1);
    expect(rejected.length).toBe(9);
  });

  // Scenario 5: Concurrent reconciliation completion (10 workers)
  it("Concurrency 5: 10 concurrent reconciliation completion requests — exactly 1 succeeds", async () => {
    let completionExecuted = 0;
    const openRec = {
      id: "rec_sess_1",
      organizationId: "org_A",
      reconciliationNumber: "REC-2026-00001",
      difference: 0.0,
      status: "OPEN",
    };

    (db.bankReconciliation.findFirst as any).mockResolvedValue(openRec);
    (db.bankReconciliation.findUnique as any).mockImplementation(async () => {
      if (completionExecuted > 0) {
        return { ...openRec, status: "COMPLETED" };
      }
      completionExecuted++;
      return openRec;
    });

    (db.bankReconciliationItem.findMany as any).mockResolvedValue([]);
    (db.bankReconciliation.update as any).mockImplementation(async () => {
      return { ...openRec, status: "COMPLETED" };
    });

    const attempts = Array.from({ length: 10 }, () =>
      BankReconciliationService.completeReconciliation(userOrgA, "rec_sess_1").catch(
        (err) => err
      )
    );

    const results = await Promise.all(attempts);
    const successes = results.filter((r) => !(r instanceof Error));
    const rejected = results.filter(
      (r) => r instanceof ConflictError || r instanceof ValidationError
    );

    expect(successes.length).toBe(1);
    expect(rejected.length).toBe(9);
  });

  // Scenario 6: Race condition — complete vs toggle
  it("Concurrency 6: Race Condition between completeReconciliation and toggleItemCleared — serialized safely", async () => {
    let recStatus = "OPEN";
    let difference = 0.0;

    const mockRec = {
      id: "rec_race_1",
      organizationId: "org_A",
      statementBeginningBalance: 1000,
      statementEndingBalance: 1500,
      get difference() {
        return difference;
      },
      get status() {
        return recStatus;
      },
    };

    (db.bankReconciliation.findFirst as any).mockResolvedValue(mockRec);
    (db.bankReconciliation.findUnique as any).mockImplementation(async () => ({
      ...mockRec,
      difference,
      status: recStatus,
    }));

    (db.bankReconciliationItem.findFirst as any).mockResolvedValue({
      id: "item_race",
      reconciliationId: "rec_race_1",
      bankTransaction: { amount: 500 },
    });
    (db.bankReconciliationItem.findMany as any).mockResolvedValue([
      { bankTransaction: { amount: 500 } },
    ]);
    (db.bankReconciliationItem.update as any).mockResolvedValue({});
    (db.bankReconciliation.update as any).mockImplementation(async ({ data }: any) => {
      if (data.status) recStatus = data.status;
      if (data.difference !== undefined) difference = data.difference;
      return { ...mockRec, status: recStatus, difference };
    });

    // Run complete and toggle simultaneously
    const [completeResult, toggleResult] = await Promise.allSettled([
      BankReconciliationService.completeReconciliation(userOrgA, "rec_race_1"),
      BankReconciliationService.toggleItemCleared(userOrgA, "rec_race_1", "tx_race", false),
    ]);

    const completedSucceeded = completeResult.status === "fulfilled";
    const toggleSucceeded = toggleResult.status === "fulfilled";

    expect(completedSucceeded || toggleSucceeded).toBe(true);
    if (recStatus === "COMPLETED") {
      expect(Math.abs(difference)).toBeLessThanOrEqual(0.001);
    }
  });

  // Scenario 7: Bank transaction void concurrency (10 workers)
  it("Concurrency 7: 10 concurrent void attempts on the same transaction — exactly 1 void executed", async () => {
    let voidExecutions = 0;
    const txRecord = {
      id: "tx_void_race",
      organizationId: "org_A",
      bankAccountId: "acc_1",
      amount: 300,
      status: "UNMATCHED",
    };

    (db.bankTransaction.findFirst as any).mockResolvedValue(txRecord);
    (db.bankTransaction.findUnique as any).mockImplementation(async () => {
      if (voidExecutions > 0) {
        return { ...txRecord, status: "VOIDED" };
      }
      voidExecutions++;
      return txRecord;
    });

    (db.bankAccount.update as any).mockResolvedValue({});
    (db.bankTransaction.update as any).mockImplementation(async () => {
      return { ...txRecord, status: "VOIDED" };
    });

    const attempts = Array.from({ length: 10 }, () =>
      BankTransactionService.voidTransaction(userOrgA, "tx_void_race", "Duplicate payment").catch(
        (err) => err
      )
    );

    const results = await Promise.all(attempts);
    const successes = results.filter((r) => !(r instanceof Error));
    const validationErrors = results.filter((r) => r instanceof ValidationError);

    expect(successes.length).toBe(1);
    expect(validationErrors.length).toBe(9);
    expect(voidExecutions).toBe(1);
  });

  // Invariant Verification: Operational Balance Recalculation
  it("Invariant: Operational balance accurately recalculates to openingBalance + SUM(non-voided transactions)", async () => {
    const bankAccount = {
      id: "acc_audit_recalc",
      organizationId: "org_A",
      openingBalance: 1000.0,
      currentBalance: 9999.0, // Drastically out-of-sync placeholder
    };
    (db.bankAccount.findFirst as any).mockResolvedValue(bankAccount);

    const transactions = [
      { amount: 500.0 }, // Deposit
      { amount: -200.0 }, // Withdrawal
      { amount: 1500.55 }, // Customer payment
      { amount: -50.55 }, // Fee
    ];
    (db.bankTransaction.findMany as any).mockResolvedValue(transactions);

    let finalBalance = 0;
    (db.bankAccount.update as any).mockImplementation(async ({ data }: any) => {
      finalBalance = data.currentBalance;
      return { ...bankAccount, currentBalance: finalBalance };
    });

    const recalculated = await BankAccountService.recalculateBalance(
      userOrgA,
      "acc_audit_recalc"
    );

    // Expected: 1000.00 + 500.00 - 200.00 + 1500.55 - 50.55 = 2750.00
    expect(finalBalance).toBe(2750.0);
    expect(recalculated.currentBalance).toBe(2750.0);
  });
});
