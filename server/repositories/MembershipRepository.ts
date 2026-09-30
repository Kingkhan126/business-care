import { db } from "@/db/client";
import { OrganizationMember, Prisma } from "@prisma/client";
import { NotFoundError } from "@/lib/errors";

export class MembershipRepository {
  static async findByOrgAndUser(
    organizationId: string,
    userId: string
  ) {
    return db.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });
  }

  static async findByIdAndOrg(
    memberId: string,
    organizationId: string
  ) {
    return db.organizationMember.findFirst({
      where: {
        id: memberId,
        organizationId,
      },
      include: {
        user: true,
        role: true,
      },
    });
  }

  static async listByOrganizationId(organizationId: string) {
    return db.organizationMember.findMany({
      where: { organizationId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            status: true,
          },
        },
        role: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  static async create(data: Prisma.OrganizationMemberCreateInput): Promise<OrganizationMember> {
    return db.organizationMember.create({ data });
  }

  static async updateRole(
    organizationId: string,
    memberId: string,
    roleId: string
  ): Promise<OrganizationMember> {
    const existing = await db.organizationMember.findFirst({
      where: {
        id: memberId,
        organizationId,
      },
    });

    if (!existing) {
      throw new NotFoundError("Member record not found in specified organization tenant");
    }

    return db.organizationMember.update({
      where: { id: memberId },
      data: { roleId },
    });
  }

  static async updateStatus(
    organizationId: string,
    memberId: string,
    status: "ACTIVE" | "INVITED" | "SUSPENDED"
  ): Promise<OrganizationMember> {
    const existing = await db.organizationMember.findFirst({
      where: {
        id: memberId,
        organizationId,
      },
    });

    if (!existing) {
      throw new NotFoundError("Member record not found in specified organization tenant");
    }

    return db.organizationMember.update({
      where: { id: memberId },
      data: { status },
    });
  }
}
