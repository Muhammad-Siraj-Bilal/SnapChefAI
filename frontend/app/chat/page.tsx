"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, RefreshCw } from "lucide-react";
import RecipeCard from "@/components/RecipeCard";
import ChatInterface from "@/components/ChatInterface";
import LoadingChef from "@/components/LoadingChef";
import { RecipeResponse, UserPreferences, defaultPreferences } from "@/lib/api";

export default function ChatPage() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<RecipeResponse[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionId, setSessionId] = useState<string>("");
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load from sessionStorage
    const storedRecipe = sessionStorage.getItem("snapchef_recipe");
    const storedSession = sessionStorage.getItem("snapchef_session_id");
    const storedPrefs = sessionStorage.getItem("snapchef_preferences");

    if (!storedRecipe || !storedSession) {
      // No recipe yet — redirect to home
      router.replace("/");
      return;
    }

    try {
      const parsedRecipe = JSON.parse(storedRecipe);
      setRecipes([parsedRecipe]);
      setCurrentIndex(0);
      setSessionId(storedSession);
      if (storedPrefs) setPreferences(JSON.parse(storedPrefs));
    } catch {
      router.replace("/");
    } finally {
      setLoading(false);
    }
  }, [router]);

  const handleRecipeUpdate = (updatedRecipe: RecipeResponse) => {
    setRecipes((prev) => {
      const next = [...prev, updatedRecipe];
      setCurrentIndex(next.length - 1);
      return next;
    });
    sessionStorage.setItem("snapchef_recipe", JSON.stringify(updatedRecipe));
  };

  const handleNewAnalysis = () => {
    // Clear session and go back
    sessionStorage.removeItem("snapchef_recipe");
    sessionStorage.removeItem("snapchef_session_id");
    sessionStorage.removeItem("snapchef_preferences");
    router.push("/");
  };

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "var(--bg-primary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <LoadingChef message="Loading your recipe..." />
      </div>
    );
  }

  return (
    <main style={{
      minHeight: "100vh",
      background: "var(--bg-primary)",
      position: "relative",
    }}>
      {/* Background decoration */}
      <div style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "400px",
        background: "linear-gradient(180deg, rgba(255,107,53,0.05) 0%, transparent 100%)",
        pointerEvents: "none",
        zIndex: 0,
      }} />

      <div style={{
        maxWidth: "1400px",
        margin: "0 auto",
        padding: "0 24px",
        position: "relative",
        zIndex: 1,
      }}>
        {/* ── Header ── */}
        <motion.header
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 0",
            borderBottom: "1px solid var(--border-subtle)",
            marginBottom: "24px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <button onClick={() => router.push("/")} className="btn-secondary" style={{ padding: "8px 16px", fontSize: "13px" }}>
              <ArrowLeft size={14} />
              Back
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "22px" }}>👨‍🍳</span>
              <span style={{
                fontFamily: "var(--font-heading)",
                fontSize: "18px",
                fontWeight: 800,
                background: "var(--gradient-primary)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}>
                SnapChef AI
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {recipes[currentIndex] && (
              <div style={{
                padding: "6px 14px",
                background: "var(--bg-surface-2)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-full)",
                fontSize: "12px",
                color: "var(--text-secondary)",
              }}>
                📋 {recipes[currentIndex].dish_name}
              </div>
            )}
            <button
              onClick={handleNewAnalysis}
              className="btn-primary"
              style={{ padding: "8px 18px", fontSize: "13px" }}
            >
              <RefreshCw size={13} />
              New Recipe
            </button>
          </div>
        </motion.header>

        {/* ── Version History Tabs ── */}
        {recipes.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              display: "flex",
              gap: "8px",
              marginBottom: "20px",
              overflowX: "auto",
              paddingBottom: "4px",
              scrollbarWidth: "none",
            }}
          >
            {recipes.map((r, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                style={{
                  padding: "6px 16px",
                  borderRadius: "var(--radius-md)",
                  fontSize: "13px",
                  fontWeight: 600,
                  transition: "all 0.2s",
                  border: "1px solid",
                  background: idx === currentIndex ? "var(--color-primary)" : "var(--bg-surface-2)",
                  borderColor: idx === currentIndex ? "var(--color-primary)" : "var(--border-subtle)",
                  color: idx === currentIndex ? "white" : "var(--text-secondary)",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  whiteSpace: "nowrap",
                  maxWidth: "200px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={r.dish_name}
              >
                <span>{r.dish_name}</span>
                {idx === currentIndex && <span style={{ fontSize: "10px", opacity: 0.8 }}>(Active)</span>}
              </button>
            ))}
          </motion.div>
        )}

        {/* ── Main layout: Recipe Card + Chat ── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 420px",
          gap: "24px",
          alignItems: "start",
          paddingBottom: "40px",
        }}
        className="chat-grid"
        >
          {/* Left column — Recipe */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <AnimatePresence mode="wait">
              {recipes[currentIndex] ? (
                <RecipeCard key={`${currentIndex}-${recipes[currentIndex].dish_name}`} recipe={recipes[currentIndex]} />
              ) : (
                <div style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-xl)",
                  padding: "48px",
                  textAlign: "center",
                  color: "var(--text-muted)",
                }}>
                  No recipe yet — upload an image to get started!
                </div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Right column — Chat (sticky) */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            style={{
              position: "sticky",
              top: "24px",
              height: "calc(100vh - 120px)",
            }}
          >
            <ChatInterface
              sessionId={sessionId}
              preferences={preferences}
              onRecipeUpdate={handleRecipeUpdate}
              hasRecipe={recipes.length > 0}
            />
          </motion.div>
        </div>
      </div>

    </main>
  );
}
