import { z } from "zod";

export const TransactionLineSchema = z.object({
  productId: z.string().optional().nullable(),
  serviceId: z.string().optional().nullable(),
  description: z.string().min(1, "Line item description is required"),
  quantity: z.number().positive("Quantity must be greater than zero"),
  unitOfMeasure: z.string().optional().nullable(),
  unitPrice: z.number().min(0, "Unit price cannot be negative"),
  discount: z.number().min(0, "Discount cannot be negative").optional().default(0),
  discountIsPercentage: z.boolean().optional().default(false),
  taxRate: z.number().min(0, "Tax rate cannot be negative").optional().default(0),
});

export type TransactionLineInput = z.input<typeof TransactionLineSchema>;

// ESTIMATES
export const EstimateSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  issueDate: z.string().or(z.date()),
  expiryDate: z.string().or(z.date()).optional().nullable(),
  currency: z.string().min(3).max(3).default("USD"),
  notes: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
  lines: z.array(TransactionLineSchema).min(1, "Estimate must contain at least one line item"),
});

export type EstimateInput = z.input<typeof EstimateSchema>;

// SALES ORDERS
export const SalesOrderSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  sourceEstimateId: z.string().optional().nullable(),
  orderDate: z.string().or(z.date()),
  expectedDeliveryDate: z.string().or(z.date()).optional().nullable(),
  currency: z.string().min(3).max(3).default("USD"),
  notes: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
  lines: z.array(TransactionLineSchema).min(1, "Sales Order must contain at least one line item"),
});

export type SalesOrderInput = z.input<typeof SalesOrderSchema>;

// INVOICES
export const SalesInvoiceSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  sourceSalesOrderId: z.string().optional().nullable(),
  warehouseId: z.string().optional().nullable(),
  issueDate: z.string().or(z.date()),
  dueDate: z.string().or(z.date()),
  currency: z.string().min(3).max(3).default("USD"),
  notes: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
  lines: z.array(TransactionLineSchema).min(1, "Invoice must contain at least one line item"),
});

export type SalesInvoiceInput = z.input<typeof SalesInvoiceSchema>;

// CUSTOMER PAYMENTS
export const CustomerPaymentSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  paymentDate: z.string().or(z.date()),
  amount: z.number().positive("Payment amount must be greater than zero"),
  currency: z.string().min(3).max(3).default("USD"),
  paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "CARD", "CHEQUE", "OTHER"]).default("BANK_TRANSFER"),
  reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type CustomerPaymentInput = z.input<typeof CustomerPaymentSchema>;

export const CustomerPaymentAllocationSchema = z.object({
  invoiceId: z.string().min(1, "Invoice ID is required"),
  allocatedAmount: z.number().positive("Allocation amount must be greater than zero"),
});

export type CustomerPaymentAllocationInput = z.input<typeof CustomerPaymentAllocationSchema>;

// CREDIT NOTES
export const CreditNoteSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  sourceInvoiceId: z.string().optional().nullable(),
  warehouseId: z.string().optional().nullable(),
  issueDate: z.string().or(z.date()),
  returnToInventory: z.boolean().default(false),
  reason: z.string().min(1, "Reason is required"),
  notes: z.string().optional().nullable(),
  lines: z.array(TransactionLineSchema).min(1, "Credit note must contain at least one line item"),
});

export type CreditNoteInput = z.input<typeof CreditNoteSchema>;

// PURCHASE ORDERS
export const PurchaseOrderSchema = z.object({
  supplierId: z.string().min(1, "Supplier is required"),
  orderDate: z.string().or(z.date()),
  expectedDate: z.string().or(z.date()).optional().nullable(),
  currency: z.string().min(3).max(3).default("USD"),
  notes: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
  lines: z.array(TransactionLineSchema).min(1, "Purchase Order must contain at least one line item"),
});

export type PurchaseOrderInput = z.input<typeof PurchaseOrderSchema>;

// VENDOR BILLS
export const VendorBillSchema = z.object({
  supplierId: z.string().min(1, "Supplier is required"),
  sourcePurchaseOrderId: z.string().optional().nullable(),
  warehouseId: z.string().optional().nullable(),
  vendorBillReference: z.string().optional().nullable(),
  issueDate: z.string().or(z.date()),
  dueDate: z.string().or(z.date()),
  currency: z.string().min(3).max(3).default("USD"),
  notes: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
  lines: z.array(TransactionLineSchema).min(1, "Vendor Bill must contain at least one line item"),
});

export type VendorBillInput = z.input<typeof VendorBillSchema>;

// VENDOR PAYMENTS
export const VendorPaymentSchema = z.object({
  supplierId: z.string().min(1, "Supplier is required"),
  paymentDate: z.string().or(z.date()),
  amount: z.number().positive("Payment amount must be greater than zero"),
  currency: z.string().min(3).max(3).default("USD"),
  paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "CARD", "CHEQUE", "OTHER"]).default("BANK_TRANSFER"),
  reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type VendorPaymentInput = z.input<typeof VendorPaymentSchema>;

export const VendorPaymentAllocationSchema = z.object({
  billId: z.string().min(1, "Bill ID is required"),
  allocatedAmount: z.number().positive("Allocation amount must be greater than zero"),
});

export type VendorPaymentAllocationInput = z.input<typeof VendorPaymentAllocationSchema>;

// VENDOR CREDITS
export const VendorCreditSchema = z.object({
  supplierId: z.string().min(1, "Supplier is required"),
  sourceBillId: z.string().optional().nullable(),
  issueDate: z.string().or(z.date()),
  reason: z.string().min(1, "Reason is required"),
  notes: z.string().optional().nullable(),
  lines: z.array(TransactionLineSchema).min(1, "Vendor credit must contain at least one line item"),
});

export type VendorCreditInput = z.input<typeof VendorCreditSchema>;
