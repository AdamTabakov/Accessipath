"""Port of the Node confidence tests."""

from app.schemas import EvidenceItem, RouteFactors
from app.services.confidence import compute_confidence

BASE_FACTORS = RouteFactors(
    stairs=0,
    ramps=1,
    elevators=0,
    crossings=1,
    accessibleEntrances=1,
    obstacles=0,
    steepSlopes=0,
    roughSurface=0,
    unknownSections=0,
    totalSamples=10,
)

WHEELCHAIR = {
    "mobilityProfile": "wheelchair",
    "avoidStairs": True,
    "preferRamps": True,
    "preferElevators": True,
    "maxSlope": "moderate",
    "preferSmoothSurface": True,
    "maxWalkDistanceMeters": 2000,
}


def evidence(source_type: str, label: str = "Feature") -> EvidenceItem:
    return EvidenceItem(
        id=f"e-{source_type}",
        label=label,
        type="entrance",
        latitude=43.6577,
        longitude=-79.38,
        distanceMeters=12,
        sourceType=source_type,
        status="accessible",
        severity="info",
    )


class TestConfidence:
    def test_trusts_institutional_more_than_community(self):
        institutional = compute_confidence(
            evidence=[evidence("institutional")],
            factors=BASE_FACTORS,
            provider="osrm",
            profile=WHEELCHAIR,
        )
        community = compute_confidence(
            evidence=[evidence("community")],
            factors=BASE_FACTORS,
            provider="osrm",
            profile=WHEELCHAIR,
        )
        assert institutional.confidence > community.confidence

    def test_lowers_confidence_when_data_is_sparse(self):
        full = compute_confidence(
            evidence=[evidence("institutional")],
            factors=BASE_FACTORS.model_copy(update={"unknownSections": 0, "totalSamples": 10}),
            provider="osrm",
            profile=WHEELCHAIR,
        )
        sparse = compute_confidence(
            evidence=[evidence("institutional")],
            factors=BASE_FACTORS.model_copy(update={"unknownSections": 8, "totalSamples": 10}),
            provider="osrm",
            profile=WHEELCHAIR,
        )
        assert sparse.breakdown.coverage < 0.5
        assert sparse.confidence < full.confidence

    def test_confidence_between_0_and_100(self):
        result = compute_confidence(
            evidence=[evidence("institutional"), evidence("osm")],
            factors=BASE_FACTORS,
            provider="osrm",
            profile=WHEELCHAIR,
        )
        assert 0 <= result.confidence <= 100

    def test_penalizes_demo_routes_slightly(self):
        demo = compute_confidence(
            evidence=[evidence("institutional")],
            factors=BASE_FACTORS,
            provider="demo",
            profile=WHEELCHAIR,
        )
        osrm = compute_confidence(
            evidence=[evidence("institutional")],
            factors=BASE_FACTORS,
            provider="osrm",
            profile=WHEELCHAIR,
        )
        assert demo.confidence < osrm.confidence