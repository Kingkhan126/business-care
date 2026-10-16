import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { storageService } from "@/lib/storage";
import { uploadOrganizationLogo, deleteOrganizationLogo } from "@/lib/storage/organization-logo";

vi.mock("@/lib/storage", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/storage")>(),
  storageService: { uploadLogo: vi.fn().mockResolvedValue("/existing-logo.png"), deleteLogo: vi.fn() },
}));

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=", "base64");
const file = { buffer: png, filename: "logo.png", mimeType: "image/png", sizeBytes: png.length };

describe("Organization logo upload without cloud storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VERCEL", "1");
    for (const key of ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"]) vi.stubEnv(key, "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("encodes a validated logo for persistent storage without accessing the filesystem or S3", async () => {
    expect(await uploadOrganizationLogo("org-1", file)).toBe(`data:image/png;base64,${png.toString("base64")}`);
    expect(storageService.uploadLogo).not.toHaveBeenCalled();
    await deleteOrganizationLogo("org-1");
    expect(storageService.deleteLogo).not.toHaveBeenCalled();
  });

  it("rejects oversized, unsupported, forged, and unsafe SVG uploads", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    for (const invalid of [
      { ...file, buffer: Buffer.alloc(2 * 1024 * 1024 + 1) },
      { ...file, mimeType: "text/html" },
      { ...file, buffer: Buffer.from("not an image") },
      { ...file, mimeType: "image/svg+xml", buffer: svg, sizeBytes: svg.length },
    ]) await expect(uploadOrganizationLogo("org-1", invalid)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("retains the configured cloud storage and local development behavior", async () => {
    vi.stubEnv("S3_BUCKET", "configured");
    vi.stubEnv("S3_ACCESS_KEY_ID", "configured");
    vi.stubEnv("S3_SECRET_ACCESS_KEY", "configured");
    expect(await uploadOrganizationLogo("org-1", file)).toBe("/existing-logo.png");
    expect(storageService.uploadLogo).toHaveBeenCalledWith("org-1", file);
    await deleteOrganizationLogo("org-1");
    expect(storageService.deleteLogo).toHaveBeenCalledWith("org-1");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("S3_BUCKET", "");
    await uploadOrganizationLogo("org-local", file);
    expect(storageService.uploadLogo).toHaveBeenCalledWith("org-local", file);
  });
});
