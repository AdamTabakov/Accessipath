"""Main API routes (port of the Node api router)."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, Request

from ..config import settings
from ..controllers.routing import build_routes, invalidate_route_results, profile_from_defaults
from ..services.osm import get_toronto_accessibility_summary
from ..core.errors import ApiValidationError, HttpError
from ..core.ratelimit import api_limiter, strict_limiter
from ..schemas import (
    AiBody,
    AiObservation,
    ProfileBody,
    ProfilePreferences,
    RecentRouteBody,
    ReportBody,
    RoutesQuery,
    VoteBody,
)
from ..services.geocoding import geocode
from ..services.osm import TORONTO_BBOX, TORONTO_PAD_DEG
from ..services.store import DataStore
from ..utils.spatial import point_within_bounds
from ..utils.uploads import save_photo
from .deps import get_store, optional_auth, parse_coordinates, rate_limit, require_auth

router = APIRouter(tags=["api"])

_api_limit = rate_limit(api_limiter)
_strict_limit = rate_limit(strict_limiter)

# Mirrors the Express router.use("/api", apiLimiter): every /api route is
# subject to the general limiter, with the strict limiter applied on top for
# geocoding, report creation, and AI analysis.
router = APIRouter(tags=["api"], dependencies=[Depends(_api_limit)])


@router.get("/api/health")
async def health(store: DataStore = Depends(get_store)):
    return {
        "status": "ok",
        "service": "accessipath-api",
        "version": "1.0.0",
        "time": datetime.now(timezone.utc).isoformat(),
        "dataStore": store.kind,
    }


@router.get("/api/accessibility-summary", )
async def accessibility_summary(store: DataStore = Depends(get_store)):
    summary = await get_toronto_accessibility_summary(store)
    return summary


@router.get("/api/geocode", dependencies=[Depends(_strict_limit)])
async def geocode_endpoint(q: str = Query(default="")):
    query = q.strip()
    if not query:
        return {"results": []}
    try:
        results = await geocode(query)
        return {"results": [r.model_dump() for r in results]}
    except Exception as error:  # noqa: BLE001
        print(f"[geocode] {error}")
        raise HttpError(502, "Geocoding is temporarily unavailable.") from error


@router.get("/api/routes", )
async def routes(
    query: RoutesQuery = Query(),
    user_id: str | None = Depends(optional_auth),
    store: DataStore = Depends(get_store),
):
    try:
        start = parse_coordinates(query.start)
        end = parse_coordinates(query.end)
    except ValueError as error:
        raise ApiValidationError([{"path": "coordinates", "message": str(error)}]) from error

    if not (
        point_within_bounds(start.latitude, start.longitude, TORONTO_BBOX, TORONTO_PAD_DEG)
        and point_within_bounds(end.latitude, end.longitude, TORONTO_BBOX, TORONTO_PAD_DEG)
    ):
        raise HttpError(400, "Routes are currently available only within Toronto.")

    profile = profile_from_defaults(
        {
            "mobilityProfile": query.profile,
            "avoidStairs": query.avoid_stairs == "true" if query.avoid_stairs is not None else None,
            "preferRamps": query.prefer_ramps == "true" if query.prefer_ramps is not None else None,
            "preferElevators": (
                query.prefer_elevators == "true" if query.prefer_elevators is not None else None
            ),
            "preferSmoothSurface": (
                query.prefer_smooth_surface == "true"
                if query.prefer_smooth_surface is not None
                else None
            ),
            "maxSlope": query.max_slope,
            "maxWalkDistanceMeters": query.max_walk_meters,
        }
    )
    result = await build_routes(
        start=start, end=end, profile=profile, mode=query.mode, store=store
    )
    stored_profile = await store.get_profile(user_id)
    return {**result, "profile": stored_profile}


@router.get("/api/routes/recent", )
async def recent_routes(
    user_id: str = Depends(require_auth), store: DataStore = Depends(get_store)
):
    return {"routes": await store.get_recent_routes(user_id)}


@router.post("/api/routes/recent", status_code=201)
async def add_recent_route(
    body: RecentRouteBody,
    user_id: str = Depends(require_auth),
    store: DataStore = Depends(get_store),
):
    route = await store.add_recent_route(
        user_id,
        {
            "startLabel": body.startLabel,
            "startLatitude": body.startLatitude,
            "startLongitude": body.startLongitude,
            "endLabel": body.endLabel,
            "endLatitude": body.endLatitude,
            "endLongitude": body.endLongitude,
            "mode": body.mode,
        },
    )
    return {"route": route}


@router.get("/api/reports", )
async def reports(
    user_id: str | None = Depends(optional_auth), store: DataStore = Depends(get_store)
):
    return {"reports": await store.get_reports(user_id)}


@router.post("/api/reports", dependencies=[Depends(_strict_limit)], status_code=201)
async def create_report(body: ReportBody, store: DataStore = Depends(get_store)):
    photo_url: str | None = None
    if body.photo:
        try:
            photo_url = await save_photo(body.photo)
        except ValueError as error:
            raise HttpError(400, str(error)) from error

    ai_observation = None
    if body.aiObservation:
        ai_observation = AiObservation(
            feature=body.aiObservation.feature,
            confidence=body.aiObservation.confidence,
            modelVersion=body.aiObservation.modelVersion,
            allDetections=body.aiObservation.allDetections or [],
            createdAt=datetime.now(timezone.utc).isoformat(),
        )

    report = await store.create_report(
        {
            "type": body.type,
            "description": body.description,
            "latitude": body.latitude,
            "longitude": body.longitude,
            "photoUrl": photo_url,
            "aiObservation": ai_observation,
        }
    )
    invalidate_route_results()
    return {"report": report}


@router.post("/api/reports/{report_id}/vote", )
async def vote_report(
    report_id: str,
    body: VoteBody,
    user_id: str = Depends(require_auth),
    store: DataStore = Depends(get_store),
):
    try:
        report = await store.vote_report(report_id, user_id, body.direction)
    except ValueError:
        raise HttpError(404, "Report not found.") from None
    invalidate_route_results()
    return {"report": report}


@router.post("/api/ai/analyze", dependencies=[Depends(_strict_limit)], status_code=201)
async def ai_analyze(body: AiBody, store: DataStore = Depends(get_store)):
    if not body.observation:
        raise HttpError(
            400,
            "No observation provided. Analysis runs on-device (privacy-first); send the structured result.",
        )
    photo_url: str | None = None
    if body.image:
        photo_url = await save_photo(body.image)
    observation = await store.create_ai_observation(
        AiObservation(
            feature=body.observation.feature,
            confidence=body.observation.confidence,
            modelVersion=body.observation.modelVersion,
            allDetections=body.observation.allDetections or [],
            createdAt=datetime.now(timezone.utc).isoformat(),
        )
    )
    payload = {"ok": True, "observation": observation}
    if photo_url:
        payload["photoUrl"] = photo_url
    return payload


@router.get("/api/profile", )
async def get_profile(
    user_id: str | None = Depends(optional_auth), store: DataStore = Depends(get_store)
):
    return {"profile": await store.get_profile(user_id)}


@router.put("/api/profile", )
async def put_profile(
    body: ProfileBody,
    user_id: str | None = Depends(optional_auth),
    store: DataStore = Depends(get_store),
):
    profile = ProfilePreferences(**body.model_dump())
    return {"profile": await store.save_profile(profile, user_id)}

