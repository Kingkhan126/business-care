"use server";

import { getCurrentSessionUser } from "@/lib/auth/session";
import { ExpenseService } from "../services/ExpenseService";
import { ExpenseApprovalService } from "../services/ExpenseApprovalService";
import { ExpensePostingService } from "../services/ExpensePostingService";
import { ExpensePaymentService } from "../services/ExpensePaymentService";
import { ExpenseCategoryService } from "../services/ExpenseCategoryService";
import {
  CreateExpenseInput,
  UpdateExpenseInput,
  RejectExpenseInput,
  PayExpenseInput,
  CreateExpenseCategoryInput,
  UpdateExpenseCategoryInput,
  CreateExpenseSchema,
  UpdateExpenseSchema,
  RejectExpenseSchema,
  PayExpenseSchema,
  CreateExpenseCategorySchema,
  UpdateExpenseCategorySchema,
} from "@/lib/validation/expense";
import { UnauthorizedError } from "@/lib/errors";

async function getRequiredUser() {
  const user = await getCurrentSessionUser();
  if (!user) {
    throw new UnauthorizedError("You must be signed in to perform this action.");
  }
  return user;
}

export async function createExpenseAction(rawInput: CreateExpenseInput) {
  const user = await getRequiredUser();
  const validated = CreateExpenseSchema.parse(rawInput);
  return ExpenseService.createExpense(user, validated);
}

export async function updateExpenseAction(id: string, rawInput: UpdateExpenseInput) {
  const user = await getRequiredUser();
  const validated = UpdateExpenseSchema.parse(rawInput);
  return ExpenseService.updateExpense(user, id, validated);
}

export async function submitExpenseAction(id: string) {
  const user = await getRequiredUser();
  return ExpenseService.submitExpense(user, id);
}

export async function approveExpenseAction(id: string) {
  const user = await getRequiredUser();
  return ExpenseApprovalService.approve(user, id);
}

export async function rejectExpenseAction(id: string, rawInput: RejectExpenseInput) {
  const user = await getRequiredUser();
  const validated = RejectExpenseSchema.parse(rawInput);
  return ExpenseApprovalService.reject(user, id, validated);
}

export async function postExpenseAction(id: string) {
  const user = await getRequiredUser();
  return ExpensePostingService.postExpense(user, id);
}

export async function payExpenseAction(id: string, rawInput: PayExpenseInput) {
  const user = await getRequiredUser();
  const validated = PayExpenseSchema.parse(rawInput);
  return ExpensePaymentService.payExpense(user, id, validated);
}

export async function voidExpenseAction(id: string, reason?: string) {
  const user = await getRequiredUser();
  return ExpensePaymentService.voidExpense(user, id, reason);
}

export async function createExpenseCategoryAction(rawInput: CreateExpenseCategoryInput) {
  const user = await getRequiredUser();
  const validated = CreateExpenseCategorySchema.parse(rawInput);
  return ExpenseCategoryService.createCategory(user, validated);
}

export async function updateExpenseCategoryAction(id: string, rawInput: UpdateExpenseCategoryInput) {
  const user = await getRequiredUser();
  const validated = UpdateExpenseCategorySchema.parse(rawInput);
  return ExpenseCategoryService.updateCategory(user, id, validated);
}

export async function deactivateExpenseCategoryAction(id: string) {
  const user = await getRequiredUser();
  return ExpenseCategoryService.deactivateCategory(user, id);
}

export async function deleteExpenseAttachmentAction(expenseId: string, attachmentId: string) {
  const user = await getRequiredUser();
  return ExpenseService.deleteAttachment(user, expenseId, attachmentId);
}
