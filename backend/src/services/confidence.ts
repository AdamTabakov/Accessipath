import type {
  ConfidenceBreakdown,
  EvidenceItem,
  ProfilePreferences,
  RouteFactors,
} from "../types/index.js";
import { clamp, haversineDistance } from "../utils/spatial.js";

const SOURCE_QUALITY: Record<string, number> = {
  institutional: 0.95,
  osm: 0.7,
  community: 0.5,
  ai: 0.35,
};

export interface ConfidenceResult {
  confidence: number;
  breakdown: ConfidenceBreakdown;
}

function sourceQuality(evidence: EvidenceItem[]): number {
  if (evidence.length === 0) return 0;
  const total = evidence.reduce(
    (sum, item) => sum + (SOURCE_QUALITY[item.sourceType] ?? 0.4),
    0,
  );
  return total / evidence.length;
}

function recencyScore(evidence: EvidenceItem[]): number {
  const hasCommunity = evidence.some((item) => item.sourceType === "community");
  return hasCommunity ? 0.7 : 1;
}

/** Cross-source agreement: two different sources describing the same feature within ~30 m. */
function agreementScore(evidence: EvidenceItem[]): number {
  if (evidence.length < 2) return 0.3;
  for (let i = 0; i < evidence.length; i++) {
    for (let j = i + 1; j < evidence.length; j++) {
      const a = evidence[i]!;
      const b = evidence[j]!;
      if (a.sourceType === b.sourceType) continue;
      if (
        a.type === b.type &&
        haversineDistance(
          { latitude: a.latitude, longitude: a.longitude },
          { latitude: b.latitude, longitude: b.longitude },
        ) <= 30
      ) {
        return 1;
      }
    }
  }
  return 0.4;
}

/**
 * Data confidence: how much we trust the accessibility *evidence*, independent
 * of whether the route scored well. Built from source quality, route coverage,
 * recency of reports, verification, and cross-source agreement.
 */
export function computeConfidence(opts: {
  evidence: EvidenceItem[];
  factors: RouteFactors;
  provider: "osrm" | "demo";
  profile: ProfilePreferences;
}): ConfidenceResult {
  const { evidence, factors, provider } = opts;

  const quality = sourceQuality(evidence);
  const coverage =
    factors.totalSamples === 0
      ? 0
      : clamp((factors.totalSamples - factors.unknownSections) / factors.totalSamples, 0, 1);
  const recency = recencyScore(evidence);
  const verified = evidence.some((item) => item.sourceType === "institutional")
    ? 0.95
    : evidence.some((item) => item.sourceType === "community" && item.verified)
      ? 0.8
      : 0.4;
  const agreement = agreementScore(evidence);

  const breakdown: ConfidenceBreakdown = {
    sourceQuality: Math.round(quality * 100) / 100,
    coverage: Math.round(coverage * 100) / 100,
    recency: Math.round(recency * 100) / 100,
    verification: verified,
    agreement,
  };

  let confidence =
    100 *
    (0.35 * quality + 0.3 * coverage + 0.15 * recency + 0.1 * verified + 0.1 * agreement);
  if (provider === "demo") confidence *= 0.85;

  return { confidence: clamp(Math.round(confidence), 0, 100), breakdown };
}