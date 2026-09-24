"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AccessCodeCard() {
  const [code, setCode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copiedText, setCopiedText] = useState(null);

  useEffect(() => {
    async function loadCode() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("access_code")
        .eq("id", user.id)
        .single();

      if (!error && data) {
        setCode(data.access_code);
      }
      setLoading(false);
    }

    loadCode();
  }, []);

  function handleCopy(text, label) {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  }

  if (loading || !code) {
    return null;
  }

  const inviteLink =
    typeof window !== "undefined" ? `${window.location.origin}/join?code=${code}` : "";

  return (
    <div className="card" style={{ padding: "18px 20px" }}>
      <div style={{ fontSize: 12, color: "var(--steel)", fontWeight: 600, marginBottom: 6 }}>
        YOUR ACCESS CODE
      </div>

      <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "0.08em" }}>
        {code}
      </div>

      <p style={{ fontSize: 12, color: "var(--steel)", marginTop: 6, marginBottom: 14 }}>
        Share this code or the invite link to add an athlete to your roster.
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={() => handleCopy(code, "code")}
          style={{
            fontSize: 12,
            fontWeight: 700,
            padding: "8px 14px",
            borderRadius: 8,
            border: "none",
            background: "var(--moss-deep)",
            color: "var(--card)",
            cursor: "pointer",
          }}
        >
          {copiedText === "code" ? "Copied!" : "Copy Code"}
        </button>

        <button
          onClick={() => handleCopy(inviteLink, "link")}
          style={{
            fontSize: 12,
            fontWeight: 700,
            padding: "8px 14px",
            borderRadius: 8,
            border: "1px solid var(--line)",
            background: "var(--card)",
            color: "var(--steel)",
            cursor: "pointer",
          }}
        >
          {copiedText === "link" ? "Copied!" : "Copy Invite Link"}
        </button>
      </div>
    </div>
  );
}
