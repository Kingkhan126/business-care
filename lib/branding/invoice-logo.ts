/** Supported persisted logo references; unresolvable storage keys are handled on the server. */
export function invoiceLogoSource(value: string | null | undefined): string | null {
  const source = value?.trim();
  if (!source) return null;
  if (/^data:image\/(?:png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/]+={0,2}$/.test(source)) return source;
  if (/^\/uploads\/logos\/[^\s\\]+$/.test(source) && !source.includes("..")) return source;
  try {
    const url = new URL(source);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}
