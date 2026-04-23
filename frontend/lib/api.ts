/**
 * SnapChef AI — Backend API Client
 * Typed functions for all backend API calls.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ─────────────────────────────────────────────
// Types (mirrors backend Pydantic models)
// ─────────────────────────────────────────────

export interface Allergies {
  peanut_free: boolean;
  dairy_free: boolean;
  gluten_free: boolean;
  egg_free: boolean;
  shellfish_free: boolean;
}

export interface UserPreferences {
  allergies: Allergies;
  budget_level: "low" | "medium" | "high";
  health_focus: "balanced" | "high_protein" | "low_carb" | "keto" | "vegan" | "vegetarian";
  equipment: string[];
  servings: number;
  cuisine_preference: string[];
  city?: string;
}

export interface RecipeDetail {
  description: string;
  prep_time: string;
  cook_time: string;
  difficulty: string;
  servings: number;
  ingredients: string[];
  steps: string[];
}

export interface RecipeResponse {
  dish_name: string;
  confidence: number;
  confidence_label: string;
  is_uncertain: boolean;
  uncertainty_message?: string;
  detected_ingredients: string[];
  recipe: RecipeDetail;
  substitutions: string[];
  allergy_warnings: string[];
  healthier_version?: string;
  budget_version?: string;
  shopping_list: string[];
  cuisine_twists: Record<string, string>;
  nutrition_note: string;
  session_id: string;
}

export interface GuardrailStats {
  uptime_seconds: number;
  total_requests_checked: number;
  total_blocked: number;
  total_flagged_warnings: number;
  block_rate_pct: number;
  by_category: Record<string, number>;
  by_endpoint: Record<string, number>;
}

export interface ChatResponse {
  session_id: string;
  reply: string;
  updated_recipe?: RecipeResponse;
  action_taken: string;
  requires_confirmation?: boolean;
  suggested_actions?: string[];
  new_dish_name?: string;
  current_dish_name?: string;
  guardrail_stats?: GuardrailStats;
}

export interface WeatherSuggestion {
  city: string;
  temperature_c: number;
  condition: string;
  suggestion: string;
  recipe_mood: string;
}

export const defaultPreferences: UserPreferences = {
  allergies: {
    peanut_free: false,
    dairy_free: false,
    gluten_free: false,
    egg_free: false,
    shellfish_free: false,
  },
  budget_level: "medium",
  health_focus: "balanced",
  equipment: ["stovetop", "oven"],
  servings: 2,
  cuisine_preference: [],
};

// ─────────────────────────────────────────────
// API Functions
// ─────────────────────────────────────────────

export async function analyzeInput(
  inputData: File | string,
  sessionId: string,
  preferences: UserPreferences
): Promise<RecipeResponse> {
  const formData = new FormData();
  if (typeof inputData === "string") {
    formData.append("text_query", inputData);
  } else {
    formData.append("image", inputData);
  }
  formData.append("session_id", sessionId);
  formData.append("preferences_json", JSON.stringify(preferences));

  const response = await fetch(`${API_URL}/analyze`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Upload failed" }));
    const errorMsg = Array.isArray(error.detail) ? error.detail.map((e: any) => e.msg).join(", ") : (error.detail || `HTTP ${response.status}`);
    throw new Error(errorMsg);
  }

  return response.json();
}

export async function sendChatMessage(
  sessionId: string,
  message: string,
  preferences: UserPreferences,
  imageFile?: File | null
): Promise<ChatResponse> {
  const formData = new FormData();
  formData.append("session_id", sessionId);
  formData.append("message", message);
  formData.append("preferences_json", JSON.stringify(preferences));
  if (imageFile) {
    formData.append("image", imageFile);
  }

  const response = await fetch(`${API_URL}/chat`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Chat failed" }));
    const errorMsg = Array.isArray(error.detail) ? error.detail.map((e: any) => e.msg).join(", ") : (error.detail || `HTTP ${response.status}`);
    throw new Error(errorMsg);
  }

  return response.json();
}

export async function getWeatherSuggestion(city: string): Promise<WeatherSuggestion> {
  const response = await fetch(`${API_URL}/weather`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ city }),
  });

  if (!response.ok) throw new Error("Weather lookup failed");
  return response.json();
}

export async function healthCheck(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/health`, { method: "GET" });
    return response.ok;
  } catch {
    return false;
  }
}
