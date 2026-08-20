"""Minimal in-memory TTL cache with a size cap (evicts oldest entry).

Port of the TypeScript ttl_cache used to keep route candidates and scored
results fast across repeated or mode-switched requests.
"""

import threading
import time
from collections import OrderedDict
from typing import Generic, Optional, TypeVar

K = TypeVar("K")
V = TypeVar("V")


class TtlCache(Generic[K, V]):
    def __init__(self, ttl_ms: int, max_size: int = 200):
        self._ttl_ms = ttl_ms
        self._max_size = max_size
        self._entries: OrderedDict[K, tuple[float, V]] = OrderedDict()
        self._lock = threading.Lock()

    def get(self, key: K) -> Optional[V]:
        with self._lock:
            entry = self._entries.get(key)
            if entry is None:
                return None
            expires, value = entry
            if expires < time.time() * 1000:
                del self._entries[key]
                return None
            return value

    def set(self, key: K, value: V) -> None:
        with self._lock:
            self._entries[key] = (time.time() * 1000 + self._ttl_ms, value)
            self._entries.move_to_end(key)
            while len(self._entries) > self._max_size:
                self._entries.popitem(last=False)

    def delete(self, key: K) -> None:
        with self._lock:
            self._entries.pop(key, None)

    def clear(self) -> None:
        with self._lock:
            self._entries.clear()


def create_ttl_cache(ttl_ms: int, max_size: int = 200) -> TtlCache:
    return TtlCache(ttl_ms=ttl_ms, max_size=max_size)