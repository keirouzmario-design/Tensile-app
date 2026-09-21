"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const STARTING_WEIGHT_BY_EQUIPMENT = {
  bodyweight: "Bodyweight",
  barbell: "20 kg",
  dumbbell: "5 kg",
  kettlebell: "8 kg",
  cable: "10 kg",
  machine: "10 kg",
  bands: "Light band",
};

function parseRange(repsTarget) {
  const parts = (repsTarget || "").split("-").map((s) => parseInt(s.trim(), 10));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return { min: parts[0], max: parts[1] };
  }
  return { min: 0, max: 999 };
}

function computeRecommendation(loggedSets, min, max) {
  const anyBelowMin = loggedSets.some((s) => s.reps < min);
  if (anyBelowMin) {
    const painSet = loggedSets.find((s) => s.reps < min && s.reason === "pain");
    if (painSet) return { recommendation: "flag_pain", flagged: true };
    return { recommendation: "decrease", flagged: true };
  }

  const allAtOrAboveMax = loggedSets.every((s) => s.reps >= max);
  if (allAtOrAboveMax) {
    const anyFailure = loggedSets.some((s) => s.effort === "failure");
    if (anyFailure) return { recommendation: "hold", flagged: false };
    return { recommendation: "increase", flagged: false };
  }

  return { recommendation: "hold", flagged: false };
}

function parseWeightValue(weightStr) {
  if (!weightStr) return null;
  const match = weightStr.trim().match(/^(\d+(\.\d+)?)\s*(.*)$/);
  if (!match) return null;
  return { value: parseFloat(match[1]), suffix: match[3] || "" };
}

function pickSessionWeight(rowSets) {
  for (const s of rowSets) {
    if (s.weight && s.weight.trim() !== "") return s.weight.trim();
  }
  return null;
}

function computeNextWeight(sessionWeight, recommendation) {
  if (!sessionWeight) return null;
  const parsed = parseWeightValue(sessionWeight);
  if (!parsed) return sessionWeight;

  let newValue = parsed.value;
  if (recommendation === "increase") newValue = parsed.value * 1.05;
  else if (recommendation === "decrease") newValue = parsed.value * 0.9;

  const rounded = Math.round(newValue * 2) / 2;
  return parsed.suffix ? `${rounded} ${parsed.suffix}` : `${rounded}`;
}

function isoDayOfWeek(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  const jsDay = d.getDay();
  return jsDay === 0 ? 7 : jsDay;
}

async function checkAndRecordPR(supabase, clientId, coachId, exerciseId, rowSets, sessionDate) {
  let best = null;
  for (const s of rowSets) {
    const parsed = parseWeightValue(s.weight);
    const reps = parseInt(s.reps, 10);
    if (parsed && !isNaN(reps)) {
      if (!best || parsed.value > best.value) {
        best = { value: parsed.value, suffix: parsed.suffix, reps };
      }
    }
  }
  if (!best) return null;

  const { data: existing } = await supabase
    .from("personal_records")
    .select("id, weight_value")
    .eq("client_id", clientId)
    .eq("exercise_id", exerciseId)
    .maybeSingle();

  if (existing && best.value <= existing.weight_value) return null;

  const weightDisplay = best.suffix ? `${best.value} ${best.suffix}` : `${best.value}`;

  if (existing) {
    await supabase
      .from("personal_records")
      .update({
        weight_value: best.value,
        weight_display: weightDisplay,
        reps: best.reps,
        session_date: sessionDate,
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("personal_records").insert({
      client_id: clientId,
      coach_id: coachId,
      exercise_id: exerciseId,
      weight_value: best.value,
      weight_display: weightDisplay,
      reps: best.reps,
      session_date: sessionDate,
    });
  }

  return weightDisplay;
}

export default function LogForm({ items, clientId, coachId, sessionDate }) {
  const supabase = createClient();
  const router = useRouter();

  const initialState = {};
  items.forEach((item) => {
    const startingWeight =
      item.weight || STARTING_WEIGHT_BY_EQUIPMENT[item.equipmentType] || "";
    initialState[item.rowId] = Array.from({ length: item.sets }, (_, idx) => {
      const last = item.lastSets ? item.lastSets[idx + 1] : undefined;
      return {
        weight: startingWeight,
        reps: last && last.reps != null ? String(last.reps) : "",
        effort: last && last.effort ? last.effort : "",
        reason: last && last.reason ? last.reason : "",
      };
    });
  });

  const [setsByRow, setSetsByRow] = useState(initialState);
  const [openInfo, setOpenInfo] = useState({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [newPRs, setNewPRs] = useState([]);
  const [error, setError] = useState("");
  const [existingLogWarning, setExistingLogWarning] = useState(false);

  function updateSet(rowId, setIndex, field, value) {
    setSetsByRow((prev) => {
      const rowSets = [...prev[rowId]];
      rowSets[setIndex] = { ...rowSets[setIndex], [field]: value };
      return { ...prev, [rowId]: rowSets };
    });
  }

  function toggleInfo(rowId, panel) {
    setOpenInfo((prev) => ({
      ...prev,
      [rowId]: prev[rowId] === panel ? null : panel,
    }));
  }

  function validateFields() {
    for (const item of items) {
      const { min } = parseRange(item.repsTarget);
      const rowSets = setsByRow[item.rowId];
      for (const s of rowSets) {
        const repsNum = parseInt(s.reps, 10);
        if (s.reps === "" || isNaN(repsNum)) {
          return `Please enter reps for every set of ${item.exerciseName}.`;
        }
        if (repsNum < min && !s.reason) {
          return `Please select a reason for the missed reps on ${item.exerciseName}.`;
        }
      }
    }
    return null;
  }

  async function handleSubmit(force = false) {
    setError("");

    const validationError = validateFields();
    if (validationError) {
      setError(validationError);
      return;
    }

    const exerciseIds = items.map((item) => item.exerciseId);

    if (!force) {
      const { data: existingLogs } = await supabase
        .from("workout_log_sets")
        .select("id")
        .eq("client_id", clientId)
        .eq("session_date", sessionDate)
        .in("exercise_id", exerciseIds)
        .limit(1);

      if (existingLogs && existingLogs.length > 0) {
        setExistingLogWarning(true);
        return;
      }
    }

    setExistingLogWarning(false);
    setSaving(true);

    // Overwrite mode: clear any previous entries for this client/date/exercises
    // before inserting fresh ones, so resubmits never duplicate rows.
    await supabase
      .from("workout_log_sets")
      .delete()
      .eq("client_id", clientId)
      .eq("session_date", sessionDate)
      .in("exercise_id", exerciseIds);

    await supabase
      .from("workout_adjustments")
      .delete()
      .eq("client_id", clientId)
      .eq("session_date", sessionDate)
      .in("exercise_id", exerciseIds);

    const logRows = [];
    const adjustmentRows = [];
    const weightUpdates = [];
    const dayOfWeek = isoDayOfWeek(sessionDate);

    for (const item of items) {
      const { min, max } = parseRange(item.repsTarget);
      const rowSets = setsByRow[item.rowId];

      const parsedSets = rowSets.map((s, idx) => {
        const reps = parseInt(s.reps, 10);
        return {
          set_number: idx + 1,
          reps,
          weight: s.weight,
          effort: reps >= max ? s.effort || null : null,
          reason: reps < min ? s.reason || null : null,
        };
      });

      parsedSets.forEach((s) => {
        logRows.push({
          client_id: clientId,
          coach_id: coachId,
          exercise_id: item.exerciseId,
          day_of_week: dayOfWeek,
          session_date: sessionDate,
          set_number: s.set_number,
          reps_logged: s.reps,
          weight_logged: s.weight,
          effort: s.effort,
          shortfall_reason: s.reason,
        });
      });

      const { recommendation, flagged } = computeRecommendation(
        parsedSets.map((s) => ({ reps: s.reps, effort: s.effort, reason: s.reason })),
        min,
        max
      );

      adjustmentRows.push({
        client_id: clientId,
        coach_id: coachId,
        exercise_id: item.exerciseId,
        session_date: sessionDate,
        recommendation,
        flagged,
      });

      const sessionWeight = pickSessionWeight(rowSets);
      const newWeight = computeNextWeight(sessionWeight, recommendation);
      if (newWeight && newWeight !== item.weight) {
        weightUpdates.push({ rowId: item.rowId, weight: newWeight });
      }
    }

    const { error: logError } = await supabase.from("workout_log_sets").insert(logRows);
    if (logError) {
      setSaving(false);
      setError("Something went wrong saving your log. Please try again.");
      return;
    }

    await supabase.from("workout_adjustments").insert(adjustmentRows);

    for (const u of weightUpdates) {
      await supabase
        .from("workout_plan_exercises")
        .update({ weight: u.weight })
        .eq("id", u.rowId);
    }

    const prResults = [];
    for (const item of items) {
      const rowSets = setsByRow[item.rowId];
      const prWeight = await checkAndRecordPR(
        supabase,
        clientId,
        coachId,
        item.exerciseId,
        rowSets,
        sessionDate
      );
      if (prWeight) {
        prResults.push({ name: item.exerciseName, weight: prWeight });
      }
    }

    setNewPRs(prResults);
    setSaving(false);
    setDone(true);
    router.refresh();
  }

  if (done) {
    return (
      <div className="empty-state">
        Logged! Great work.
        {newPRs.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {newPRs.map((pr, i) => (
              <div key={i} style={{ fontWeight: 700, color: "var(--moss-deep)", marginBottom: 4 }}>
                🎉 New PR: {pr.name} — {pr.weight}
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 12 }}>
          <a href="/dashboard/client/workout" style={{ color: "var(--moss-deep)", fontWeight: 700 }}>
            Back to your plan
          </a>
        </div>
      </div>
    );
  }

  return (
    <div>
      {items.map((item) => {
        const { min, max } = parseRange(item.repsTarget);
        const rowSets = setsByRow[item.rowId];
        const hasVideo = !!item.videoUrl;
        const hasInstructions = !!item.instructions;
        const infoOpen = openInfo[item.rowId];

        return (
          <div key={item.rowId} className="card" style={{ padding: 16, marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
              {item.exerciseName}
            </div>
            <div className="muted" style={{ marginBottom: 8 }}>
              Target: {item.repsTarget} reps
            </div>

            {(hasVideo || hasInstructions) && (
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                {hasInstructions && (
                  <button
                    onClick={() => toggleInfo(item.rowId, "instructions")}
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      padding: "6px 10px",
                      borderRadius: 6,
                      border: "1px solid var(--line)",
                      background: infoOpen === "instructions" ? "var(--ink)" : "var(--card)",
                      color: infoOpen === "instructions" ? "var(--card)" : "var(--ink)",
                    }}
                  >
                    Instructions
                  </button>
                )}
                {hasVideo && (
                  <a
                    href={item.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      padding: "6px 10px",
                      borderRadius: 6,
                      border: "1px solid var(--line)",
                      background: "var(--card)",
                      color: "var(--ink)",
                      textDecoration: "none",
                    }}
                  >
                    Watch video
                  </a>
                )}
              </div>
            )}

            {infoOpen === "instructions" && hasInstructions && (
              <div
                className="muted"
                style={{ fontSize: 13, marginBottom: 10, padding: 10, background: "var(--paper)", borderRadius: 6 }}
              >
                {item.instructions}
              </div>
            )}

            {rowSets.map((s, idx) => {
              const repsNum = parseInt(s.reps, 10);
              const showEffort = !isNaN(repsNum) && repsNum >= max;
              const showReason = !isNaN(repsNum) && repsNum > 0 && repsNum < min;
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
                  {showReason && (
                    <div style={{ marginTop: 8 }}>
                      <label style={{ fontSize: 11, color: "var(--steel)" }}>
                        You didn't reach the minimum reps — why?
                      </label>
                      <select
                        value={s.reason}
                        onChange={(e) => updateSet(item.rowId, idx, "reason", e.target.value)}
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
                        <option value="failure">Reached failure (couldn't do more reps)</option>
                        <option value="pain">Pain or discomfort</option>
                        <option value="form">Form broke down</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      {existingLogWarning && (
        <div
          className="card"
          style={{
            padding: 16,
            marginBottom: 12,
            borderColor: "var(--amber)",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--amber)", marginBottom: 6 }}>
            You already logged this day
          </div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
            Submitting again will replace your previous entries for this day
            with what's on this screen now.
          </div>
          <button
            onClick={() => handleSubmit(true)}
            disabled={saving}
            style={{
              border: "none",
              background: "var(--amber)",
              color: "var(--card)",
              borderRadius: 6,
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 700,
              cursor: saving ? "default" : "pointer",
            }}
          >
            {saving ? "Saving..." : "Overwrite and submit"}
          </button>
        </div>
      )}

      {error && (
        <div style={{ color: "var(--rust)", fontSize: 13, marginBottom: 12 }}>{error}</div>
      )}

      <button
        onClick={() => handleSubmit(false)}
        disabled={saving}
        className="btn-primary"
        style={{ width: "auto", padding: "10px 20px" }}
      >
        {saving ? "Saving..." : "Submit log"}
      </button>
    </div>
  );
}
