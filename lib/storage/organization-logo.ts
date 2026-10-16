import { ValidationError } from "@/lib/errors";
import {
  ALLOWED_LOGO_MIME_TYPES, MAX_LOGO_FILE_SIZE_BYTES, StorageFile,
  isSvgContentSafe, storageService, validateImageMagicBytes,
} from "@/lib/storage";

function storeLogoInDatabase() {
  return process.env.VERCEL === "1" &&
    !(process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);
}

export async function uploadOrganizationLogo(organizationId: string, file: StorageFile): Promise<string> {
  if (!storeLogoInDatabase()) return storageService.uploadLogo(organizationId, file);

  if (file.sizeBytes > MAX_LOGO_FILE_SIZE_BYTES || file.buffer.length > MAX_LOGO_FILE_SIZE_BYTES) {
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

  // The existing logoUrl text column persists the small image across serverless deployments.
  return `data:${file.mimeType};base64,${file.buffer.toString("base64")}`;
}

export async function deleteOrganizationLogo(organizationId: string): Promise<void> {
  if (!storeLogoInDatabase()) await storageService.deleteLogo(organizationId);
  // Database-backed logos are removed when OrganizationService clears logoUrl.
}
