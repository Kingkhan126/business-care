import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  LocalDiskStorageService,
  S3StorageService,
  createStorageService,
  ALLOWED_ATTACHMENT_MIME_TYPES,
  MAX_ATTACHMENT_SIZE_BYTES,
  validateAttachmentMagicBytes,
} from "@/lib/storage";
import { ValidationError } from "@/lib/errors";

// Mock @aws-sdk/client-s3 and @aws-sdk/s3-request-presigner
const mockSend = vi.fn();
vi.mock("@aws-sdk/client-s3", () => {
  return {
    S3Client: vi.fn().mockImplementation(() => ({
      send: mockSend,
    })),
    PutObjectCommand: vi.fn().mockImplementation((args) => ({ ...args, type: "PutObjectCommand" })),
    DeleteObjectCommand: vi.fn().mockImplementation((args) => ({ ...args, type: "DeleteObjectCommand" })),
    GetObjectCommand: vi.fn().mockImplementation((args) => ({ ...args, type: "GetObjectCommand" })),
  };
});

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn().mockResolvedValue("https://s3.mock.signed-url.com/receipt.pdf?token=12345"),
}));

describe("Phase 8 Step 2: Storage Architecture & Persistent S3/R2 Security Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Storage Service Selection & Factory", () => {
    it("should instantiate LocalDiskStorageService when S3 environment variables are absent in development", () => {
      const originalEnv = { ...process.env };
      delete process.env.S3_BUCKET;
      delete process.env.S3_ACCESS_KEY_ID;
      delete process.env.S3_SECRET_ACCESS_KEY;
      (process.env as any).NODE_ENV = "development";

      const service = createStorageService();
      expect(service).toBeInstanceOf(LocalDiskStorageService);

      process.env = originalEnv;
    });

    it("should instantiate S3StorageService when S3 credentials and bucket are defined", () => {
      const originalEnv = { ...process.env };
      process.env.S3_BUCKET = "test-bucket";
      process.env.S3_ACCESS_KEY_ID = "test-key-id";
      process.env.S3_SECRET_ACCESS_KEY = "test-secret";
      process.env.S3_REGION = "us-east-1";

      const service = createStorageService();
      expect(service).toBeInstanceOf(S3StorageService);

      process.env = originalEnv;
    });

    it("should throw a fatal configuration error in production when running on Vercel without persistent S3 storage", () => {
      const originalEnv = { ...process.env };
      delete process.env.S3_BUCKET;
      delete process.env.S3_ACCESS_KEY_ID;
      delete process.env.S3_SECRET_ACCESS_KEY;
      (process.env as any).NODE_ENV = "production";
      process.env.VERCEL = "1";

      expect(() => createStorageService()).toThrow(
        "FATAL STORAGE CONFIGURATION ERROR: Serverless production environments require persistent cloud storage"
      );

      process.env = originalEnv;
    });
  });

  describe("2. S3StorageService Security & Tenant Isolation", () => {
    const s3Service = new S3StorageService({
      bucket: "bizengine-prod",
      region: "auto",
      accessKeyId: "mock_key",
      secretAccessKey: "mock_secret",
      endpoint: "https://mock.r2.cloudflarestorage.com",
    });

    // Valid mock PDF: starts with %PDF (0x25, 0x50, 0x44, 0x46)
    const validPdfBuffer = Buffer.from([
      0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x35, 0x0a, 0x25, 0xd0, 0xd4,
    ]);

    it("should successfully upload a valid PDF attachment with organization-scoped key and SHA-256 hash", async () => {
      mockSend.mockResolvedValueOnce({});

      const file = {
        buffer: validPdfBuffer,
        filename: "Vendor_Invoice_#101.pdf",
        mimeType: "application/pdf",
        sizeBytes: validPdfBuffer.length,
      };

      const result = await s3Service.uploadExpenseAttachment(
        "org_alpha_123",
        "exp_987",
        file
      );

      expect(mockSend).toHaveBeenCalledTimes(1);
      const callArg = mockSend.mock.calls[0][0];

      // Verify organization and expense path scoping
      expect(callArg.Bucket).toBe("bizengine-prod");
      expect(callArg.Key).toMatch(/^organizations\/org_alpha_123\/expenses\/exp_987\/[a-f0-9]+_Vendor_Invoice__101\.pdf$/);
      expect(callArg.ContentType).toBe("application/pdf");
      expect(callArg.Metadata.organizationId).toBe("org_alpha_123");
      expect(callArg.Metadata.expenseId).toBe("exp_987");
      expect(callArg.Metadata.hash).toBe(result.hash);

      expect(result.storagePath).toBe(callArg.Key);
      expect(result.hash).toHaveLength(64); // SHA-256 hex string
    });

    it("should reject attachment files exceeding the 10MB limit", async () => {
      const oversizedFile = {
        buffer: Buffer.alloc(MAX_ATTACHMENT_SIZE_BYTES + 1024),
        filename: "huge_receipt.pdf",
        mimeType: "application/pdf",
        sizeBytes: MAX_ATTACHMENT_SIZE_BYTES + 1024,
      };

      await expect(
        s3Service.uploadExpenseAttachment("org_1", "exp_1", oversizedFile)
      ).rejects.toThrow("Attachment file size exceeds maximum 10MB limit.");
    });

    it("should reject disallowed extensions (.exe, .sh, .bat, .svg)", async () => {
      const maliciousFile = {
        buffer: validPdfBuffer,
        filename: "script.sh",
        mimeType: "application/pdf",
        sizeBytes: validPdfBuffer.length,
      };

      await expect(
        s3Service.uploadExpenseAttachment("org_1", "exp_1", maliciousFile)
      ).rejects.toThrow("Files with extension '.sh' are strictly prohibited");
    });

    it("should reject executable header magic bytes even if filename is disguised as .pdf (MZ header)", async () => {
      // Disguised Windows executable (MZ header: 0x4D, 0x5A)
      const fakePdf = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);

      const disguisedFile = {
        buffer: fakePdf,
        filename: "disguised_trojan.pdf",
        mimeType: "application/pdf",
        sizeBytes: fakePdf.length,
      };

      await expect(
        s3Service.uploadExpenseAttachment("org_1", "exp_1", disguisedFile)
      ).rejects.toThrow("File payload header does not match expected document/image magic bytes.");
    });

    it("should prevent path traversal attacks in organizationId, expenseId, and filename", async () => {
      mockSend.mockResolvedValueOnce({});

      const file = {
        buffer: validPdfBuffer,
        filename: "../../../etc/passwd.pdf",
        mimeType: "application/pdf",
        sizeBytes: validPdfBuffer.length,
      };

      const result = await s3Service.uploadExpenseAttachment(
        "../../org_evil",
        "../../exp_evil",
        file
      );

      // Verify that path traversal was sanitized
      expect(result.storagePath).not.toContain("../");
      expect(result.storagePath).toContain("organizations/org_evil/expenses/exp_evil/");
    });

    it("should enforce tenant boundary when deleting expense attachments", async () => {
      mockSend.mockResolvedValueOnce({});

      // Legitimate deletion within tenant boundary
      const legitimateKey = "organizations/org_alpha/expenses/exp_1/hash_file.pdf";
      await s3Service.deleteExpenseAttachment("org_alpha", "exp_1", legitimateKey);
      expect(mockSend).toHaveBeenCalledTimes(1);

      // Illegal deletion across tenant boundaries
      const foreignKey = "organizations/org_victim/expenses/exp_victim/hash_file.pdf";
      await expect(
        s3Service.deleteExpenseAttachment("org_alpha", "exp_1", foreignKey)
      ).rejects.toThrow("Unauthorized storage key access.");
    });

    it("should generate a presigned download URL for private S3 storage", async () => {
      const storageKey = "organizations/org_alpha/expenses/exp_1/receipt.pdf";
      const signedUrl = await s3Service.getSignedDownloadUrl("org_alpha", storageKey, 1800);

      expect(signedUrl).toBe("https://s3.mock.signed-url.com/receipt.pdf?token=12345");
    });
  });
});
