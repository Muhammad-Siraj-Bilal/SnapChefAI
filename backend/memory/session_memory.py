"""
SnapChef AI — Session Memory
Per-session conversation memory with TTL expiry.
"""

import time
import logging
from typing import Optional
from langchain.memory import ConversationBufferWindowMemory
from models.schemas import UserPreferences, RecipeResponse

logger = logging.getLogger(__name__)

# In-memory store: session_id -> session data
_sessions: dict[str, dict] = {}


def _now() -> float:
    return time.time()


def get_or_create_session(session_id: str, ttl_seconds: int = 7200) -> dict:
    """
    Returns existing session or creates a new one.
    Session structure:
      - memory: ConversationBufferWindowMemory
      - preferences: UserPreferences
      - current_recipe: RecipeResponse | None
      - created_at: float
      - last_accessed: float
    """
    _cleanup_expired_sessions(ttl_seconds)

    if session_id not in _sessions:
        logger.info(f"Creating new session: {session_id}")
        _sessions[session_id] = {
            "memory": ConversationBufferWindowMemory(
                k=10,
                memory_key="chat_history",
                return_messages=True,
            ),
            "preferences": UserPreferences(),
            "current_recipe": None,
            "created_at": _now(),
            "last_accessed": _now(),
        }
    else:
        _sessions[session_id]["last_accessed"] = _now()

    return _sessions[session_id]


def update_session_preferences(session_id: str, preferences: UserPreferences) -> None:
    """Updates user preferences for a session."""
    session = get_or_create_session(session_id)
    session["preferences"] = preferences
    logger.info(f"Updated preferences for session {session_id}")


def update_session_recipe(session_id: str, recipe: RecipeResponse) -> None:
    """Stores the most recent recipe in the session."""
    session = get_or_create_session(session_id)
    session["current_recipe"] = recipe


def get_session_recipe(session_id: str) -> Optional[RecipeResponse]:
    """Returns the most recent recipe from the session, or None."""
    if session_id in _sessions:
        return _sessions[session_id].get("current_recipe")
    return None


def get_session_memory(session_id: str) -> ConversationBufferWindowMemory:
    """Returns the LangChain memory for a session."""
    return get_or_create_session(session_id)["memory"]


def get_session_preferences(session_id: str) -> UserPreferences:
    """Returns stored user preferences for a session."""
    return get_or_create_session(session_id)["preferences"]


def delete_session(session_id: str) -> None:
    """Deletes a session (e.g., when user resets)."""
    if session_id in _sessions:
        del _sessions[session_id]
        logger.info(f"Deleted session: {session_id}")


def _cleanup_expired_sessions(ttl_seconds: int) -> None:
    """Removes sessions that have not been accessed within TTL."""
    cutoff = _now() - ttl_seconds
    expired = [sid for sid, s in _sessions.items() if s["last_accessed"] < cutoff]
    for sid in expired:
        del _sessions[sid]
        logger.info(f"Expired session cleaned up: {sid}")


def get_active_session_count() -> int:
    return len(_sessions)
