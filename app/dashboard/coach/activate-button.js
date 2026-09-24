"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ActivateButton({ coachId, clientId, days, currentEndDate }) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);

  async function handleActivate() {
    // Blocks an instant double-tap before React re-renders and disables the
    // button — important here since a double-tap would silently add the
    // days twice instead of creating an obvious duplicate row
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);

    const todayStr = new Date().toISOString().split("T")[0];

    // Extend from whichever is later: the client's current end date (if
    // their package is still active), or today (if it already expired or
    // was never set). This carries over unused days instead of losing them.
    const baseDateStr =
      currentEndDate && currentEndDate > todayStr ? currentEndDate : todayStr;

    const newEndDate = new Date(baseDateStr);
    newEndDate.setDate(newEndDate.getDate() + days);
    const formatted = newEndDate.toISOString().split("T")[0];

    await supabase
      .from("coach_client_links")
      .update({ package_end_date: formatted })
      .eq("coach_id", coachId)
      .eq("client_id", clientId);

    setLoading(false);
    submittingRef.current = false;
    router.refresh();
  }

  return (
    <button
      onClick={handleActivate}
      disabled={loading}
      style={{
        background: "var(--moss)",
        color: "var(--card)",
        border: "none",
        borderRadius: 6,
        padding: "6px 12px",
        fontSize: 12,
        fontWeight: 700,
        cursor: loading ? "default" : "pointer",
        opacity: loading ? 0.6 : 1,
      }}
    >
      {loading ? "..." : `+${days} days`}
    </button>
  );
}
