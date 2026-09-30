import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ValidationError } from "../errors";

export interface StorageFile {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

export interface IStorageService {
  uploadLogo(organizationId: string, file: StorageFile): Promise<string>;
  deleteLogo(organizationId: string): Promise<void>;
  uploadExpenseAttachment(
    organizationId: string,
    expenseId: string,
    file: StorageFile
  ): Promise<{ storagePath: string; hash: string }>;
  deleteExpenseAttachment(
    organizationId: string,
    expenseId: string,
    storagePath: string
  ): Promise<void>;
  getSignedDownloadUrl?(
    organizationId: string,
    storagePath: string,
    expiresInSeconds?: number
  ): Promise<string>;
}

export const ALLOWED_LOGO_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
];

export const MAX_LOGO_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB limit

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10MB limit

export const DISALLOWED_EXTENSIONS = [
  ".exe", ".bat", ".cmd", ".sh", ".bin", ".msi", ".com", ".scr",
  ".vbs", ".js", ".mjs", ".jar", ".ps1", ".svg", ".php", ".py",
];

export function validateAttachmentMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 4) return false;

  // Reject executable headers immediately
  // MZ header (DOS/Windows executables)
  if (buffer[0] === 0x4d && buffer[1] === 0x5a) return false;
  // ELF header (Linux executables)
  if (buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46) return false;

  if (mimeType === "application/pdf") {
    // PDF magic bytes: %PDF (25 50 44 46)
    return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
  }
  if (mimeType === "image/png") {
    // PNG magic bytes: 89 50 4E 47
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  }
  if (mimeType === "image/jpeg") {
    // JPEG magic bytes: FF D8 FF
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === "image/webp") {
    // WEBP contains "RIFF" and "WEBP"
    const header = buffer.toString("utf8", 0, 12);
    return header.startsWith("RIFF") && header.includes("WEBP");
  }

  return false;
}

export function validateImageMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 4) return false;

  if (mimeType === "image/png") {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  }
  if (mimeType === "image/jpeg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === "image/webp") {
    const header = buffer.toString("utf8", 0, 12);
    return header.startsWith("RIFF") && header.includes("WEBP");
  }
  if (mimeType === "image/svg+xml") {
    const content = buffer.toString("utf8", 0, 100).toLowerCase();
    return content.includes("<svg") || content.includes("<?xml");
  }

  return false;
}

export function isSvgContentSafe(buffer: Buffer): boolean {
  const content = buffer.toString("utf8").toLowerCase();
  const dangerousPatterns = [
    /<script\b/i,
    /on\w+\s*=/i,
    /javascript\s*:/i,
    /<foreignobject\b/i,
    /<iframe\b/i,
    /<embed\b/i,
    /<object\b/i,
    /<use\b/i,
    /<import\b/i,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(content)) {
      return false;
    }
  }

  return true;
}

export class LocalDiskStorageService implements IStorageService {
  private logosDir: string;
  private expensesDir: string;

  constructor() {
    this.logosDir = path.join(process.cwd(), "public", "uploads", "logos");
    this.expensesDir = path.join(process.cwd(), "public", "uploads", "expenses");
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch {
      // Ignore if directory exists
    }
  }

  public async uploadLogo(organizationId: string, file: StorageFile): Promise<string> {
    if (file.sizeBytes > MAX_LOGO_FILE_SIZE_BYTES) {
      throw new ValidationError("Logo image size exceeds 2MB limit.");
    }

    if (!ALLOWED_LOGO_MIME_TYPES.includes(file.mimeType)) {
      throw new ValidationError("Invalid image format. Allowed formats: PNG, JPEG, WEBP, SVG.");
    }

    if (!validateImageMagicBytes(file.buffer, file.mimeType)) {
      throw new ValidationError("File payload header does not match expected image magic bytes.");
    }

    if (file.mimeType === "image/svg+xml" && !isSvgContentSafe(file.buffer)) {
      throw new ValidationError("SVG image contains unsafe elements, scripts, or embedded event handlers.");
    }

    const safeOrgId = path.basename(organizationId).replace(/[^a-zA-Z0-9_-]/g, "_");
    const tenantDir = path.join(this.logosDir, safeOrgId);
    await this.ensureDirectoryExists(tenantDir);

    const rawExt = path.extname(file.filename).toLowerCase();
    const allowedExts = [".png", ".jpg", ".jpeg", ".webp", ".svg"];
    const ext = allowedExts.includes(rawExt) ? rawExt : ".png";
    const targetFilename = `logo${ext}`;
    const targetPath = path.join(tenantDir, targetFilename);

    await fs.writeFile(targetPath, file.buffer);

    return `/uploads/logos/${safeOrgId}/${targetFilename}?v=${Date.now()}`;
  }

  public async deleteLogo(organizationId: string): Promise<void> {
    const safeOrgId = path.basename(organizationId).replace(/[^a-zA-Z0-9_-]/g, "_");
    const tenantDir = path.join(this.logosDir, safeOrgId);
    try {
      const files = await fs.readdir(tenantDir);
      for (const file of files) {
        await fs.unlink(path.join(tenantDir, file));
      }
    } catch {
      // Directory or file doesn't exist
    }
  }

  public async uploadExpenseAttachment(
    organizationId: string,
    expenseId: string,
    file: StorageFile
  ): Promise<{ storagePath: string; hash: string }> {
    if (file.sizeBytes > MAX_ATTACHMENT_SIZE_BYTES) {
      throw new ValidationError("Attachment file size exceeds maximum 10MB limit.");
    }

    const ext = path.extname(file.filename).toLowerCase();
    if (DISALLOWED_EXTENSIONS.includes(ext)) {
      throw new ValidationError(`Files with extension '${ext}' are strictly prohibited for expense attachments.`);
    }

    if (!ALLOWED_ATTACHMENT_MIME_TYPES.includes(file.mimeType)) {
      throw new ValidationError(
        "Invalid file format. Allowed formats: PDF, JPEG, PNG, WEBP. SVG and executables are rejected."
      );
    }

    if (!validateAttachmentMagicBytes(file.buffer, file.mimeType)) {
      throw new ValidationError(
        "File payload header does not match expected document/image magic bytes."
      );
    }

    // Path traversal defense: sanitize directory elements
    const safeOrgId = path.basename(organizationId).replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeExpenseId = path.basename(expenseId).replace(/[^a-zA-Z0-9_-]/g, "_");
    const tenantExpenseDir = path.join(this.expensesDir, safeOrgId, safeExpenseId);
    await this.ensureDirectoryExists(tenantExpenseDir);

    // Sanitize filename and create unique timestamped file
    const sanitizedBase = path.basename(file.filename).replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniquePrefix = crypto.randomBytes(8).toString("hex");
    const uniqueFilename = `${uniquePrefix}_${sanitizedBase}`;
    const targetPath = path.join(tenantExpenseDir, uniqueFilename);

    await fs.writeFile(targetPath, file.buffer);

    // Compute cryptographic SHA-256 hash for integrity
    const hash = crypto.createHash("sha256").update(file.buffer).digest("hex");
    const storagePath = `/uploads/expenses/${safeOrgId}/${safeExpenseId}/${uniqueFilename}`;

    return { storagePath, hash };
  }

  public async deleteExpenseAttachment(
    organizationId: string,
    expenseId: string,
    storagePath: string
  ): Promise<void> {
    const safeOrgId = path.basename(organizationId).replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeExpenseId = path.basename(expenseId).replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeFilename = path.basename(storagePath);

    const fullPath = path.join(this.expensesDir, safeOrgId, safeExpenseId, safeFilename);

    try {
      await fs.unlink(fullPath);
    } catch {
      // Ignore if file doesn't exist on disk
    }
  }

  public async getSignedDownloadUrl(
    _organizationId: string,
    storagePath: string
  ): Promise<string> {
    return storagePath;
  }
}

export class S3StorageService implements IStorageService {
  private client: S3Client;
  private bucket: string;

  constructor(options?: {
    bucket?: string;
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    endpoint?: string;
  }) {
    this.bucket = options?.bucket || process.env.S3_BUCKET || "";
    const region = options?.region || process.env.S3_REGION || "auto";
    const accessKeyId = options?.accessKeyId || process.env.S3_ACCESS_KEY_ID || "";
    const secretAccessKey = options?.secretAccessKey || process.env.S3_SECRET_ACCESS_KEY || "";
    const endpoint = options?.endpoint || process.env.S3_ENDPOINT || undefined;

    if (!this.bucket || !accessKeyId || !secretAccessKey) {
      throw new Error(
        "S3StorageService requires S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY environment variables."
      );
    }

    this.client = new S3Client({
      region,
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: !!endpoint, // Required for MinIO and custom S3 endpoints
    });
  }

  public async uploadLogo(organizationId: string, file: StorageFile): Promise<string> {
    if (file.sizeBytes > MAX_LOGO_FILE_SIZE_BYTES) {
      throw new ValidationError("Logo image size exceeds 2MB limit.");
    }

    if (!ALLOWED_LOGO_MIME_TYPES.includes(file.mimeType)) {
      throw new ValidationError("Invalid image format. Allowed formats: PNG, JPEG, WEBP, SVG.");
    }

    if (!validateImageMagicBytes(file.buffer, file.mimeType)) {
      throw new ValidationError("File payload header does not match expected image magic bytes.");
    }

    if (file.mimeType === "image/svg+xml" && !isSvgContentSafe(file.buffer)) {
      throw new ValidationError("SVG image contains unsafe elements, scripts, or embedded event handlers.");
    }

    const safeOrgId = path.basename(organizationId).replace(/[^a-zA-Z0-9_-]/g, "_");
    const rawExt = path.extname(file.filename).toLowerCase();
    const allowedExts = [".png", ".jpg", ".jpeg", ".webp", ".svg"];
    const ext = allowedExts.includes(rawExt) ? rawExt : ".png";
    const key = `organizations/${safeOrgId}/logos/logo${ext}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimeType,
        Metadata: { organizationId: safeOrgId },
      })
    );

    return key;
  }

  public async deleteLogo(organizationId: string): Promise<void> {
    const safeOrgId = path.basename(organizationId).replace(/[^a-zA-Z0-9_-]/g, "_");
    const keyPrefix = `organizations/${safeOrgId}/logos/`;
    // Delete standard logo variants
    const extensions = [".png", ".jpg", ".jpeg", ".webp", ".svg"];
    for (const ext of extensions) {
      try {
        await this.client.send(
          new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: `${keyPrefix}logo${ext}`,
          })
        );
      } catch {
        // Ignore deletion of non-existent key
      }
    }
  }

  public async uploadExpenseAttachment(
    organizationId: string,
    expenseId: string,
    file: StorageFile
  ): Promise<{ storagePath: string; hash: string }> {
    if (file.sizeBytes > MAX_ATTACHMENT_SIZE_BYTES) {
      throw new ValidationError("Attachment file size exceeds maximum 10MB limit.");
    }

    const ext = path.extname(file.filename).toLowerCase();
    if (DISALLOWED_EXTENSIONS.includes(ext)) {
      throw new ValidationError(`Files with extension '${ext}' are strictly prohibited for expense attachments.`);
    }

    if (!ALLOWED_ATTACHMENT_MIME_TYPES.includes(file.mimeType)) {
      throw new ValidationError(
        "Invalid file format. Allowed formats: PDF, JPEG, PNG, WEBP. SVG and executables are rejected."
      );
    }

    if (!validateAttachmentMagicBytes(file.buffer, file.mimeType)) {
      throw new ValidationError(
        "File payload header does not match expected document/image magic bytes."
      );
    }

    const safeOrgId = path.basename(organizationId).replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeExpenseId = path.basename(expenseId).replace(/[^a-zA-Z0-9_-]/g, "_");
    const sanitizedBase = path.basename(file.filename).replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniquePrefix = crypto.randomBytes(8).toString("hex");
    const key = `organizations/${safeOrgId}/expenses/${safeExpenseId}/${uniquePrefix}_${sanitizedBase}`;

    const hash = crypto.createHash("sha256").update(file.buffer).digest("hex");

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimeType,
        Metadata: {
          organizationId: safeOrgId,
          expenseId: safeExpenseId,
          hash,
        },
      })
    );

    return { storagePath: key, hash };
  }

  public async deleteExpenseAttachment(
    organizationId: string,
    expenseId: string,
    storagePath: string
  ): Promise<void> {
    const safeOrgId = path.basename(organizationId).replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeExpenseId = path.basename(expenseId).replace(/[^a-zA-Z0-9_-]/g, "_");

    // Enforce tenant boundary on key
    if (!storagePath.startsWith(`organizations/${safeOrgId}/expenses/${safeExpenseId}/`)) {
      throw new ValidationError("Unauthorized storage key access.");
    }

    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: storagePath,
        })
      );
    } catch {
      // Ignore if already deleted
    }
  }

  public async getSignedDownloadUrl(
    organizationId: string,
    storagePath: string,
    expiresInSeconds: number = 3600
  ): Promise<string> {
    const safeOrgId = path.basename(organizationId).replace(/[^a-zA-Z0-9_-]/g, "_");
    if (!storagePath.startsWith(`organizations/${safeOrgId}/`)) {
      throw new ValidationError("Unauthorized storage key access.");
    }

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: storagePath,
    });

    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }
}

export function createStorageService(): IStorageService {
  if (
    process.env.S3_BUCKET &&
    process.env.S3_ACCESS_KEY_ID &&
    process.env.S3_SECRET_ACCESS_KEY
  ) {
    return new S3StorageService();
  }

  if (process.env.NODE_ENV === "production" && process.env.VERCEL === "1") {
    throw new Error(
      "FATAL STORAGE CONFIGURATION ERROR: Serverless production environments require persistent cloud storage. Please configure S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY."
    );
  }

  return new LocalDiskStorageService();
}

export const storageService: IStorageService = createStorageService();
