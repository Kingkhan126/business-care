import { SignJWT, jwtVerify } from "jose";

const SIGNED_URL_DURATION_SECONDS = 60 * 5; // 5 minutes

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set.");
  return new TextEncoder().encode(secret);
}

export async function createSignedDownloadToken(documentId: string): Promise<string> {
  return new SignJWT({ documentId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SIGNED_URL_DURATION_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySignedDownloadToken(token: string): Promise<{ documentId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.documentId !== "string") return null;
    return { documentId: payload.documentId };
  } catch {
    return null;
  }
}
