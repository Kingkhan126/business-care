const SIGNATURES: Record<string, { bytes: number[]; extension: string }[]> = {
  "application/pdf": [{ bytes: [0x25, 0x50, 0x44, 0x46], extension: ".pdf" }], // %PDF
  "image/png": [{ bytes: [0x89, 0x50, 0x4e, 0x47], extension: ".png" }],
  "image/jpeg": [{ bytes: [0xff, 0xd8, 0xff], extension: ".jpg" }],
};

/**
 * Confirms the file's actual bytes match one of the allowed MIME types,
 * rather than trusting the browser-supplied Content-Type header (which a
 * malicious client can set to anything). Returns the safe extension to use
 * for the stored file, or null if the content doesn't match any allowed type.
 */
export function detectSafeExtension(buffer: Buffer, allowedMimeTypes: string[]): string | null {
  for (const mime of allowedMimeTypes) {
    const candidates = SIGNATURES[mime];
    if (!candidates) continue;
    for (const sig of candidates) {
      const matches = sig.bytes.every((byte, i) => buffer[i] === byte);
      if (matches) return sig.extension;
    }
  }
  return null;
}
