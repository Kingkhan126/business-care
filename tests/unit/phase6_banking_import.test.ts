import { describe, it, expect } from "vitest";
import {
  CsvColumnMappingSchema,
  BankImportPreviewSchema,
} from "@/lib/validation/banking";
import { CSVBankFeedProvider } from "@/server/services/CSVBankFeedProvider";

describe("Phase 6 — Bank Statement Import & Deduplication Suite", () => {
  it("Test 1: Validates column mapping schema with single signed Amount column", () => {
    const validMapping = {
      dateColumn: "Date",
      descriptionColumn: "Description",
      amountColumn: "Amount",
      referenceColumn: "Ref",
      payeeColumn: "Payee",
      dateFormat: "YYYY-MM-DD",
      delimiter: ",",
      hasHeader: true,
    };

    const parsed = CsvColumnMappingSchema.parse(validMapping);
    expect(parsed.dateColumn).toBe("Date");
    expect(parsed.amountColumn).toBe("Amount");
  });

  it("Test 2: Validates column mapping schema with Inflow and Outflow columns", () => {
    const validInOutMapping = {
      dateColumn: "TxDate",
      descriptionColumn: "Memo",
      inflowColumn: "Credit",
      outflowColumn: "Debit",
      dateFormat: "MM/DD/YYYY",
      delimiter: ",",
      hasHeader: true,
    };

    const parsed = CsvColumnMappingSchema.parse(validInOutMapping);
    expect(parsed.inflowColumn).toBe("Credit");
    expect(parsed.outflowColumn).toBe("Debit");
  });

  it("Test 3: Rejects column mapping missing both Amount and Inflow/Outflow", () => {
    const invalidMapping = {
      dateColumn: "Date",
      descriptionColumn: "Description",
    };

    expect(() => CsvColumnMappingSchema.parse(invalidMapping)).toThrow();
  });

  it("Test 4: Parses CSV text correctly using CSVBankFeedProvider", () => {
    const csvContent = `Date,Description,Amount,Reference
2026-10-01,Client Wire Deposit,1500.00,REF101
2026-10-02,Office Supplies Expense,-120.50,CHQ202
2026-10-03,Utility Bill Payment,-350.00,UTIL99`;

    const mapping = {
      dateColumn: "Date",
      descriptionColumn: "Description",
      amountColumn: "Amount",
      referenceColumn: "Reference",
      dateFormat: "YYYY-MM-DD",
      delimiter: ",",
      hasHeader: true,
    };

    const result = CSVBankFeedProvider.parse("org-1", "bank-1", csvContent, mapping);
    expect(result.totalRows).toBe(3);
    expect(result.validRows).toBe(3);
    expect(result.totalInflow).toBe(1500.0);
    expect(result.totalOutflow).toBe(470.5);
    expect(result.netAmount).toBe(1029.5);
    expect(result.rows[0].amount).toBe(1500.0);
    expect(result.rows[1].amount).toBe(-120.5);
  });

  it("Test 5: Deterministic SHA-256 fingerprint generation ensures deduplication", () => {
    const date = new Date("2026-10-01T00:00:00.000Z");
    const amount = 1500.0;
    const ref = "REF101";
    const desc = "Client Wire Deposit";

    const fp1 = CSVBankFeedProvider.generateFingerprint(
      "org-1",
      "bank-1",
      date,
      amount,
      ref,
      desc
    );
    const fp2 = CSVBankFeedProvider.generateFingerprint(
      "org-1",
      "bank-1",
      date,
      amount,
      ref,
      desc
    );
    const fpDifferentAmount = CSVBankFeedProvider.generateFingerprint(
      "org-1",
      "bank-1",
      date,
      1500.01,
      ref,
      desc
    );

    expect(fp1).toBe(fp2);
    expect(fp1).not.toBe(fpDifferentAmount);
    expect(fp1).toHaveLength(64); // 64 hex characters (SHA-256)
  });
});
