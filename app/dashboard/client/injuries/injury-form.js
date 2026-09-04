"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function InjuryForm({ userId, initialValue }) {
  const supabase = createClient();
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    await supabase.from("profiles").update({ injuries: value }).eq("id", userId);
    setSaving(false);
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={5}
        placeholder="e.g. Right shoulder impingement, avoid overhead pressing"
        style={{
          width: "100%",
          padding: "10px 12px",
          border: "1px solid var(--line)",
          borderRadius: 6,
          fontSize: 14,
          fontFamily: "inherit",
        }}
      />
      <button
        onClick={handleSave}
        disabled={saving}
        className="btn-primary"
        style={{ marginTop: 12, width: "auto", padding: "10px 20px" }}
      >
        {saving ? "Saving..." : saved ? "Saved ✓" : "Save"}
      </button>
    </div>
  );
}
