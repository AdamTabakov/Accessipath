"""In-memory fixed-window rate limiting (port of express-rate-limit usage).

Production limits stay tight; the limiter is bypassed when NODE_ENV=test so
test suites sharing one app instance are not throttled (same behaviour as the
Node middleware)."""

import time
import threading

from ..config import settings


class RateLimiter:
    def __init__(self, limit: int, window_ms: int, message: str):
        self.limit = limit
        self.window_ms = window_ms
        self.message = message
        self._hits: dict[str, list[float]] = {}
        self._lock = threading.Lock()

    def allow(self, key: str) -> tuple[bool, int, int]:
        """Returns (allowed, remaining, reset_seconds)."""
        if settings.is_test:
            return True, self.limit, int(self.window_ms / 1000)
        now = time.time()
        window_start = now - self.window_ms / 1000
        with self._lock:
            hits = [t for t in self._hits.get(key, []) if t > window_start]
            remaining = max(0, self.limit - len(hits))
            reset = max(0, int(self.window_ms / 1000 - (now - window_start)))
            if len(hits) >= self.limit:
                self._hits[key] = hits
                return False, 0, reset
            hits.append(now)
            self._hits[key] = hits
            return True, remaining, reset


api_limiter = RateLimiter(
    limit=120,
    window_ms=60_000,
    message="Too many requests. Please slow down.",
)
strict_limiter = RateLimiter(
    limit=20,
    window_ms=60_000,
    message="Too many requests. Please try again in a minute.",
)
auth_limiter = RateLimiter(
    limit=8,
    window_ms=60_000,
    message="Too many attempts. Please try again in a minute.",
)