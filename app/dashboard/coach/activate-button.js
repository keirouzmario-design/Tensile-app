"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ActivateButton({ coachId, clientId, days }) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  async function handleActivate() {
    setLoading(true);

    const newEndDate = new Date();
    newEndDate.setDate(newEndDate.getDate() + days);
    const formatted = newEndDate.toISOString().split("T")[0];

    await supabase
      .from("coach_client_links")
      .update({ package_end_date: formatted })
      .eq("coach_id", coachId)
      .eq("client_id", clientId);

    setLoading(false);
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
        cursor: "pointer",
      }}
    >
      {loading ? "..." : `+${days} days`}
    </button>
  );
}
