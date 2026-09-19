"use client";

import { useState } from "react";

export default function ExerciseItem({ name, gifUrl, instructions, videoUrl }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          margin: 0,
          textAlign: "left",
          cursor: "pointer",
          fontWeight: 600,
          fontSize: "inherit",
          fontFamily: "inherit",
          color: "var(--moss-deep)",
          textDecoration: "underline",
        }}
      >
        {name}
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--card)",
              borderRadius: 12,
              padding: 20,
              maxWidth: 420,
              width: "100%",
              maxHeight: "80vh",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 14,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 16 }}>{name}</div>
              <button
                onClick={() => setOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 22,
                  lineHeight: 1,
                  cursor: "pointer",
                  color: "var(--steel)",
                }}
              >
                ×
              </button>
            </div>

            {gifUrl ? (
              <img
                src={gifUrl}
                alt={name}
                style={{ width: "100%", borderRadius: 8, marginBottom: 14, display: "block" }}
              />
            ) : (
              <div
                className="muted"
                style={{ fontSize: 13, marginBottom: 14, padding: 10, background: "var(--paper)", borderRadius: 6 }}
              >
                No demo GIF added yet.
              </div>
            )}

            {instructions ? (
              <div style={{ fontSize: 14, marginBottom: 14, whiteSpace: "pre-wrap" }}>
                {instructions}
              </div>
            ) : (
              <div className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
                No instructions added yet.
              </div>
            )}

            {videoUrl && (
              <a
                href={videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 13, fontWeight: 700, color: "var(--moss-deep)" }}
              >
                Watch video →
              </a>
            )}
          </div>
        </div>
      )}
    </>
  );
}
