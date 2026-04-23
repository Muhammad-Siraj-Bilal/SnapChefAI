"use client";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { Send, Zap, Camera, X } from "lucide-react";
import { ChatResponse, UserPreferences, sendChatMessage } from "@/lib/api";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  action?: string;
  pendingRecipe?: any;
  confirmed?: boolean;
  rejected?: boolean;
  requires_action?: boolean;
  newDishName?: string;
  currentDishName?: string;
  redirectDismissed?: boolean;
}

interface ChatInterfaceProps {
  sessionId: string;
  preferences: UserPreferences;
  onRecipeUpdate?: (recipe: any) => void;
  hasRecipe: boolean;
}

const QUICK_ACTIONS = [
  { emoji: "🌱", label: "Make it Vegan" },
  { emoji: "💪", label: "High Protein" },
  { emoji: "💸", label: "Budget Version" },
  { emoji: "💨", label: "Air Fryer" },
  { emoji: "🌡️", label: "Healthier Version" },
  { emoji: "🧄", label: "Remove Dairy" },
  { emoji: "🌶️", label: "Make it Spicy" },
  { emoji: "👨‍👩‍👧‍👦", label: "Serve 4 People" },
  { emoji: "🇮🇳", label: "Indian Style" },
  { emoji: "🇰🇷", label: "Korean Style" },
  { emoji: "🛒", label: "Shopping List" },
  { emoji: "⏱️", label: "Quick Version" },
];

const ACTION_COLORS: Record<string, string> = {
  rewrite: "rgba(78,205,196,0.1)",
  search: "rgba(255,230,109,0.1)",
  chat: "transparent",
  blocked_injection: "rgba(255, 107, 107, 0.15)",
  blocked_unsafe: "rgba(255, 107, 107, 0.15)",
};

export default function ChatInterface({
  sessionId,
  preferences,
  onRecipeUpdate,
  hasRecipe,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: hasRecipe
        ? "I've analyzed your image and generated a recipe! 🎉 You can ask me to:\n\n- Make it **vegan, gluten-free, or dairy-free**\n- Adapt it for **air fryer** or other equipment\n- Get a **healthier** or **budget-friendly** version\n- Give it an **Indian, Korean, or Italian twist**\n- Generate a **shopping list**\n\nWhat would you like to change?"
        : "👋 Hi! I'm SnapChef AI. Upload a food photo above and I'll generate a personalized recipe for you!\n\nOr tell me what you'd like to cook and I can help with suggestions.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [activeSuggestions, setActiveSuggestions] = useState<string[]>([]);
  const [guardrailStats, setGuardrailStats] = useState<any>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Update welcome message when recipe loads
  useEffect(() => {
    if (hasRecipe && messages.length === 1 && messages[0].id === "welcome") {
      setMessages([{
        id: "welcome",
        role: "assistant",
        content: "Recipe ready! 🎉 Ask me to adapt it — try **\"Make it vegan\"**, **\"Serve 4 people\"**, or **\"Give me a Korean twist\"**!",
        timestamp: new Date(),
      }]);
    }
  }, [hasRecipe]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    const imgFile = selectedImage;
    removeImage();
    setLoading(true);

    try {
      const response: ChatResponse = await sendChatMessage(sessionId, text.trim(), preferences, imgFile);
      
      setActiveSuggestions(response.suggested_actions || []);
      if (response.guardrail_stats) {
        setGuardrailStats(response.guardrail_stats);
      }

      // STATED RULE: Never auto-update. User must click "Apply Changes".
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response.reply,
        timestamp: new Date(),
        action: response.action_taken,
        pendingRecipe: response.updated_recipe,
        requires_action: !!response.updated_recipe,
        confirmed: false,
        newDishName: response.new_dish_name || "",
        currentDishName: response.current_dish_name || "",
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error: any) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I ran into an issue. Please try again in a moment.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
      background: "var(--bg-surface)",
      border: "1px solid var(--border-subtle)",
      borderRadius: "var(--radius-xl)",
      overflow: "hidden",
    }}>
      {/* ── Header ── */}
      <div style={{
        padding: "16px 20px",
        borderBottom: "1px solid var(--border-subtle)",
        background: "var(--bg-surface-2)",
        display: "flex",
        alignItems: "center",
        gap: "10px",
      }}>
        <div style={{
          width: "36px",
          height: "36px",
          borderRadius: "50%",
          background: "var(--gradient-primary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "18px",
        }}>
          👨‍🍳
        </div>
        <div>
          <p style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "15px" }}>SnapChef AI</p>
          <p style={{ fontSize: "11px", color: "var(--color-secondary)", display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#4ECDC4", display: "inline-block" }} />
            Engine v6.0 • Solid
          </p>
        </div>
      </div>

      {/* ── Messages ── */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        minHeight: 0,
      }}>
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              style={{
                display: "flex",
                flexDirection: msg.role === "user" ? "row-reverse" : "row",
                gap: "10px",
                alignItems: "flex-start",
              }}
            >
              {/* Avatar */}
              <div style={{
                width: "30px",
                height: "30px",
                borderRadius: "50%",
                background: msg.role === "user" ? "var(--gradient-secondary)" : "var(--gradient-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "14px",
                flexShrink: 0,
              }}>
                {msg.role === "user" ? "👤" : "👨‍🍳"}
              </div>

              {/* Bubble */}
              <div style={{
                maxWidth: "80%",
                padding: "10px 14px",
                borderRadius: msg.role === "user"
                  ? "16px 4px 16px 16px"
                  : "4px 16px 16px 16px",
                background: msg.role === "user"
                  ? "var(--gradient-primary)"
                  : msg.action
                  ? ACTION_COLORS[msg.action] || "var(--bg-surface-2)"
                  : "var(--bg-surface-2)",
                border: msg.role === "assistant" ? "1px solid var(--border-subtle)" : "none",
                fontSize: "14px",
                lineHeight: 1.6,
              }}>
                {msg.action && msg.action !== "chat" && (
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    fontSize: "11px",
                    color: msg.action.startsWith("blocked") ? "var(--color-accent)" : msg.action === "rewrite" ? "var(--color-secondary)" : "var(--color-accent)",
                    marginBottom: "6px",
                    fontWeight: 600,
                  }}>
                    <Zap size={10} />
                    {msg.action === "rewrite" ? "Recipe Updated" : msg.action.startsWith("blocked") ? "Safety Intervention" : "Live Search Used"}
                  </div>
                )}
                <div style={{ color: msg.role === "user" ? "white" : "var(--text-secondary)" }}>
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p style={{ margin: "0 0 8px" }}>{children}</p>,
                      strong: ({ children }) => <strong style={{ color: "var(--text-primary)" }}>{children}</strong>,
                      ul: ({ children }) => <ul style={{ paddingLeft: "16px", margin: "4px 0" }}>{children}</ul>,
                      li: ({ children }) => <li style={{ marginBottom: "4px" }}>{children}</li>,
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>

                {/* Confirmation Flow */}
                {msg.pendingRecipe && !msg.confirmed && !msg.rejected && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "16px" }}>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      id={`apply-btn-${msg.id}`}
                      onClick={() => {
                        if (onRecipeUpdate) {
                          onRecipeUpdate(msg.pendingRecipe);
                          setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, confirmed: true } : m));
                        }
                      }}
                      style={{
                        width: "100%",
                        padding: "14px",
                        background: "var(--gradient-secondary)",
                        borderRadius: "12px",
                        color: "white",
                        fontSize: "14px",
                        fontWeight: 800,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "10px",
                        cursor: "pointer",
                        border: "none",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                      }}
                    >
                      <Zap size={16} />
                      Apply Changes to Recipe Card
                    </motion.button>
                    
                    <button
                      onClick={() => {
                        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, rejected: true } : m));
                      }}
                      style={{
                        width: "100%",
                        padding: "10px",
                        background: "transparent",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "8px",
                        color: "var(--text-muted)",
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      No thanks, keep current recipe
                    </button>
                  </div>
                )}

                {/* Redirect Flow (New Dish) — Two Buttons */}
                {msg.action === "redirect" && !msg.redirectDismissed && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "16px" }}>
                    <button
                      onClick={() => window.location.assign("/")}
                      style={{
                        width: "100%",
                        padding: "13px",
                        background: "linear-gradient(135deg, var(--color-primary), #ff8c42)",
                        border: "none",
                        borderRadius: "12px",
                        color: "white",
                        fontWeight: 700,
                        fontSize: "14px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                      }}
                    >
                      <span>🚀</span> Start New Recipe
                    </button>
                    <button
                      onClick={() => {
                        setMessages(prev => prev.map(m =>
                          m.id === msg.id ? { ...m, redirectDismissed: true } : m
                        ));
                      }}
                      style={{
                        width: "100%",
                        padding: "11px",
                        background: "transparent",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "10px",
                        color: "var(--text-muted)",
                        fontSize: "13px",
                        cursor: "pointer",
                      }}
                    >
                      ✋ No thanks, continue with {msg.currentDishName || "current recipe"}
                    </button>
                  </div>
                )}
                {msg.confirmed && (
                  <div style={{
                    marginTop: "8px",
                    fontSize: "11px",
                    color: "var(--color-secondary)",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    opacity: 0.8
                  }}>
                    <Zap size={10} /> Applied to Ingredients
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Loading indicator */}
        {loading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}
          >
            <div style={{
              width: "30px",
              height: "30px",
              borderRadius: "50%",
              background: "var(--gradient-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "14px",
            }}>
              👨‍🍳
            </div>
            <div style={{
              padding: "14px 16px",
              background: "var(--bg-surface-2)",
              borderRadius: "4px 16px 16px 16px",
              border: "1px solid var(--border-subtle)",
              display: "flex",
              gap: "6px",
              alignItems: "center",
            }}>
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.12 }}
                  style={{
                    width: "7px",
                    height: "7px",
                    borderRadius: "50%",
                    background: "var(--color-primary)",
                  }}
                />
              ))}
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Funny Guardrail Counter ── */}
      {guardrailStats && (guardrailStats.by_category.blocked_prompt_injection + guardrailStats.by_category.blocked_unsafe_content) > 0 && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            padding: "8px 16px",
            background: "rgba(255, 107, 107, 0.1)",
            borderTop: "1px solid rgba(255, 107, 107, 0.2)",
            borderBottom: "1px solid rgba(255, 107, 107, 0.2)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "11px",
            color: "var(--color-accent)",
            fontFamily: "var(--font-heading)",
            fontWeight: 800,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <motion.span 
              animate={{ opacity: [1, 0.5, 1] }} 
              transition={{ repeat: Infinity, duration: 1.5 }}
              role="img" 
              aria-label="shield"
            >
              🛡️
            </motion.span>
            <span>POLICE DEPARTMENT: <strong>{guardrailStats.by_category.blocked_prompt_injection + guardrailStats.by_category.blocked_unsafe_content}</strong> Poisoners Intercepted</span>
          </div>
          <div style={{ opacity: 0.8, fontSize: "10px" }}>
            🛡️ Integrity: {100 - guardrailStats.block_rate_pct}%
          </div>
        </motion.div>
      )}

      {/* ── Suggestions ── */}
      <div style={{
        padding: "10px 12px",
        borderTop: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        background: "var(--bg-surface-2)",
      }}>
        <div style={{ 
          display: "flex", 
          gap: "8px", 
          overflowX: "auto", 
          paddingBottom: "8px",
          maskImage: "linear-gradient(to right, black 90%, transparent 100%)"
        }}>
          {(activeSuggestions.length > 0 ? activeSuggestions : QUICK_ACTIONS.map(a => `${a.emoji} ${a.label}`)).map((label) => (
            <button
              key={label}
              onClick={() => sendMessage(label.replace(/^[^\s]+\s/, ""))}
              disabled={loading}
              className="chip"
              style={{ 
                fontSize: "12px", 
                padding: "8px 16px", 
                whiteSpace: "nowrap",
                background: "var(--bg-surface)",
                border: "2px solid var(--border-subtle)",
                borderRadius: "20px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                fontWeight: 600,
                color: "var(--text-primary)"
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Input ── */}
      <div style={{
        padding: "12px",
        background: "var(--bg-surface-2)",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}>
        {/* Preview Area */}
        {imagePreview && (
          <div style={{ position: "relative", width: "fit-content" }}>
            <img 
              src={imagePreview} 
              alt="Upload preview" 
              style={{ width: "60px", height: "60px", objectFit: "cover", borderRadius: "8px", border: "2px solid var(--border-subtle)" }}
            />
            <button
              onClick={removeImage}
              style={{
                position: "absolute",
                top: "-6px",
                right: "-6px",
                background: "rgba(0,0,0,0.6)",
                color: "white",
                borderRadius: "50%",
                padding: "2px",
                border: "none",
                cursor: "pointer",
              }}
            >
              <X size={12} />
            </button>
          </div>
        )}

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleImageUpload}
            style={{ display: "none" }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="chip"
            style={{ padding: "10px", borderRadius: "var(--radius-md)" }}
          >
            <Camera size={18} />
          </button>
          
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={hasRecipe ? "Ask to modify this recipe..." : "Ask anything about cooking..."}
            disabled={loading}
            className="input-field"
            style={{ flex: 1, padding: "10px 14px", fontSize: "14px" }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={(!input.trim() && !selectedImage) || loading}
            className="btn-primary"
            style={{ padding: "10px 16px", borderRadius: "var(--radius-md)", fontSize: "14px" }}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
