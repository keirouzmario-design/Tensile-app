"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ProgramSetup({ clientId, coachId }) {
  const supabase = createClient();
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [durationWeeks, setDurationWeeks] = useState(4);
  const [startDate, setStartDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submittingRef = useRef(false);

  const inputStyle = {
    width: "100%",
    padding: "8px 10px",
    border: "1px solid var(--line)",
    borderRadius: 6,
    fontSize: 13,
    marginTop: 4,
    marginBottom: 14,
  };

  async function createProgram() {
    // Blocks an instant double-tap before React even has a chance to
    // re-render and disable the button
    if (submittingRef.current) return;

    if (!name.trim()) {
      setError("Give the program a name.");
      return;
    }
    if (!startDate) {
      setError("Pick a start date.");
      return;
    }
    const weeks = parseInt(durationWeeks, 10);
    if (!weeks || weeks < 1) {
      setError("Duration must be at least 1 week.");
      return;
    }

    submittingRef.current = true;
    setError("");
    setSaving(true);

    const { data: program, error: programError } = await supabase
      .from("programs")
      .insert({
        coach_id: coachId,
        client_id: clientId,
        name: name.trim(),
        description: description.trim() || null,
        duration_weeks: weeks,
        start_date: startDate,
        active: true,
      })
      .select()
      .single();

    if (programError) {
      setError(programError.message);
      setSaving(false);
      submittingRef.current = false;
      return;
    }

    const weekRows = Array.from({ length: weeks }, (_, i) => ({
      program_id: program.id,
      week_number: i + 1,
    }));

    const { error: weeksError } = await supabase
      .from("program_weeks")
      .insert(weekRows);

    if (weeksError) {
      setError(weeksError.message);
      setSaving(false);
      submittingRef.current = false;
      return;
    }

    setSaving(false);
    submittingRef.current = false;
    router.refresh();
  }

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
        No program yet
      </div>
      <div className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
        Set up a personalized program for this client to start building weeks
        and exercises.
      </div>

      <label style={{ fontSize: 11, color: "var(--steel)" }}>Program name</label>
      <input
        type="text"
        placeholder="e.g. Strength Block 1"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={inputStyle}
      />

      <label style={{ fontSize: 11, color: "var(--steel)" }}>
        Description (optional)
      </label>
      <input
        type="text"
        placeholder="Goals, focus, notes..."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        style={inputStyle}
      />

      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, color: "var(--steel)" }}>
            Duration (weeks)
          </label>
          <input
            type="number"
            min="1"
            value={durationWeeks}
            onChange={(e) => setDurationWeeks(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, color: "var(--steel)" }}>
            Start date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={inputStyle}
          />
        </div>
      </div>

      {error && (
        <div style={{ color: "var(--rust)", fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      )}

      <button
        onClick={createProgram}
        disabled={saving}
        style={{
          border: "none",
          background: "var(--ink)",
          color: "var(--card)",
          borderRadius: 6,
          padding: "10px 16px",
          fontSize: 13,
          fontWeight: 700,
          cursor: saving ? "default" : "pointer",
          opacity: saving ? 0.6 : 1,
        }}
      >
        {saving ? "Creating..." : "Create Program"}
      </button>
    </div>
  );
}
