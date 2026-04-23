"""
SnapChef AI — Chat Chain (Final Stable)
Clear two paths: MODIFICATION vs NEW_DISH (redirect), with keyword-first detection.
"""

import re
import json
import logging
from typing import Tuple

from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from langsmith import traceable

from models.schemas import UserPreferences, RecipeResponse
from chains.recipe_chain import rewrite_recipe_with_instruction
from rag.retriever import get_relevant_context
from memory.session_memory import (
    get_session_memory,
    get_session_recipe,
    update_session_preferences,
    update_session_recipe,
)
from guardrails.guardrails import check_unsafe_request
from guardrails.injection_guard import check_prompt_injection
from guardrails.guardrail_counter import counter, GuardrailEvent

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────
# Keyword-based intent detection (fast, reliable)
# ──────────────────────────────────────────────────────────
MODIFICATION_KEYWORDS = [
    "vegan", "vegetarian", "spicy", "spicier", "healthier", "healthy",
    "less salt", "less sugar", "low carb", "keto", "gluten free", "gluten-free",
    "dairy free", "dairy-free", "halal", "kosher", "no egg", "no meat",
    "more protein", "high protein", "budget", "cheaper", "quick", "faster",
    "30 minutes", "20 minutes", "serve", "servings", "people", "portions",
    "air fryer", "microwave", "instant pot", "korean", "indian", "italian",
    "mediterranean", "thai", "chinese", "mexican", "spice", "mild",
    "substitute", "swap", "replace", "without chicken", "without meat",
    "add more", "less oil", "no oil", "extra", "double", "half",
    "peanut free", "nut free", "allergy", "calories", "lighter", "nutritional",
    "instead of", "what can i use", "substitute for",
]

NEW_DISH_PHRASES = [
    "i want to make", "i want to cook", "i wanna make", "lets make",
    "let's make", "can we make", "can i make", "how do i make",
    "make sushi", "make pizza", "make pasta", "make ramen",
    "switch to", "change to", "different dish", "new recipe", 
    "another recipe", "something else", "start from scratch",
]

CHAT_KEYWORDS = [
    "source", "origin", "where did you", "who are you", "what are you",
    "visa", "requirements", "passport", "travel", "weather",
]


def _keyword_classify(message: str, current_dish: str) -> Tuple[str, str]:
    """Fast keyword-based classification. Returns (intent, dish_name)."""
    lower = message.lower().strip()

    # Check for direct "chat/source" keywords first to prevent them from being mods
    for kw in CHAT_KEYWORDS:
        if kw in lower:
            return "chat", ""

    # Check modification keywords
    for kw in MODIFICATION_KEYWORDS:
        if kw in lower:
            return "modification", ""

    # Check new dish phrases
    for phrase in NEW_DISH_PHRASES:
        if phrase in lower:
            # Try to extract the dish name from the message
            words = message.strip().split()
            # Heuristic: last 1-3 words are often the dish
            dish_candidate = " ".join(words[-3:]).strip("?.!")
            return "new_dish", dish_candidate.title()

    return "unknown", ""


async def _classify_intent(message: str, current_dish: str) -> Tuple[str, str]:
    """
    Two-stage classification:
    1. Fast keyword check
    2. LLM fallback if ambiguous
    """
    # Stage 1: keyword-based
    intent, dish = _keyword_classify(message, current_dish)
    if intent != "unknown":
        logger.info(f"[intent] keyword match -> {intent}")
        return intent, dish

    # Stage 2: LLM fallback for ambiguous cases
    try:
        llm = ChatGroq(model="llama-3.1-8b-instant", temperature=0, max_tokens=20)
        prompt = (
            f'Current dish: "{current_dish}"\n'
            f'User said: "{message}"\n\n'
            "Is the user asking to MODIFY the current dish (scale, swap, veganize), "
            "request a COMPLETELY DIFFERENT dish (New Dish), "
            "or just ASK A QUESTION about ingredients/cooking (Chat)?\n"
            "Substitution questions like 'what can I use instead of X' are CHAT or MODIFICATION, NOT NEW_DISH.\n"
            "Reply ONLY with: MODIFICATION, NEW_DISH, or CHAT\n"
            "If NEW_DISH, add the dish name: NEW_DISH: Dish Name"
        )
        res = await llm.ainvoke([HumanMessage(content=prompt)])
        content = res.content.strip().upper()

        if "NEW_DISH" in content:
            parts = content.split(":", 1)
            dish_name = parts[1].strip().title() if len(parts) > 1 else "New Dish"
            return "new_dish", dish_name
        if "MODIFICATION" in content:
            return "modification", ""
        return "chat", ""
    except Exception as e:
        logger.warning(f"[intent] LLM fallback failed: {e}")
        return "chat", ""


CHAT_SYSTEM_PROMPT = """You are SnapChef AI, a professional culinary assistant.
You help users with their current recipe using provided Cooking Knowledge.

RULES:
- Answer concisely (2-3 sentences max).
- If the question is about non-cooking topics (e.g. visas, history, tech), politely state that you only assist with cooking.
- If uncertainty exists (e.g. blurry image), admit it and give likely possibilities instead of guessing.
- NEVER start your response with prefixes like "ACTION:" or "REPLY:".
- Use the provided context to give safe, accurate food safety and substitution advice.
"""


@traceable(name="process_chat")
async def process_cooking_chat_v5(
    session_id: str,
    message: str,
    preferences: UserPreferences,
) -> dict:
    # 1. SAFETY GUARDRAILS
    counter.tick(session_id=session_id)
    injection = check_prompt_injection(message)
    if injection.is_injection:
        counter.increment(GuardrailEvent.PROMPT_INJECTION, session_id=session_id, endpoint="chat")
        return {
            "reply": injection.safe_reply,
            "action_taken": "blocked_injection",
            "guardrail_stats": counter.get_stats(session_id=session_id)
        }

    unsafe = check_unsafe_request(message)
    if unsafe[0]:
        counter.increment(GuardrailEvent.UNSAFE_CONTENT, session_id=session_id, endpoint="chat")
        return {
            "reply": unsafe[1],
            "action_taken": "blocked_unsafe",
            "guardrail_stats": counter.get_stats(session_id=session_id)
        }

    # 2. Extract servings from message if present
    serving_match = re.search(r"(serve|serves|for)\s+(\d+)", message, re.IGNORECASE)
    if serving_match:
        new_servings = int(serving_match.group(2))
        preferences.servings = new_servings
        logger.info(f"[chat] Updating servings to {new_servings} based on message")

    update_session_preferences(session_id, preferences)
    current = get_session_recipe(session_id)
    current_dish = current.dish_name if current else "your dish"

    intent, new_dish_name = await _classify_intent(message, current_dish)
    logger.info(f"[chat] intent={intent}, new_dish={new_dish_name!r}, current={current_dish!r}")

    memory = get_session_memory(session_id)
    updated_recipe = None
    action_taken = "chat"

    # ── Path 1: New Dish → hardcoded redirect reply ──
    if intent == "new_dish":
        action_taken = "redirect"
        reply_text = (
            f"This chat session is dedicated to your **{current_dish}** recipe. "
            f"To start a fresh recipe for **{new_dish_name}**, click the button below — "
            f"or stay here to keep adapting your {current_dish}! 👇"
        )
        memory.save_context({"input": message}, {"output": reply_text})
        return {
            "reply": reply_text,
            "action_taken": "redirect",
            "new_dish_name": new_dish_name,
            "current_dish_name": current_dish,
            "updated_recipe": None,
            "requires_confirmation": False,
            "suggested_actions": [],
            "guardrail_stats": counter.get_stats(session_id=session_id),
        }

    # ── Path 2: Modification → rewrite recipe ──
    if intent == "modification" and current:
        logger.info(f"[chat] Starting rewrite for: '{message}'")
        try:
            updated_recipe = rewrite_recipe_with_instruction(
                current, message, preferences, session_id
            )
            if updated_recipe and updated_recipe.recipe.ingredients:
                action_taken = "rewrite"
                update_session_recipe(session_id, updated_recipe)
                logger.info(f"[chat] Rewrite SUCCESS: {updated_recipe.dish_name}")
            else:
                updated_recipe = None
                action_taken = "chat"
        except Exception as e:
            logger.error(f"[chat] Rewrite exception: {e}")
            updated_recipe = None
            action_taken = "chat"

    # ── Build context ──
    rag_context = ""
    if intent == "chat":
        # Search for knowledge base context
        rag_context = get_relevant_context(message)
        if rag_context:
            logger.info(f"[chat] RAG context retrieved ({len(rag_context)} chars)")
        else:
            # Maybe search for general dish info if it's about the current dish
            rag_context = get_relevant_context(current_dish, k=1)

    # ── Build LLM chat reply ──
    llm = ChatGroq(model="llama-3.1-8b-instant", temperature=0.7, max_tokens=300)
    history = memory.load_memory_variables({}).get("chat_history", [])
    messages = [SystemMessage(content=CHAT_SYSTEM_PROMPT)]
    
    # Context injection
    if intent == "modification" and updated_recipe:
        prompt_body = (
            f"Current dish: {current_dish}. User asked: \"{message}\".\n"
            f"You have updated the recipe to: {updated_recipe.dish_name}.\n"
            f"Briefly confirm the key changes in 1-2 sentences. Avoid placeholders."
        )
    else:
        prompt_body = f"Current dish: {current_dish}.\n\n"
        if rag_context:
            prompt_body += f"COOKING KNOWLEDGE:\n{rag_context}\n\n"
        prompt_body += f"User: \"{message}\". Answer based on context if available."

    for m in history[-4:]:
        if hasattr(m, "type"):
            messages.append(
                HumanMessage(content=m.content) if m.type == "human"
                else AIMessage(content=m.content)
            )

    messages.append(HumanMessage(content=prompt_body))
    response = await llm.ainvoke(messages)
    reply_text = response.content.strip()
    memory.save_context({"input": message}, {"output": reply_text})

    return {
        "reply": reply_text,
        "action_taken": action_taken,
        "new_dish_name": new_dish_name,
        "current_dish_name": current_dish,
        "updated_recipe": updated_recipe,
        "requires_confirmation": bool(updated_recipe),
        "suggested_actions": ["🛒 Shopping List", "🌡️ Healthier", "👨‍👩‍👧‍👦 Serve 4"],
        "guardrail_stats": counter.get_stats(session_id=session_id),
    }
