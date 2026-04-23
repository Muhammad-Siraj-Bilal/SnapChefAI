"""
SnapChef AI — Per-Session Rate Limiter
Sliding-window rate limiting to prevent abuse, stored in-memory.
No Redis dependency — pure Python thread-safe implementation.
"""

import time
import threading
import logging
from collections import defaultdict, deque
from typing import Tuple

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# Default limits per endpoint
# ─────────────────────────────────────────────
RATE_LIMITS = {
    "analyze": {"max_requests": 10, "window_seconds": 60},   # 10 image analyses/min
    "chat":    {"max_requests": 30, "window_seconds": 60},   # 30 chat messages/min
    "weather": {"max_requests": 20, "window_seconds": 60},
}


class SlidingWindowRateLimiter:
    """
    Per-session sliding window rate limiter.

    Stores a deque of timestamps per (session_id, endpoint) pair.
    Timestamps older than the window are purged on each check.

    Thread-safe via a single lock per limiter instance.
    """

    def __init__(self):
        # (session_id, endpoint) -> deque of request timestamps
        self._windows: dict[tuple[str, str], deque] = defaultdict(deque)
        self._lock = threading.Lock()
        logger.info("SlidingWindowRateLimiter initialised.")

    def is_allowed(self, session_id: str, endpoint: str) -> Tuple[bool, str]:
        """
        Check whether a request from session_id to endpoint is within rate limits.

        Returns:
            (allowed: bool, message: str)
        """
        limit_config = RATE_LIMITS.get(endpoint, {"max_requests": 60, "window_seconds": 60})
        max_requests = limit_config["max_requests"]
        window = limit_config["window_seconds"]

        now = time.time()
        cutoff = now - window
        key = (session_id, endpoint)

        with self._lock:
            dq = self._windows[key]

            # Purge expired timestamps
            while dq and dq[0] < cutoff:
                dq.popleft()

            count = len(dq)

            if count >= max_requests:
                retry_after = int(window - (now - dq[0])) + 1
                msg = (
                    f"Rate limit exceeded for /{endpoint}: "
                    f"{max_requests} requests per {window}s allowed. "
                    f"Please wait {retry_after}s before retrying."
                )
                logger.warning(
                    f"Rate limit hit: session={session_id} endpoint={endpoint} "
                    f"count={count}/{max_requests}"
                )
                return False, msg

            # Record this request
            dq.append(now)
            return True, ""

    def get_remaining(self, session_id: str, endpoint: str) -> dict:
        """Returns rate limit status for a session+endpoint."""
        limit_config = RATE_LIMITS.get(endpoint, {"max_requests": 60, "window_seconds": 60})
        max_requests = limit_config["max_requests"]
        window = limit_config["window_seconds"]

        now = time.time()
        cutoff = now - window
        key = (session_id, endpoint)

        with self._lock:
            dq = self._windows[key]
            while dq and dq[0] < cutoff:
                dq.popleft()
            used = len(dq)

        return {
            "endpoint": endpoint,
            "limit": max_requests,
            "used": used,
            "remaining": max(0, max_requests - used),
            "window_seconds": window,
        }

    def clear_session(self, session_id: str) -> None:
        """Remove all rate limit state for a session (e.g., on session delete)."""
        with self._lock:
            keys_to_remove = [k for k in self._windows if k[0] == session_id]
            for k in keys_to_remove:
                del self._windows[k]
        logger.info(f"Rate limit state cleared for session: {session_id}")


# Module-level singleton
rate_limiter = SlidingWindowRateLimiter()
