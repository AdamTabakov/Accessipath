import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { imageSize } from "image-size";
import { config } from "../config.js";

const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const MAX_DIMENSION = 5000;

/**
 * Only these byte signatures reach image-size. image-size's ICNS/JXL/HEIF
 * parsers can loop forever on crafted files (CVE no-fix), so we reject any
 * upload whose content does not start with one of the formats we actually
 * accept. Declared MIME type is never trusted.
 */
function assertAllowedImageSignature(buffer: Buffer): void {
  if (buffer.length < 12) throw new Error("Image is too small to be valid.");
  const sig = buffer.subarray(0, 12);
  const png = sig.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const jpeg = sig[0] === 0xff && sig[1] === 0xd8 && sig[2] === 0xff;
  const gif = sig.subarray(0, 6).toString("ascii") === "GIF87a" || sig.subarray(0, 6).toString("ascii") === "GIF89a";
  const webp =
    sig.subarray(0, 4).toString("ascii") === "RIFF" && sig.subarray(8, 12).toString("ascii") === "WEBP";
  if (!png && !jpeg && !gif && !webp) {
    throw new Error("Image contents do not match a supported format (JPEG, PNG, WebP or GIF).");
  }
}

/**
 * Validate a base64 data-URL image (declared MIME + magic bytes via image-size)
 * and persist it to the uploads directory. Returns the public URL path.
 * Rejects oversized, wrong-type, or malformed files.
 */
export async function savePhoto(dataUrl: string): Promise<{ photoUrl: string }> {
  const match = /^data:(image\/[a-z+]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) throw new Error("Photo must be a base64 data URL.");
  const mime = match[1]!.toLowerCase();
  const ext = ALLOWED_MIME[mime];
  if (!ext) throw new Error("Unsupported image type. Use JPEG, PNG, WebP or GIF.");

  const buffer = Buffer.from(match[2]!, "base64");
  if (buffer.length === 0) throw new Error("Empty image.");
  if (buffer.length > config.maxUploadBytes) {
    throw new Error(`Image is too large (max ${config.maxUploadBytes / (1024 * 1024)} MB).`);
  }

  assertAllowedImageSignature(buffer);

  const dimensions = imageSize(buffer);
  if (!dimensions || !dimensions.width || !dimensions.height) {
    throw new Error("Could not read image contents - file appears corrupted.");
  }
  if (dimensions.width > MAX_DIMENSION || dimensions.height > MAX_DIMENSION) {
    throw new Error(`Image dimensions too large (max ${MAX_DIMENSION}px).`);
  }

  await fs.mkdir(config.uploadDir, { recursive: true });
  const filename = `${randomUUID()}${ext}`;
  await fs.writeFile(path.join(config.uploadDir, filename), buffer, { flag: "wx" });

  return { photoUrl: `/uploads/${filename}` };
}