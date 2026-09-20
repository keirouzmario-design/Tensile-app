"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const DAYS = [
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
  { label: "Sun", value: 7 },
];

export default function WorkoutEditor({
  clientId,
  coachId,
  program,
  initialWeeks,
  initialProgramExercises,
  allExercises,
}) {
  const supabase = createClient();
  const router = useRouter();
  const [activeWeekId, setActiveWeekId] = useState(initialWeeks[0]?.id || null);
  const [activeDay, setActiveDay] = useState(1);
  const [pickerFor, setPickerFor] = useState(null);
  const [search, setSearch] = useState("");
  const [equipmentFilter, setEquipmentFilter] = useState("all");
  const [muscleFilter, setMuscleFilter] = useState("all");
  const [savingId, setSavingId] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [generateMessage, setGenerateMessage] = useState("");

  const activeWeek = initialWeeks.find((w) => w.id === activeWeekId);

  const dayRows = initialProgramExercises
    .filter((r) => r.program_week_id === activeWeekId && r.day_of_week === activeDay)
    .sort((a, b) => a.order_index - b.order_index);

  const equipmentOptions = [
    "all",
    ...new Set(allExercises.map((ex) => ex.equipment_type).filter(Boolean)),
  ].sort();

  const muscleOptions = [
    "all",
    ...new Set(allExercises.map((ex) => ex.muscle_groups?.[0]).filter(Boolean)),
  ].sort();

  function mainMuscle(exercise) {
    return exercise?.muscle_groups?.[0] || "";
  }

  function openPicker(id) {
    setPickerFor(id);
    setSearch("");
    setEquipmentFilter("all");
    setMuscleFilter("all");
  }

  function closePicker() {
    setPickerFor(null);
    setSearch("");
    setEquipmentFilter("all");
    setMuscleFilter("all");
  }

  async function updateRow(id, fields) {
    setSavingId(id);
    await supabase.from("program_exercises").update(fields).eq("id", id);
    setSavingId(null);
    router.refresh();
  }

  async function deleteRow(id) {
    await supabase.from("program_exercises").delete().eq("id", id);
    router.refresh();
  }

  async function addExercise(exerciseId) {
    if (!activeWeekId) return;
    const nextOrder = dayRows.length;
    await supabase.from("program_exercises").insert({
      program_week_id: activeWeekId,
      day_of_week: activeDay,
      exercise_id: exerciseId,
      sets: 3,
      reps_target: "8-12",
      weight: "",
      order_index: nextOrder,
    });
    closePicker();
    router.refresh();
  }

  async function swapExercise(rowId, newExerciseId) {
    await updateRow(rowId, { exercise_id: newExerciseId });
    closePicker();
  }

  async function generateCalendar() {
    setGenerating(true);
    setGenerateMessage("");
    const { error } = await supabase.rpc("generate_program_workouts", {
      p_program_id: program.id,
    });
    setGenerating(false);
    if (error) {
      setGenerateMessage(`Error: ${error.message}`);
    } else {
      setGenerateMessage("Calendar generated — client can now see this program.");
    }
  }

  function swapCandidates(currentExercise) {
    const lockedMuscle = mainMuscle(currentExercise);
    return allExercises.filter((ex) => {
      const matchesMuscle = mainMuscle(ex) === lockedMuscle;
      const matchesEquipment =
        equipmentFilter === "all" || ex.equipment_type === equipmentFilter;
      const matchesSearch = ex.name.toLowerCase().includes(search.toLowerCase());
      return matchesMuscle && matchesEquipment && matchesSearch;
    });
  }

  const addCandidates = allExercises.filter((ex) => {
    const matchesMuscle = muscleFilter === "all" || mainMuscle(ex) === muscleFilter;
    const matchesEquipment =
      equipmentFilter === "all" || ex.equipment_type === equipmentFilter;
    const matchesSearch = ex.name.toLowerCase().includes(search.toLowerCase());
    return matchesMuscle && matchesEquipment && matchesSearch;
  });

  const selectStyle = {
    padding: "8px 10px",
    border: "1px solid var(--line)",
    borderRadius: 6,
    fontSize: 13,
    background: "var(--card)",
    color: "var(--ink)",
  };

  const smallInputStyle = {
    width: "100%",
    padding: "6px 8px",
    border: "1px solid var(--line)",
    borderRadius: 6,
    fontSize: 13,
  };

  return (
    <div>
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>{program.name}</div>
        {program.description && (
          <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
            {program.description}
          </div>
        )}
        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
          Starts {program.start_date} · {program.duration_weeks} weeks
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
        {initialWeeks.map((week) => (
          <button
            key={week.id}
            onClick={() => setActiveWeekId(week.id)}
            style={{
              border: "1px solid var(--line)",
              background: activeWeekId === week.id ? "var(--moss-deep)" : "var(--card)",
              color: activeWeekId === week.id ? "var(--card)" : "var(--ink)",
              borderRadius: 6,
              padding: "6px 12px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Week {week.week_number}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
        {DAYS.map((day) => (
          <button
            key={day.value}
            onClick={() => setActiveDay(day.value)}
            style={{
              border: "1px solid var(--line)",
              background: activeDay === day.value ? "var(--ink)" : "var(--card)",
              color: activeDay === day.value ? "var(--card)" : "var(--ink)",
              borderRadius: 6,
              padding: "6px 12px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {day.label}
          </button>
        ))}
      </div>

      {dayRows.length === 0 && (
        <div className="empty-state" style={{ marginBottom: 16 }}>
          No exercises assigned for {activeWeek ? `Week ${activeWeek.week_number}` : "this week"} on this day yet.
        </div>
      )}

      {dayRows.map((row) => {
        const exercise = allExercises.find((ex) => ex.id === row.exercise_id);
        const candidates = pickerFor === row.id ? swapCandidates(exercise) : [];
        return (
          <div key={row.id} className="card" style={{ marginBottom: 12, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{exercise?.name}</div>
                <div className="muted">{mainMuscle(exercise)} · {exercise?.equipment_type}</div>
              </div>
              <button
                onClick={() => (pickerFor === row.id ? closePicker() : openPicker(row.id))}
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--moss-deep)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Swap exercise
              </button>
            </div>

            {pickerFor === row.id && (
              <div style={{ marginTop: 12, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
                  Showing {mainMuscle(exercise)} exercises only
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <select
                    value={equipmentFilter}
                    onChange={(e) => setEquipmentFilter(e.target.value)}
                    style={{ ...selectStyle, flex: 1 }}
                  >
                    {equipmentOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt === "all" ? "Any equipment" : opt}
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  placeholder="Search exercises..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    border: "1px solid var(--line)",
                    borderRadius: 6,
                    fontSize: 13,
                    marginBottom: 8,
                  }}
                />
                <div style={{ maxHeight: 180, overflowY: "auto" }}>
                  {candidates.length === 0 && (
                    <div className="muted" style={{ fontSize: 13, padding: "8px 4px" }}>
                      No matches for that equipment.
                    </div>
                  )}
                  {candidates.map((ex) => (
                    <div
                      key={ex.id}
                      onClick={() => swapExercise(row.id, ex.id)}
                      style={{
                        padding: "8px 4px",
                        borderBottom: "1px solid var(--line)",
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      {ex.name}
                      <span className="muted" style={{ marginLeft: 6 }}>
                        {ex.equipment_type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: "var(--steel)" }}>Sets</label>
                <input
                  type="number"
                  defaultValue={row.sets}
                  onBlur={(e) => updateRow(row.id, { sets: parseInt(e.target.value) || 0 })}
                  style={smallInputStyle}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: "var(--steel)" }}>Reps</label>
                <input
                  type="text"
                  defaultValue={row.reps_target}
                  onBlur={(e) => updateRow(row.id, { reps_target: e.target.value })}
                  style={smallInputStyle}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: "var(--steel)" }}>Weight</label>
                <input
                  type="text"
                  defaultValue={row.weight}
                  onBlur={(e) => updateRow(row.id, { weight: e.target.value })}
                  style={smallInputStyle}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: "var(--steel)" }}>RPE</label>
                <input
                  type="number"
                  step="0.5"
                  defaultValue={row.target_rpe ?? ""}
                  onBlur={(e) =>
                    updateRow(row.id, {
                      target_rpe: e.target.value ? parseFloat(e.target.value) : null,
                    })
                  }
                  style={smallInputStyle}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: "var(--steel)" }}>% 1RM</label>
                <input
                  type="number"
                  step="1"
                  defaultValue={row.target_percentage ?? ""}
                  onBlur={(e) =>
                    updateRow(row.id, {
                      target_percentage: e.target.value ? parseFloat(e.target.value) : null,
                    })
                  }
                  style={smallInputStyle}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: "var(--steel)" }}>Rest (sec)</label>
                <input
                  type="number"
                  step="5"
                  defaultValue={row.rest_seconds ?? ""}
                  onBlur={(e) =>
                    updateRow(row.id, {
                      rest_seconds: e.target.value ? parseInt(e.target.value, 10) : null,
                    })
                  }
                  style={smallInputStyle}
                />
              </div>
            </div>

            <button
              onClick={() => deleteRow(row.id)}
              style={{
                marginTop: 10,
                fontSize: 12,
                color: "var(--rust)",
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
            >
              Remove exercise
            </button>

            {savingId === row.id && (
              <div style={{ fontSize: 11, color: "var(--steel)", marginTop: 4 }}>Saving...</div>
            )}
          </div>
        );
      })}

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Add an exercise</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <select
            value={muscleFilter}
            onChange={(e) => {
              setMuscleFilter(e.target.value);
              setPickerFor("add");
            }}
            style={{ ...selectStyle, flex: 1 }}
          >
            {muscleOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt === "all" ? "Any muscle" : opt}
              </option>
            ))}
          </select>
          <select
            value={equipmentFilter}
            onChange={(e) => {
              setEquipmentFilter(e.target.value);
              setPickerFor("add");
            }}
            style={{ ...selectStyle, flex: 1 }}
          >
            {equipmentOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt === "all" ? "Any equipment" : opt}
              </option>
            ))}
          </select>
        </div>
        <input
          placeholder="Search exercises..."
          value={pickerFor === "add" ? search : ""}
          onFocus={() => setPickerFor("add")}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            padding: "8px 10px",
            border: "1px solid var(--line)",
            borderRadius: 6,
            fontSize: 13,
            marginBottom: 8,
          }}
        />
        {pickerFor === "add" && (
          <div style={{ maxHeight: 180, overflowY: "auto" }}>
            {addCandidates.length === 0 && (
              <div className="muted" style={{ fontSize: 13, padding: "8px 4px" }}>
                No matches.
              </div>
            )}
            {addCandidates.map((ex) => (
              <div
                key={ex.id}
                onClick={() => addExercise(ex.id)}
                style={{
                  padding: "8px 4px",
                  borderBottom: "1px solid var(--line)",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {ex.name}
                <span className="muted" style={{ marginLeft: 6 }}>
                  {mainMuscle(ex)} · {ex.equipment_type}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
          Push to client&apos;s calendar
        </div>
        <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
          Generates dated workouts from this program. Safe to re-run after edits —
          it replaces previously generated entries for this program.
        </div>
        <button
          onClick={generateCalendar}
          disabled={generating}
          style={{
            border: "none",
            background: "var(--ink)",
            color: "var(--card)",
            borderRadius: 6,
            padding: "10px 16px",
            fontSize: 13,
            fontWeight: 700,
            cursor: generating ? "default" : "pointer",
            opacity: generating ? 0.6 : 1,
          }}
        >
          {generating ? "Generating..." : "Generate Calendar"}
        </button>
        {generateMessage && (
          <div style={{ fontSize: 13, marginTop: 10 }}>{generateMessage}</div>
        )}
      </div>
    </div>
  );
}
