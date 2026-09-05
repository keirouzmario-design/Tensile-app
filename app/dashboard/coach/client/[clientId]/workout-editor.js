"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function WorkoutEditor({ clientId, coachId, initialPlan, allExercises }) {
  const supabase = createClient();
  const router = useRouter();
  const [activeDay, setActiveDay] = useState(0);
  const [pickerFor, setPickerFor] = useState(null);
  const [search, setSearch] = useState("");
  const [equipmentFilter, setEquipmentFilter] = useState("all");
  const [muscleFilter, setMuscleFilter] = useState("all");
  const [savingId, setSavingId] = useState(null);

  const dayRows = initialPlan
    .filter((r) => r.day_of_week === activeDay)
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
    await supabase.from("workout_plan_exercises").update(fields).eq("id", id);
    setSavingId(null);
    router.refresh();
  }

  async function deleteRow(id) {
    await supabase.from("workout_plan_exercises").delete().eq("id", id);
    router.refresh();
  }

  async function addExercise(exerciseId) {
    const nextOrder = dayRows.length;
    await supabase.from("workout_plan_exercises").insert({
      client_id: clientId,
      coach_id: coachId,
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

  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
        {DAYS.map((label, idx) => (
          <button
            key={idx}
            onClick={() => setActiveDay(idx)}
            style={{
              border: "1px solid var(--line)",
              background: activeDay === idx ? "var(--ink)" : "var(--card)",
              color: activeDay === idx ? "var(--card)" : "var(--ink)",
              borderRadius: 6,
              padding: "6px 12px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {dayRows.length === 0 && (
        <div className="empty-state" style={{ marginBottom: 16 }}>
          No exercises assigned for this day yet.
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
                  type="text"
                  defaultValue={row.reps_target}
                  onBlur={(e) => updateRow(row.id, { reps_target: e.target.value })}
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
                <label style={{ fontSize: 11, color: "var(--steel)" }}>Weight</label>
                <input
                  type="text"
                  defaultValue={row.weight}
                  onBlur={(e) => updateRow(row.id, { weight: e.target.value })}
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

      <div className="card" style={{ padding: 16 }}>
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
    </div>
  );
}
