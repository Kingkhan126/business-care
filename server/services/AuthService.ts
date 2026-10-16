import { UserRepository } from "../repositories/UserRepository";
import { AuditRepository } from "../repositories/AuditRepository";
import { hashPassword, verifyPassword, createSessionToken } from "@/lib/auth/session";
import { ConflictError, UnauthorizedError, ValidationError } from "@/lib/errors";
import { LoginInput, RegisterInput } from "@/lib/validation/auth";

export class AuthService {
  static async login(input: LoginInput) {
    const user = await UserRepository.findByEmail(input.email);
    if (!user) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const isValidPassword = await verifyPassword(input.password, user.passwordHash);
    if (!isValidPassword) {
      throw new UnauthorizedError("Invalid email or password");
    }

    if (user.status !== "ACTIVE") {
      throw new UnauthorizedError("Account is inactive or suspended");
    }

    // Find default active organization membership
    const memberships = await db.organizationMember.findMany({
      where: { userId: user.id, status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
    });

    const activeOrganizationId = memberships.length > 0 ? memberships[0].organizationId : null;

    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      activeOrganizationId,
    });

    if (activeOrganizationId) {
      await AuditRepository.create({
        organization: { connect: { id: activeOrganizationId } },
        actor: { connect: { id: user.id } },
        action: "user.login",
        entityType: "User",
        entityId: user.id,
        metadata: { email: user.email },
      });
    }

    return { token, user, activeOrganizationId };
  }

  static async register(input: RegisterInput) {
    const existingUser = await UserRepository.findByEmail(input.email);
    if (existingUser) {
      throw new ConflictError("An account with this email address already exists");
    }

    const passwordHash = await hashPassword(input.password);

    // Commit the entire account setup together, including its audit record.
    const { user, org } = await db.$transaction(async (tx) => {
      const ownerRole = await tx.role.findFirst({
        where: { name: "Owner", organizationId: null, isSystem: true },
      });
      if (!ownerRole) {
        throw new ValidationError("System Owner role not found. Please run seed script.");
      }
      const user = await tx.user.create({
        data: { email: input.email, name: input.name, passwordHash, status: "ACTIVE", emailVerified: false },
      });
      const org = await tx.organization.create({
        data: { name: input.organizationName, email: input.email, currency: "USD", timezone: "UTC", country: "US" },
      });
      await tx.organizationMember.create({
        data: { organizationId: org.id, userId: user.id, roleId: ownerRole.id, status: "ACTIVE" },
      });
      await tx.auditLog.create({
        data: { organizationId: org.id, actorId: user.id, action: "organization.created", entityType: "Organization", entityId: org.id, metadata: { organizationName: org.name } },
      });
      return { user, org };
    });

    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      activeOrganizationId: org.id,
    });

    return { token, user, organization: org };
  }
}
import { db } from "@/db/client";
