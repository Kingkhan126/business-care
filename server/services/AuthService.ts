import { UserRepository } from "../repositories/UserRepository";
import { OrganizationRepository } from "../repositories/OrganizationRepository";
import { RoleRepository } from "../repositories/RoleRepository";
import { MembershipRepository } from "../repositories/MembershipRepository";
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

    // Create User
    const user = await UserRepository.create({
      email: input.email,
      name: input.name,
      passwordHash,
      status: "ACTIVE",
      emailVerified: true,
    });

    // Create Organization
    const org = await OrganizationRepository.create({
      name: input.organizationName,
      email: input.email,
      currency: "USD",
      timezone: "UTC",
      country: "US",
    });

    // Find Owner Role
    const ownerRole = await RoleRepository.findByName("Owner");
    if (!ownerRole) {
      throw new ValidationError("System Owner role not found. Please run seed script.");
    }

    // Create Owner Membership
    await MembershipRepository.create({
      organization: { connect: { id: org.id } },
      user: { connect: { id: user.id } },
      role: { connect: { id: ownerRole.id } },
      status: "ACTIVE",
    });

    // Audit Log
    await AuditRepository.create({
      organization: { connect: { id: org.id } },
      actor: { connect: { id: user.id } },
      action: "organization.created",
      entityType: "Organization",
      entityId: org.id,
      metadata: { organizationName: org.name },
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
