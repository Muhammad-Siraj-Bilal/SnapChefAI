"""
SnapChef AI — Pydantic Schemas
All request/response models for the API.
"""

from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


# ─────────────────────────────────────────────
# User Preferences (persisted in session memory)
# ─────────────────────────────────────────────

class Allergies(BaseModel):
    peanut_free: bool = False
    dairy_free: bool = False
    gluten_free: bool = False
    egg_free: bool = False
    shellfish_free: bool = False

class UserPreferences(BaseModel):
    allergies: Allergies = Field(default_factory=Allergies)
    budget_level: str = "medium"          # "low" | "medium" | "high"
    health_focus: str = "balanced"        # "balanced" | "high_protein" | "low_carb" | "keto" | "vegan" | "vegetarian"
    equipment: List[str] = Field(default_factory=lambda: ["stovetop", "oven"])
    servings: int = 2
    cuisine_preference: List[str] = Field(default_factory=list)  # e.g. ["italian", "indian"]
    city: Optional[str] = None            # For weather suggestions


# ─────────────────────────────────────────────
# Recipe Detail (structured by output parser)
# ─────────────────────────────────────────────

class RecipeDetail(BaseModel):
    description: str = ""
    prep_time: str = "15 minutes"
    cook_time: str = "30 minutes"
    difficulty: str = "Medium"            # "Easy" | "Medium" | "Hard"
    servings: int = 2
    ingredients: List[str] = Field(default_factory=list)
    steps: List[str] = Field(default_factory=list)


# ─────────────────────────────────────────────
# API Request Models
# ─────────────────────────────────────────────

class ChatRequest(BaseModel):
    session_id: str
    message: str
    preferences: UserPreferences = Field(default_factory=UserPreferences)

class WeatherRequest(BaseModel):
    city: str


# ─────────────────────────────────────────────
# API Response Models
# ─────────────────────────────────────────────

class RecipeResponse(BaseModel):
    dish_name: str
    confidence: float = Field(ge=0.0, le=1.0)
    confidence_label: str                  # "High" | "Medium" | "Low/Uncertain"
    is_uncertain: bool = False
    uncertainty_message: Optional[str] = None
    detected_ingredients: List[str] = Field(default_factory=list)
    recipe: RecipeDetail = Field(default_factory=RecipeDetail)
    substitutions: List[str] = Field(default_factory=list)
    allergy_warnings: List[str] = Field(default_factory=list)
    healthier_version: Optional[str] = None
    budget_version: Optional[str] = None
    shopping_list: List[str] = Field(default_factory=list)
    cuisine_twists: Dict[str, str] = Field(default_factory=dict)
    nutrition_note: str = ""
    session_id: str = ""

class ChatResponse(BaseModel):
    session_id: str
    reply: str
    updated_recipe: Optional[RecipeResponse] = None
    action_taken: str = "chat"
    requires_confirmation: bool = False
    suggested_actions: List[str] = Field(default_factory=list)
    new_dish_name: str = ""
    current_dish_name: str = ""
    guardrail_stats: Optional[GuardrailStats] = None

class WeatherSuggestion(BaseModel):
    city: str
    temperature_c: float
    condition: str
    suggestion: str
    recipe_mood: str                       # "light" | "hearty" | "refreshing" | "warming"

class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "SnapChef AI Backend"
    version: str = "1.0.0"


class GuardrailStats(BaseModel):
    """Real-time guardrail event counter snapshot."""
    uptime_seconds: int
    total_requests_checked: int
    total_blocked: int
    total_flagged_warnings: int
    block_rate_pct: float
    by_category: Dict[str, int]
    by_endpoint: Dict[str, int]


# ─────────────────────────────────────────────
# Internal Structured Outputs (for LangChain parsers)
# ─────────────────────────────────────────────

class VisionOutput(BaseModel):
    """Output from the vision identification chain."""
    dish_name: str = Field(description="Name of the identified dish or 'Unknown'")
    confidence: float = Field(description="Confidence score between 0.0 and 1.0", ge=0.0, le=1.0)
    detected_ingredients: List[str] = Field(description="List of detected ingredients")
    is_food: bool = Field(description="Whether the image contains food/ingredients")
    notes: str = Field(description="Any notes about uncertainty or ambiguity", default="")

class FullRecipeOutput(BaseModel):
    """Complete structured recipe output from the recipe generation chain."""
    dish_name: str
    description: str = ""
    prep_time: str = "20 minutes"
    cook_time: str = "30 minutes"
    difficulty: str = "Medium"
    servings: int = 2
    ingredients: List[str] = Field(default_factory=list)
    steps: List[str] = Field(default_factory=list)
    substitutions: List[str] = Field(default_factory=list)
    allergy_warnings: List[str] = Field(default_factory=list)
    healthier_version: str = ""
    budget_version: str = ""
    shopping_list: List[str] = Field(default_factory=list)
    cuisine_twists: Dict[str, str] = Field(default_factory=dict)
    nutrition_note: str = ""
