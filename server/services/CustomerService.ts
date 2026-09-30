import { db } from "@/db/client";
import { CustomerRepository } from "../repositories/CustomerRepository";
import { AuditRepository } from "../repositories/AuditRepository";
import { SessionUser } from "@/types/auth";
import { assertTenantAccess } from "../authorization/tenant";
import { requirePermission } from "../authorization/permissions";
import { NotFoundError, ValidationError, ConflictError } from "@/lib/errors";
import { CustomerInput } from "@/lib/validation/master_data";
import { CustomerStatus } from "@prisma/client";

export class CustomerService {
  static async list(
    user: SessionUser,
    options?: { search?: string; status?: CustomerStatus; skip?: number; take?: number }
  ) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "customers.read");

    return CustomerRepository.listByOrg(user.activeOrganizationId, options);
  }

  static async getById(user: SessionUser, id: string) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "customers.read");

    const customer = await CustomerRepository.findByIdAndOrg(id, user.activeOrganizationId);
    if (!customer) {
      throw new NotFoundError("Customer not found");
    }
    return customer;
  }

  static async create(user: SessionUser, input: CustomerInput) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "customers.create");

    const userProvidedNumber = Boolean(input.customerNumber?.trim());
    let attempts = 0;
    const maxAttempts = 25;

    while (attempts < maxAttempts) {
      try {
        return await db.$transaction(async (tx) => {
          let customerNumber = input.customerNumber?.trim();
          if (!customerNumber) {
            if (attempts >= 15) {
              // Safe fallback guaranteeing uniqueness
              customerNumber = `CUS-${Date.now().toString().slice(-6)}${attempts}`;
            } else {
              let maxSeq = 0;
              if (typeof tx.customer?.findMany === "function") {
                const existingCustomers = await tx.customer.findMany({
                  where: {
                    organizationId: user.activeOrganizationId!,
                    customerNumber: { startsWith: "CUS-" },
                  },
                  select: { customerNumber: true },
                });
                if (Array.isArray(existingCustomers)) {
                  for (const c of existingCustomers) {
                    const match = c.customerNumber?.match(/^CUS-(\d+)$/);
                    if (match) {
                      const seq = parseInt(match[1], 10);
                      if (!isNaN(seq) && seq > maxSeq) {
                        maxSeq = seq;
                      }
                    }
                  }
                }
              }
              if (maxSeq === 0) {
                const count = await tx.customer.count({ where: { organizationId: user.activeOrganizationId! } });
                maxSeq = count;
              }
              const candidateSeq = maxSeq + 1 + attempts;
              customerNumber = `CUS-${String(candidateSeq).padStart(6, "0")}`;
            }
          }

          const existing = await tx.customer.findFirst({
            where: { customerNumber, organizationId: user.activeOrganizationId! },
          });
          if (existing) {
            if (userProvidedNumber) {
              throw new ConflictError(`Customer number '${customerNumber}' already exists in your organization.`);
            }
            throw new Error("AUTO_NUMBER_COLLISION");
          }

          const customer = await tx.customer.create({
            data: {
              organizationId: user.activeOrganizationId!,
              customerNumber,
              displayName: input.displayName,
              legalName: input.legalName,
              contactPerson: input.contactPerson,
              email: input.email,
              phone: input.phone,
              alternatePhone: input.alternatePhone,
              website: input.website,
              billingAddressLine1: input.billingAddressLine1,
              billingAddressLine2: input.billingAddressLine2,
              billingCity: input.billingCity,
              billingState: input.billingState,
              billingPostalCode: input.billingPostalCode,
              billingCountry: input.billingCountry,
              shippingAddressLine1: input.shippingAddressLine1,
              shippingAddressLine2: input.shippingAddressLine2,
              shippingCity: input.shippingCity,
              shippingState: input.shippingState,
              shippingPostalCode: input.shippingPostalCode,
              shippingCountry: input.shippingCountry,
              taxId: input.taxId,
              registrationNumber: input.registrationNumber,
              currency: input.currency,
              paymentTerms: input.paymentTerms,
              creditLimit: input.creditLimit,
              notes: input.notes,
              status: input.status,
            },
          });

          await tx.auditLog.create({
            data: {
              organizationId: user.activeOrganizationId!,
              actorId: user.id,
              action: "customer.created",
              entityType: "Customer",
              entityId: customer.id,
              metadata: { customerNumber, displayName: customer.displayName },
            },
          });

          return customer;
        });
      } catch (err: any) {
        if (err.message === "AUTO_NUMBER_COLLISION" && !userProvidedNumber) {
          attempts++;
          continue;
        }
        throw err;
      }
    }

    throw new ConflictError("Failed to generate a unique customer number after multiple attempts. Please try again.");
  }

  static async update(user: SessionUser, id: string, input: Partial<CustomerInput>) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "customers.update");

    const existing = await CustomerRepository.findByIdAndOrg(id, user.activeOrganizationId);
    if (!existing) {
      throw new NotFoundError("Customer not found in your organization");
    }

    return db.$transaction(async (tx) => {
      const updated = await tx.customer.update({
        where: { id },
        data: {
          ...input,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: user.activeOrganizationId!,
          actorId: user.id,
          action: "customer.updated",
          entityType: "Customer",
          entityId: id,
          metadata: { displayName: updated.displayName },
        },
      });

      return updated;
    });
  }

  static async updateStatus(user: SessionUser, id: string, status: CustomerStatus) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "customers.update");

    const existing = await CustomerRepository.findByIdAndOrg(id, user.activeOrganizationId);
    if (!existing) {
      throw new NotFoundError("Customer not found in your organization");
    }

    return db.$transaction(async (tx) => {
      const updated = await tx.customer.update({
        where: { id },
        data: { status },
      });

      await tx.auditLog.create({
        data: {
          organizationId: user.activeOrganizationId!,
          actorId: user.id,
          action: status === "ACTIVE" ? "customer.reactivated" : "customer.deactivated",
          entityType: "Customer",
          entityId: id,
        },
      });

      return updated;
    });
  }
}
