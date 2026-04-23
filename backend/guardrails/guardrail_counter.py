"""
SnapChef AI — Guardrail Event Counter
Thread-safe singleton that tracks every blocked/flagged request by category.
Exposed via the /stats endpoint.
"""

import threading
import time
import logging
from dataclasses import dataclass, field
from typing import Dict

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# Event category constants
# ─────────────────────────────────────────────
class GuardrailEvent:
    NON_FOOD           = "blocked_non_food"
    LOW_CONFIDENCE     = "blocked_low_confidence"
    UNSAFE_CONTENT     = "blocked_unsafe_content"
    PROMPT_INJECTION   = "blocked_prompt_injection"
    JAILBREAK_ATTEMPT  = "blocked_jailbreak"
    ALLERGEN_WARNING   = "flagged_allergen"
    RATE_LIMITED       = "rate_limited"
    RECIPE_VIOLATION   = "blocked_recipe_violation"   # output allergen violation


@dataclass
class _CounterState:
    total_requests_checked: int = 0
    blocked_non_food: int = 0
    blocked_low_confidence: int = 0
    blocked_unsafe_content: int = 0
    blocked_prompt_injection: int = 0
    blocked_jailbreak: int = 0
    flagged_allergen: int = 0
    rate_limited: int = 0
    blocked_recipe_violation: int = 0
    started_at: float = field(default_factory=time.time)

    # Per-endpoint breakdown
    analyze_blocked: int = 0
    chat_blocked: int = 0

    def as_dict(self) -> Dict:
        uptime_seconds = int(time.time() - self.started_at)
        total_blocked = (
            self.blocked_non_food
            + self.blocked_low_confidence
            + self.blocked_unsafe_content
            + self.blocked_prompt_injection
            + self.blocked_jailbreak
            + self.rate_limited
            + self.blocked_recipe_violation
        )
        return {
            "uptime_seconds": uptime_seconds,
            "total_requests_checked": self.total_requests_checked,
            "total_blocked": total_blocked,
            "total_flagged_warnings": self.flagged_allergen,
            "block_rate_pct": round(
                (total_blocked / max(self.total_requests_checked, 1)) * 100, 2
            ),
            "by_category": {
                GuardrailEvent.NON_FOOD:         self.blocked_non_food,
                GuardrailEvent.LOW_CONFIDENCE:   self.blocked_low_confidence,
                GuardrailEvent.UNSAFE_CONTENT:   self.blocked_unsafe_content,
                GuardrailEvent.PROMPT_INJECTION: self.blocked_prompt_injection,
                GuardrailEvent.JAILBREAK_ATTEMPT: self.blocked_jailbreak,
                GuardrailEvent.ALLERGEN_WARNING: self.flagged_allergen,
                GuardrailEvent.RATE_LIMITED:     self.rate_limited,
                GuardrailEvent.RECIPE_VIOLATION: self.blocked_recipe_violation,
            },
            "by_endpoint": {
                "analyze": self.analyze_blocked,
                "chat":    self.chat_blocked,
            },
        }


class GuardrailCounter:
    _instance: "GuardrailCounter | None" = None
    _lock: threading.Lock = threading.Lock()

    def __init__(self):
        self._sessions: Dict[str, _CounterState] = {}
        self._state_lock = threading.Lock()

    def __new__(cls) -> "GuardrailCounter":
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance

    def _get_sid(self, sid: str = None) -> str:
        return sid or "global"

    def tick(self, session_id: str = None) -> None:
        sid = self._get_sid(session_id)
        with self._state_lock:
            if sid not in self._sessions: self._sessions[sid] = _CounterState()
            self._sessions[sid].total_requests_checked += 1

    def increment(self, event: str, session_id: str = None, endpoint: str = "") -> None:
        sid = self._get_sid(session_id)
        with self._state_lock:
            if sid not in self._sessions: self._sessions[sid] = _CounterState()
            state = self._sessions[sid]
            if hasattr(state, event):
                setattr(state, event, getattr(state, event) + 1)
            if event != GuardrailEvent.ALLERGEN_WARNING:
                if endpoint == "analyze": state.analyze_blocked += 1
                elif endpoint == "chat": state.chat_blocked += 1

    def get_stats(self, session_id: str = None) -> Dict:
        sid = self._get_sid(session_id)
        with self._state_lock:
            if sid not in self._sessions: self._sessions[sid] = _CounterState()
            return self._sessions[sid].as_dict()

    def reset(self, session_id: str = None) -> None:
        with self._state_lock:
            if session_id:
                if session_id in self._sessions: del self._sessions[session_id]
            else:
                self._sessions = {}


# Module-level singleton — import this directly
counter = GuardrailCounter()
