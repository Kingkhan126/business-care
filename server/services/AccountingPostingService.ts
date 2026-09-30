import { db } from "@/db/client";
import { AccountMappingService } from "./AccountMappingService";
import { AccountingPeriodService } from "./AccountingPeriodService";
import { CalculationEngine } from "./CalculationEngine";
import { SessionUser } from "@/types/auth";
import { assertTenantAccess } from "../authorization/tenant";
import { requirePermission } from "../authorization/permissions";
import { NotFoundError, ValidationError, ConflictError } from "@/lib/errors";

export class AccountingPostingService {
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
   * Automatically posts a Sales Invoice to General Ledger.
   */
  static async postInvoice(user: SessionUser, invoiceId: string) {
    if (!user.activeOrganizationId) throw new NotFoundError("No active organization selected");
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "accounting.post");

    try {
      return await db.$transaction(async (tx) => {
        const invoice = await tx.salesInvoice.findFirst({
          where: { id: invoiceId, organizationId: user.activeOrganizationId! },
          include: { lines: true, customer: true },
        });

        if (!invoice) throw new NotFoundError("Sales Invoice not found");
        if (invoice.status === "DRAFT" || invoice.status === "VOID") {
          throw new ValidationError(`Invoice ${invoice.invoiceNumber} in status '${invoice.status}' cannot be posted.`);
        }

        const existingJournal = await this.checkAndLockEvent(
          tx,
          user.activeOrganizationId!,
          "SalesInvoice",
          invoice.id,
          "INVOICE_POSTED"
        );
        if (existingJournal) return existingJournal;

        const arAccount = await AccountMappingService.resolveAccount(user.activeOrganizationId!, "ACCOUNTS_RECEIVABLE");
        const revenueAccount = await AccountMappingService.resolveAccount(user.activeOrganizationId!, "SALES_REVENUE");
        const taxAccount = await AccountMappingService.resolveAccount(user.activeOrganizationId!, "TAX_PAYABLE");

        const total = Number(invoice.total);
        const subtotal = Number(invoice.subtotal) - Number(invoice.discountTotal);
        const taxTotal = Number(invoice.taxTotal);

        const period = await AccountingPeriodService.assertOpenPeriod(user.activeOrganizationId!, invoice.issueDate, tx);

        const count = await tx.journalEntry.count({ where: { organizationId: user.activeOrganizationId! } });
        const journalNumber = `JE-${String(count + 1).padStart(6, "0")}`;

        const lines = [
          {
            accountId: arAccount.id,
            description: `Accounts Receivable for Invoice ${invoice.invoiceNumber}`,
            debit: total,
            credit: 0,
            customerId: invoice.customerId,
          },
          {
            accountId: revenueAccount.id,
            description: `Sales Revenue for Invoice ${invoice.invoiceNumber}`,
            debit: 0,
            credit: subtotal,
            customerId: invoice.customerId,
          },
        ];

        if (taxTotal > 0) {
          lines.push({
            accountId: taxAccount.id,
            description: `Sales Tax Payable for Invoice ${invoice.invoiceNumber}`,
            debit: 0,
            credit: taxTotal,
            customerId: invoice.customerId,
          });
        }

        const journal = await tx.journalEntry.create({
          data: {
            organizationId: user.activeOrganizationId!,
            journalNumber,
            entryDate: invoice.issueDate,
            postingDate: new Date(),
            referenceType: "SalesInvoice",
            referenceId: invoice.id,
            description: `Sales Invoice ${invoice.invoiceNumber} - ${invoice.customer.displayName}`,
            source: "SALES_INVOICE",
            status: "POSTED",
            accountingPeriodId: period.id,
            totalDebit: total,
            totalCredit: total,
            createdById: user.id,
            postedById: user.id,
            postedAt: new Date(),
            lines: { create: lines },
          },
          include: { lines: { include: { account: true } } },
        });

        await tx.accountingEvent.create({
          data: {
            organizationId: user.activeOrganizationId!,
            eventType: "INVOICE_POSTED",
            sourceType: "SalesInvoice",
            sourceId: invoice.id,
            journalEntryId: journal.id,
          },
        });

        return journal;
      });
    } catch (err: any) {
      if (err.code === "P2002" || err.message?.includes("Unique constraint failed")) {
        return this.handleUniqueCollision(user.activeOrganizationId!, "SalesInvoice", invoiceId, "INVOICE_POSTED");
      }
      throw err;
    }
  }

  /**
   * Automatically posts a Customer Payment to General Ledger.
   */
  static async postCustomerPayment(user: SessionUser, paymentId: string) {
    if (!user.activeOrganizationId) throw new NotFoundError("No active organization selected");
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "accounting.post");

    try {
      return await db.$transaction(async (tx) => {
        const payment = await tx.customerPayment.findFirst({
          where: { id: paymentId, organizationId: user.activeOrganizationId! },
          include: { customer: true },
        });

        if (!payment) throw new NotFoundError("Customer Payment not found");

        const existingJournal = await this.checkAndLockEvent(
          tx,
          user.activeOrganizationId!,
          "CustomerPayment",
          payment.id,
          "CUSTOMER_PAYMENT_POSTED"
        );
        if (existingJournal) return existingJournal;

        const bankKey = payment.paymentMethod === "CASH" ? "CASH" : "BANK";
        const cashBankAccount = await AccountMappingService.resolveAccount(user.activeOrganizationId!, bankKey as any);
        const arAccount = await AccountMappingService.resolveAccount(user.activeOrganizationId!, "ACCOUNTS_RECEIVABLE");

        const amount = Number(payment.amount);
        const period = await AccountingPeriodService.assertOpenPeriod(user.activeOrganizationId!, payment.paymentDate, tx);

        const count = await tx.journalEntry.count({ where: { organizationId: user.activeOrganizationId! } });
        const journalNumber = `JE-${String(count + 1).padStart(6, "0")}`;

        const journal = await tx.journalEntry.create({
          data: {
            organizationId: user.activeOrganizationId!,
            journalNumber,
            entryDate: payment.paymentDate,
            postingDate: new Date(),
            referenceType: "CustomerPayment",
            referenceId: payment.id,
            description: `Customer Payment ${payment.paymentNumber} - ${payment.customer.displayName}`,
            source: "CUSTOMER_PAYMENT",
            status: "POSTED",
            accountingPeriodId: period.id,
            totalDebit: amount,
            totalCredit: amount,
            createdById: user.id,
            postedById: user.id,
            postedAt: new Date(),
            lines: {
              create: [
                {
                  accountId: cashBankAccount.id,
                  description: `Payment Receipt ${payment.paymentNumber}`,
                  debit: amount,
                  credit: 0,
                  customerId: payment.customerId,
                },
                {
                  accountId: arAccount.id,
                  description: `Accounts Receivable Clearance ${payment.paymentNumber}`,
                  debit: 0,
                  credit: amount,
                  customerId: payment.customerId,
                },
              ],
            },
          },
          include: { lines: { include: { account: true } } },
        });

        await tx.accountingEvent.create({
          data: {
            organizationId: user.activeOrganizationId!,
            eventType: "CUSTOMER_PAYMENT_POSTED",
            sourceType: "CustomerPayment",
            sourceId: payment.id,
            journalEntryId: journal.id,
          },
        });

        return journal;
      });
    } catch (err: any) {
      if (err.code === "P2002" || err.message?.includes("Unique constraint failed")) {
        return this.handleUniqueCollision(user.activeOrganizationId!, "CustomerPayment", paymentId, "CUSTOMER_PAYMENT_POSTED");
      }
      throw err;
    }
  }

  /**
   * Automatically posts a Vendor Bill to General Ledger.
   * Categorizes lines between Inventory Asset (tracked products) and Expense (services/other).
   */
  static async postVendorBill(user: SessionUser, billId: string) {
    if (!user.activeOrganizationId) throw new NotFoundError("No active organization selected");
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "accounting.post");

    try {
      return await db.$transaction(async (tx) => {
        const bill = await tx.vendorBill.findFirst({
          where: { id: billId, organizationId: user.activeOrganizationId! },
          include: { lines: true, supplier: true },
        });

        if (!bill) throw new NotFoundError("Vendor Bill not found");
        if (bill.status === "DRAFT" || bill.status === "VOID") {
          throw new ValidationError(`Vendor Bill ${bill.billNumber} in status '${bill.status}' cannot be posted.`);
        }

        const existingJournal = await this.checkAndLockEvent(
          tx,
          user.activeOrganizationId!,
          "VendorBill",
          bill.id,
          "VENDOR_BILL_POSTED"
        );
        if (existingJournal) return existingJournal;

        const apAccount = await AccountMappingService.resolveAccount(user.activeOrganizationId!, "ACCOUNTS_PAYABLE");
        const expenseAccount = await AccountMappingService.resolveAccount(user.activeOrganizationId!, "DEFAULT_EXPENSE");
        const inventoryAccount = await AccountMappingService.resolveAccount(user.activeOrganizationId!, "INVENTORY_ASSET");
        const taxAccount = await AccountMappingService.resolveAccount(user.activeOrganizationId!, "TAX_RECOVERABLE");

        const total = Number(bill.total);
        const taxTotal = Number(bill.taxTotal);

        let inventorySubtotal = 0;
        let expenseSubtotal = 0;

        for (const line of bill.lines) {
          const lineNet = Number(line.subtotal) - Number(line.discount || 0);
          if (line.productId) {
            inventorySubtotal = CalculationEngine.roundMoney(inventorySubtotal + lineNet);
          } else {
            expenseSubtotal = CalculationEngine.roundMoney(expenseSubtotal + lineNet);
          }
        }

        if (inventorySubtotal === 0 && expenseSubtotal === 0) {
          expenseSubtotal = Number(bill.subtotal) - Number(bill.discountTotal);
        }

        const period = await AccountingPeriodService.assertOpenPeriod(user.activeOrganizationId!, bill.issueDate, tx);

        const count = await tx.journalEntry.count({ where: { organizationId: user.activeOrganizationId! } });
        const journalNumber = `JE-${String(count + 1).padStart(6, "0")}`;

        const lines: any[] = [];

        if (inventorySubtotal > 0) {
          lines.push({
            accountId: inventoryAccount.id,
            description: `Inventory Asset Purchase for Bill ${bill.billNumber}`,
            debit: inventorySubtotal,
            credit: 0,
            supplierId: bill.supplierId,
          });
        }

        if (expenseSubtotal > 0) {
          lines.push({
            accountId: expenseAccount.id,
            description: `Purchase Expense for Bill ${bill.billNumber}`,
            debit: expenseSubtotal,
            credit: 0,
            supplierId: bill.supplierId,
          });
        }

        lines.push({
          accountId: apAccount.id,
          description: `Accounts Payable for Bill ${bill.billNumber}`,
          debit: 0,
          credit: total,
          supplierId: bill.supplierId,
        });

        if (taxTotal > 0) {
          lines.unshift({
            accountId: taxAccount.id,
            description: `Input Tax Recoverable for Bill ${bill.billNumber}`,
            debit: taxTotal,
            credit: 0,
            supplierId: bill.supplierId,
          });
        }

        const journal = await tx.journalEntry.create({
          data: {
            organizationId: user.activeOrganizationId!,
            journalNumber,
            entryDate: bill.issueDate,
            postingDate: new Date(),
            referenceType: "VendorBill",
            referenceId: bill.id,
            description: `Vendor Bill ${bill.billNumber} - ${bill.supplier.displayName}`,
            source: "VENDOR_BILL",
            status: "POSTED",
            accountingPeriodId: period.id,
            totalDebit: total,
            totalCredit: total,
            createdById: user.id,
            postedById: user.id,
            postedAt: new Date(),
            lines: { create: lines },
          },
          include: { lines: { include: { account: true } } },
        });

        await tx.accountingEvent.create({
          data: {
            organizationId: user.activeOrganizationId!,
            eventType: "VENDOR_BILL_POSTED",
            sourceType: "VendorBill",
            sourceId: bill.id,
            journalEntryId: journal.id,
          },
        });

        return journal;
      });
    } catch (err: any) {
      if (err.code === "P2002" || err.message?.includes("Unique constraint failed")) {
        return this.handleUniqueCollision(user.activeOrganizationId!, "VendorBill", billId, "VENDOR_BILL_POSTED");
      }
      throw err;
    }
  }

  /**
   * Automatically posts a Vendor Payment to General Ledger.
   */
  static async postVendorPayment(user: SessionUser, paymentId: string) {
    if (!user.activeOrganizationId) throw new NotFoundError("No active organization selected");
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "accounting.post");

    try {
      return await db.$transaction(async (tx) => {
        const payment = await tx.vendorPayment.findFirst({
          where: { id: paymentId, organizationId: user.activeOrganizationId! },
          include: { supplier: true },
        });

        if (!payment) throw new NotFoundError("Vendor Payment not found");

        const existingJournal = await this.checkAndLockEvent(
          tx,
          user.activeOrganizationId!,
          "VendorPayment",
          payment.id,
          "VENDOR_PAYMENT_POSTED"
        );
        if (existingJournal) return existingJournal;

        const bankKey = payment.paymentMethod === "CASH" ? "CASH" : "BANK";
        const cashBankAccount = await AccountMappingService.resolveAccount(user.activeOrganizationId!, bankKey as any);
        const apAccount = await AccountMappingService.resolveAccount(user.activeOrganizationId!, "ACCOUNTS_PAYABLE");

        const amount = Number(payment.amount);
        const period = await AccountingPeriodService.assertOpenPeriod(user.activeOrganizationId!, payment.paymentDate, tx);

        const count = await tx.journalEntry.count({ where: { organizationId: user.activeOrganizationId! } });
        const journalNumber = `JE-${String(count + 1).padStart(6, "0")}`;

        const journal = await tx.journalEntry.create({
          data: {
            organizationId: user.activeOrganizationId!,
            journalNumber,
            entryDate: payment.paymentDate,
            postingDate: new Date(),
            referenceType: "VendorPayment",
            referenceId: payment.id,
            description: `Vendor Payment ${payment.paymentNumber} - ${payment.supplier.displayName}`,
            source: "VENDOR_PAYMENT",
            status: "POSTED",
            accountingPeriodId: period.id,
            totalDebit: amount,
            totalCredit: amount,
            createdById: user.id,
            postedById: user.id,
            postedAt: new Date(),
            lines: {
              create: [
                {
                  accountId: apAccount.id,
                  description: `Accounts Payable Clearance ${payment.paymentNumber}`,
                  debit: amount,
                  credit: 0,
                  supplierId: payment.supplierId,
                },
                {
                  accountId: cashBankAccount.id,
                  description: `Payment Disbursement ${payment.paymentNumber}`,
                  debit: 0,
                  credit: amount,
                  supplierId: payment.supplierId,
                },
              ],
            },
          },
          include: { lines: { include: { account: true } } },
        });

        await tx.accountingEvent.create({
          data: {
            organizationId: user.activeOrganizationId!,
            eventType: "VENDOR_PAYMENT_POSTED",
            sourceType: "VendorPayment",
            sourceId: payment.id,
            journalEntryId: journal.id,
          },
        });

        return journal;
      });
    } catch (err: any) {
      if (err.code === "P2002" || err.message?.includes("Unique constraint failed")) {
        return this.handleUniqueCollision(user.activeOrganizationId!, "VendorPayment", paymentId, "VENDOR_PAYMENT_POSTED");
      }
      throw err;
    }
  }

  /**
   * Automatically posts a Credit Note to General Ledger.
   */
  static async postCreditNote(user: SessionUser, creditNoteId: string) {
    if (!user.activeOrganizationId) throw new NotFoundError("No active organization selected");
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "accounting.post");

    try {
      return await db.$transaction(async (tx) => {
        const creditNote = await tx.creditNote.findFirst({
          where: { id: creditNoteId, organizationId: user.activeOrganizationId! },
          include: { lines: true, customer: true },
        });

        if (!creditNote) throw new NotFoundError("Credit Note not found");
        if (creditNote.status === "DRAFT" || creditNote.status === "VOID") {
          throw new ValidationError(`Credit Note ${creditNote.creditNoteNumber} in status '${creditNote.status}' cannot be posted.`);
        }

        const existingJournal = await this.checkAndLockEvent(
          tx,
          user.activeOrganizationId!,
          "CreditNote",
          creditNote.id,
          "CREDIT_NOTE_POSTED"
        );
        if (existingJournal) return existingJournal;

        const salesReturnAccount = await AccountMappingService.resolveAccount(user.activeOrganizationId!, "SALES_RETURNS");
        const taxAccount = await AccountMappingService.resolveAccount(user.activeOrganizationId!, "TAX_PAYABLE");
        const arAccount = await AccountMappingService.resolveAccount(user.activeOrganizationId!, "ACCOUNTS_RECEIVABLE");

        const total = Number(creditNote.total);
        const subtotal = Number(creditNote.subtotal);
        const taxTotal = Number(creditNote.taxTotal);

        const period = await AccountingPeriodService.assertOpenPeriod(user.activeOrganizationId!, creditNote.issueDate, tx);

        const count = await tx.journalEntry.count({ where: { organizationId: user.activeOrganizationId! } });
        const journalNumber = `JE-${String(count + 1).padStart(6, "0")}`;

        const lines = [
          {
            accountId: salesReturnAccount.id,
            description: `Sales Return for Credit Note ${creditNote.creditNoteNumber}`,
            debit: subtotal,
            credit: 0,
            customerId: creditNote.customerId,
          },
          {
            accountId: arAccount.id,
            description: `Accounts Receivable Credit ${creditNote.creditNoteNumber}`,
            debit: 0,
            credit: total,
            customerId: creditNote.customerId,
          },
        ];

        if (taxTotal > 0) {
          lines.unshift({
            accountId: taxAccount.id,
            description: `Tax Payable Reversal for Credit Note ${creditNote.creditNoteNumber}`,
            debit: taxTotal,
            credit: 0,
            customerId: creditNote.customerId,
          });
        }

        const journal = await tx.journalEntry.create({
          data: {
            organizationId: user.activeOrganizationId!,
            journalNumber,
            entryDate: creditNote.issueDate,
            postingDate: new Date(),
            referenceType: "CreditNote",
            referenceId: creditNote.id,
            description: `Credit Note ${creditNote.creditNoteNumber} - ${creditNote.customer.displayName}`,
            source: "CREDIT_NOTE",
            status: "POSTED",
            accountingPeriodId: period.id,
            totalDebit: total,
            totalCredit: total,
            createdById: user.id,
            postedById: user.id,
            postedAt: new Date(),
            lines: { create: lines },
          },
          include: { lines: { include: { account: true } } },
        });

        await tx.accountingEvent.create({
          data: {
            organizationId: user.activeOrganizationId!,
            eventType: "CREDIT_NOTE_POSTED",
            sourceType: "CreditNote",
            sourceId: creditNote.id,
            journalEntryId: journal.id,
          },
        });

        return journal;
      });
    } catch (err: any) {
      if (err.code === "P2002" || err.message?.includes("Unique constraint failed")) {
        return this.handleUniqueCollision(user.activeOrganizationId!, "CreditNote", creditNoteId, "CREDIT_NOTE_POSTED");
      }
      throw err;
    }
  }

  /**
   * Automatically posts a Vendor Credit to General Ledger.
   */
  static async postVendorCredit(user: SessionUser, vendorCreditId: string) {
    if (!user.activeOrganizationId) throw new NotFoundError("No active organization selected");
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "accounting.post");

    try {
      return await db.$transaction(async (tx) => {
        const vendorCredit = await tx.vendorCredit.findFirst({
          where: { id: vendorCreditId, organizationId: user.activeOrganizationId! },
          include: { lines: true, supplier: true },
        });

        if (!vendorCredit) throw new NotFoundError("Vendor Credit not found");
        if (vendorCredit.status === "DRAFT" || vendorCredit.status === "VOID") {
          throw new ValidationError(`Vendor Credit ${vendorCredit.vendorCreditNumber} in status '${vendorCredit.status}' cannot be posted.`);
        }

        const existingJournal = await this.checkAndLockEvent(
          tx,
          user.activeOrganizationId!,
          "VendorCredit",
          vendorCredit.id,
          "VENDOR_CREDIT_POSTED"
        );
        if (existingJournal) return existingJournal;

        const apAccount = await AccountMappingService.resolveAccount(user.activeOrganizationId!, "ACCOUNTS_PAYABLE");
        const expenseAccount = await AccountMappingService.resolveAccount(user.activeOrganizationId!, "DEFAULT_EXPENSE");
        const taxAccount = await AccountMappingService.resolveAccount(user.activeOrganizationId!, "TAX_RECOVERABLE");

        const total = Number(vendorCredit.total);
        const subtotal = Number(vendorCredit.subtotal);
        const taxTotal = Number(vendorCredit.taxTotal);

        const period = await AccountingPeriodService.assertOpenPeriod(user.activeOrganizationId!, vendorCredit.issueDate, tx);

        const count = await tx.journalEntry.count({ where: { organizationId: user.activeOrganizationId! } });
        const journalNumber = `JE-${String(count + 1).padStart(6, "0")}`;

        const lines = [
          {
            accountId: apAccount.id,
            description: `Accounts Payable Reduction for Vendor Credit ${vendorCredit.vendorCreditNumber}`,
            debit: total,
            credit: 0,
            supplierId: vendorCredit.supplierId,
          },
          {
            accountId: expenseAccount.id,
            description: `Purchase Adjustment for Vendor Credit ${vendorCredit.vendorCreditNumber}`,
            debit: 0,
            credit: subtotal,
            supplierId: vendorCredit.supplierId,
          },
        ];

        if (taxTotal > 0) {
          lines.push({
            accountId: taxAccount.id,
            description: `Tax Recoverable Reversal for Vendor Credit ${vendorCredit.vendorCreditNumber}`,
            debit: 0,
            credit: taxTotal,
            supplierId: vendorCredit.supplierId,
          });
        }

        const journal = await tx.journalEntry.create({
          data: {
            organizationId: user.activeOrganizationId!,
            journalNumber,
            entryDate: vendorCredit.issueDate,
            postingDate: new Date(),
            referenceType: "VendorCredit",
            referenceId: vendorCredit.id,
            description: `Vendor Credit ${vendorCredit.vendorCreditNumber} - ${vendorCredit.supplier.displayName}`,
            source: "VENDOR_CREDIT",
            status: "POSTED",
            accountingPeriodId: period.id,
            totalDebit: total,
            totalCredit: total,
            createdById: user.id,
            postedById: user.id,
            postedAt: new Date(),
            lines: { create: lines },
          },
          include: { lines: { include: { account: true } } },
        });

        await tx.accountingEvent.create({
          data: {
            organizationId: user.activeOrganizationId!,
            eventType: "VENDOR_CREDIT_POSTED",
            sourceType: "VendorCredit",
            sourceId: vendorCredit.id,
            journalEntryId: journal.id,
          },
        });

        return journal;
      });
    } catch (err: any) {
      if (err.code === "P2002" || err.message?.includes("Unique constraint failed")) {
        return this.handleUniqueCollision(user.activeOrganizationId!, "VendorCredit", vendorCreditId, "VENDOR_CREDIT_POSTED");
      }
      throw err;
    }
  }

  /**
   * Automatically posts a Stock Adjustment to General Ledger.
   */
  static async postStockAdjustment(user: SessionUser, adjustmentId: string) {
    if (!user.activeOrganizationId) throw new NotFoundError("No active organization selected");
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "accounting.post");

    try {
      return await db.$transaction(async (tx) => {
        const adjustment = await tx.stockAdjustment.findFirst({
          where: { id: adjustmentId, organizationId: user.activeOrganizationId! },
          include: { product: true, warehouse: true },
        });

        if (!adjustment) throw new NotFoundError("Stock Adjustment not found");

        const existingJournal = await this.checkAndLockEvent(
          tx,
          user.activeOrganizationId!,
          "StockAdjustment",
          adjustment.id,
          "STOCK_ADJUSTMENT_POSTED"
        );
        if (existingJournal) return existingJournal;

        const inventoryAccount = await AccountMappingService.resolveAccount(user.activeOrganizationId!, "INVENTORY_ASSET");
        const cogsAccount = await AccountMappingService.resolveAccount(user.activeOrganizationId!, "COST_OF_GOODS_SOLD");

        const qtyChange = Number(adjustment.quantityChange);
        const costPrice = Number(adjustment.product.costPrice || 0);
        const totalCost = CalculationEngine.roundMoney(Math.abs(qtyChange) * costPrice);

        if (totalCost === 0) {
          throw new ValidationError(`Stock Adjustment for ${adjustment.product.name} has zero valuation amount.`);
        }

        const period = await AccountingPeriodService.assertOpenPeriod(user.activeOrganizationId!, adjustment.createdAt, tx);

        const count = await tx.journalEntry.count({ where: { organizationId: user.activeOrganizationId! } });
        const journalNumber = `JE-${String(count + 1).padStart(6, "0")}`;

        const isIncrease = qtyChange > 0;
        const lines = isIncrease
          ? [
              {
                accountId: inventoryAccount.id,
                description: `Inventory Increase for Product ${adjustment.product.sku}`,
                debit: totalCost,
                credit: 0,
                productId: adjustment.productId,
              },
              {
                accountId: cogsAccount.id,
                description: `Inventory Adjustment Credit for ${adjustment.product.sku}`,
                debit: 0,
                credit: totalCost,
                productId: adjustment.productId,
              },
            ]
          : [
              {
                accountId: cogsAccount.id,
                description: `Inventory Adjustment Expense for ${adjustment.product.sku}`,
                debit: totalCost,
                credit: 0,
                productId: adjustment.productId,
              },
              {
                accountId: inventoryAccount.id,
                description: `Inventory Decrease for Product ${adjustment.product.sku}`,
                debit: 0,
                credit: totalCost,
                productId: adjustment.productId,
              },
            ];

        const journal = await tx.journalEntry.create({
          data: {
            organizationId: user.activeOrganizationId!,
            journalNumber,
            entryDate: adjustment.createdAt,
            postingDate: new Date(),
            referenceType: "StockAdjustment",
            referenceId: adjustment.id,
            description: `Stock Adjustment (${adjustment.adjustmentType}) - ${adjustment.product.name}`,
            source: "STOCK_ADJUSTMENT",
            status: "POSTED",
            accountingPeriodId: period.id,
            totalDebit: totalCost,
            totalCredit: totalCost,
            createdById: user.id,
            postedById: user.id,
            postedAt: new Date(),
            lines: { create: lines },
          },
          include: { lines: { include: { account: true } } },
        });

        await tx.accountingEvent.create({
          data: {
            organizationId: user.activeOrganizationId!,
            eventType: "STOCK_ADJUSTMENT_POSTED",
            sourceType: "StockAdjustment",
            sourceId: adjustment.id,
            journalEntryId: journal.id,
          },
        });

        return journal;
      });
    } catch (err: any) {
      if (err.code === "P2002" || err.message?.includes("Unique constraint failed")) {
        return this.handleUniqueCollision(user.activeOrganizationId!, "StockAdjustment", adjustmentId, "STOCK_ADJUSTMENT_POSTED");
      }
      throw err;
    }
  }
}
