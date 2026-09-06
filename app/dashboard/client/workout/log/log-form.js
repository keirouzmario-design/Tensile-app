"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function parseRange(repsTarget) {
  const parts = (repsTarget || "").split("-").map((s) => parseInt(s.trim(), 10));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return { min: parts[0], max: parts[1] };
  }
  return { min: 0, max: 999 };
}

function computeRecommendation(loggedSets, min, max) {
  const anyBelowMin = loggedSets.some((s) => s.reps < min);
  if (anyBelowMin) return { recommendation: "deload", flagged: true };

  const allAtOrAboveMax = loggedSets.every((s) => s.reps >= max);
  if (allAtOrAboveMax) {
    const anyFailure = loggedSets.some((s) => s.effort === "failure");
    if (anyFailure) return { recommendation: "hold", flagged: false };
    return { recommendation: "increase", flagged: false };
  }

  return { recommendation: "hold", flagged: false };
}

export default function LogForm({ items, clientId, coachId, dayOfWeek }) {
  const supabase = createClient();
  const router = useRouter();

  const initialState = {};
  items.forEach((item) => {
    initialState[item.rowId] = Array.from({ length: item.sets }, () => ({
      weight: item.weight || "",
      reps: "",
      effort: "",
    }));
  });

  const [setsByRow, setSetsByRow] = useState(initialState);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  function updateSet(rowId, setIndex, field, value) {
    setSetsByRow((prev) => {
      const rowSets = [...prev[rowId]];
      rowSets[setIndex] = { ...rowSets[setIndex], [field]: value };
      return { ...prev, [rowId]: rowSets };
    });
  }

  async function handleSubmit() {
    setError("");

    for (const item of items) {
      const rowSets = setsByRow[item.rowId];
      for (const s of rowSets) {
        if (s.reps === "" || isNaN(parseInt(s.reps, 10))) {
          setError(`Please enter reps for every set of ${item.exerciseName}.`);
          return;
        }
      }
    }

    setSaving(true);

    const logRows = [];
    const adjustmentRows = [];

    for (const item of items) {
      const { min, max } = parseRange(item.repsTarget);
      const rowSets = setsByRow[item.rowId];

      const parsedSets = rowSets.map((s, idx) => ({
        set_number: idx + 1,
        reps: parseInt(s.reps, 10),
        weight: s.weight,
        effort: parseInt(s.reps, 10) >= max ? s.effort || null : null,
      }));

      parsedSets.forEach((s) => {
        logRows.push({
          client_id: clientId,
          coach_id: coachId,
          exercise_id: item.exerciseId,
          day_of_week: dayOfWeek,
          set_number: s.set_number,
          reps_logged: s.reps,
          weight_logged: s.weight,
          effort: s.effort,
        });
      });

      const { recommendation, flagged } = computeRecommendation(
        parsedSets.map((s) => ({ reps: s.reps, effort: s.effort })),
        min,
        max
      );

      adjustmentRows.push({
        client_id: clientId,
        coach_id: coachId,
        exercise_id: item.exerciseId,
        recommendation,
        flagged,
      });
    }

    const { error: logError } = await supabase.from("workout_log_sets").insert(logRows);
    if (logError) {
      setSaving(false);
      setError("Something went wrong saving your log. Please try again.");
      return;
    }

    await supabase.from("workout_adjustments").insert(adjustmentRows);

    setSaving(false);
    setDone(true);
    router.refresh();
  }

  if (done) {
    return (
      <div className="empty-state">
        Logged! Your coach will see this, and your next session's
        recommendations are ready.{" "}
        <a href="/dashboard/client/workout" style={{ color: "var(--moss-deep)", fontWeight: 700 }}>
          Back to your plan
        </a>
      </div>
    );
  }

  return (
    <div>
      {items.map((item) => {
        const { max } = parseRange(item.repsTarget);
        const rowSets = setsByRow[item.rowId];
        return (
          <div key={item.rowId} className="card" style={{ padding: 16, marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
              {item.exerciseName}
            </div>
            <div className="muted" style={{ marginBottom: 10 }}>
              Target: {item.repsTarget} reps
            </div>
            {rowSets.map((s, idx) => {
              const repsNum = parseInt(s.reps, 10);
              const showEffort = !isNaN(repsNum) && repsNum >= max;
              return (
                <div
                  key={idx}
                  style={{
                    borderTop: idx === 0 ? "none" : "1px solid var(--line)",
                    paddingTop: idx === 0 ? 0 : 10,
                    marginTop: idx === 0 ? 0 : 10,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--steel)", marginBottom: 6 }}>
                    Set {idx + 1}
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 11, color: "var(--steel)" }}>Weight</label>
                      <input
                        type="text"
                        value={s.weight}
                        onChange={(e) => updateSet(item.rowId, idx, "weight", e.target.value)}
                        style={{
                          width: "100%",
                          padding: "6px 8px",
                          border: "1px solid var(--line)",
                          borderRadius: 6,
                          fontSize: 13,
                        }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 11, color: "var(--steel)" }}>Reps</label>
                      <input
                        type="number"
                        value={s.reps}
                        onChange={(e) => updateSet(item.rowId, idx, "reps", e.target.value)}
                        style={{
                          width: "100%",
                          padding: "6px 8px",
                          border: "1px solid var(--line)",
                          borderRadius: 6,
                          fontSize: 13,
                        }}
                      />
                    </div>
                  </div>
                  {showEffort && (
                    <div style={{ marginTop: 8 }}>
                      <label style={{ fontSize: 11, color: "var(--steel)" }}>
                        You hit the top of your range — how did it feel?
                      </label>
                      <select
                        value={s.effort}
                        onChange={(e) => updateSet(item.rowId, idx, "effort", e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          border: "1px solid var(--line)",
                          borderRadius: 6,
                          fontSize: 13,
                          background: "var(--card)",
                          color: "var(--ink)",
                          marginTop: 4,
                        }}
                      >
                        <option value="">Select...</option>
                        <option value="very_easy">Very easy</option>
                        <option value="easy">Easy</option>
                        <option value="failure">Reached failure (couldn't do another rep)</option>
                      </select>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      {error && (
        <div style={{ color: "var(--rust)", fontSize: 13, marginBottom: 12 }}>{error}</div>
      )}

      <button
        onClick={handleSubmit}
        disabled={saving}
        className="btn-primary"
        style={{ width: "auto", padding: "10px 20px" }}
      >
        {saving ? "Saving..." : "Submit log"}
      </button>
    </div>
  );
}
