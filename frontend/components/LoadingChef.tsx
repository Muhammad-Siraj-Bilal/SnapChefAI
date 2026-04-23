"use client";
import { motion } from "framer-motion";

export default function LoadingChef({ message = "Analyzing your image..." }: { message?: string }) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "24px",
      padding: "40px",
    }}>
      {/* Animated chef hat */}
      <motion.div
        animate={{ rotate: [0, -10, 10, -10, 0] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        style={{ fontSize: "64px", lineHeight: 1 }}
      >
        👨‍🍳
      </motion.div>

      {/* Pulsing ring */}
      <div style={{ position: "relative", width: "80px", height: "80px" }}>
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{ scale: [1, 2], opacity: [0.6, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.5, ease: "easeOut" }}
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              border: "2px solid var(--color-primary)",
            }}
          />
        ))}
        <div style={{
          position: "absolute",
          inset: "20px",
          borderRadius: "50%",
          background: "var(--gradient-primary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        </div>
      </div>

      {/* Message */}
      <div style={{ textAlign: "center" }}>
        <p style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: "16px", marginBottom: "4px" }}>
          {message}
        </p>
        <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
          This usually takes 5–10 seconds
        </p>
      </div>

      {/* Bouncing dots */}
      <div style={{ display: "flex", gap: "8px" }}>
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "var(--color-primary)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
