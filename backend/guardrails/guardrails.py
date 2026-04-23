"""
SnapChef AI — Input/Output Guardrails
Validates inputs before processing and ensures safe, accurate outputs.
Includes prompt injection defence, allergen scanning, and output validation.
"""

import logging
from typing import List, Tuple
from models.schemas import VisionOutput, UserPreferences

# Re-export injection guard for convenience
from guardrails.injection_guard import check_prompt_injection, sanitize_input, InjectionResult  # noqa: F401

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# Confidence thresholds
# ─────────────────────────────────────────────
CONFIDENCE_HIGH = 0.75
CONFIDENCE_MEDIUM = 0.50
CONFIDENCE_LOW = 0.0  # below MEDIUM is "uncertain"

# ─────────────────────────────────────────────
# Allergen keyword maps
# ─────────────────────────────────────────────
ALLERGEN_KEYWORDS = {
    "peanut_free": [
        "peanut", "peanuts", "peanut butter", "groundnut", "groundnuts",
        "arachis oil", "monkey nuts",
    ],
    "dairy_free": [
        "milk", "butter", "cream", "cheese", "yogurt", "yoghurt", "ghee",
        "whey", "casein", "lactose", "mozzarella", "parmesan", "brie",
        "cheddar", "ricotta", "sour cream", "crème fraîche",
    ],
    "gluten_free": [
        "flour", "wheat", "bread", "pasta", "noodles", "barley", "rye",
        "spelt", "semolina", "couscous", "breadcrumbs", "soy sauce",
        "malt", "beer", "ale", "lager",
    ],
    "egg_free": [
        "egg", "eggs", "egg white", "egg yolk", "mayonnaise", "meringue",
        "albumin", "ovalbumin",
    ],
    "shellfish_free": [
        "shrimp", "prawn", "crab", "lobster", "crayfish", "clam", "oyster",
        "scallop", "mussel", "squid", "octopus", "abalone",
    ],
}

# Unsafe request patterns (keyword-level; deep detection is in injection_guard.py)
UNSAFE_PATTERNS = [
    "make me sick",
    "food poisoning on purpose",
    "raw chicken is safe",
    "undercooked pork is fine",
    "how to poison",
    "laxative recipe",
    "emetic recipe",
    "make someone vomit",
    "foodborne illness intentional",
    "poisonous",
    "poison",
    "toxic",
    "lethal",
    "deadly",
    "harmful ingredient",
    "deathly",
]


def get_confidence_label(confidence: float) -> str:
    if confidence >= CONFIDENCE_HIGH:
        return "High"
    elif confidence >= CONFIDENCE_MEDIUM:
        return "Medium"
    else:
        return "Low / Uncertain"


def is_uncertain(confidence: float) -> bool:
    return confidence < CONFIDENCE_MEDIUM


def build_uncertainty_message(vision_output: VisionOutput) -> str:
    """Returns a helpful message when confidence is too low."""
    candidates = vision_output.dish_name if vision_output.dish_name != "Unknown" else "something"
    return (
        f"I'm not fully certain, but this looks most similar to **{candidates}** "
        f"(confidence: {vision_output.confidence:.0%}). "
        "For a more accurate recipe, could you:\n"
        "- Upload a clearer, better-lit photo\n"
        "- Tell me what dish or ingredients this is\n"
        "- Or describe what you're looking to cook"
    )


def check_non_food(is_food: bool) -> tuple[bool, str]:
    """Returns (is_blocked, error_message) if image is not food."""
    if not is_food:
        return True, (
            "The uploaded image doesn't appear to contain food or ingredients. "
            "Please upload a photo of a dish, ingredients, your fridge, or your pantry."
        )
    return False, ""


def check_unsafe_request(message: str) -> Tuple[bool, str]:
    """Returns (is_blocked, error_message) if request contains unsafe content."""
    message_lower = message.lower()
    for pattern in UNSAFE_PATTERNS:
        if pattern in message_lower:
            return True, (
                "I can only help with safe, healthy recipe suggestions. "
                "I can't assist with that request."
            )
    return False, ""


def scan_ingredients_for_allergens(
    ingredients: List[str],
    preferences: UserPreferences,
) -> List[str]:
    """
    Scans ingredient list for allergen keywords based on user preferences.
    Returns list of warning strings.
    """
    warnings: List[str] = []
    ingredients_lower = [i.lower() for i in ingredients]
    combined_text = " ".join(ingredients_lower)

    allergy_dict = preferences.allergies.model_dump()

    for allergy_key, keywords in ALLERGEN_KEYWORDS.items():
        if allergy_dict.get(allergy_key, False):  # User has this restriction
            found = [kw for kw in keywords if kw in combined_text]
            if found:
                allergy_name = allergy_key.replace("_free", "").replace("_", " ").title()
                warnings.append(
                    f"⚠️ {allergy_name} allergen detected: {', '.join(found)}. "
                    "Consider the substitution suggestions."
                )
    return warnings


def validate_recipe_has_no_banned_ingredients(
    recipe_text: str,
    preferences: UserPreferences,
) -> List[str]:
    """
    Checks that the generated recipe doesn't include allergen ingredients
    the user explicitly wants to avoid. Returns list of violations found.
    """
    violations: List[str] = []
    text_lower = recipe_text.lower()
    allergy_dict = preferences.allergies.model_dump()

    for allergy_key, keywords in ALLERGEN_KEYWORDS.items():
        if allergy_dict.get(allergy_key, False):
            found = [kw for kw in keywords if kw in text_lower]
            if found:
                violations.extend(found)

    return violations
