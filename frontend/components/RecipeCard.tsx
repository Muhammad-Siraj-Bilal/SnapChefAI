"use client";
import { RecipeResponse } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import {
  Clock, Users, ChefHat, ShoppingCart, Sparkles,
  ChevronDown, ChevronUp, BadgeCheck, AlertTriangle, Copy, Check
} from "lucide-react";

interface RecipeCardProps {
  recipe: RecipeResponse;
}

const CUISINE_EMOJIS: Record<string, string> = {
  Indian: "🇮🇳",
  Italian: "🇮🇹",
  Korean: "🇰🇷",
  Mexican: "🇲🇽",
  Arabic: "🇦🇪",
};

export default function RecipeCard({ recipe }: RecipeCardProps) {
  const [activeTab, setActiveTab] = useState<"recipe" | "shopping" | "twists">("recipe");
  const [showHealthy, setShowHealthy] = useState(false);
  const [showBudget, setShowBudget] = useState(false);
  const [copiedList, setCopiedList] = useState(false);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  const confidenceColor =
    recipe.confidence_label === "High"
      ? "badge-high"
      : recipe.confidence_label === "Medium"
      ? "badge-medium"
      : "badge-low";

  const copyShoppingList = () => {
    const text = recipe.shopping_list.map((item) => `• ${item}`).join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopiedList(true);
      setTimeout(() => setCopiedList(false), 2000);
    });
  };

  // Uncertain state
  if (recipe.is_uncertain) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: "var(--bg-surface)",
          border: "1px solid rgba(255,230,109,0.3)",
          borderRadius: "var(--radius-lg)",
          padding: "28px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>🤔</div>
        <h3 style={{ fontFamily: "var(--font-heading)", fontSize: "20px", fontWeight: 700, marginBottom: "12px" }}>
          Hmm, I&apos;m not quite sure...
        </h3>
        <p style={{
          color: "var(--text-secondary)",
          fontSize: "15px",
          lineHeight: 1.7,
          whiteSpace: "pre-line",
          textAlign: "left",
          background: "var(--bg-surface-2)",
          borderRadius: "var(--radius-md)",
          padding: "16px",
        }}>
          {recipe.uncertainty_message}
        </p>
        <div className="badge badge-medium" style={{ marginTop: "16px", display: "inline-flex" }}>
          Confidence: {(recipe.confidence * 100).toFixed(0)}%
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-xl)",
        overflow: "hidden",
      }}
    >
      {/* ── Header ── */}
      <div style={{
        background: "linear-gradient(135deg, rgba(255,107,53,0.15), rgba(78,205,196,0.08))",
        borderBottom: "1px solid var(--border-subtle)",
        padding: "24px",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "12px" }}>
          <h2 style={{
            fontFamily: "var(--font-heading)",
            fontSize: "24px",
            fontWeight: 800,
            lineHeight: 1.2,
            flex: 1,
          }}>
            {recipe.dish_name}
          </h2>
          <span className={`badge ${confidenceColor}`} style={{ flexShrink: 0 }}>
            <BadgeCheck size={12} />
            {recipe.confidence_label} · {(recipe.confidence * 100).toFixed(0)}%
          </span>
        </div>

        {recipe.recipe?.description && (
          <p style={{ color: "var(--text-secondary)", fontSize: "14px", lineHeight: 1.6, marginBottom: "16px" }}>
            {recipe.recipe.description}
          </p>
        )}

        {/* Meta chips */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
          {recipe.recipe?.prep_time && (
            <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "13px", color: "var(--text-secondary)" }}>
              <Clock size={13} color="var(--color-primary)" />
              Prep: {recipe.recipe.prep_time}
            </span>
          )}
          {recipe.recipe?.cook_time && (
            <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "13px", color: "var(--text-secondary)" }}>
              <Clock size={13} color="var(--color-secondary)" />
              Cook: {recipe.recipe.cook_time}
            </span>
          )}
          {recipe.recipe?.servings && (
            <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "13px", color: "var(--text-secondary)" }}>
              <Users size={13} color="var(--color-accent)" />
              {recipe.recipe.servings} servings
            </span>
          )}
          {recipe.recipe?.difficulty && (
            <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "13px", color: "var(--text-secondary)" }}>
              <ChefHat size={13} color="var(--color-purple)" />
              {recipe.recipe.difficulty}
            </span>
          )}
        </div>
      </div>

      {/* ── Allergy Warnings ── */}
      {recipe.allergy_warnings && recipe.allergy_warnings.length > 0 && (
        <div style={{
          background: "rgba(255,107,53,0.08)",
          borderBottom: "1px solid rgba(255,107,53,0.2)",
          padding: "12px 24px",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
        }}>
          {recipe.allergy_warnings.map((warning, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#FF9F7A" }}>
              <AlertTriangle size={13} />
              {warning}
            </div>
          ))}
        </div>
      )}

      {/* ── Tabs ── */}
      <div style={{
        display: "flex",
        borderBottom: "1px solid var(--border-subtle)",
        background: "var(--bg-surface-2)",
      }}>
        {(["recipe", "shopping", "twists"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: "12px",
              fontSize: "13px",
              fontWeight: 600,
              color: activeTab === tab ? "var(--color-primary)" : "var(--text-muted)",
              borderBottom: activeTab === tab ? "2px solid var(--color-primary)" : "2px solid transparent",
              transition: "all 0.2s",
              fontFamily: "var(--font-heading)",
            }}
          >
            {tab === "recipe" && "📋 Recipe"}
            {tab === "shopping" && "🛒 Shopping"}
            {tab === "twists" && "🌍 Twists"}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          style={{ padding: "24px" }}
        >
          {/* RECIPE TAB */}
          {activeTab === "recipe" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {/* Ingredients */}
              {recipe.recipe?.ingredients?.length > 0 && (
                <div>
                  <p className="section-label">Ingredients</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {recipe.recipe.ingredients.map((ing, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "10px",
                          fontSize: "14px",
                          color: "var(--text-secondary)",
                          lineHeight: 1.5,
                        }}
                      >
                        <span style={{
                          width: "6px",
                          height: "6px",
                          borderRadius: "50%",
                          background: "var(--color-primary)",
                          marginTop: "7px",
                          flexShrink: 0,
                        }} />
                        {ing}
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Steps */}
              {recipe.recipe?.steps?.length > 0 && (
                <div>
                  <p className="section-label">Instructions</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {recipe.recipe.steps.map((step, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "12px",
                          padding: "12px",
                          background: "var(--bg-surface-2)",
                          borderRadius: "var(--radius-md)",
                          border: "1px solid var(--border-subtle)",
                          fontSize: "14px",
                          color: "var(--text-secondary)",
                          lineHeight: 1.6,
                        }}
                      >
                        <span style={{
                          minWidth: "24px",
                          height: "24px",
                          borderRadius: "50%",
                          background: "var(--gradient-primary)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "11px",
                          fontWeight: 700,
                          color: "white",
                          flexShrink: 0,
                          fontFamily: "var(--font-heading)",
                        }}>
                          {i + 1}
                        </span>
                        <span>{step.replace(/^Step \d+[:.]?\s*/i, "")}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Nutrition note */}
              {recipe.nutrition_note && (
                <div style={{
                  padding: "12px 16px",
                  background: "rgba(78,205,196,0.08)",
                  border: "1px solid rgba(78,205,196,0.2)",
                  borderRadius: "var(--radius-md)",
                  fontSize: "13px",
                  color: "var(--color-secondary)",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}>
                  <Sparkles size={13} />
                  {recipe.nutrition_note}
                </div>
              )}

              {/* Substitutions */}
              {recipe.substitutions?.length > 0 && (
                <div>
                  <p className="section-label">Substitutions</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {recipe.substitutions.map((sub, i) => (
                      <div key={i} style={{
                        fontSize: "13px",
                        color: "var(--text-secondary)",
                        padding: "8px 12px",
                        background: "var(--bg-surface-2)",
                        borderRadius: "var(--radius-sm)",
                        borderLeft: "3px solid var(--color-secondary)",
                      }}>
                        {sub}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Healthier / Budget toggles */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {recipe.healthier_version && (
                  <div>
                    <button
                      onClick={() => setShowHealthy(!showHealthy)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        color: "var(--color-secondary)",
                        fontSize: "13px",
                        fontWeight: 600,
                      }}
                    >
                      {showHealthy ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      🥗 See Healthier Version
                    </button>
                    <AnimatePresence>
                      {showHealthy && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          style={{ overflow: "hidden" }}
                        >
                          <div style={{
                            marginTop: "8px",
                            padding: "12px",
                            background: "rgba(78,205,196,0.08)",
                            borderRadius: "var(--radius-md)",
                            fontSize: "14px",
                            color: "var(--text-secondary)",
                          }}>
                            {recipe.healthier_version}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {recipe.budget_version && (
                  <div>
                    <button
                      onClick={() => setShowBudget(!showBudget)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        color: "var(--color-accent)",
                        fontSize: "13px",
                        fontWeight: 600,
                      }}
                    >
                      {showBudget ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      💰 See Budget Version
                    </button>
                    <AnimatePresence>
                      {showBudget && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          style={{ overflow: "hidden" }}
                        >
                          <div style={{
                            marginTop: "8px",
                            padding: "12px",
                            background: "rgba(255,230,109,0.08)",
                            borderRadius: "var(--radius-md)",
                            fontSize: "14px",
                            color: "var(--text-secondary)",
                          }}>
                            {recipe.budget_version}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SHOPPING TAB */}
          {activeTab === "shopping" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                <p className="section-label" style={{ marginBottom: 0 }}>Shopping List</p>
                <button onClick={copyShoppingList} className="btn-secondary" style={{ padding: "6px 14px", fontSize: "12px" }}>
                  {copiedList ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy List</>}
                </button>
              </div>
              {recipe.shopping_list?.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {recipe.shopping_list.map((item, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "10px 14px",
                        background: "var(--bg-surface-2)",
                        borderRadius: "var(--radius-md)",
                        fontSize: "14px",
                        color: "var(--text-secondary)",
                        border: "1px solid var(--border-subtle)",
                      }}
                    >
                      <ShoppingCart size={13} color="var(--color-primary)" />
                      {item}
                    </motion.div>
                  ))}
                </div>
              ) : (
                <p style={{ color: "var(--text-muted)", fontSize: "14px", textAlign: "center", padding: "24px" }}>
                  No shopping list available. Ask in the chat: &quot;Generate a shopping list&quot;
                </p>
              )}
            </div>
          )}

          {/* TWISTS TAB */}
          {activeTab === "twists" && (
            <div>
              <p className="section-label">Cuisine Twist Options</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {Object.entries(recipe.cuisine_twists || {}).map(([cuisine, twist], i) => (
                  <motion.div
                    key={cuisine}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    style={{
                      padding: "14px",
                      background: "var(--bg-surface-2)",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "6px",
                      fontFamily: "var(--font-heading)",
                      fontWeight: 700,
                      fontSize: "14px",
                    }}>
                      <span style={{ fontSize: "20px" }}>{CUISINE_EMOJIS[cuisine] || "🌍"}</span>
                      {cuisine} Style
                    </div>
                    <p style={{ color: "var(--text-secondary)", fontSize: "13px", lineHeight: 1.6 }}>
                      {twist}
                    </p>
                  </motion.div>
                ))}
              </div>
              {Object.keys(recipe.cuisine_twists || {}).length === 0 && (
                <p style={{ color: "var(--text-muted)", fontSize: "14px", textAlign: "center", padding: "24px" }}>
                  Ask in the chat: &quot;Give me an Indian twist on this recipe&quot;
                </p>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
