"""Pydantic models: internal domain types plus API request/response schemas.

Field names intentionally match the TypeScript types in the shared contract
(camelCase) so the JSON payloads are byte-for-byte compatible with the
previous Express backend.
"""

import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator

# ---------------------------------------------------------------------------
# Literal unions (mirror of the TS union types)
# ---------------------------------------------------------------------------

AccessibilityStatus = Literal["accessible", "inaccessible", "unknown"]
MobilityProfile = Literal["wheelchair", "walker", "cane", "limited_mobility", "custom"]
RouteMode = Literal["fastest", "balanced", "most_accessible"]
EvidenceSource = Literal["institutional", "osm", "community", "ai"]
EvidenceType = Literal[
    "entrance",
    "ramp",
    "elevator",
    "stairs",
    "crossing",
    "automatic_door",
    "barrier",
    "obstacle",
    "other",
]
ReportType = Literal[
    "broken_elevator",
    "blocked_ramp",
    "stairs",
    "construction",
    "obstacle",
    "surface_issue",
    "other",
]
ReportStatus = Literal["pending", "verified", "rejected", "expired"]
VoteDirection = Literal["up", "down"]
SlopeLevel = Literal["flat", "moderate", "steep", "any"]


# ---------------------------------------------------------------------------
# Domain types
# ---------------------------------------------------------------------------

class Coordinates(BaseModel):
    latitude: float
    longitude: float


class AccessibilityPoint(BaseModel):
    id: str
    buildingName: str | None = None
    type: EvidenceType
    latitude: float
    longitude: float
    wheelchair: AccessibilityStatus | None = None
    ramp: bool | None = None
    elevator: bool | None = None
    stairs: bool | None = None
    automaticDoor: bool | None = None
    surface: Literal["smooth", "rough", "unknown"] | None = None
    incline: Literal["flat", "moderate", "steep", "unknown"] | None = None
    sourceType: EvidenceSource
    sourceUrl: str | None = None
    description: str | None = None
    confidence: float
    verifiedAt: str | None = None
    isTemporary: bool | None = None
    severity: Literal["info", "warning", "blocked"] | None = None
    expiresAt: str | None = None
    photoUrl: str | None = None


class RouteCandidate(BaseModel):
    id: str
    provider: Literal["osrm", "demo"]
    distanceMeters: int
    durationMinutes: int
    geometry: list[Coordinates]


class RecentRoute(BaseModel):
    id: str
    startLabel: str
    startLatitude: float
    startLongitude: float
    endLabel: str
    endLatitude: float
    endLongitude: float
    mode: RouteMode
    createdAt: str


class PenaltyEntry(BaseModel):
    label: str
    points: float
    severity: Literal["info", "warning", "critical"]
    detail: str | None = None


class BonusEntry(BaseModel):
    label: str
    points: float


class EvidenceItem(BaseModel):
    id: str
    label: str
    type: EvidenceType
    latitude: float
    longitude: float
    distanceMeters: int
    sourceType: EvidenceSource
    status: AccessibilityStatus
    severity: Literal["info", "warning", "blocked"]
    description: str | None = None
    photoUrl: str | None = None
    verified: bool | None = None


class RouteFactors(BaseModel):
    stairs: int = 0
    ramps: int = 0
    elevators: int = 0
    crossings: int = 0
    accessibleEntrances: int = 0
    obstacles: int = 0
    steepSlopes: int = 0
    roughSurface: int = 0
    unknownSections: int = 0
    totalSamples: int = 0


class ConfidenceBreakdown(BaseModel):
    sourceQuality: float
    coverage: float
    recency: float
    verification: float
    agreement: float


class RouteResult(BaseModel):
    id: str
    mode: RouteMode
    provider: Literal["osrm", "demo"]
    distanceMeters: int
    durationMinutes: int
    accessibilityScore: int
    dataConfidence: int
    confidenceBreakdown: ConfidenceBreakdown
    factors: RouteFactors
    penalties: list[PenaltyEntry]
    bonuses: list[BonusEntry]
    evidence: list[EvidenceItem]
    unknownCoordinates: list[Coordinates]
    geometry: list[Coordinates]


class ProfilePreferences(BaseModel):
    mobilityProfile: MobilityProfile
    avoidStairs: bool
    preferRamps: bool
    preferElevators: bool
    maxSlope: SlopeLevel
    preferSmoothSurface: bool
    maxWalkDistanceMeters: int = Field(ge=0, le=50000)


class AiDetection(BaseModel):
    label: str = Field(min_length=1, max_length=120)
    score: float = Field(ge=0, le=1)


class AiObservation(BaseModel):
    reportId: str | None = None
    feature: str = Field(min_length=1, max_length=120)
    confidence: float = Field(ge=0, le=1)
    modelVersion: str = Field(min_length=1, max_length=120)
    createdAt: str
    allDetections: list[AiDetection] = Field(default_factory=list, max_length=10)


class AccessibilityReport(BaseModel):
    id: str
    type: ReportType
    description: str
    latitude: float
    longitude: float
    status: ReportStatus
    upvotes: int
    downvotes: int
    myVote: VoteDirection | None = None
    verifiedAt: str | None = None
    photoUrl: str | None = None
    createdAt: str
    expiresAt: str
    aiObservation: AiObservation | None = None


class Place(BaseModel):
    id: str
    label: str
    description: str
    latitude: float
    longitude: float
    buildingId: str | None = None
    source: Literal["curated", "nominatim"]


class User(BaseModel):
    id: str
    email: str
    name: str
    passwordHash: str
    verifiedAt: str | None = None
    verificationCodeHash: str | None = None
    verificationExpiresAt: str | None = None
    createdAt: str


class SafeUser(BaseModel):
    id: str
    email: str
    name: str
    verified: bool
    createdAt: str


def to_safe_user(user: User) -> SafeUser:
    return SafeUser(
        id=user.id,
        email=user.email,
        name=user.name,
        verified=bool(user.verifiedAt),
        createdAt=user.createdAt,
    )


# ---------------------------------------------------------------------------
# API request bodies
# ---------------------------------------------------------------------------

_EMAIL_REGEX = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


def _normalize_email(value: str) -> str:
    return value.strip().lower()


class SignupBody(BaseModel):
    email: str = Field(max_length=254)
    name: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=8, max_length=100)

    @field_validator("email")
    @classmethod
    def _clean_email(cls, value: str) -> str:
        value = _normalize_email(value)
        if len(value) > 254 or not re.match(_EMAIL_REGEX, value):
            raise ValueError("Enter a valid email address.")
        return value


class LoginBody(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(min_length=1, max_length=100)

    @field_validator("email")
    @classmethod
    def _clean_email(cls, value: str) -> str:
        value = _normalize_email(value)
        if len(value) > 254 or not re.match(_EMAIL_REGEX, value):
            raise ValueError("Enter a valid email address.")
        return value


class VerifyBody(BaseModel):
    email: str = Field(max_length=254)
    code: str = Field(pattern=r"^\d{6}$")

    @field_validator("email")
    @classmethod
    def _clean_email(cls, value: str) -> str:
        value = _normalize_email(value)
        if len(value) > 254 or not re.match(_EMAIL_REGEX, value):
            raise ValueError("Enter a valid email address.")
        return value


class ResendBody(BaseModel):
    email: str = Field(max_length=254)

    @field_validator("email")
    @classmethod
    def _clean_email(cls, value: str) -> str:
        value = _normalize_email(value)
        if len(value) > 254 or not re.match(_EMAIL_REGEX, value):
            raise ValueError("Enter a valid email address.")
        return value


class AiObservationInput(BaseModel):
    feature: str = Field(min_length=1, max_length=120)
    confidence: float = Field(ge=0, le=1)
    modelVersion: str = Field(min_length=1, max_length=120)
    allDetections: list[AiDetection] | None = Field(default=None, max_length=10)


class ReportBody(BaseModel):
    type: ReportType
    description: str = Field(min_length=3, max_length=2000)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    photo: str | None = None
    aiObservation: AiObservationInput | None = None


class AiBody(BaseModel):
    image: str | None = None
    observation: AiObservationInput | None = None


class ProfileBody(BaseModel):
    mobilityProfile: MobilityProfile
    avoidStairs: bool
    preferRamps: bool
    preferElevators: bool
    maxSlope: SlopeLevel
    preferSmoothSurface: bool
    maxWalkDistanceMeters: int = Field(ge=0, le=50000)


class VoteBody(BaseModel):
    direction: VoteDirection


class RecentRouteBody(BaseModel):
    startLabel: str = Field(min_length=1, max_length=120)
    startLatitude: float = Field(ge=-90, le=90)
    startLongitude: float = Field(ge=-180, le=180)
    endLabel: str = Field(min_length=1, max_length=120)
    endLatitude: float = Field(ge=-90, le=90)
    endLongitude: float = Field(ge=-180, le=180)
    mode: RouteMode


class RoutesQuery(BaseModel):
    start: str
    end: str
    profile: MobilityProfile = "wheelchair"
    mode: RouteMode = "most_accessible"
    avoid_stairs: Literal["true", "false"] | None = None
    prefer_ramps: Literal["true", "false"] | None = None
    prefer_elevators: Literal["true", "false"] | None = None
    max_slope: SlopeLevel | None = None
    max_walk_meters: int | None = Field(default=None, ge=0, le=50000)
