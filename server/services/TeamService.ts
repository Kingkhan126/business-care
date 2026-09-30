import crypto from "crypto";
import { db } from "@/db/client";
import { MembershipRepository } from "../repositories/MembershipRepository";
import { InvitationRepository } from "../repositories/InvitationRepository";
import { RoleRepository } from "../repositories/RoleRepository";
import { UserRepository } from "../repositories/UserRepository";
import { AuditRepository } from "../repositories/AuditRepository";
import { SessionUser } from "@/types/auth";
import { assertTenantAccess } from "../authorization/tenant";
import { requirePermission } from "../authorization/permissions";
import { NotFoundError, ValidationError, ConflictError } from "@/lib/errors";
import { InviteMemberInput } from "@/lib/validation/organization";
import { MemberStatus, Prisma } from "@prisma/client";

export class TeamService {
  static async listMembers(user: SessionUser) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }

    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "users.view");

    return MembershipRepository.listByOrganizationId(user.activeOrganizationId);
  }

  private static async assertNotFinalOwner(
    tx: Prisma.TransactionClient,
    organizationId: string,
    targetMemberId: string,
    actionName = "modify"
  ): Promise<void> {
    const targetMember = await tx.organizationMember.findFirst({
      where: {
        id: targetMemberId,
        organizationId,
      },
      include: { role: true },
    });

    if (!targetMember) {
      throw new NotFoundError("Member record not found in this organization");
    }

    if (targetMember.role.name === "Owner" && targetMember.status === "ACTIVE") {
      const activeOwnerCount = await tx.organizationMember.count({
        where: {
          organizationId,
          status: "ACTIVE",
          role: { name: "Owner" },
        },
      });

      if (activeOwnerCount <= 1) {
        throw new ValidationError(
          `Cannot ${actionName} the final active Owner of the organization. Promote another team member to Owner first.`
        );
      }
    }
  }

  static async updateMemberStatus(user: SessionUser, memberId: string, status: MemberStatus) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }

    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "organization.members.manage");

    return db.$transaction(async (tx) => {
      if (status !== "ACTIVE") {
        await this.assertNotFinalOwner(tx, user.activeOrganizationId!, memberId, "deactivate");
      }

      const existing = await tx.organizationMember.findFirst({
        where: { id: memberId, organizationId: user.activeOrganizationId! },
      });

      if (!existing) {
        throw new NotFoundError("Member record not found in specified organization tenant");
      }

      const updated = await tx.organizationMember.update({
        where: { id: memberId },
        data: { status },
      });

      await tx.auditLog.create({
        data: {
          organizationId: user.activeOrganizationId!,
          actorId: user.id,
          action: "member.status_changed",
          entityType: "OrganizationMember",
          entityId: memberId,
          metadata: { newStatus: status },
        },
      });

      return updated;
    });
  }

  static async updateMemberRole(user: SessionUser, memberId: string, roleId: string) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }

    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "organization.members.manage");

    return db.$transaction(async (tx) => {
      const targetRole = await tx.role.findFirst({
        where: {
          id: roleId,
          OR: [{ organizationId: user.activeOrganizationId! }, { organizationId: null, isSystem: true }],
        },
      });

      if (!targetRole) {
        throw new ValidationError("Selected role does not exist or does not belong to your organization");
      }

      if (targetRole.name !== "Owner") {
        await this.assertNotFinalOwner(tx, user.activeOrganizationId!, memberId, "demote");
      }

      const existing = await tx.organizationMember.findFirst({
        where: { id: memberId, organizationId: user.activeOrganizationId! },
      });

      if (!existing) {
        throw new NotFoundError("Member record not found in specified organization tenant");
      }

      const updated = await tx.organizationMember.update({
        where: { id: memberId },
        data: { roleId },
      });

      await tx.auditLog.create({
        data: {
          organizationId: user.activeOrganizationId!,
          actorId: user.id,
          action: "member.role_updated",
          entityType: "OrganizationMember",
          entityId: memberId,
          metadata: { newRoleId: roleId, newRoleName: targetRole.name },
        },
      });

      return updated;
    });
  }

  static async removeMember(user: SessionUser, memberId: string) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }

    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "organization.members.manage");

    return db.$transaction(async (tx) => {
      await this.assertNotFinalOwner(tx, user.activeOrganizationId!, memberId, "remove");

      const targetMember = await tx.organizationMember.findFirst({
        where: { id: memberId, organizationId: user.activeOrganizationId! },
      });

      if (!targetMember) {
        throw new NotFoundError("Member not found in this organization");
      }

      await tx.organizationMember.delete({ where: { id: memberId } });

      await tx.auditLog.create({
        data: {
          organizationId: user.activeOrganizationId!,
          actorId: user.id,
          action: "member.removed",
          entityType: "OrganizationMember",
          entityId: memberId,
          metadata: { removedUserId: targetMember.userId },
        },
      });

      return { success: true };
    });
  }

  static async listInvitations(user: SessionUser) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }

    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "users.view");

    return InvitationRepository.listByOrganization(user.activeOrganizationId);
  }

  static async createInvitation(user: SessionUser, input: InviteMemberInput) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }

    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "organization.members.manage");

    const targetRole = await RoleRepository.findByIdAndOrg(input.roleId, user.activeOrganizationId);
    if (!targetRole) {
      throw new ValidationError("Selected role does not exist or does not belong to your organization");
    }

    const existingUser = await UserRepository.findByEmail(input.email);
    if (existingUser) {
      const existingMembership = await MembershipRepository.findByOrgAndUser(
        user.activeOrganizationId,
        existingUser.id
      );
      if (existingMembership) {
        throw new ConflictError("User is already an active member of this organization");
      }
    }

    // Generate 256-bit entropy raw token and store SHA-256 hash in database
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await InvitationRepository.create({
      organization: { connect: { id: user.activeOrganizationId } },
      role: { connect: { id: input.roleId } },
      createdBy: { connect: { id: user.id } },
      email: input.email.toLowerCase().trim(),
      token: tokenHash,
      expiresAt,
      status: "PENDING",
    });

    await AuditRepository.create({
      organization: { connect: { id: user.activeOrganizationId } },
      actor: { connect: { id: user.id } },
      action: "invitation.created",
      entityType: "OrganizationInvitation",
      entityId: invitation.id,
      metadata: { invitedEmail: input.email, roleId: input.roleId },
    });

    return {
      ...invitation,
      token: rawToken, // Return raw token to caller for link generation
    };
  }

  static async revokeInvitation(user: SessionUser, invitationId: string) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }

    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "organization.members.manage");

    const updated = await InvitationRepository.updateStatus(
      user.activeOrganizationId,
      invitationId,
      "REVOKED"
    );

    if (!updated) {
      throw new NotFoundError("Invitation record not found in your organization");
    }

    await AuditRepository.create({
      organization: { connect: { id: user.activeOrganizationId } },
      actor: { connect: { id: user.id } },
      action: "invitation.revoked",
      entityType: "OrganizationInvitation",
      entityId: invitationId,
      metadata: { revokedEmail: updated.email },
    });

    return updated;
  }

  static async acceptInvitation(user: SessionUser, token: string) {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const invitation = await InvitationRepository.findByToken(tokenHash);
    if (!invitation) {
      throw new NotFoundError("Invalid or expired invitation token");
    }

    if (invitation.status !== "PENDING") {
      throw new ValidationError(`Invitation is no longer pending (Status: ${invitation.status})`);
    }

    if (new Date() > new Date(invitation.expiresAt)) {
      await db.organizationInvitation.update({
        where: { id: invitation.id },
        data: { status: "EXPIRED" },
      });
      throw new ValidationError("Invitation link has expired");
    }

    if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
      throw new ValidationError(
        `This invitation was issued to '${invitation.email}', but you are signed in as '${user.email}'.`
      );
    }

    return db.$transaction(async (tx) => {
      // Check for existing membership
      const existingMembership = await tx.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: invitation.organizationId,
            userId: user.id,
          },
        },
      });

      if (existingMembership) {
        if (existingMembership.status === "ACTIVE") {
          throw new ConflictError("You are already an active member of this organization.");
        }
        // Reactivate existing membership with invited role
        const updatedMem = await tx.organizationMember.update({
          where: { id: existingMembership.id },
          data: { status: "ACTIVE", roleId: invitation.roleId },
        });

        await tx.organizationInvitation.update({
          where: { id: invitation.id },
          data: { status: "ACCEPTED", acceptedAt: new Date() },
        });

        await tx.auditLog.create({
          data: {
            organizationId: invitation.organizationId,
            actorId: user.id,
            action: "invitation.accepted",
            entityType: "OrganizationInvitation",
            entityId: invitation.id,
            metadata: { acceptedByUserId: user.id },
          },
        });

        return updatedMem;
      }

      // Add new membership atomically
      const membership = await tx.organizationMember.create({
        data: {
          organizationId: invitation.organizationId,
          userId: user.id,
          roleId: invitation.roleId,
          status: "ACTIVE",
        },
      });

      await tx.organizationInvitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          organizationId: invitation.organizationId,
          actorId: user.id,
          action: "invitation.accepted",
          entityType: "OrganizationInvitation",
          entityId: invitation.id,
          metadata: { acceptedByUserId: user.id },
        },
      });

      return membership;
    });
  }
}
