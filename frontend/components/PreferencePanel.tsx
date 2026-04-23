"use client";
import { useState } from "react";
import { UserPreferences, Allergies } from "@/lib/api";
import { ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface PreferencePanelProps {
  preferences: UserPreferences;
  onChange: (prefs: UserPreferences) => void;
}

const ALLERGY_OPTIONS: { key: keyof Allergies; emoji: string; label: string }[] = [
  { key: "peanut_free", emoji: "🥜", label: "Peanut Free" },
  { key: "dairy_free", emoji: "🥛", label: "Dairy Free" },
  { key: "gluten_free", emoji: "🌾", label: "Gluten Free" },
  { key: "egg_free", emoji: "🥚", label: "Egg Free" },
  { key: "shellfish_free", emoji: "🦐", label: "Shellfish Free" },
];

const EQUIPMENT_OPTIONS = [
  { value: "stovetop", emoji: "🍳", label: "Stovetop" },
  { value: "oven", emoji: "🔥", label: "Oven" },
  { value: "air_fryer", emoji: "💨", label: "Air Fryer" },
  { value: "microwave", emoji: "📡", label: "Microwave" },
  { value: "instant_pot", emoji: "⚡", label: "Instant Pot" },
  { value: "slow_cooker", emoji: "🫕", label: "Slow Cooker" },
];

const HEALTH_OPTIONS = [
  { value: "balanced", emoji: "⚖️", label: "Balanced" },
  { value: "high_protein", emoji: "💪", label: "High Protein" },
  { value: "low_carb", emoji: "🥗", label: "Low Carb" },
  { value: "keto", emoji: "🥑", label: "Keto" },
  { value: "vegetarian", emoji: "🌿", label: "Vegetarian" },
  { value: "vegan", emoji: "🌱", label: "Vegan" },
];

const BUDGET_OPTIONS = [
  { value: "low", emoji: "💰", label: "Budget" },
  { value: "medium", emoji: "💰💰", label: "Moderate" },
  { value: "high", emoji: "💰💰💰", label: "Premium" },
];

export default function PreferencePanel({ preferences, onChange }: PreferencePanelProps) {
  const [expanded, setExpanded] = useState(true);

  const updateAllergen = (key: keyof Allergies, value: boolean) => {
    onChange({
      ...preferences,
      allergies: { ...preferences.allergies, [key]: value },
    });
  };

  const toggleEquipment = (value: string) => {
    const current = preferences.equipment;
    const updated = current.includes(value)
      ? current.filter((e) => e !== value)
      : [...current, value];
    onChange({ ...preferences, equipment: updated });
  };

  const s = (key: string, size: number) => ({
    width: size,
    height: size,
  });

  return (
    <div style={{
      background: "var(--bg-surface)",
      border: "1px solid var(--border-subtle)",
      borderRadius: "var(--radius-lg)",
      overflow: "hidden",
    }}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
          color: "var(--text-primary)",
          fontSize: "14px",
          fontWeight: 600,
          borderBottom: expanded ? "1px solid var(--border-subtle)" : "none",
          fontFamily: "var(--font-heading)",
          transition: "background 0.2s",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span>⚙️</span>
          <span>Preferences & Restrictions</span>
        </div>
        {expanded ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Allergies / Dietary Restrictions */}
              <div>
                <p className="section-label">Dietary Restrictions</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {ALLERGY_OPTIONS.map(({ key, emoji, label }) => (
                    <button
                      key={key}
                      onClick={() => updateAllergen(key, !preferences.allergies[key])}
                      className={`chip ${preferences.allergies[key] ? "active" : ""}`}
                    >
                      <span>{emoji}</span>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Health Focus */}
              <div>
                <p className="section-label">Health Focus</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {HEALTH_OPTIONS.map(({ value, emoji, label }) => (
                    <button
                      key={value}
                      onClick={() => onChange({ ...preferences, health_focus: value as any })}
                      className={`chip ${preferences.health_focus === value ? "active" : ""}`}
                    >
                      <span>{emoji}</span>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Equipment */}
              <div>
                <p className="section-label">Available Equipment</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {EQUIPMENT_OPTIONS.map(({ value, emoji, label }) => (
                    <button
                      key={value}
                      onClick={() => toggleEquipment(value)}
                      className={`chip ${preferences.equipment.includes(value) ? "active" : ""}`}
                    >
                      <span>{emoji}</span>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Budget + Servings flow */}
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                {/* Budget */}
                <div style={{ flex: 1, minWidth: "180px" }}>
                  <p className="section-label">Budget Level</p>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {BUDGET_OPTIONS.map(({ value, emoji, label }) => (
                      <button
                        key={value}
                        onClick={() => onChange({ ...preferences, budget_level: value as any })}
                        className={`chip ${preferences.budget_level === value ? "active" : ""}`}
                        style={{ flex: 1, justifyContent: "center", fontSize: "12px" }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Servings */}
                <div>
                  <p className="section-label">Servings</p>
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    background: "var(--bg-surface-2)",
                    border: "1px solid var(--border-medium)",
                    borderRadius: "var(--radius-md)",
                    padding: "6px 12px",
                  }}>
                    <button
                      onClick={() => onChange({ ...preferences, servings: Math.max(1, preferences.servings - 1) })}
                      style={{ color: "var(--color-primary)", fontWeight: 700, fontSize: "18px", width: "24px" }}
                    >
                      −
                    </button>
                    <span style={{ fontWeight: 700, fontSize: "16px", minWidth: "20px", textAlign: "center" }}>
                      {preferences.servings}
                    </span>
                    <button
                      onClick={() => onChange({ ...preferences, servings: Math.min(10, preferences.servings + 1) })}
                      style={{ color: "var(--color-primary)", fontWeight: 700, fontSize: "18px", width: "24px" }}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* City for weather */}
              <div>
                <p className="section-label">Your City (for seasonal suggestions)</p>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Dubai, London, New York..."
                  value={preferences.city || ""}
                  onChange={(e) => onChange({ ...preferences, city: e.target.value })}
                  style={{ maxWidth: "280px" }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
