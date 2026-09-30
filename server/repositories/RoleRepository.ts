import { db } from "@/db/client";
import { Role } from "@prisma/client";

export class RoleRepository {
  static async listAvailableRolesForOrg(organizationId: string): Promise<Role[]> {
    return db.role.findMany({
      where: {
        OR: [
          { organizationId: null, isSystem: true },
          { organizationId },
        ],
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });
  }

  static async findByName(name: string, organizationId?: string): Promise<Role | null> {
    return db.role.findFirst({
      where: {
        name,
        OR: [
          { organizationId: null },
          { organizationId },
        ],
      },
    });
  }

  static async findByIdAndOrg(roleId: string, organizationId: string): Promise<Role | null> {
    return db.role.findFirst({
      where: {
        id: roleId,
        OR: [
          { organizationId: null, isSystem: true },
          { organizationId },
        ],
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });
  }
}
