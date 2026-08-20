"""Data stores: interface, in-memory implementation, and factory.

Port of the TypeScript store. The community report lifecycle (pending ->
verified/rejected/expired with time decay and 2:1 vote ratio rules) is
preserved exactly because routing and confidence depend on it."""

import time
import uuid
from abc import ABC, abstractmethod
from typing import Any

from ..config import settings
from ..schemas import (
    AccessibilityPoint,
    AccessibilityReport,
    AiObservation,
    EvidenceType,
    ProfilePreferences,
    RecentRoute,
    ReportStatus,
    RouteMode,
    User,
    VoteDirection,
)

DEFAULT_PROFILE = ProfilePreferences(
    mobilityProfile="wheelchair",
    avoidStairs=True,
    preferRamps=True,
    preferElevators=True,
    maxSlope="moderate",
    preferSmoothSurface=True,
    maxWalkDistanceMeters=2000,
)

REPORT_LIFETIME_DAYS = 90
VERIFIED_LIFETIME_DAYS = 90
VERIFY_UPVOTES = 3
REJECT_DOWNVOTES = 3

DAY_MS = 24 * 60 * 60 * 1000


class DataStore(ABC):
    kind: str = "memory"

    @abstractmethod
    async def get_all_accessibility_points(self) -> list[AccessibilityPoint]:
        ...

    @abstractmethod
    async def invalidate_accessibility_points(self) -> None:
        ...

    @abstractmethod
    async def get_reports(self, user_id: str | None = None) -> list[AccessibilityReport]:
        ...

    @abstractmethod
    async def create_report(self, input_: dict[str, Any]) -> AccessibilityReport:
        ...

    @abstractmethod
    async def vote_report(
        self, id: str, user_id: str, direction: VoteDirection
    ) -> AccessibilityReport:
        ...

    @abstractmethod
    async def create_ai_observation(self, observation: AiObservation) -> AiObservation:
        ...

    @abstractmethod
    async def get_profile(self, user_id: str | None = None) -> ProfilePreferences:
        ...

    @abstractmethod
    async def save_profile(
        self, profile: ProfilePreferences, user_id: str | None = None
    ) -> ProfilePreferences:
        ...

    @abstractmethod
    async def find_user_by_email(self, email: str) -> User | None:
        ...

    @abstractmethod
    async def get_user_by_id(self, id: str) -> User | None:
        ...

    @abstractmethod
    async def create_user(self, input_: dict[str, Any]) -> User:
        ...

    @abstractmethod
    async def update_user(self, id: str, patch: dict[str, Any]) -> User:
        ...

    @abstractmethod
    async def get_recent_routes(self, user_id: str) -> list[RecentRoute]:
        ...

    @abstractmethod
    async def add_recent_route(self, user_id: str, input_: dict[str, Any]) -> RecentRoute:
        ...


def _report_type_to_point(
    report_type: str,
    latitude: float,
    longitude: float,
    description: str,
    id: str,
    photo_url: str | None = None,
) -> AccessibilityPoint:
    base = {
        "id": id,
        "latitude": latitude,
        "longitude": longitude,
        "description": description,
        "sourceType": "community",
        "isTemporary": True,
        "confidence": 0.5,
        "photoUrl": photo_url,
        "expiresAt": _iso(time.time() * 1000 + REPORT_LIFETIME_DAYS * DAY_MS),
    }
    if report_type == "broken_elevator":
        return AccessibilityPoint(
            **base,
            type="elevator",
            elevator=True,
            wheelchair="inaccessible",
            severity="warning",
        )
    if report_type == "blocked_ramp":
        return AccessibilityPoint(
            **base, type="obstacle", wheelchair="inaccessible", severity="blocked"
        )
    if report_type == "stairs":
        return AccessibilityPoint(
            **base, type="stairs", stairs=True, wheelchair="inaccessible", severity="warning"
        )
    if report_type in ("construction", "surface_issue"):
        return AccessibilityPoint(
            **base, type="obstacle", surface="rough", wheelchair="unknown", severity="warning"
        )
    if report_type == "obstacle":
        return AccessibilityPoint(
            **base, type="obstacle", wheelchair="unknown", severity="warning"
        )
    return AccessibilityPoint(**base, type="other", wheelchair="unknown", severity="warning")


def report_to_accessibility_point(
    report: AccessibilityReport, status: ReportStatus
) -> AccessibilityPoint:
    point = _report_type_to_point(
        id=f"point-{report.id}",
        report_type=report.type,
        latitude=report.latitude,
        longitude=report.longitude,
        description=report.description,
        photo_url=report.photoUrl,
    )
    verified = status == "verified"
    point.confidence = 0.85 if verified else 0.5
    if verified and report.verifiedAt:
        point.verifiedAt = report.verifiedAt
    return point


def effective_report_status(report: AccessibilityReport, now: float | None = None) -> ReportStatus:
    if now is None:
        now = time.time() * 1000
    if report.status == "rejected":
        return "rejected"
    if report.status == "verified" and report.verifiedAt:
        decay_at = _parse_ms(report.verifiedAt) + VERIFIED_LIFETIME_DAYS * DAY_MS
        return "pending" if now > decay_at else "verified"
    if now > _parse_ms(report.expiresAt):
        return "expired"
    return report.status


def apply_vote_status(report: AccessibilityReport) -> None:
    if report.downvotes >= REJECT_DOWNVOTES and report.downvotes > report.upvotes:
        report.status = "rejected"
        report.verifiedAt = None
        return
    if report.upvotes >= VERIFY_UPVOTES and report.upvotes >= 2 * report.downvotes:
        if report.status != "verified":
            report.status = "verified"
            report.verifiedAt = _iso(time.time() * 1000)
            report.expiresAt = _iso(_parse_ms(report.verifiedAt) + VERIFIED_LIFETIME_DAYS * DAY_MS)
        return
    report.status = "pending"
    report.verifiedAt = None


def _iso(ms: float) -> str:
    from datetime import datetime, timezone

    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).isoformat()


def _parse_ms(value: str) -> float:
    from datetime import datetime, timezone

    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.timestamp() * 1000


class MemoryStore(DataStore):
    kind = "memory"

    def __init__(self) -> None:
        self.reports: list[AccessibilityReport] = []
        self.report_votes: dict[str, dict[str, VoteDirection]] = {}
        self.profile: ProfilePreferences = DEFAULT_PROFILE.model_copy(deep=True)
        self.profiles: dict[str, ProfilePreferences] = {}
        self.users_by_email: dict[str, User] = {}
        self.users_by_id: dict[str, User] = {}
        self.recent_routes: dict[str, list[RecentRoute]] = {}
        self.points_cache: tuple[list[AccessibilityPoint], float] | None = None
        self.points_cache_ttl_ms = 20_000

    async def get_all_accessibility_points(self) -> list[AccessibilityPoint]:
        if self.points_cache and time.time() * 1000 - self.points_cache[1] < self.points_cache_ttl_ms:
            return self.points_cache[0]
        points: list[AccessibilityPoint] = []
        for report in self.reports:
            status = effective_report_status(report)
            if status in ("rejected", "expired"):
                continue
            points.append(report_to_accessibility_point(report, status))
        self.points_cache = (points, time.time() * 1000)
        return points

    async def invalidate_accessibility_points(self) -> None:
        self.points_cache = None

    async def get_reports(self, user_id: str | None = None) -> list[AccessibilityReport]:
        result = []
        for r in sorted(self.reports, key=lambda x: x.createdAt, reverse=True):
            votes = self.report_votes.get(r.id, {})
            upvotes = sum(1 for d in votes.values() if d == "up")
            downvotes = sum(1 for d in votes.values() if d == "down")
            copy = r.model_copy(
                update={
                    "upvotes": upvotes,
                    "downvotes": downvotes,
                    "myVote": votes.get(user_id) if user_id else None,
                    "status": effective_report_status(r),
                }
            )
            result.append(copy)
        return result

    async def create_report(self, input_: dict[str, Any]) -> AccessibilityReport:
        now_ms = time.time() * 1000
        report = AccessibilityReport(
            id=str(uuid.uuid4()),
            type=input_["type"],
            description=input_["description"],
            latitude=input_["latitude"],
            longitude=input_["longitude"],
            status="pending",
            upvotes=0,
            downvotes=0,
            myVote=None,
            photoUrl=input_.get("photoUrl"),
            createdAt=_iso(now_ms),
            expiresAt=_iso(now_ms + REPORT_LIFETIME_DAYS * DAY_MS),
            aiObservation=input_.get("aiObservation"),
        )
        self.reports.insert(0, report)
        await self.invalidate_accessibility_points()
        return report

    async def vote_report(
        self, id: str, user_id: str, direction: VoteDirection
    ) -> AccessibilityReport:
        report = next((r for r in self.reports if r.id == id), None)
        if not report:
            raise ValueError("Report not found.")
        user_votes = self.report_votes.setdefault(id, {})
        if user_votes.get(user_id) == direction:
            del user_votes[user_id]
        else:
            user_votes[user_id] = direction
        upvotes = sum(1 for d in user_votes.values() if d == "up")
        downvotes = sum(1 for d in user_votes.values() if d == "down")
        report.upvotes = upvotes
        report.downvotes = downvotes
        apply_vote_status(report)
        await self.invalidate_accessibility_points()
        return report.model_copy(update={"myVote": user_votes.get(user_id)})

    async def create_ai_observation(self, observation: AiObservation) -> AiObservation:
        return observation

    async def get_profile(self, user_id: str | None = None) -> ProfilePreferences:
        if user_id:
            saved = self.profiles.get(user_id)
            if saved:
                return saved.model_copy(deep=True)
        return self.profile.model_copy(deep=True)

    async def save_profile(
        self, profile: ProfilePreferences, user_id: str | None = None
    ) -> ProfilePreferences:
        if user_id:
            self.profiles[user_id] = profile.model_copy(deep=True)
            return await self.get_profile(user_id)
        self.profile = profile.model_copy(deep=True)
        return await self.get_profile()

    async def find_user_by_email(self, email: str) -> User | None:
        return self.users_by_email.get(email.lower())

    async def get_user_by_id(self, id: str) -> User | None:
        return self.users_by_id.get(id)

    async def create_user(self, input_: dict[str, Any]) -> User:
        user = User(
            id=input_["id"],
            email=input_["email"].lower(),
            name=input_["name"],
            passwordHash=input_["passwordHash"],
            verificationCodeHash=input_["verificationCodeHash"],
            verificationExpiresAt=input_["verificationExpiresAt"],
            createdAt=input_["createdAt"],
        )
        self.users_by_email[user.email] = user
        self.users_by_id[user.id] = user
        return user

    async def update_user(self, id: str, patch: dict[str, Any]) -> User:
        existing = self.users_by_id.get(id)
        if not existing:
            raise ValueError("User not found.")
        updated = existing.model_copy(
            update={
                "verifiedAt": patch.get("verifiedAt", existing.verifiedAt),
                "verificationCodeHash": patch.get(
                    "verificationCodeHash", existing.verificationCodeHash
                ),
                "verificationExpiresAt": patch.get(
                    "verificationExpiresAt", existing.verificationExpiresAt
                ),
            }
        )
        self.users_by_email[updated.email] = updated
        self.users_by_id[id] = updated
        return updated

    async def get_recent_routes(self, user_id: str) -> list[RecentRoute]:
        return self.recent_routes.get(user_id, [])[:]

    async def add_recent_route(self, user_id: str, input_: dict[str, Any]) -> RecentRoute:
        route = RecentRoute(
            id=str(uuid.uuid4()),
            startLabel=input_["startLabel"],
            startLatitude=input_["startLatitude"],
            startLongitude=input_["startLongitude"],
            endLabel=input_["endLabel"],
            endLatitude=input_["endLatitude"],
            endLongitude=input_["endLongitude"],
            mode=input_["mode"],
            createdAt=_iso(time.time() * 1000),
        )
        existing = self.recent_routes.get(user_id, [])
        filtered = [
            r
            for r in existing
            if not (
                r.startLatitude == input_["startLatitude"]
                and r.startLongitude == input_["startLongitude"]
                and r.endLatitude == input_["endLatitude"]
                and r.endLongitude == input_["endLongitude"]
            )
        ]
        self.recent_routes[user_id] = [route, *filtered][:10]
        return route


def map_report_status(value: str) -> ReportStatus:
    if value in ("verified", "rejected", "expired", "pending"):
        return value
    return "pending"


async def create_store() -> DataStore:
    if settings.database_url:
        try:
            from .postgres import PostgresStore

            store = PostgresStore(settings.database_url)
            await store.initialize()
            return store
        except Exception as error:  # noqa: BLE001
            print(f"[store] Postgres unavailable - falling back to in-memory store: {error}")
    return MemoryStore()