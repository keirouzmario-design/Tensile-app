"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function calcPrice(days, chat) {
  const base = days * 20;
  const chatFee = chat === "daily" ? 40 : chat === "weekly" ? 15 : 0;
  return base + chatFee;
}

export default function StartPlanForm({ coachId, clientId }) {
  const supabase = createClient();
  const router = useRouter();
  const [days, setDays] = useState(3);
  const [chat, setChat] = useState("weekly");
  const [loading, setLoading] = useState(false);

  const price = calcPrice(days, chat);

  async function handleSubmit() {
    setLoading(true);
    await supabase.from("package_requests").insert({
      client_id: clientId,
      coach_id: coachId,
      days_per_week: days,
      chat_frequency: chat,
      price,
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="card">
      <div style={{ fontWeight: 700, marginBottom: 12 }}>Choose your package</div>

      <label style={{ fontSize: 13, color: "var(--steel)" }}>Training days per week</label>
      <div style={{ display: "flex", gap: 6, margin: "8px 0 16px", flexWrap: "wrap" }}>
        {[1, 2, 3, 4, 5, 6].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            style={{
              border: "1px solid var(--line)",
              borderRadius: 6,
              padding: "6px 12px",
              fontSize: 13,
              fontWeight: 600,
              background: days === d ? "var(--ink)" : "var(--card)",
              color: days === d ? "var(--card)" : "var(--ink)",
              cursor: "pointer",
            }}
          >
            {d}
          </button>
        ))}
      </div>

      <label style={{ fontSize: 13, color: "var(--steel)" }}>Coach chat frequency</label>
      <div style={{ display: "flex", gap: 6, margin: "8px 0 16px", flexWrap: "wrap" }}>
        {[
          { v: "weekly", l: "Once a week" },
          { v: "daily", l: "Every session" },
        ].map((opt) => (
          <button
            key={opt.v}
            onClick={() => setChat(opt.v)}
            style={{
              border: "1px solid var(--line)",
              borderRadius: 6,
              padding: "6px 12px",
              fontSize: 13,
              fontWeight: 600,
              background: chat === opt.v ? "var(--ink)" : "var(--card)",
              color: chat === opt.v ? "var(--card)" : "var(--ink)",
              cursor: "pointer",
            }}
          >
            {opt.l}
          </button>
        ))}
      </div>

      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>
        ${price} <span style={{ fontSize: 12, fontWeight: 400, color: "var(--steel)" }}>/ month</span>
      </div>

      <button onClick={handleSubmit} disabled={loading} className="btn-primary">
        {loading ? "Sending..." : "Request this package"}
      </button>
    </div>
  );
}
