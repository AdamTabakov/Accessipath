"""Data confidence computation (port of the Node confidence service).

How much we trust the accessibility *evidence*, independent of whether the
route scored well."""

from ..schemas import ConfidenceBreakdown, EvidenceItem, ProfilePreferences, RouteFactors
from ..utils.spatial import clamp, haversine_distance

SOURCE_QUALITY = {
    "institutional": 0.95,
    "osm": 0.7,
    "community": 0.5,
    "ai": 0.35,
}


class ConfidenceResult:
    def __init__(self, confidence: int, breakdown: ConfidenceBreakdown):
        self.confidence = confidence
        self.breakdown = breakdown


def _source_quality(evidence: list[EvidenceItem]) -> float:
    if not evidence:
        return 0
    return sum(SOURCE_QUALITY.get(item.sourceType, 0.4) for item in evidence) / len(evidence)


def _recency_score(evidence: list[EvidenceItem]) -> float:
    has_community = any(item.sourceType == "community" for item in evidence)
    return 0.7 if has_community else 1


def _agreement_score(evidence: list[EvidenceItem]) -> float:
    if len(evidence) < 2:
        return 0.3
    for i in range(len(evidence)):
        for j in range(i + 1, len(evidence)):
            a = evidence[i]
            b = evidence[j]
            if a.sourceType == b.sourceType:
                continue
            if a.type == b.type and haversine_distance(
                a, b
            ) <= 30:
                return 1
    return 0.4


def compute_confidence(
    evidence: list[EvidenceItem],
    factors: RouteFactors,
    provider: str,
    profile: ProfilePreferences,
) -> ConfidenceResult:
    quality = _source_quality(evidence)
    coverage = (
        0
        if factors.totalSamples == 0
        else clamp((factors.totalSamples - factors.unknownSections) / factors.totalSamples, 0, 1)
    )
    recency = _recency_score(evidence)
    if any(item.sourceType == "institutional" for item in evidence):
        verified = 0.95
    elif any(item.sourceType == "community" and item.verified for item in evidence):
        verified = 0.8
    else:
        verified = 0.4
    agreement = _agreement_score(evidence)

    breakdown = ConfidenceBreakdown(
        sourceQuality=round(quality * 100) / 100,
        coverage=round(coverage * 100) / 100,
        recency=round(recency * 100) / 100,
        verification=verified,
        agreement=agreement,
    )

    confidence = 100 * (
        0.35 * quality
        + 0.3 * coverage
        + 0.15 * recency
        + 0.1 * verified
        + 0.1 * agreement
    )
    if provider == "demo":
        confidence *= 0.85

    return ConfidenceResult(
        confidence=int(clamp(round(confidence), 0, 100)), breakdown=breakdown
    )