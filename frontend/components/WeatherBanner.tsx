"use client";
import { WeatherSuggestion } from "@/lib/api";
import { motion } from "framer-motion";
import { X, Cloud } from "lucide-react";
import { useState } from "react";

interface WeatherBannerProps {
  weather: WeatherSuggestion;
}

const MOOD_EMOJIS: Record<string, string> = {
  refreshing: "🧊",
  light: "☀️",
  balanced: "🌤️",
  hearty: "🍲",
  warming: "❄️",
};

const MOOD_COLORS: Record<string, string> = {
  refreshing: "rgba(78,205,196,0.12)",
  light: "rgba(255,230,109,0.12)",
  balanced: "rgba(255,107,53,0.08)",
  hearty: "rgba(155,89,182,0.12)",
  warming: "rgba(52,152,219,0.12)",
};

export default function WeatherBanner({ weather }: WeatherBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      style={{
        padding: "12px 16px",
        background: MOOD_COLORS[weather.recipe_mood] || "rgba(255,107,53,0.08)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-md)",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        position: "relative",
      }}
    >
      <span style={{ fontSize: "24px" }}>
        {MOOD_EMOJIS[weather.recipe_mood] || "🌡️"}
      </span>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "2px" }}>
          {weather.city} — {weather.temperature_c}°C · {weather.condition}
        </p>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
          {weather.suggestion}
        </p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        style={{ color: "var(--text-muted)", flexShrink: 0 }}
      >
        <X size={14} />
      </button>
    </motion.div>
  );
}
