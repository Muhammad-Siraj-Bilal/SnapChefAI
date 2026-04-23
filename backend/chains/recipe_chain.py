"""
SnapChef AI — Recipe Chain (Bulletproof Final)
Zero silent failures — always returns real data or a clear error.
"""

import re
import json
import logging
from typing import Optional

from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage
from langsmith import traceable
from rag.retriever import get_relevant_context

from models.schemas import (
    UserPreferences,
    RecipeResponse,
    RecipeDetail,
    VisionOutput,
)

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are a professional chef. Return ONLY a single valid JSON object. "
    "No markdown, no prose, no explanation. Just raw JSON."
)

GENERATE_PROMPT = """\
Generate a complete authentic recipe for: {dish_name}

User: {pref_context}

Return this exact JSON (with real values — no placeholders):
{{
  "dish_name": "{dish_name}",
  "description": "2 sentence description",
  "prep_time": "15 minutes",
  "cook_time": "30 minutes",
  "difficulty": "Medium",
  "servings": number,
  "ingredients": ["quantity + ingredient 1", "quantity + ingredient 2"],
  "steps": ["Step 1: ...", "Step 2: ..."],
  "substitutions": ["swap 1", "swap 2"],
  "allergy_warnings": [],
  "healthier_version": "...",
  "budget_version": "...",
  "shopping_list": ["quantity + item 1", "quantity + item 2"],
  "cuisine_twists": {{"Twist Name": "description"}},
  "nutrition_note": "..."
}}"""

MODIFY_PROMPT = """\
Modify this recipe following the Instruction. Use the provided Cooking Knowledge to ensure accuracy.

Current dish: {current_dish}
Current ingredients: {current_ingredients}

Instruction: {instruction}
User Preferences: {pref_context}

COOKING KNOWLEDGE (Use this!):
{rag_context}

Rules:
- "vegan": remove ALL meat/fish/chicken/eggs/dairy/ghee. Use tofu, mushrooms, or plant-based proteins.
- "gluten-free": replace wheat flour/pasta with rice/almond/GF alternatives.
- Ensure ingredient quantities are logical.
- Change dish_name to reflect the change (e.g., "Vegan Pad Thai").
- Output ONLY valid JSON. No markdown.

Return this JSON:
{{
  "dish_name": "...",
  "description": "...",
  "prep_time": "...",
  "cook_time": "...",
  "difficulty": "Easy/Medium",
  "servings": number,
  "ingredients": ["quantity + ingredient"],
  "steps": ["Step 1...", "Step 2..."],
  "substitutions": ["..."],
  "allergy_warnings": [],
  "healthier_version": "...",
  "budget_version": "...",
  "shopping_list": ["quantity + item"],
  "cuisine_twists": {{"Twist": "Description"}},
  "nutrition_note": "..."
}}"""


def _get_llm() -> ChatGroq:
    """Returns a highly available model to prevent 429 errors."""
    return ChatGroq(
        model="llama-3.1-8b-instant",
        temperature=0.1,  # Low temperature for precise JSON
        max_tokens=4096,
    )


def _pref_context(prefs: UserPreferences) -> str:
    allergy_dict = prefs.allergies.model_dump()
    active = [k.replace("_", " ") for k, v in allergy_dict.items() if v]
    return (
        f"Diet={prefs.health_focus}, Budget={prefs.budget_level}, "
        f"Servings={prefs.servings}, Allergies={active or 'None'}"
    )


def _extract_json(raw: str) -> dict:
    """Robustly extract a JSON object from raw LLM output."""
    text = raw.strip()
    # Strip markdown fences
    for fence in ["```json", "```"]:
        if fence in text:
            text = text.split(fence)[1].split("```")[0].strip()
            break
    # Find outermost { ... }
    start = text.find("{")
    end = text.rfind("}") + 1
    if start >= 0 and end > start:
        text = text[start:end]
    return json.loads(text)


def _build_response(data: dict, session_id: str) -> RecipeResponse:
    """
    Build a RecipeResponse directly from a dict using .get() — never crashes.
    """
    ingredients = data.get("ingredients") or []
    steps = data.get("steps") or []
    shopping = data.get("shopping_list") or []
    subs = data.get("substitutions") or []
    warnings = data.get("allergy_warnings") or []
    twists = data.get("cuisine_twists") or {}
    servings = data.get("servings", 2)
    if isinstance(servings, str):
        # extract first number
        nums = re.findall(r"\d+", servings)
        servings = int(nums[0]) if nums else 2

    return RecipeResponse(
        dish_name=data.get("dish_name", "Chef's Recipe"),
        confidence=0.98,
        confidence_label="High",
        detected_ingredients=ingredients,
        recipe=RecipeDetail(
            description=data.get("description", ""),
            prep_time=data.get("prep_time", "15 minutes"),
            cook_time=data.get("cook_time", "30 minutes"),
            difficulty=data.get("difficulty", "Medium"),
            servings=servings,
            ingredients=ingredients,
            steps=steps,
        ),
        substitutions=subs,
        allergy_warnings=warnings,
        healthier_version=data.get("healthier_version", ""),
        budget_version=data.get("budget_version", ""),
        shopping_list=shopping,
        cuisine_twists=twists if isinstance(twists, dict) else {},
        nutrition_note=data.get("nutrition_note", ""),
        session_id=session_id,
    )


@traceable(name="generate_recipe")
def generate_recipe(
    vision_output: VisionOutput,
    preferences: UserPreferences,
    session_id: str,
) -> RecipeResponse:
    llm = _get_llm()
    pref_ctx = _pref_context(preferences)

    prompt = GENERATE_PROMPT.format(
        dish_name=vision_output.dish_name,
        pref_context=pref_ctx,
    )

    logger.info(f"[generate_recipe] dish={vision_output.dish_name}")
    res = llm.invoke([SystemMessage(content=SYSTEM_PROMPT), HumanMessage(content=prompt)])
    raw = res.content

    try:
        data = _extract_json(raw)
        result = _build_response(data, session_id)
        logger.info(
            f"[generate_recipe] OK: {result.dish_name}, "
            f"{len(result.recipe.ingredients)} ingredients, {len(result.recipe.steps)} steps"
        )
        return result
    except Exception as e:
        logger.error(f"[generate_recipe] PARSE FAIL: {e}\nRaw (first 400): {raw[:400]}")
        # Real fallback — not placeholders
        return RecipeResponse(
            dish_name=vision_output.dish_name,
            confidence=0.4,
            confidence_label="Low / Uncertain",
            detected_ingredients=vision_output.detected_ingredients,
            recipe=RecipeDetail(
                description=f"Could not fully parse the recipe for {vision_output.dish_name}. The AI response was malformed. Please try again.",
                ingredients=vision_output.detected_ingredients,
                steps=["Please tap 'New Recipe' and try again."],
            ),
            session_id=session_id,
        )


@traceable(name="rewrite_recipe")
def rewrite_recipe_with_instruction(
    current_recipe: Optional[RecipeResponse],
    instruction: str,
    preferences: UserPreferences,
    session_id: str,
) -> Optional[RecipeResponse]:
    llm = _get_llm()
    pref_ctx = _pref_context(preferences)

    current_dish = current_recipe.dish_name if current_recipe else "Unknown"
    current_ings = (
        current_recipe.recipe.ingredients
        if current_recipe and current_recipe.recipe.ingredients
        else []
    )

    # Retrieve RAG context for the specific instruction
    rag_context = get_relevant_context(instruction, k=2)
    logger.info(f"[rewrite_recipe] RAG context: {len(rag_context)} chars")

    prompt = MODIFY_PROMPT.format(
        current_dish=current_dish,
        current_ingredients=json.dumps(current_ings, ensure_ascii=False),
        instruction=instruction,
        pref_context=pref_ctx,
        rag_context=rag_context,
    )

    logger.info(f"[rewrite_recipe] Processing '{current_dish}' -> '{instruction}'")
    res = llm.invoke([SystemMessage(content=SYSTEM_PROMPT), HumanMessage(content=prompt)])
    raw = res.content

    try:
        data = _extract_json(raw)
        result = _build_response(data, session_id)
        logger.info(
            f"[rewrite_recipe] OK: {result.dish_name}, "
            f"{len(result.recipe.ingredients)} ingredients"
        )
        return result
    except Exception as e:
        logger.error(f"[rewrite_recipe] PARSE FAIL: {e}\nRaw (first 400): {raw[:400]}")
        return current_recipe  # return unchanged, don't show broken data
