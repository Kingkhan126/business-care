import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Password policy enforced server-side (never trust client-side checks alone).
 * At least 10 chars, one letter, one number. Intentionally avoids requiring
 * exotic special characters, which pushes users toward weak patterns like
 * "Password1!".
 */
export function isPasswordStrong(plain: string): boolean {
  return plain.length >= 10 && /[A-Za-z]/.test(plain) && /[0-9]/.test(plain);
}
