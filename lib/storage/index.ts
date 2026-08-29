import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

/**
 * Storage interface. This local-disk implementation is for development only
 * — swap this file for an S3/GCS-backed implementation in production without
 * touching any caller, since callers only depend on this interface.
 */
export interface ObjectStorage {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

const STORAGE_ROOT = path.join(process.cwd(), "storage", "uploads");

class LocalDiskStorage implements ObjectStorage {
  async put(key: string, data: Buffer): Promise<void> {
    const fullPath = path.join(STORAGE_ROOT, key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, data);
  }

  async get(key: string): Promise<Buffer> {
    return fs.readFile(path.join(STORAGE_ROOT, key));
  }

  async delete(key: string): Promise<void> {
    await fs.unlink(path.join(STORAGE_ROOT, key)).catch(() => undefined);
  }
}

export const storage: ObjectStorage = new LocalDiskStorage();

/** Generates a random, non-guessable storage key. Never derived from the
 * original filename, so a raw path can never leak the applicant's document
 * name or be walked/guessed by an attacker. */
export function generateStorageKey(applicationId: string, extension: string): string {
  const random = crypto.randomBytes(16).toString("hex");
  return `${applicationId}/${random}${extension}`;
}
