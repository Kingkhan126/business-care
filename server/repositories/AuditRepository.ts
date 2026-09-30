import { db } from "@/db/client";
import { Prisma } from "@prisma/client";

export class AuditRepository {
  static async create(data: Prisma.AuditLogCreateInput) {
    return db.auditLog.create({ data });
  }

  static async listByOrganization(organizationId: string, limit = 50) {
    return db.auditLog.findMany({
      where: { organizationId },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }
}
