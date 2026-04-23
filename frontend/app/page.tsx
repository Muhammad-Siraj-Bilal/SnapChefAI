"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { v4 as uuidv4 } from "uuid";
import { ArrowRight, Zap, Shield, Brain, Globe, Star } from "lucide-react";
import ImageUploader from "@/components/ImageUploader";
import PreferencePanel from "@/components/PreferencePanel";
import LoadingChef from "@/components/LoadingChef";
import WeatherBanner from "@/components/WeatherBanner";
import {
  analyzeInput,
  getWeatherSuggestion,
  defaultPreferences,
  UserPreferences,
  RecipeResponse,
  WeatherSuggestion,
} from "@/lib/api";

const FEATURES = [
  { icon: <Zap size={18} />, color: "var(--color-primary)", title: "Instant Recipe Generation", desc: "Upload any food photo and get a complete recipe in seconds" },
  { icon: <Brain size={18} />, color: "var(--color-secondary)", title: "Smart Memory", desc: "Remembers your allergies, budget, and preferences throughout your session" },
  { icon: <Shield size={18} />, color: "var(--color-accent)", title: "Safety Guardrails", desc: "Honest confidence scores, allergy warnings, and prompt injection defense" },
  { icon: <Globe size={18} />, color: "var(--color-purple)", title: "Live Search + RAG", desc: "Powered by Tavily live search and a curated cooking knowledge base" },
];

const MODE_OPTIONS = [
  { emoji: "🍽️", label: "Dish Photo", desc: "Upload a cooked dish to get its recipe" },
  { emoji: "🧊", label: "Fridge Mode", desc: "Photo of your fridge — get 3 meal ideas" },
  { emoji: "🛒", label: "Pantry Mode", desc: "Scan your ingredients for recipe suggestions" },
];

export default function HomePage() {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [textQuery, setTextQuery] = useState("");
  const [mode, setMode] = useState<string>("Dish Photo");
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sessionId] = useState(() => uuidv4());
  const [weather, setWeather] = useState<WeatherSuggestion | null>(null);

  // Fetch weather when city is set
  useEffect(() => {
    if (preferences.city && preferences.city.trim().length > 1) {
      const timer = setTimeout(() => {
        getWeatherSuggestion(preferences.city!)
          .then(setWeather)
          .catch(() => {});
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [preferences.city]);

  const handleImageSelected = (file: File, prev: string) => {
    setSelectedFile(file);
    setPreview(prev);
    setTextQuery(""); // Clear text if image is selected
    setError("");
  };

  const handleClear = () => {
    setSelectedFile(null);
    setPreview("");
    setError("");
  };

  const handleAnalyze = async () => {
    if (!selectedFile && !textQuery.trim()) {
      setError("Please upload a food image or enter a text request first.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const inputData = selectedFile || textQuery.trim();
      const result: RecipeResponse = await analyzeInput(inputData, sessionId, preferences);

      // Store result in sessionStorage to pass to the chat page
      sessionStorage.setItem("snapchef_recipe", JSON.stringify(result));
      sessionStorage.setItem("snapchef_session_id", sessionId);
      sessionStorage.setItem("snapchef_preferences", JSON.stringify(preferences));

      router.push("/chat");
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{
      minHeight: "100vh",
      background: "var(--gradient-hero)",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Background blobs */}
      <div style={{
        position: "fixed",
        top: "-20%",
        right: "-10%",
        width: "600px",
        height: "600px",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,107,53,0.08) 0%, transparent 70%)",
        pointerEvents: "none",
        zIndex: 0,
      }} />
      <div style={{
        position: "fixed",
        bottom: "-20%",
        left: "-10%",
        width: "500px",
        height: "500px",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(78,205,196,0.06) 0%, transparent 70%)",
        pointerEvents: "none",
        zIndex: 0,
      }} />

      <div style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "0 24px",
        position: "relative",
        zIndex: 1,
      }}>
        {/* ── Nav ── */}
        <motion.nav
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "24px 0",
            borderBottom: "1px solid var(--border-subtle)",
            marginBottom: "48px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "28px" }}>👨‍🍳</span>
            <span style={{
              fontFamily: "var(--font-heading)",
              fontSize: "22px",
              fontWeight: 800,
              background: "var(--gradient-primary)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>
              SnapChef AI
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{
              padding: "4px 12px",
              background: "rgba(78,205,196,0.1)",
              border: "1px solid rgba(78,205,196,0.2)",
              borderRadius: "var(--radius-full)",
              fontSize: "12px",
              color: "var(--color-secondary)",
              fontWeight: 600,
            }}>
              🔴 LIVE DEMO
            </span>
          </div>
        </motion.nav>

        {/* ── Hero ── */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{ textAlign: "center", marginBottom: "64px" }}
        >
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 16px",
            background: "rgba(255,107,53,0.1)",
            border: "1px solid rgba(255,107,53,0.2)",
            borderRadius: "var(--radius-full)",
            fontSize: "12px",
            fontWeight: 700,
            color: "var(--color-primary)",
            marginBottom: "24px",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}>
            <Star size={11} fill="currentColor" />
            Multimodal AI · LangChain · LangSmith · RAG
          </div>

          <h1 style={{
            fontFamily: "var(--font-heading)",
            fontSize: "clamp(36px, 6vw, 70px)",
            fontWeight: 800,
            lineHeight: 1.1,
            marginBottom: "20px",
          }}>
            Turn Any{" "}
            <span style={{
              background: "var(--gradient-primary)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>
              Food Photo
            </span>
            <br />
            Into a Perfect Recipe
          </h1>

          <p style={{
            fontSize: "clamp(16px, 2.5vw, 20px)",
            color: "var(--text-secondary)",
            maxWidth: "620px",
            margin: "0 auto 32px",
            lineHeight: 1.7,
          }}>
            Upload a dish, fridge, or pantry photo. SnapChef AI identifies ingredients,
            generates personalized recipes, and adapts them based on your allergies,
            budget, and health goals.
          </p>

          {/* Features row */}
          <div style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            justifyContent: "center",
            marginBottom: "48px",
          }}>
            {["Allergy Filters", "Fridge Mode", "AI Chat", "Shopping List", "Cuisine Twists", "Budget Mode", "Seasonal Recommendations"].map((tag) => (
              <span key={tag} style={{
                padding: "5px 14px",
                background: "var(--bg-surface-2)",
                border: "1px solid var(--border-medium)",
                borderRadius: "var(--radius-full)",
                fontSize: "13px",
                color: "var(--text-secondary)",
              }}>
                {tag}
              </span>
            ))}
          </div>
        </motion.div>

        {/* ── Main Upload Section ── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 400px",
          gap: "24px",
          marginBottom: "64px",
          alignItems: "start",
        }}
        className="main-grid"
        >
          {/* Left: Upload + Action */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            style={{ display: "flex", flexDirection: "column", gap: "16px" }}
          >
            {/* Mode selector */}
            <div style={{ display: "flex", gap: "8px" }}>
              {MODE_OPTIONS.map((m) => (
                <button
                  key={m.label}
                  onClick={() => setMode(m.label)}
                  style={{
                    flex: 1,
                    padding: "10px 8px",
                    borderRadius: "var(--radius-md)",
                    border: `1px solid ${mode === m.label ? "rgba(255,107,53,0.5)" : "var(--border-subtle)"}`,
                    background: mode === m.label ? "rgba(255,107,53,0.1)" : "var(--bg-surface)",
                    fontSize: "12px",
                    fontWeight: mode === m.label ? 700 : 400,
                    color: mode === m.label ? "var(--color-primary)" : "var(--text-muted)",
                    textAlign: "center",
                    transition: "all 0.2s",
                  }}
                >
                  <div style={{ fontSize: "20px", marginBottom: "4px" }}>{m.emoji}</div>
                  <div>{m.label}</div>
                </button>
              ))}
            </div>

            {/* Image uploader */}
            <ImageUploader
              onImageSelected={handleImageSelected}
              onClear={handleClear}
              preview={preview}
              disabled={loading}
            />

            <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "8px 0" }}>
              <div style={{ flex: 1, height: "1px", background: "var(--border-subtle)" }} />
              <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.1em" }}>OR</span>
              <div style={{ flex: 1, height: "1px", background: "var(--border-subtle)" }} />
            </div>

            <textarea
              placeholder="e.g. I want to cook a vegan lasagna..."
              className="input-field"
              value={textQuery}
              onChange={(e) => {
                setTextQuery(e.target.value);
                if (e.target.value) handleClear();
              }}
              disabled={loading}
              style={{
                resize: "none",
                minHeight: "80px",
                lineHeight: "1.5",
                padding: "16px",
                opacity: selectedFile ? 0.3 : 1,
              }}
            />

            {/* Weather banner */}
            <AnimatePresence>
              {weather && <WeatherBanner weather={weather} />}
            </AnimatePresence>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  style={{
                    padding: "12px 16px",
                    background: "rgba(255,107,53,0.1)",
                    border: "1px solid rgba(255,107,53,0.2)",
                    borderRadius: "var(--radius-md)",
                    color: "var(--color-primary)",
                    fontSize: "14px",
                  }}
                >
                  ⚠️ {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Loading */}
            <AnimatePresence>
              {loading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-lg)",
                  }}
                >
                  <LoadingChef
                    message={
                      mode === "Fridge Mode"
                        ? "Scanning your fridge ingredients..."
                        : mode === "Pantry Mode"
                        ? "Identifying pantry items..."
                        : "Analyzing your dish..."
                    }
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* CTA */}
            {!loading && (
              <button
                onClick={handleAnalyze}
                disabled={!selectedFile && !textQuery.trim()}
                className="btn-primary"
                style={{ width: "100%", padding: "16px", fontSize: "16px", borderRadius: "var(--radius-md)" }}
              >
                <span style={{ fontSize: "18px" }}>✨</span>
                Generate Recipe with AI
                <ArrowRight size={18} />
              </button>
            )}
          </motion.div>

          {/* Right: Preferences */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <PreferencePanel preferences={preferences} onChange={setPreferences} />
          </motion.div>
        </div>

        {/* ── Feature Cards ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          style={{ marginBottom: "64px" }}
        >
          <h2 style={{
            fontFamily: "var(--font-heading)",
            fontSize: "28px",
            fontWeight: 800,
            textAlign: "center",
            marginBottom: "32px",
          }}>
            Why SnapChef AI Stands Out
          </h2>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "16px",
          }}>
            {FEATURES.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.08 }}
                className="glass-card"
                style={{ padding: "24px" }}
              >
                <div style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "var(--radius-md)",
                  background: `${feature.color}22`,
                  border: `1px solid ${feature.color}44`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: feature.color,
                  marginBottom: "14px",
                }}>
                  {feature.icon}
                </div>
                <h3 style={{ fontFamily: "var(--font-heading)", fontSize: "15px", fontWeight: 700, marginBottom: "8px" }}>
                  {feature.title}
                </h3>
                <p style={{ color: "var(--text-muted)", fontSize: "13px", lineHeight: 1.6 }}>
                  {feature.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* ── Footer ── */}
        <footer style={{
          textAlign: "center",
          padding: "32px 0",
          borderTop: "1px solid var(--border-subtle)",
          color: "var(--text-muted)",
          fontSize: "13px",
        }}>
          <p>Built with ❤️ using Groq · LangChain · LangSmith · Tavily · ChromaDB · Next.js · FastAPI</p>
        </footer>
      </div>

    </main>
  );
}
