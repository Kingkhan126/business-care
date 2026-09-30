import { db } from "@/db/client";
import { Prisma } from "@prisma/client";

export class UnitOfMeasureRepository {
  static async findByIdAndOrg(id: string, organizationId: string) {
    return db.unitOfMeasure.findFirst({
      where: {
        id,
        OR: [{ organizationId }, { organizationId: null, isSystem: true }],
      },
    });
  }

  static async listAvailable(organizationId: string) {
    return db.unitOfMeasure.findMany({
      where: {
        OR: [{ organizationId }, { organizationId: null, isSystem: true }],
      },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    });
  }

  static async create(data: Prisma.UnitOfMeasureCreateInput) {
    return db.unitOfMeasure.create({ data });
  }
}
