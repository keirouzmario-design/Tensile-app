"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function RemoveClientButton({ coachId, clientId, clientName }) {
  const supabase = createClient();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState("");
  const submittingRef = useRef(false);

  async function handleRemove() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setRemoving(true);
    setError("");

    const { error: deleteError } = await supabase
      .from("coach_client_links")
      .delete()
      .eq("coach_id", coachId)
      .eq("client_id", clientId);

    setRemoving(false);
    submittingRef.current = false;

    if (deleteError) {
      setError("Couldn't remove client. Try again.");
      return;
    }

    router.refresh();
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "var(--steel)",
          background: "none",
          border: "none",
          cursor: "pointer",
        }}
      >
        Remove client
      </button>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <span style={{ fontSize: 11, color: "var(--rust)" }}>
        Remove {clientName || "this client"} from your roster?
      </span>
      <button
        onClick={handleRemove}
        disabled={removing}
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "var(--card)",
          background: "var(--rust)",
          border: "none",
          borderRadius: 6,
          padding: "4px 10px",
          cursor: removing ? "default" : "pointer",
        }}
      >
        {removing ? "Removing..." : "Confirm"}
      </button>
      <button
        onClick={() => setConfirming(false)}
        disabled={removing}
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "var(--steel)",
          background: "none",
          border: "1px solid var(--line)",
          borderRadius: 6,
          padding: "4px 10px",
          cursor: "pointer",
        }}
      >
        Cancel
      </button>
      {error && <span style={{ fontSize: 11, color: "var(--rust)" }}>{error}</span>}
    </div>
  );
}
