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