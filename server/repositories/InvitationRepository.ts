import { db } from "@/db/client";
import { Prisma, InvitationStatus } from "@prisma/client";

export class InvitationRepository {
  static async findByToken(token: string) {
    return db.organizationInvitation.findUnique({
      where: { token },
      include: {
        organization: true,
        role: true,
      },
    });
  }

  static async findByIdAndOrg(id: string, organizationId: string) {
    return db.organizationInvitation.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        role: true,
      },
    });
  }

  static async listByOrganization(organizationId: string) {
    return db.organizationInvitation.findMany({
      where: { organizationId },
      include: {
        role: {
          select: {
            id: true,
            name: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  static async create(data: Prisma.OrganizationInvitationCreateInput) {
    return db.organizationInvitation.create({ data });
  }

  static async updateStatus(
    organizationId: string,
    invitationId: string,
    status: InvitationStatus
  ) {
    const existing = await db.organizationInvitation.findFirst({
      where: { id: invitationId, organizationId },
    });

    if (!existing) {
      return null;
    }

    const extraFields: Prisma.OrganizationInvitationUpdateInput = {};
    if (status === "ACCEPTED") extraFields.acceptedAt = new Date();
    if (status === "REVOKED") extraFields.revokedAt = new Date();

    return db.organizationInvitation.update({
      where: { id: invitationId },
      data: {
        status,
        ...extraFields,
      },
    });
  }
}
