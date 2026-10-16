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
  if (process.env.NODE_ENV === "production" && secret.length < 32) {
    throw new Error("AUTH_SECRET must contain at least 32 characters in production.");
  }
  return new TextEncoder().encode(secret);
}
