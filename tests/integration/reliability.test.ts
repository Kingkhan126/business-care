import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/db/client";
import { SessionUser } from "@/types/auth";
import { InvoiceService } from "@/server/services/InvoiceService";
import { AuthService } from "@/server/services/AuthService";
import { ExpenseApprovalService } from "@/server/services/ExpenseApprovalService";
import { ExpenseService } from "@/server/services/ExpenseService";
import { CustomerPaymentService } from "@/server/services/CustomerPaymentService";
import { JournalEntryService } from "@/server/services/JournalEntryService";
import { FinancialReportService } from "@/server/services/FinancialReportService";
import { DashboardService } from "@/server/services/DashboardService";
import { nextDocumentNumber } from "@/server/services/DocumentNumberService";
import { BankImportService } from "@/server/services/BankImportService";
import { BankReconciliationService } from "@/server/services/BankReconciliationService";
import { OrganizationSettingsRepository } from "@/server/repositories/OrganizationSettingsRepository";
import { AccountingPeriodService } from "@/server/services/AccountingPeriodService";

describe("PostgreSQL reliability regressions", () => {
  const run = randomUUID();
  let user: SessionUser;
  let otherOrg: string;
  let customerId: string;
  let otherCustomerId: string;
  let productId: string;
  let serviceId: string;
  let cashId: string;
  let revenueId: string;
  let expenseId: string;
  let claimantId: string;
  const date = new Date();

  beforeAll(async () => {
    const actor = await db.user.create({ data: { email: `${run}@test.invalid`, name: "Test Owner", passwordHash: "never-return-this-hash" } });
    const claimant = await db.user.create({ data: { email: `claim-${run}@test.invalid`, name: "Claimant", passwordHash: "claimant-secret-hash" } });
    claimantId = claimant.id;
    const org = await db.organization.create({ data: { name: `Reliability ${run}`, currency: "USD" } });
    otherOrg = (await db.organization.create({ data: { name: `Foreign ${run}` } })).id;
    user = { id: actor.id, email: actor.email, name: actor.name, activeOrganizationId: org.id, permissions: ["invoices.read", "invoices.create", "invoices.update", "payments.create", "reports.read", "accounting.read", "accounting.manage", "accounting.post", "accounting.reverse", "expense.read", "expense.create", "expense.approve", "banking.read", "banking.import", "banking.reconcile"] };
    customerId = (await db.customer.create({ data: { organizationId: org.id, customerNumber: "CUS-1", displayName: "Customer" } })).id;
    otherCustomerId = (await db.customer.create({ data: { organizationId: otherOrg, customerNumber: "CUS-1", displayName: "Foreign customer" } })).id;
    productId = (await db.product.create({ data: { organizationId: otherOrg, sku: "FOREIGN", name: "Foreign product", trackInventory: false } })).id;
    serviceId = (await db.service.create({ data: { organizationId: otherOrg, code: "FOREIGN", name: "Foreign service" } })).id;
    const createAccount = (accountCode: string, accountType: "ASSET" | "REVENUE" | "EXPENSE", normalBalance: "DEBIT" | "CREDIT") => db.account.create({ data: { organizationId: org.id, accountCode, accountName: accountCode, accountType, normalBalance } });
    cashId = (await createAccount("1000", "ASSET", "DEBIT")).id;
    revenueId = (await createAccount("4000", "REVENUE", "CREDIT")).id;
    expenseId = (await createAccount("6000", "EXPENSE", "DEBIT")).id;
    await db.accountingPeriod.create({ data: { organizationId: org.id, fiscalYear: date.getUTCFullYear(), periodNumber: date.getUTCMonth() + 1, name: "Current month", startDate: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)), endDate: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999)) } });
  });

  // Clean up only this run's fixtures; never reset or truncate the test database.
  afterAll(async () => {
    if (user) {
      const orgs = [user.activeOrganizationId!, otherOrg];
      // Restrict relationships require dependents to be removed first.
      await db.customerPaymentAllocation.deleteMany({ where: { payment: { organizationId: { in: orgs } } } });
      await db.customerPayment.deleteMany({ where: { organizationId: { in: orgs } } });
      await db.salesInvoice.deleteMany({ where: { organizationId: { in: orgs } } });
      await db.salesOrder.deleteMany({ where: { organizationId: { in: orgs } } });
      await db.expense.deleteMany({ where: { organizationId: { in: orgs } } });
      await db.bankReconciliation.deleteMany({ where: { organizationId: { in: orgs } } });
      await db.bankTransaction.deleteMany({ where: { organizationId: { in: orgs } } });
      await db.bankImportBatch.deleteMany({ where: { organizationId: { in: orgs } } });
      await db.bankAccount.deleteMany({ where: { organizationId: { in: orgs } } });
      await db.journalEntry.deleteMany({ where: { organizationId: { in: orgs } } });
      await db.account.deleteMany({ where: { organizationId: { in: orgs } } });
      await db.documentSequence.deleteMany({ where: { organizationId: { in: orgs } } });
      await db.organization.deleteMany({ where: { id: { in: orgs } } });
      await db.user.deleteMany({ where: { id: { in: [user.id, claimantId] } } });
    }
    await db.$disconnect();
  });

  const invoiceInput = () => ({ customerId, issueDate: date, dueDate: date, currency: "USD", lines: [{ description: "Consulting", quantity: 1, unitPrice: 100 }] });

  it("initializes organization settings safely during concurrent first visits", async () => {
    const settings = await Promise.all(Array.from({ length: 8 }, () => OrganizationSettingsRepository.findByOrganizationId(user.activeOrganizationId!)));
    expect(new Set(settings.map(record => record.id)).size).toBe(1);
    expect(await db.organizationSettings.count({ where: { organizationId: user.activeOrganizationId! } })).toBe(1);
  });

  it("initializes a missing accounting period safely under concurrent requests", async () => {
    const periods = await Promise.all(Array.from({ length: 8 }, () => AccountingPeriodService.assertOpenPeriod(otherOrg, date)));
    expect(new Set(periods.map(record => record.id)).size).toBe(1);
    await db.accountingPeriod.update({ where: { id: periods[0].id }, data: { status: "CLOSED" } });
    await expect(db.$transaction(tx => AccountingPeriodService.assertOpenPeriod(otherOrg, date, tx))).rejects.toThrow(/closed/i);
  });

  it("rejects foreign tenant products, services, customers, and source orders without writing invoices", async () => {
    const source = await db.salesOrder.create({ data: { organizationId: otherOrg, customerId: otherCustomerId, orderNumber: "SO-1", orderDate: date, createdById: user.id } });
    const before = await db.salesInvoice.count({ where: { organizationId: user.activeOrganizationId! } });
    for (const input of [
      { ...invoiceInput(), customerId: otherCustomerId },
      { ...invoiceInput(), lines: [{ ...invoiceInput().lines[0], productId }] },
      { ...invoiceInput(), lines: [{ ...invoiceInput().lines[0], serviceId }] },
      { ...invoiceInput(), sourceSalesOrderId: source.id },
    ]) await expect(InvoiceService.create(user, input)).rejects.toThrow(/not found/i);
    expect(await db.salesInvoice.count({ where: { organizationId: user.activeOrganizationId! } })).toBe(before);
  });

  it("allocates distinct invoice numbers under actual concurrent writes", async () => {
    const invoices = await Promise.all(Array.from({ length: 10 }, () => InvoiceService.create(user, invoiceInput())));
    expect(new Set(invoices.map(i => i.invoiceNumber)).size).toBe(10);
  });

  it("starts counters above existing imported numbers and never reuses deleted numbers", async () => {
    const imported = await db.salesInvoice.create({ data: { organizationId: user.activeOrganizationId!, customerId, invoiceNumber: "INV-900000", issueDate: date, dueDate: date, createdById: user.id } });
    const first = await InvoiceService.create(user, invoiceInput());
    expect(first.invoiceNumber).toBe("INV-900001");
    await db.salesInvoice.delete({ where: { id: first.id } });
    const second = await InvoiceService.create(user, invoiceInput());
    expect(second.invoiceNumber).toBe("INV-900002");
    await db.salesInvoice.delete({ where: { id: imported.id } });
  });

  it("rolls back number allocation when the document transaction fails", async () => {
    await expect(db.$transaction(async tx => {
      await nextDocumentNumber(tx, user.activeOrganizationId!, "estimate", "ROLLBACK-");
      throw new Error("Injected write failure");
    })).rejects.toThrow("Injected write failure");
    const allocated = await db.$transaction(tx => nextDocumentNumber(tx, user.activeOrganizationId!, "estimate", "ROLLBACK-"));
    expect(allocated).toBe("ROLLBACK-000001");
  });

  it("serializes competing payment allocations and prevents overpayment", async () => {
    const invoice = await InvoiceService.create(user, invoiceInput());
    await InvoiceService.issueInvoice(user, invoice.id);
    const payment = await CustomerPaymentService.recordPayment(user, { customerId, paymentDate: date, amount: 100, currency: "USD" });
    const results = await Promise.allSettled(Array.from({ length: 2 }, () => CustomerPaymentService.allocatePayment(user, payment.id, { invoiceId: invoice.id, allocatedAmount: 100 })));
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    const stored = await db.salesInvoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(Number(stored.amountPaid)).toBe(100);
    expect(Number(stored.balanceDue)).toBe(0);
    expect(await db.customerPaymentAllocation.count({ where: { invoiceId: invoice.id } })).toBe(1);
  });

  it("preserves original and reversal in reports, including before the reversal date", async () => {
    const originalDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    const journal = await JournalEntryService.createManualJournal(user, { entryDate: originalDate, description: "Reversal regression", lines: [{ accountId: cashId, debit: 125, credit: 0 }, { accountId: revenueId, debit: 0, credit: 125 }] });
    await JournalEntryService.postJournal(user, journal.id);
    expect((await FinancialReportService.getProfitAndLoss(user)).totalRevenue).toBe(125);
    await JournalEntryService.reverseJournal(user, journal.id, "Regression test");
    const beforeReversal = await FinancialReportService.getProfitAndLoss(user, { startDate: originalDate, endDate: originalDate });
    expect(beforeReversal.totalRevenue).toBe(125);
    const pnl = await FinancialReportService.getProfitAndLoss(user, { startDate: originalDate, endDate: new Date(Date.now() + 1000) });
    expect(pnl.totalRevenue).toBe(0);
    const trial = await FinancialReportService.getTrialBalance(user);
    expect(trial.grandTotalDebit).toBe(0);
    expect(trial.grandTotalCredit).toBe(0);
    expect((await FinancialReportService.getBalanceSheet(user)).totalAssets).toBe(0);
  });

  it("keeps inactive accounts' posted history in financial statements", async () => {
    const journal = await JournalEntryService.createManualJournal(user, { entryDate: date, lines: [{ accountId: expenseId, debit: 40, credit: 0 }, { accountId: cashId, debit: 0, credit: 40 }] });
    await JournalEntryService.postJournal(user, journal.id);
    await db.account.update({ where: { id: expenseId }, data: { isActive: false } });
    expect((await FinancialReportService.getProfitAndLoss(user)).totalExpenses).toBe(40);
    await db.account.update({ where: { id: expenseId }, data: { isActive: true } });
  });

  it("returns safe claimant data and serializes expense approvals", async () => {
    const expense = await db.expense.create({ data: { organizationId: user.activeOrganizationId!, expenseNumber: "EXP-APPROVAL", expenseType: "EMPLOYEE_CLAIM", paymentType: "REIMBURSEMENT", status: "SUBMITTED", expenseDate: date, description: "Claim", claimantId, createdById: claimantId } });
    const results = await Promise.allSettled([ExpenseApprovalService.approve(user, expense.id), ExpenseApprovalService.approve(user, expense.id)]);
    const successes = results.filter(r => r.status === "fulfilled");
    expect(successes).toHaveLength(1);
    if (successes[0].status === "fulfilled") {
      expect(successes[0].value.claimant?.id).toBe(claimantId);
      expect(successes[0].value.claimant).not.toHaveProperty("passwordHash");
      expect(JSON.stringify(successes[0].value)).not.toContain("claimant-secret-hash");
    }
  });

  it("rolls back a business mutation when audit persistence fails", async () => {
    const trigger = `audit_fail_${run.replaceAll("-", "")}`;
    await db.$executeRawUnsafe(`CREATE FUNCTION "${trigger}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."actorId" = '${user.id}' AND NEW.action = 'invoice.created' THEN RAISE EXCEPTION 'Injected audit failure'; END IF; RETURN NEW; END $$`);
    await db.$executeRawUnsafe(`CREATE TRIGGER "${trigger}" BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION "${trigger}"()`);
    const before = await db.salesInvoice.count({ where: { organizationId: user.activeOrganizationId! } });
    try {
      await expect(InvoiceService.create(user, invoiceInput())).rejects.toThrow();
      expect(await db.salesInvoice.count({ where: { organizationId: user.activeOrganizationId! } })).toBe(before);
    } finally {
      await db.$executeRawUnsafe(`DROP TRIGGER "${trigger}" ON "AuditLog"`);
      await db.$executeRawUnsafe(`DROP FUNCTION "${trigger}"()`);
    }
  });

  it("does not expose unauthorized dashboard domains and uses ledger figures", async () => {
    const restricted = await DashboardService.getSummary({ ...user, permissions: [] });
    expect(restricted.access).toEqual({ reports: false, invoices: false, expenses: false, banking: false });
    expect(restricted.invoices).toEqual([]);
    expect(restricted.expenses).toEqual([]);
    expect(restricted.accounts).toEqual([]);
    expect(restricted.totalRevenue).toBe(0);
    const summary = await DashboardService.getSummary(user);
    expect(summary.totalRevenue).toBe(0); // Draft/issued invoices aren't ledger revenue.
    expect(summary.totalExpenses).toBe(40);
    expect(summary.netProfit).toBe(-40);
    expect(summary.organization.currency).toBe("USD");
  });

  it("imports the same bank statement concurrently without double-counting balances", async () => {
    const account = await db.bankAccount.create({ data: { organizationId: user.activeOrganizationId!, accountName: "Import regression", openingBalance: 1000, currentBalance: 1000 } });
    const input = { bankAccountId: account.id, fileName: "statement.csv", csvContent: "Date,Description,Amount\n2026-10-01,Deposit,250\n2026-10-02,Withdrawal,-50", mapping: { hasHeader: true, dateColumn: "Date", descriptionColumn: "Description", amountColumn: "Amount" } };
    const results = await Promise.all(Array.from({ length: 5 }, () => BankImportService.commit(user, input)));
    expect(results.reduce((total, result) => total + result.importedRecords, 0)).toBe(2);
    expect(await db.bankTransaction.count({ where: { bankAccountId: account.id } })).toBe(2);
    expect(Number((await db.bankAccount.findUniqueOrThrow({ where: { id: account.id } })).currentBalance)).toBe(1200);
  });

  it("serializes reconciliation creation and completion against PostgreSQL row locks", async () => {
    const account = await db.bankAccount.create({ data: { organizationId: user.activeOrganizationId!, accountName: "Reconciliation regression" } });
    const input = { bankAccountId: account.id, statementStartDate: "2026-10-01", statementEndDate: "2026-10-31", statementEndingBalance: 0 };
    const starts = await Promise.allSettled([BankReconciliationService.startReconciliation(user, input), BankReconciliationService.startReconciliation(user, input)]);
    expect(starts.filter(result => result.status === "fulfilled")).toHaveLength(1);
    const reconciliation = await db.bankReconciliation.findFirstOrThrow({ where: { bankAccountId: account.id } });
    const completions = await Promise.allSettled([BankReconciliationService.completeReconciliation(user, reconciliation.id), BankReconciliationService.completeReconciliation(user, reconciliation.id)]);
    expect(completions.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect((await db.bankReconciliation.findUniqueOrThrow({ where: { id: reconciliation.id } })).status).toBe("COMPLETED");
  });

  it("leaves no partial registration when account setup cannot finish", async () => {
    // Force the organization insert to fail after user creation using a temporary DB trigger.
    const email = `rollback-${run}@test.invalid`;
    const triggerName = `registration_fail_${run.replaceAll("-", "")}`;
    const orgName = `FAIL-${run}`;
    await db.$executeRawUnsafe(`CREATE FUNCTION "${triggerName}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.name = '${orgName}' THEN RAISE EXCEPTION 'Injected organization failure'; END IF; RETURN NEW; END $$`);
    await db.$executeRawUnsafe(`CREATE TRIGGER "${triggerName}" BEFORE INSERT ON "Organization" FOR EACH ROW EXECUTE FUNCTION "${triggerName}"()`);
    let roleId: string | undefined;
    try {
      const existing = await db.role.findFirst({ where: { name: "Owner", organizationId: null, isSystem: true } });
      if (!existing) roleId = (await db.role.create({ data: { name: "Owner", isSystem: true } })).id;
      await expect(AuthService.register({ email, name: "Rollback", organizationName: orgName, password: "Password123!" })).rejects.toThrow();
      expect(await db.user.findUnique({ where: { email } })).toBeNull();
      expect(await db.organization.findFirst({ where: { name: orgName } })).toBeNull();
    } finally {
      await db.$executeRawUnsafe(`DROP TRIGGER "${triggerName}" ON "Organization"`);
      await db.$executeRawUnsafe(`DROP FUNCTION "${triggerName}"()`);
      if (roleId) await db.role.delete({ where: { id: roleId } });
    }
  });
});
