import { db } from "@/db/client";
import { Organization, Prisma } from "@prisma/client";

export class OrganizationRepository {
  static async findById(id: string): Promise<Organization | null> {
    return db.organization.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: true,
            role: true,
          },
        },
      },
    });
  }

  static async create(data: Prisma.OrganizationCreateInput): Promise<Organization> {
    return db.organization.create({ data });
  }

  static async update(id: string, data: Prisma.OrganizationUpdateInput): Promise<Organization> {
    return db.organization.update({
      where: { id },
      data,
    });
  }
}
