import { db } from "@/db/client";
import { VendorPaymentRepository } from "../repositories/VendorPaymentRepository";
import { SupplierRepository } from "../repositories/SupplierRepository";
import { SessionUser } from "@/types/auth";
import { assertTenantAccess } from "../authorization/tenant";
import { requirePermission } from "../authorization/permissions";
import { NotFoundError, ValidationError, ConflictError } from "@/lib/errors";
import { VendorPaymentInput, VendorPaymentAllocationInput } from "@/lib/validation/transactions";

export class VendorPaymentService {
  static async list(
    user: SessionUser,
    options?: { supplierId?: string; search?: string; skip?: number; take?: number }
  ) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "purchases.read");

    return VendorPaymentRepository.listByOrg(user.activeOrganizationId, options);
  }

  static async getById(user: SessionUser, id: string) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "purchases.read");

    const payment = await VendorPaymentRepository.findByIdAndOrg(id, user.activeOrganizationId);
    if (!payment) {
      throw new NotFoundError("Vendor Payment not found");
    }
    return payment;
  }

  static async recordPayment(user: SessionUser, input: VendorPaymentInput) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "purchases.create");

    const supplier = await SupplierRepository.findByIdAndOrg(input.supplierId, user.activeOrganizationId);
    if (!supplier) {
      throw new NotFoundError("Supplier not found in your organization");
    }

    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      try {
        return await db.$transaction(async (tx) => {
          const count = await tx.vendorPayment.count({ where: { organizationId: user.activeOrganizationId! } });
          const paymentNumber = `VPAY-${String(count + 1 + attempts).padStart(6, "0")}`;

          const existing = await tx.vendorPayment.findFirst({
            where: { paymentNumber, organizationId: user.activeOrganizationId! },
          });
          if (existing) {
            throw new Error("AUTO_NUMBER_COLLISION");
          }

          const payment = await tx.vendorPayment.create({
            data: {
              organizationId: user.activeOrganizationId!,
              paymentNumber,
              supplierId: input.supplierId,
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
            include: { supplier: true },
          });

          await tx.auditLog.create({
            data: {
              organizationId: user.activeOrganizationId!,
              actorId: user.id,
              action: "vendor_payment.created",
              entityType: "VendorPayment",
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

    throw new ConflictError("Failed to generate a unique vendor payment number. Please try again.");
  }

  static async allocatePayment(user: SessionUser, paymentId: string, input: VendorPaymentAllocationInput) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "purchases.create");

    return db.$transaction(async (tx) => {
      // Row-level pessimistic locking on BOTH VendorPayment unallocatedAmount AND VendorBill balanceDue
      await tx.$queryRaw`SELECT "unallocatedAmount" FROM "VendorPayment" WHERE id = ${paymentId} AND "organizationId" = ${user.activeOrganizationId!} FOR UPDATE`;
      await tx.$queryRaw`SELECT "balanceDue" FROM "VendorBill" WHERE id = ${input.billId} AND "organizationId" = ${user.activeOrganizationId!} FOR UPDATE`;

      const payment = await tx.vendorPayment.findFirst({
        where: { id: paymentId, organizationId: user.activeOrganizationId! },
      });

      if (!payment) {
        throw new NotFoundError("Vendor Payment not found");
      }

      const bill = await tx.vendorBill.findFirst({
        where: { id: input.billId, organizationId: user.activeOrganizationId! },
      });

      if (!bill) {
        throw new NotFoundError("Vendor Bill not found");
      }

      if (payment.supplierId !== bill.supplierId) {
        throw new ValidationError("Payment and Bill must belong to the same supplier.");
      }

      if (bill.status !== "RECEIVED" && bill.status !== "PARTIALLY_PAID") {
        throw new ValidationError(`Cannot allocate payment to bill in status '${bill.status}'.`);
      }

      const currentUnallocated = Number(payment.unallocatedAmount);
      const currentBalanceDue = Number(bill.balanceDue);

      if (input.allocatedAmount > currentUnallocated) {
        throw new ValidationError(
          `Allocation amount (${input.allocatedAmount}) exceeds available unallocated payment balance (${currentUnallocated}).`
        );
      }

      if (input.allocatedAmount > currentBalanceDue) {
        throw new ValidationError(
          `Allocation amount (${input.allocatedAmount}) exceeds bill balance due (${currentBalanceDue}).`
        );
      }

      const newUnallocated = Number((currentUnallocated - input.allocatedAmount).toFixed(2));
      const newAmountPaid = Number((Number(bill.amountPaid) + input.allocatedAmount).toFixed(2));
      const newBalanceDue = Number((currentBalanceDue - input.allocatedAmount).toFixed(2));
      const newBillStatus = newBalanceDue === 0 ? "PAID" : "PARTIALLY_PAID";

      const allocation = await tx.vendorPaymentAllocation.create({
        data: {
          paymentId: payment.id,
          billId: bill.id,
          allocatedAmount: input.allocatedAmount,
        },
      });

      await tx.vendorPayment.update({
        where: { id: payment.id },
        data: { unallocatedAmount: newUnallocated },
      });

      await tx.vendorBill.update({
        where: { id: bill.id },
        data: {
          amountPaid: newAmountPaid,
          balanceDue: newBalanceDue,
          status: newBillStatus,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: user.activeOrganizationId!,
          actorId: user.id,
          action: "vendor_payment.allocated",
          entityType: "VendorPaymentAllocation",
          entityId: allocation.id,
          metadata: {
            paymentNumber: payment.paymentNumber,
            billNumber: bill.billNumber,
            allocatedAmount: input.allocatedAmount,
            newBalanceDue,
            newBillStatus,
          },
        },
      });

      return allocation;
    });
  }
}
