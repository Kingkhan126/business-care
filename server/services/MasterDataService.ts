import { db } from "@/db/client";
import { CategoryRepository } from "../repositories/CategoryRepository";
import { UnitOfMeasureRepository } from "../repositories/UnitOfMeasureRepository";
import { WarehouseRepository } from "../repositories/WarehouseRepository";
import { AuditRepository } from "../repositories/AuditRepository";
import { SessionUser } from "@/types/auth";
import { assertTenantAccess } from "../authorization/tenant";
import { requirePermission } from "../authorization/permissions";
import { NotFoundError, ValidationError, ConflictError } from "@/lib/errors";
import { ProductCategoryInput, UnitOfMeasureInput, WarehouseInput } from "@/lib/validation/master_data";

export class MasterDataService {
  // --------------------------------------------------------------------------
  // PRODUCT CATEGORIES
  // --------------------------------------------------------------------------
  static async listCategories(user: SessionUser) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "products.read");

    return CategoryRepository.listByOrg(user.activeOrganizationId);
  }

  static async createCategory(user: SessionUser, input: ProductCategoryInput) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "products.create");

    const existing = await CategoryRepository.findByNameAndOrg(input.name, user.activeOrganizationId);
    if (existing) {
      throw new ConflictError(`A category named '${input.name}' already exists in your organization.`);
    }

    if (input.parentId) {
      const parent = await CategoryRepository.findByIdAndOrg(input.parentId, user.activeOrganizationId);
      if (!parent) {
        throw new NotFoundError("Selected parent category not found in your organization.");
      }
    }

    return db.$transaction(async (tx) => {
      const category = await tx.productCategory.create({
        data: {
          organizationId: user.activeOrganizationId!,
          name: input.name,
          description: input.description,
          parentId: input.parentId || null,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: user.activeOrganizationId!,
          actorId: user.id,
          action: "category.created",
          entityType: "ProductCategory",
          entityId: category.id,
          metadata: { name: category.name },
        },
      });

      return category;
    });
  }

  static async updateCategory(user: SessionUser, id: string, input: Partial<ProductCategoryInput>) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "products.update");

    const existing = await CategoryRepository.findByIdAndOrg(id, user.activeOrganizationId);
    if (!existing) {
      throw new NotFoundError("Category not found in your organization.");
    }

    if (input.parentId) {
      if (input.parentId === id) {
        throw new ValidationError("A category cannot be set as its own parent.");
      }

      // Check for recursive circular loop dependency
      let currentParentId: string | null = input.parentId;
      let depth = 0;
      const maxDepth = 50;

      while (currentParentId && depth < maxDepth) {
        if (currentParentId === id) {
          throw new ValidationError("Cannot set category parent: would create a circular category hierarchy dependency loop.");
        }
        const parentCategory = await CategoryRepository.findByIdAndOrg(currentParentId, user.activeOrganizationId);
        currentParentId = parentCategory?.parentId || null;
        depth++;
      }
    }

    return db.$transaction(async (tx) => {
      const updated = await tx.productCategory.update({
        where: { id },
        data: {
          ...input,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: user.activeOrganizationId!,
          actorId: user.id,
          action: "category.updated",
          entityType: "ProductCategory",
          entityId: id,
          metadata: { name: updated.name },
        },
      });

      return updated;
    });
  }

  // --------------------------------------------------------------------------
  // UNITS OF MEASURE
  // --------------------------------------------------------------------------
  static async listUnitsOfMeasure(user: SessionUser) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "products.read");

    return UnitOfMeasureRepository.listAvailable(user.activeOrganizationId);
  }

  static async createUnitOfMeasure(user: SessionUser, input: UnitOfMeasureInput) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "products.create");

    return db.$transaction(async (tx) => {
      const unit = await tx.unitOfMeasure.create({
        data: {
          organizationId: user.activeOrganizationId!,
          code: input.code.toLowerCase().trim(),
          name: input.name,
          symbol: input.symbol,
          precision: input.precision,
          isSystem: false,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: user.activeOrganizationId!,
          actorId: user.id,
          action: "unit_of_measure.created",
          entityType: "UnitOfMeasure",
          entityId: unit.id,
          metadata: { name: unit.name, code: unit.code },
        },
      });

      return unit;
    });
  }

  // --------------------------------------------------------------------------
  // WAREHOUSES
  // --------------------------------------------------------------------------
  static async listWarehouses(user: SessionUser) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "inventory.read");

    return WarehouseRepository.listByOrg(user.activeOrganizationId);
  }

  static async createWarehouse(user: SessionUser, input: WarehouseInput) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "inventory.update");

    const existingCode = await WarehouseRepository.findByCodeAndOrg(input.code, user.activeOrganizationId);
    if (existingCode) {
      throw new ConflictError(`Warehouse code '${input.code}' already exists in your organization.`);
    }

    return db.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.warehouse.updateMany({
          where: { organizationId: user.activeOrganizationId!, isDefault: true },
          data: { isDefault: false },
        });
      }

      // If this is the first warehouse created, make it default automatically
      const count = await tx.warehouse.count({ where: { organizationId: user.activeOrganizationId! } });
      const isDefault = input.isDefault || count === 0;

      const warehouse = await tx.warehouse.create({
        data: {
          organizationId: user.activeOrganizationId!,
          code: input.code,
          name: input.name,
          description: input.description,
          addressLine1: input.addressLine1,
          city: input.city,
          state: input.state,
          postalCode: input.postalCode,
          country: input.country,
          isDefault,
          isActive: input.isActive,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: user.activeOrganizationId!,
          actorId: user.id,
          action: "warehouse.created",
          entityType: "Warehouse",
          entityId: warehouse.id,
          metadata: { code: warehouse.code, name: warehouse.name },
        },
      });

      return warehouse;
    });
  }

  static async updateWarehouse(user: SessionUser, id: string, input: Partial<WarehouseInput>) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "inventory.update");

    const existing = await WarehouseRepository.findByIdAndOrg(id, user.activeOrganizationId);
    if (!existing) {
      throw new NotFoundError("Warehouse not found in your organization.");
    }

    return db.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.warehouse.updateMany({
          where: { organizationId: user.activeOrganizationId!, isDefault: true },
          data: { isDefault: false },
        });
      }

      const updated = await tx.warehouse.update({
        where: { id },
        data: {
          ...input,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: user.activeOrganizationId!,
          actorId: user.id,
          action: "warehouse.updated",
          entityType: "Warehouse",
          entityId: id,
          metadata: { name: updated.name },
        },
      });

      return updated;
    });
  }
}
