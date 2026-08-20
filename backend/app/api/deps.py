"""Shared FastAPI dependencies: store access and authentication."""

from fastapi import Depends, Request

from ..core.errors import HttpError
from ..core.ratelimit import RateLimiter
from ..schemas import Coordinates
from ..services.auth import verify_token
from ..services.store import DataStore
from ..utils.spatial import is_valid_coordinate


def rate_limit(limiter: RateLimiter):
    """Build a dependency that rejects a client IP once the window is exhausted."""

    def dependency(request: Request) -> None:
        key = request.client.host if request.client else "unknown"
        allowed, _, _ = limiter.allow(key)
        if not allowed:
            raise HttpError(429, limiter.message)

    return dependency


def get_store(request: Request) -> DataStore:
    return request.app.state.store


def extract_bearer_token(request: Request) -> str | None:
    header = request.headers.get("Authorization")
    if not header:
        return None
    parts = header.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1]


def optional_auth(request: Request) -> str | None:
    """Returns the authenticated user id when a valid token is present, else None."""
    token = extract_bearer_token(request)
    if not token:
        return None
    return verify_token(token)


def require_auth(request: Request) -> str:
    token = extract_bearer_token(request)
    if not token:
        raise HttpError(401, "Authentication required.")
    user_id = verify_token(token)
    if not user_id:
        raise HttpError(401, "Invalid or expired session.")
    return user_id


def parse_coordinates(value: str) -> Coordinates:
    """Parse a 'lat,lon' query parameter, raising a zod-style validation error."""
    parts = value.split(",")
    if len(parts) != 2:
        raise ValueError("expected format 'lat,lon'")
    try:
        latitude = float(parts[0])
        longitude = float(parts[1])
    except ValueError:
        raise ValueError("expected format 'lat,lon'") from None
    if not is_valid_coordinate(latitude, longitude):
        raise ValueError("Coordinates out of range: latitude -90..90, longitude -180..180")
    return Coordinates(latitude=latitude, longitude=longitude)