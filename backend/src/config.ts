import "dotenv/config";

function readList(value: string | undefined, fallback: string): string[] {
  return (value ?? fallback)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProd: (process.env.NODE_ENV ?? "development") === "production",
  databaseUrl: process.env.DATABASE_URL ?? "",
  corsOrigins: readList(process.env.CORS_ORIGINS, "http://localhost:5173,http://127.0.0.1:5173"),
  osrmUrl: process.env.OSRM_URL ?? "https://router.project-osrm.org",
  nominatimUrl: process.env.NOMINATIM_URL ?? "https://nominatim.openstreetmap.org",
  overpassUrl: process.env.OVERPASS_URL ?? "https://overpass-api.de/api/interpreter",
  uploadDir: process.env.UPLOAD_DIR ?? "uploads",
  maxUploadBytes: 8 * 1024 * 1024, // 8 MB
  bodyLimit: "12mb",
};