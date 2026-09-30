import { db } from "@/db/client";
import { CustomerPaymentRepository } from "../repositories/CustomerPaymentRepository";
import { CustomerRepository } from "../repositories/CustomerRepository";
import { SessionUser } from "@/types/auth";
import { assertTenantAccess } from "../authorization/tenant";
import { requirePermission } from "../authorization/permissions";
import { NotFoundError, ValidationError, ConflictError } from "@/lib/errors";
import { CustomerPaymentInput, CustomerPaymentAllocationInput } from "@/lib/validation/transactions";

export class CustomerPaymentService {
  static async list(
    user: SessionUser,
    options?: { customerId?: string; search?: string; skip?: number; take?: number }
  ) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "payments.read");

    return CustomerPaymentRepository.listByOrg(user.activeOrganizationId, options);
  }

  static async getById(user: SessionUser, id: string) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "payments.read");

    const payment = await CustomerPaymentRepository.findByIdAndOrg(id, user.activeOrganizationId);
    if (!payment) {
      throw new NotFoundError("Customer Payment not found");
    }
    return payment;
  }

  static async recordPayment(user: SessionUser, input: CustomerPaymentInput) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "payments.create");

    const customer = await CustomerRepository.findByIdAndOrg(input.customerId, user.activeOrganizationId);
    if (!customer) {
      throw new NotFoundError("Customer not found in your organization");
    }

    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      try {
        return await db.$transaction(async (tx) => {
          const count = await tx.customerPayment.count({ where: { organizationId: user.activeOrganizationId! } });
          const paymentNumber = `PAY-${String(count + 1 + attempts).padStart(6, "0")}`;

          const existing = await tx.customerPayment.findFirst({
            where: { paymentNumber, organizationId: user.activeOrganizationId! },
          });
          if (existing) {
            throw new Error("AUTO_NUMBER_COLLISION");
          }

          const payment = await tx.customerPayment.create({
            data: {
              organizationId: user.activeOrganizationId!,
              paymentNumber,
              customerId: input.customerId,
              paymentDate: new Date(input.paymentDate),
              amount: input.amount,
              unallocatedAmount: input.amount,
              currency: input.currency || "USD",
              paymentMethod: input.paymentMethod,
              reference: input.reference,
              notes: input.notes,
              status: "COMPLETED",
              createdById: user.id,
            },
            include: { customer: true },
          });

          await tx.auditLog.create({
            data: {
              organizationId: user.activeOrganizationId!,
              actorId: user.id,
              action: "customer_payment.created",
              entityType: "CustomerPayment",
              entityId: payment.id,
              metadata: { paymentNumber, amount: input.amount },
            },
          });

          return payment;
        });
      } catch (err: any) {
        if (err.message === "AUTO_NUMBER_COLLISION") {
          attempts++;
          continue;
        }
        throw err;
      }
    }

    throw new ConflictError("Failed to generate a unique payment number. Please try again.");
  }

  static async allocatePayment(user: SessionUser, paymentId: string, input: CustomerPaymentAllocationInput) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "payments.create");

    return db.$transaction(async (tx) => {
      // Pessimistic row locking on BOTH CustomerPayment unallocatedAmount AND SalesInvoice balanceDue
      await tx.$queryRaw`SELECT "unallocatedAmount" FROM "CustomerPayment" WHERE id = ${paymentId} AND "organizationId" = ${user.activeOrganizationId!} FOR UPDATE`;
      await tx.$queryRaw`SELECT "balanceDue" FROM "SalesInvoice" WHERE id = ${input.invoiceId} AND "organizationId" = ${user.activeOrganizationId!} FOR UPDATE`;

      const payment = await tx.customerPayment.findFirst({
        where: { id: paymentId, organizationId: user.activeOrganizationId! },
      });

      if (!payment) {
        throw new NotFoundError("Customer Payment not found");
      }

      const invoice = await tx.salesInvoice.findFirst({
        where: { id: input.invoiceId, organizationId: user.activeOrganizationId! },
      });

      if (!invoice) {
        throw new NotFoundError("Sales Invoice not found");
      }

      if (payment.customerId !== invoice.customerId) {
        throw new ValidationError("Payment and Invoice must belong to the same customer.");
      }

      if (invoice.status !== "ISSUED" && invoice.status !== "PARTIALLY_PAID") {
        throw new ValidationError(`Cannot allocate payment to invoice in status '${invoice.status}'.`);
      }

      const currentUnallocated = Number(payment.unallocatedAmount);
      const currentBalanceDue = Number(invoice.balanceDue);

      if (input.allocatedAmount > currentUnallocated) {
        throw new ValidationError(
          `Allocation amount (${input.allocatedAmount}) exceeds available unallocated payment balance (${currentUnallocated}).`
        );
      }

      if (input.allocatedAmount > currentBalanceDue) {
        throw new ValidationError(
          `Allocation amount (${input.allocatedAmount}) exceeds invoice balance due (${currentBalanceDue}).`
        );
      }

      const newUnallocated = Number((currentUnallocated - input.allocatedAmount).toFixed(2));
      const newAmountPaid = Number((Number(invoice.amountPaid) + input.allocatedAmount).toFixed(2));
      const newBalanceDue = Number((currentBalanceDue - input.allocatedAmount).toFixed(2));
      const newInvoiceStatus = newBalanceDue === 0 ? "PAID" : "PARTIALLY_PAID";

      const allocation = await tx.customerPaymentAllocation.create({
        data: {
          paymentId: payment.id,
          invoiceId: invoice.id,
          allocatedAmount: input.allocatedAmount,
        },
      });

      await tx.customerPayment.update({
        where: { id: payment.id },
        data: { unallocatedAmount: newUnallocated },
      });

      await tx.salesInvoice.update({
        where: { id: invoice.id },
        data: {
          amountPaid: newAmountPaid,
          balanceDue: newBalanceDue,
          status: newInvoiceStatus,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: user.activeOrganizationId!,
          actorId: user.id,
          action: "customer_payment.allocated",
          entityType: "CustomerPaymentAllocation",
          entityId: allocation.id,
          metadata: {
            paymentNumber: payment.paymentNumber,
            invoiceNumber: invoice.invoiceNumber,
            allocatedAmount: input.allocatedAmount,
            newBalanceDue,
            newInvoiceStatus,
          },
        },
      });

      return allocation;
    });
  }
}
