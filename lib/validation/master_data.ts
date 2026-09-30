import { z } from "zod";
import { SUPPORTED_CURRENCIES } from "@/lib/formatting";

const ALLOWED_CURRENCY_CODES = SUPPORTED_CURRENCIES.map((c) => c.code);

const CurrencySchema = z
  .string()
  .length(3, "Currency code must be 3 characters")
  .transform((c) => c.toUpperCase())
  .refine((c) => ALLOWED_CURRENCY_CODES.includes(c), {
    message: "Unsupported currency code",
  });

export const CustomerSchema = z.object({
  customerNumber: z.string().trim().optional(),
  displayName: z.string().trim().min(2, "Display name must be at least 2 characters"),
  legalName: z.string().trim().optional(),
  contactPerson: z.string().trim().optional(),
  email: z.string().trim().email("Invalid email format").optional().or(z.literal("")),
  phone: z.string().trim().optional(),
  alternatePhone: z.string().trim().optional(),
  website: z.string().trim().url("Invalid website URL").optional().or(z.literal("")),
  billingAddressLine1: z.string().trim().optional(),
  billingAddressLine2: z.string().trim().optional(),
  billingCity: z.string().trim().optional(),
  billingState: z.string().trim().optional(),
  billingPostalCode: z.string().trim().optional(),
  billingCountry: z.string().trim().length(2).optional().default("US"),
  shippingAddressLine1: z.string().trim().optional(),
  shippingAddressLine2: z.string().trim().optional(),
  shippingCity: z.string().trim().optional(),
  shippingState: z.string().trim().optional(),
  shippingPostalCode: z.string().trim().optional(),
  shippingCountry: z.string().trim().length(2).optional().default("US"),
  taxId: z.string().trim().optional(),
  registrationNumber: z.string().trim().optional(),
  currency: CurrencySchema.default("USD"),
  paymentTerms: z.string().trim().optional(),
  creditLimit: z.number().min(0, "Credit limit cannot be negative").optional(),
  notes: z.string().trim().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export type CustomerInput = z.infer<typeof CustomerSchema>;

export const SupplierSchema = z.object({
  supplierNumber: z.string().trim().optional(),
  displayName: z.string().trim().min(2, "Display name must be at least 2 characters"),
  legalName: z.string().trim().optional(),
  contactPerson: z.string().trim().optional(),
  email: z.string().trim().email("Invalid email format").optional().or(z.literal("")),
  phone: z.string().trim().optional(),
  alternatePhone: z.string().trim().optional(),
  website: z.string().trim().url("Invalid website URL").optional().or(z.literal("")),
  addressLine1: z.string().trim().optional(),
  addressLine2: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  postalCode: z.string().trim().optional(),
  country: z.string().trim().length(2).optional().default("US"),
  taxId: z.string().trim().optional(),
  registrationNumber: z.string().trim().optional(),
  currency: CurrencySchema.default("USD"),
  paymentTerms: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export type SupplierInput = z.infer<typeof SupplierSchema>;

export const ProductCategorySchema = z.object({
  name: z.string().trim().min(2, "Category name must be at least 2 characters"),
  description: z.string().trim().optional(),
  parentId: z.string().nullable().optional(),
});

export type ProductCategoryInput = z.infer<typeof ProductCategorySchema>;

export const UnitOfMeasureSchema = z.object({
  code: z.string().trim().min(1, "Code is required"),
  name: z.string().trim().min(1, "Name is required"),
  symbol: z.string().trim().min(1, "Symbol is required"),
  precision: z.number().min(0).max(4).default(0),
});

export type UnitOfMeasureInput = z.infer<typeof UnitOfMeasureSchema>;

export const ProductSchema = z.object({
  sku: z.string().trim().min(1, "SKU is required"),
  name: z.string().trim().min(2, "Product name must be at least 2 characters"),
  description: z.string().trim().optional(),
  categoryId: z.string().nullable().optional(),
  unitOfMeasureId: z.string().nullable().optional(),
  barcode: z.string().trim().optional(),
  brand: z.string().trim().optional(),
  trackInventory: z.boolean().default(true),
  allowNegativeStock: z.boolean().default(false),
  reorderLevel: z.number().min(0).optional(),
  reorderQuantity: z.number().min(0).optional(),
  costPrice: z.number().min(0, "Cost price cannot be negative").default(0),
  sellingPrice: z.number().min(0, "Selling price cannot be negative").default(0),
  currency: CurrencySchema.default("USD"),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export type ProductInput = z.infer<typeof ProductSchema>;

export const ServiceSchema = z.object({
  code: z.string().trim().min(1, "Service code is required"),
  name: z.string().trim().min(2, "Service name must be at least 2 characters"),
  description: z.string().trim().optional(),
  categoryId: z.string().nullable().optional(),
  unitOfMeasureId: z.string().nullable().optional(),
  costPrice: z.number().min(0, "Cost price cannot be negative").default(0),
  sellingPrice: z.number().min(0, "Selling price cannot be negative").default(0),
  currency: CurrencySchema.default("USD"),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export type ServiceInput = z.infer<typeof ServiceSchema>;

export const WarehouseSchema = z.object({
  code: z.string().trim().min(1, "Warehouse code is required"),
  name: z.string().trim().min(2, "Warehouse name must be at least 2 characters"),
  description: z.string().trim().optional(),
  addressLine1: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  postalCode: z.string().trim().optional(),
  country: z.string().trim().length(2).optional().default("US"),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export type WarehouseInput = z.infer<typeof WarehouseSchema>;

export const StockAdjustmentSchema = z.object({
  warehouseId: z.string().min(1, "Warehouse selection is required"),
  productId: z.string().min(1, "Product selection is required"),
  adjustmentType: z.enum(["INITIAL_STOCK", "CORRECTION", "DAMAGE", "LOSS", "FOUND"]),
  quantityChange: z.number().refine((val) => val !== 0, {
    message: "Quantity change cannot be zero",
  }),
  reason: z.string().trim().min(2, "Reason is required"),
  notes: z.string().trim().optional(),
});

export type StockAdjustmentInput = z.infer<typeof StockAdjustmentSchema>;
