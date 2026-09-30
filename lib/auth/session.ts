import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { JWTPayload, SessionUser } from "@/types/auth";
import { db } from "@/db/client";

const AUTH_COOKIE_NAME = "auth_session";

export function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "FATAL SECURITY CONFIGURATION ERROR: AUTH_SECRET environment variable must be defined in production."
      );
    }
    return new TextEncoder().encode(
      "default_dev_secret_must_be_changed_in_prod_32chars!"
    );
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(payload: JWTPayload): Promise<string> {
  const key = getSecretKey();
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key);
}

export async function verifySessionToken(token: string): Promise<JWTPayload | null> {
  try {
    const key = getSecretKey();
    const verified = await jwtVerify(token, key);
    return verified.payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getSessionTokenFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(AUTH_COOKIE_NAME);
  return cookie?.value || null;
}

export async function getCurrentSessionUser(): Promise<SessionUser | null> {
  const token = await getSessionTokenFromCookie();
  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload || !payload.userId) return null;

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    include: {
      memberships: {
        where: { status: "ACTIVE" },
        include: {
          organization: true,
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
      },
    },
  });

  if (!user || user.status !== "ACTIVE") return null;

  // Select active organization membership
  let activeMembership = user.memberships.find(
    (m) => m.organizationId === payload.activeOrganizationId
  );

  // Fallback to first membership if unspecified or invalid
  if (!activeMembership && user.memberships.length > 0) {
    activeMembership = user.memberships[0];
  }

  const permissions = activeMembership
    ? activeMembership.role.permissions.map((rp) => rp.permission.code)
    : [];

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    activeOrganizationId: activeMembership?.organizationId || null,
    roleId: activeMembership?.roleId || null,
    roleName: activeMembership?.role.name || null,
    permissions,
  };
}
