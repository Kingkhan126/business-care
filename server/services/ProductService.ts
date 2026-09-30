import { db } from "@/db/client";
import { ProductRepository } from "../repositories/ProductRepository";
import { AuditRepository } from "../repositories/AuditRepository";
import { SessionUser } from "@/types/auth";
import { assertTenantAccess } from "../authorization/tenant";
import { requirePermission } from "../authorization/permissions";
import { NotFoundError, ValidationError, ConflictError } from "@/lib/errors";
import { ProductInput } from "@/lib/validation/master_data";
import { ProductStatus } from "@prisma/client";

export class ProductService {
  static async list(
    user: SessionUser,
    options?: { search?: string; categoryId?: string; status?: ProductStatus; skip?: number; take?: number }
  ) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "products.read");

    return ProductRepository.listByOrg(user.activeOrganizationId, options);
  }

  static async getById(user: SessionUser, id: string) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "products.read");

    const product = await ProductRepository.findByIdAndOrg(id, user.activeOrganizationId);
    if (!product) {
      throw new NotFoundError("Product not found");
    }
    return product;
  }

  static async create(user: SessionUser, input: ProductInput) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "products.create");

    return db.$transaction(async (tx) => {
      const existingSku = await tx.product.findFirst({
        where: { sku: input.sku, organizationId: user.activeOrganizationId! },
      });
      if (existingSku) {
        throw new ConflictError(`Product SKU '${input.sku}' already exists in your organization.`);
      }

      const product = await tx.product.create({
        data: {
          organizationId: user.activeOrganizationId!,
          sku: input.sku,
          name: input.name,
          description: input.description,
          categoryId: input.categoryId || null,
          unitOfMeasureId: input.unitOfMeasureId || null,
          barcode: input.barcode,
          brand: input.brand,
          trackInventory: input.trackInventory,
          allowNegativeStock: input.allowNegativeStock,
          reorderLevel: input.reorderLevel,
          reorderQuantity: input.reorderQuantity,
          costPrice: input.costPrice,
          sellingPrice: input.sellingPrice,
          currency: input.currency,
          status: input.status,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: user.activeOrganizationId!,
          actorId: user.id,
          action: "product.created",
          entityType: "Product",
          entityId: product.id,
          metadata: { sku: product.sku, name: product.name },
        },
      });

      return product;
    });
  }

  static async update(user: SessionUser, id: string, input: Partial<ProductInput>) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "products.update");

    const existing = await ProductRepository.findByIdAndOrg(id, user.activeOrganizationId);
    if (!existing) {
      throw new NotFoundError("Product not found in your organization");
    }

    return db.$transaction(async (tx) => {
      if (input.sku && input.sku !== existing.sku) {
        const duplicateSku = await tx.product.findFirst({
          where: { sku: input.sku, organizationId: user.activeOrganizationId! },
        });
        if (duplicateSku) {
          throw new ConflictError(`Product SKU '${input.sku}' is already in use by another product.`);
        }
      }

      const updated = await tx.product.update({
        where: { id },
        data: {
          ...input,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: user.activeOrganizationId!,
          actorId: user.id,
          action: "product.updated",
          entityType: "Product",
          entityId: id,
          metadata: { name: updated.name },
        },
      });

      return updated;
    });
  }

  static async updateStatus(user: SessionUser, id: string, status: ProductStatus) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "products.update");

    const existing = await ProductRepository.findByIdAndOrg(id, user.activeOrganizationId);
    if (!existing) {
      throw new NotFoundError("Product not found in your organization");
    }

    return db.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id },
        data: { status },
      });

      await tx.auditLog.create({
        data: {
          organizationId: user.activeOrganizationId!,
          actorId: user.id,
          action: status === "ACTIVE" ? "product.reactivated" : "product.deactivated",
          entityType: "Product",
          entityId: id,
        },
      });

      return updated;
    });
  }
}
