import { describe, it, expect } from "vitest";
import {
  CreateBankAccountSchema,
  UpdateBankAccountSchema,
  BankAccountTypeEnum,
} from "@/lib/validation/banking";
import { CalculationEngine } from "@/server/services/CalculationEngine";

describe("Phase 6 — Bank & Cash Accounts Validation and Domain Suite", () => {
  it("Test 1: Validates creation of valid checking bank account", () => {
    const validData = {
      accountName: "Operating Checking Account",
      accountType: "CHECKING",
      institutionName: "Chase",
      accountNumberMasked: "****1234",
      routingNumber: "021000021",
      currency: "USD",
      openingBalance: 5000.0,
      openingBalanceDate: "2026-10-01",
      linkedLedgerAccountId: "gl-acc-1110",
      description: "Primary business checking",
      createOpeningBalanceJournal: true,
    };

    const parsed = CreateBankAccountSchema.parse(validData);
    expect(parsed.accountName).toBe("Operating Checking Account");
    expect(parsed.accountType).toBe("CHECKING");
    expect(parsed.currency).toBe("USD");
    expect(parsed.openingBalance).toBe(5000.0);
    expect(parsed.createOpeningBalanceJournal).toBe(true);
  });

  it("Test 2: Rejects bank account with missing account name", () => {
    const invalidData = {
      accountName: "",
      accountType: "CHECKING",
      currency: "USD",
    };

    expect(() => CreateBankAccountSchema.parse(invalidData)).toThrow();
  });

  it("Test 3: Validates cash register / petty cash account type", () => {
    const cashData = {
      accountName: "Front Desk Cash Drawer",
      accountType: "CASH",
      openingBalance: 300.0,
      currency: "USD",
    };

    const parsed = CreateBankAccountSchema.parse(cashData);
    expect(parsed.accountType).toBe("CASH");
    expect(parsed.accountName).toBe("Front Desk Cash Drawer");
    expect(parsed.openingBalance).toBe(300.0);
  });

  it("Test 4: Rejects unsupported account types", () => {
    const invalidType = {
      accountName: "Crypto Vault",
      accountType: "CRYPTO_WALLET" as any,
    };

    expect(() => CreateBankAccountSchema.parse(invalidType)).toThrow();
  });

  it("Test 5: Calculates Net Liquidity across Bank, Cash, and Credit Card accounts", () => {
    const accounts = [
      { type: "CHECKING", balance: 12500.5 },
      { type: "SAVINGS", balance: 25000.0 },
      { type: "CASH", balance: 850.25 },
      { type: "CREDIT_CARD", balance: 3200.75 },
    ];

    let totalBank = 0;
    let totalCash = 0;
    let totalCreditCard = 0;

    for (const a of accounts) {
      if (a.type === "CASH") totalCash = CalculationEngine.roundMoney(totalCash + a.balance);
      else if (a.type === "CREDIT_CARD") totalCreditCard = CalculationEngine.roundMoney(totalCreditCard + a.balance);
      else totalBank = CalculationEngine.roundMoney(totalBank + a.balance);
    }

    const netLiquidity = CalculationEngine.roundMoney(totalBank + totalCash - totalCreditCard);

    expect(totalBank).toBe(37500.5);
    expect(totalCash).toBe(850.25);
    expect(totalCreditCard).toBe(3200.75);
    expect(netLiquidity).toBe(35150.0);
  });

  it("Test 6: Validates account update schema allowing partial fields", () => {
    const updateData = {
      accountName: "Renamed Operating Account",
      isActive: false,
    };

    const parsed = UpdateBankAccountSchema.parse(updateData);
    expect(parsed.accountName).toBe("Renamed Operating Account");
    expect(parsed.isActive).toBe(false);
  });
});
