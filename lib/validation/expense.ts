import { z } from "zod";
import { ExpenseType, ExpenseStatus, ExpensePaymentType } from "@prisma/client";

export const CreateExpenseCategorySchema = z.object({
  name: z.string().min(1, "Category name is required").max(100),
  code: z
    .string()
    .min(1, "Category code is required")
    .max(30)
    .regex(/^[A-Z0-9_-]+$/, "Code must contain only uppercase alphanumeric characters, dashes, or underscores"),
  description: z.string().max(500).optional(),
  linkedExpenseAccountId: z.string().cuid().optional().nullable(),
  taxRate: z.number().min(0).max(100).default(0.0),
  isActive: z.boolean().default(true),
});

export const UpdateExpenseCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  linkedExpenseAccountId: z.string().cuid().optional().nullable(),
  taxRate: z.number().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
});

export const ExpenseLineInputSchema = z.object({
  categoryId: z.string().cuid().optional().nullable(),
  description: z.string().min(1, "Line description is required").max(500),
  quantity: z.number().positive("Quantity must be greater than 0").default(1),
  unitPrice: z.number().min(0, "Unit price cannot be negative"),
  taxRate: z.number().min(0).max(100).default(0),
  notes: z.string().max(500).optional().nullable(),
});

export const CreateExpenseSchema = z
  .object({
    expenseType: z.nativeEnum(ExpenseType).default(ExpenseType.DIRECT_BUSINESS),
    paymentType: z.nativeEnum(ExpensePaymentType).default(ExpensePaymentType.PAID_IMMEDIATELY),
    expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Valid ISO date required (YYYY-MM-DD)"),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Valid ISO date required (YYYY-MM-DD)").optional().nullable(),
    description: z.string().min(1, "Description is required").max(500),
    notes: z.string().max(2000).optional().nullable(),
    currency: z.string().length(3).default("USD"),
    claimantId: z.string().cuid().optional().nullable(),
    supplierId: z.string().cuid().optional().nullable(),
    categoryId: z.string().cuid().optional().nullable(),
    bankAccountId: z.string().cuid().optional().nullable(),
    lines: z.array(ExpenseLineInputSchema).min(1, "At least one expense line is required"),
  })
  .refine(
    (data) => {
      // Employee claims must specify a claimant
      if (data.expenseType === ExpenseType.EMPLOYEE_CLAIM && !data.claimantId) {
        return false;
      }
      return true;
    },
    {
      message: "Claimant is required for employee expense claims",
      path: ["claimantId"],
    }
  )
  .refine(
    (data) => {
      // Immediate direct payment requires a bank account
      if (
        data.expenseType === ExpenseType.DIRECT_BUSINESS &&
        data.paymentType === ExpensePaymentType.PAID_IMMEDIATELY &&
        !data.bankAccountId
      ) {
        return false;
      }
      return true;
    },
    {
      message: "Bank account is required for immediate business expenses",
      path: ["bankAccountId"],
    }
  );

export const UpdateExpenseSchema = z.object({
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional().nullable(),
  description: z.string().min(1).max(500).optional(),
  notes: z.string().max(2000).optional().nullable(),
  currency: z.string().length(3).optional(),
  supplierId: z.string().cuid().optional().nullable(),
  categoryId: z.string().cuid().optional().nullable(),
  bankAccountId: z.string().cuid().optional().nullable(),
  lines: z.array(ExpenseLineInputSchema).min(1).optional(),
});

export const RejectExpenseSchema = z.object({
  reason: z.string().min(1, "Rejection reason is required").max(1000),
});

export const PayExpenseSchema = z.object({
  bankAccountId: z.string().cuid("Bank account ID is required"),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
  reference: z.string().max(100).optional(),
});

export const ExpenseQuerySchema = z.object({
  status: z.nativeEnum(ExpenseStatus).optional(),
  expenseType: z.nativeEnum(ExpenseType).optional(),
  paymentType: z.nativeEnum(ExpensePaymentType).optional(),
  claimantId: z.string().optional(),
  supplierId: z.string().optional(),
  categoryId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
  skip: z.number().int().min(0).default(0),
  take: z.number().int().min(1).max(100).default(50),
});

export type CreateExpenseCategoryInput = z.input<typeof CreateExpenseCategorySchema>;
export type UpdateExpenseCategoryInput = z.input<typeof UpdateExpenseCategorySchema>;
export type ExpenseLineInput = z.input<typeof ExpenseLineInputSchema>;
export type CreateExpenseInput = z.input<typeof CreateExpenseSchema>;
export type UpdateExpenseInput = z.input<typeof UpdateExpenseSchema>;
export type RejectExpenseInput = z.input<typeof RejectExpenseSchema>;
export type PayExpenseInput = z.input<typeof PayExpenseSchema>;
export type ExpenseQueryInput = z.input<typeof ExpenseQuerySchema>;
