"use client";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Camera, X, ImageIcon } from "lucide-react";

interface ImageUploaderProps {
  onImageSelected: (file: File, preview: string) => void;
  onClear: () => void;
  preview?: string;
  disabled?: boolean;
}

export default function ImageUploader({
  onImageSelected,
  onClear,
  preview,
  disabled,
}: ImageUploaderProps) {
  const [dragError, setDragError] = useState<string>("");

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: any[]) => {
      setDragError("");
      if (rejectedFiles.length > 0) {
        const err = rejectedFiles[0].errors[0];
        if (err.code === "file-too-large") {
          setDragError("Image is too large. Max size is 5MB.");
        } else if (err.code === "file-invalid-type") {
          setDragError("Invalid file type. Please upload a JPEG, PNG, or WebP image.");
        } else {
          setDragError(err.message);
        }
        return;
      }
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];
        const previewUrl = URL.createObjectURL(file);
        onImageSelected(file, previewUrl);
      }
    },
    [onImageSelected]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
    },
    maxSize: 5 * 1024 * 1024, // 5MB
    maxFiles: 1,
    disabled,
  });

  return (
    <div style={{ width: "100%" }}>
      <AnimatePresence mode="wait">
        {preview ? (
          /* Preview state */
          <motion.div
            key="preview"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{
              position: "relative",
              borderRadius: "var(--radius-lg)",
              overflow: "hidden",
              border: "2px solid var(--border-medium)",
              background: "var(--bg-surface-2)",
            }}
          >
            <img
              src={preview}
              alt="Uploaded food"
              style={{
                width: "100%",
                maxHeight: "320px",
                objectFit: "cover",
                display: "block",
              }}
            />
            {/* Overlay gradient */}
            <div style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(to top, rgba(0,0,0,0.4) 0%, transparent 50%)",
            }} />
            {/* Clear button */}
            {!disabled && (
              <button
                onClick={onClear}
                style={{
                  position: "absolute",
                  top: "12px",
                  right: "12px",
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background: "rgba(0,0,0,0.6)",
                  backdropFilter: "blur(8px)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px solid rgba(255,255,255,0.2)",
                  color: "white",
                  transition: "all 0.2s",
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = "rgba(255,107,53,0.8)")}
                onMouseOut={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.6)")}
              >
                <X size={16} />
              </button>
            )}
            <div style={{
              position: "absolute",
              bottom: "12px",
              left: "16px",
              background: "rgba(0,0,0,0.7)",
              backdropFilter: "blur(8px)",
              borderRadius: "var(--radius-full)",
              padding: "4px 12px",
              fontSize: "12px",
              color: "var(--text-secondary)",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}>
              <ImageIcon size={12} />
              Image ready to analyze
            </div>
          </motion.div>
        ) : (
          /* Upload drop zone */
          <motion.div
            key="dropzone"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            {...(getRootProps() as any)}
            style={{
              border: `2px dashed ${isDragActive ? "var(--color-primary)" : "var(--border-medium)"}`,
              borderRadius: "var(--radius-lg)",
              padding: "48px 24px",
              textAlign: "center",
              cursor: disabled ? "not-allowed" : "pointer",
              background: isDragActive
                ? "rgba(255,107,53,0.05)"
                : "var(--bg-surface-2)",
              transition: "all 0.2s ease",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <input {...getInputProps()} />

            {/* Background decoration */}
            <div style={{
              position: "absolute",
              top: "-30px",
              right: "-30px",
              width: "120px",
              height: "120px",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(255,107,53,0.08) 0%, transparent 70%)",
              pointerEvents: "none",
            }} />

            <motion.div
              animate={isDragActive ? { scale: 1.2, rotate: 5 } : { scale: 1, rotate: 0 }}
              style={{ fontSize: "48px", marginBottom: "16px" }}
            >
              {isDragActive ? "🍽️" : "📸"}
            </motion.div>

            <h3 style={{
              fontFamily: "var(--font-heading)",
              fontSize: "18px",
              fontWeight: 700,
              color: isDragActive ? "var(--color-primary)" : "var(--text-primary)",
              marginBottom: "8px",
            }}>
              {isDragActive ? "Drop your food photo here!" : "Upload a Food Photo"}
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "14px", marginBottom: "20px" }}>
              Dish · Ingredients · Fridge · Pantry
            </p>

            <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
              <div className="btn-primary" style={{ pointerEvents: "none", padding: "10px 20px", fontSize: "14px" }}>
                <Upload size={15} />
                Browse Files
              </div>
            </div>

            <p style={{
              fontSize: "12px",
              color: "var(--text-muted)",
              marginTop: "16px",
            }}>
              JPEG, PNG, WebP · Max 5MB
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error message */}
      <AnimatePresence>
        {dragError && (
          <motion.p
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              color: "var(--color-primary)",
              fontSize: "13px",
              marginTop: "8px",
              padding: "8px 12px",
              background: "rgba(255,107,53,0.1)",
              borderRadius: "var(--radius-sm)",
              border: "1px solid rgba(255,107,53,0.2)",
            }}
          >
            ⚠️ {dragError}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
