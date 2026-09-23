"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { saveProgramToLibrary } from "@/lib/supabase/save-program-to-library";

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
  const [savingToLibrary, setSavingToLibrary] = useState(false);
  const [libraryName, setLibraryName] = useState("");
  const [showLibraryPrompt, setShowLibraryPrompt] = useState(false);
  const [libraryMessage, setLibraryMessage] = useState("");
  const [showLoadPrompt, setShowLoadPrompt] = useState(false);
  const [librarySessions, setLibrarySessions] = useState(null);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [loadMessage, setLoadMessage] = useState("");

  // Program-level (multi-week) Library state
  const [showProgramLibraryPrompt, setShowProgramLibraryPrompt] = useState(false);
  const [programLibraryName, setProgramLibraryName] = useState("");
  const [savingProgramToLibrary, setSavingProgramToLibrary] = useState(false);
  const [programLibraryMessage, setProgramLibraryMessage] = useState("");
  const [showLoadProgramPrompt, setShowLoadProgramPrompt] = useState(false);
  const [libraryPrograms, setLibraryPrograms] = useState(null);
  const [loadingProgramLibrary, setLoadingProgramLibrary] = useState(false);
  const [loadProgramMessage, setLoadProgramMessage] = useState("");

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

  async function saveDayToLibrary() {
    if (!libraryName.trim()) {
      setLibraryMessage("Please enter a name for this saved session.");
      return;
    }
    if (dayRows.length === 0) {
      setLibraryMessage("This day has no exercises to save yet.");
      return;
    }

    setSavingToLibrary(true);
    setLibraryMessage("");

    const { data: librarySession, error: sessionError } = await supabase
      .from("library_sessions")
      .insert({
        coach_id: coachId,
        name: libraryName.trim(),
      })
      .select()
      .single();

    if (sessionError) {
      setSavingToLibrary(false);
      setLibraryMessage(`Error: ${sessionError.message}`);
      return;
    }

    const exerciseRows = dayRows.map((row) => ({
      library_session_id: librarySession.id,
      exercise_id: row.exercise_id,
      sets: row.sets,
      reps_target: row.reps_target,
      weight: row.weight,
      target_rpe: row.target_rpe,
      target_percentage: row.target_percentage,
      rest_seconds: row.rest_seconds,
      order_index: row.order_index,
    }));

    const { error: exercisesError } = await supabase
      .from("library_session_exercises")
      .insert(exerciseRows);

    setSavingToLibrary(false);

    if (exercisesError) {
      setLibraryMessage(`Error: ${exercisesError.message}`);
      return;
    }

    setLibraryMessage(`Saved "${libraryName.trim()}" to your Library.`);
    setLibraryName("");
    setShowLibraryPrompt(false);
  }

  async function openLoadPrompt() {
    setShowLoadPrompt(true);
    setLoadMessage("");
    if (librarySessions === null) {
      setLoadingLibrary(true);
      const { data, error } = await supabase
        .from("library_sessions")
        .select("*, library_session_exercises(count)")
        .eq("coach_id", coachId)
        .order("created_at", { ascending: false });
      setLoadingLibrary(false);
      if (error) {
        setLoadMessage(`Error: ${error.message}`);
        return;
      }
      setLibrarySessions(data || []);
    }
  }

  async function loadSessionIntoDay(librarySessionId) {
    if (!activeWeekId) return;

    setLoadingLibrary(true);
    setLoadMessage("");

    const { data: savedExercises, error } = await supabase
      .from("library_session_exercises")
      .select("*")
      .eq("library_session_id", librarySessionId)
      .order("order_index", { ascending: true });

    if (error) {
      setLoadingLibrary(false);
      setLoadMessage(`Error: ${error.message}`);
      return;
    }

    const startOrder = dayRows.length;
    const newRows = (savedExercises || []).map((ex, idx) => ({
      program_week_id: activeWeekId,
      day_of_week: activeDay,
      exercise_id: ex.exercise_id,
      sets: ex.sets,
      reps_target: ex.reps_target,
      weight: ex.weight,
      target_rpe: ex.target_rpe,
      target_percentage: ex.target_percentage,
      rest_seconds: ex.rest_seconds,
      order_index: startOrder + idx,
    }));

    const { error: insertError } = await supabase
      .from("program_exercises")
      .insert(newRows);

    setLoadingLibrary(false);

    if (insertError) {
      setLoadMessage(`Error: ${insertError.message}`);
      return;
    }

    setShowLoadPrompt(false);
    router.refresh();
  }

  // Save the ENTIRE active program (all weeks, all days, all exercises) to the Library
  async function saveWholeProgramToLibrary() {
    if (!programLibraryName.trim()) {
      setProgramLibraryMessage("Please enter a name for this saved program.");
      return;
    }

    setSavingProgramToLibrary(true);
    setProgramLibraryMessage("");

    try {
      await saveProgramToLibrary(program.id, programLibraryName.trim(), "");
      setProgramLibraryMessage(`Saved "${programLibraryName.trim()}" to your Library.`);
      setProgramLibraryName("");
      setShowProgramLibraryPrompt(false);
    } catch (err) {
      setProgramLibraryMessage(`Error: ${err.message}`);
    }

    setSavingProgramToLibrary(false);
  }

  async function openLoadProgramPrompt() {
    setShowLoadProgramPrompt(true);
    setLoadProgramMessage("");
    if (libraryPrograms === null) {
      setLoadingProgramLibrary(true);
      const { data, error } = await supabase
        .from("library_programs")
        .select("*, library_program_weeks(count)")
        .eq("coach_id", coachId)
        .order("created_at", { ascending: false });
      setLoadingProgramLibrary(false);
      if (error) {
        setLoadProgramMessage(`Error: ${error.message}`);
        return;
      }
      setLibraryPrograms(data || []);
    }
  }

  // Copies every week + exercise from a saved library program into the
  // currently active program. If the active program already has a week
  // with that week number, exercises are added into it; otherwise a new
  // week is created. Existing exercises are never deleted or overwritten.
  async function loadProgramFromLibrary(libraryProgramId) {
    setLoadingProgramLibrary(true);
    setLoadProgramMessage("");

    const { data: libWeeks, error: weeksError } = await supabase
      .from("library_program_weeks")
      .select("id, week_number")
      .eq("library_program_id", libraryProgramId)
      .order("week_number", { ascending: true });

    if (weeksError) {
      setLoadingProgramLibrary(false);
      setLoadProgramMessage(`Error: ${weeksError.message}`);
      return;
    }

    if (!libWeeks || libWeeks.length === 0) {
      setLoadingProgramLibrary(false);
      setLoadProgramMessage("That saved program has no weeks to load.");
      return;
    }

    const libWeekIds = libWeeks.map((w) => w.id);
    const { data: libExercises, error: exercisesError } = await supabase
      .from("library_program_exercises")
      .select("*")
      .in("library_program_week_id", libWeekIds)
      .order("order_index", { ascending: true });

    if (exercisesError) {
      setLoadingProgramLibrary(false);
      setLoadProgramMessage(`Error: ${exercisesError.message}`);
      return;
    }

    // Map each library week to a real program_weeks row, creating new
    // weeks as needed if this client's program has fewer weeks already.
    const weekIdMap = {};
    for (const libWeek of libWeeks) {
      let matchingWeek = initialWeeks.find((w) => w.week_number === libWeek.week_number);

      if (!matchingWeek) {
        const { data: newWeek, error: newWeekError } = await supabase
          .from("program_weeks")
          .insert({
            program_id: program.id,
            week_number: libWeek.week_number,
          })
          .select()
          .single();

        if (newWeekError) {
          setLoadingProgramLibrary(false);
          setLoadProgramMessage(`Error: ${newWeekError.message}`);
          return;
        }
        matchingWeek = newWeek;
      }

      weekIdMap[libWeek.id] = matchingWeek.id;
    }

    const newRows = (libExercises || []).map((ex) => ({
      program_week_id: weekIdMap[ex.library_program_week_id],
      day_of_week: ex.day_of_week,
      exercise_id: ex.exercise_id,
      sets: ex.sets,
      reps_target: ex.reps_target,
      weight: ex.weight,
      target_rpe: ex.target_rpe,
      target_percentage: ex.target_percentage,
      rest_seconds: ex.rest_seconds,
      order_index: ex.order_index,
    }));

    if (newRows.length > 0) {
      const { error: insertError } = await supabase
        .from("program_exercises")
        .insert(newRows);

      if (insertError) {
        setLoadingProgramLibrary(false);
        setLoadProgramMessage(`Error: ${insertError.message}`);
        return;
      }
    }

    setLoadingProgramLibrary(false);
    setShowLoadProgramPrompt(false);
    router.refresh();
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

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {!showProgramLibraryPrompt && (
          <button
            onClick={() => {
              setShowProgramLibraryPrompt(true);
              setProgramLibraryMessage("");
            }}
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--moss-deep)",
              background: "none",
              border: "1px solid var(--line)",
              borderRadius: 6,
              padding: "6px 12px",
              cursor: "pointer",
            }}
          >
            Save whole program to Library
          </button>
        )}
        {!showLoadProgramPrompt && (
          <button
            onClick={openLoadProgramPrompt}
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--moss-deep)",
              background: "none",
              border: "1px solid var(--line)",
              borderRadius: 6,
              padding: "6px 12px",
              cursor: "pointer",
            }}
          >
            Load program from Library
          </button>
        )}
      </div>

      {showProgramLibraryPrompt && (
        <div className="card" style={{ padding: 12, marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: "var(--steel)" }}>
            Name this saved program
          </label>
          <input
            type="text"
            placeholder="e.g. 12-Week Strength Block"
            value={programLibraryName}
            onChange={(e) => setProgramLibraryName(e.target.value)}
            style={{ ...smallInputStyle, marginTop: 4, marginBottom: 8 }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={saveWholeProgramToLibrary}
              disabled={savingProgramToLibrary}
              style={{
                border: "none",
                background: "var(--ink)",
                color: "var(--card)",
                borderRadius: 6,
                padding: "8px 14px",
                fontSize: 13,
                fontWeight: 700,
                cursor: savingProgramToLibrary ? "default" : "pointer",
              }}
            >
              {savingProgramToLibrary ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => {
                setShowProgramLibraryPrompt(false);
                setProgramLibraryMessage("");
              }}
              style={{
                border: "1px solid var(--line)",
                background: "var(--card)",
                color: "var(--ink)",
                borderRadius: 6,
                padding: "8px 14px",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
          {programLibraryMessage && (
            <div style={{ fontSize: 12, marginTop: 8 }}>{programLibraryMessage}</div>
          )}
        </div>
      )}

      {showLoadProgramPrompt && (
        <div className="card" style={{ padding: 12, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
            Pick a saved program to load into {program.name}
          </div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
            Matching weeks will be filled in; missing weeks will be added.
            Nothing already in this program gets removed.
          </div>
          {loadingProgramLibrary && (
            <div className="muted" style={{ fontSize: 13 }}>Loading...</div>
          )}
          {!loadingProgramLibrary && libraryPrograms && libraryPrograms.length === 0 && (
            <div className="muted" style={{ fontSize: 13 }}>
              You haven't saved any programs to your Library yet.
            </div>
          )}
          {!loadingProgramLibrary &&
            libraryPrograms &&
            libraryPrograms.map((lp) => (
              <div
                key={lp.id}
                onClick={() => loadProgramFromLibrary(lp.id)}
                style={{
                  padding: "10px 4px",
                  borderBottom: "1px solid var(--line)",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                <span style={{ fontWeight: 600, color: "var(--moss-deep)" }}>{lp.name}</span>
                <span className="muted" style={{ marginLeft: 6 }}>
                  {lp.library_program_weeks?.[0]?.count || 0} weeks
                </span>
              </div>
            ))}
          <button
            onClick={() => {
              setShowLoadProgramPrompt(false);
              setLoadProgramMessage("");
            }}
            style={{
              marginTop: 10,
              border: "1px solid var(--line)",
              background: "var(--card)",
              color: "var(--ink)",
              borderRadius: 6,
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          {loadProgramMessage && (
            <div style={{ fontSize: 12, marginTop: 8 }}>{loadProgramMessage}</div>
          )}
        </div>
      )}

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

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {dayRows.length > 0 && !showLibraryPrompt && (
          <button
            onClick={() => {
              setShowLibraryPrompt(true);
              setLibraryMessage("");
            }}
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--moss-deep)",
              background: "none",
              border: "1px solid var(--line)",
              borderRadius: 6,
              padding: "6px 12px",
              cursor: "pointer",
            }}
          >
            Save this day to Library
          </button>
        )}
        {!showLoadPrompt && (
          <button
            onClick={openLoadPrompt}
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--moss-deep)",
              background: "none",
              border: "1px solid var(--line)",
              borderRadius: 6,
              padding: "6px 12px",
              cursor: "pointer",
            }}
          >
            Load from Library
          </button>
        )}
      </div>

      {showLibraryPrompt && (
        <div className="card" style={{ padding: 12, marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: "var(--steel)" }}>
            Name this saved session
          </label>
          <input
            type="text"
            placeholder="e.g. Push Day"
            value={libraryName}
            onChange={(e) => setLibraryName(e.target.value)}
            style={{ ...smallInputStyle, marginTop: 4, marginBottom: 8 }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={saveDayToLibrary}
              disabled={savingToLibrary}
              style={{
                border: "none",
                background: "var(--ink)",
                color: "var(--card)",
                borderRadius: 6,
                padding: "8px 14px",
                fontSize: 13,
                fontWeight: 700,
                cursor: savingToLibrary ? "default" : "pointer",
              }}
            >
              {savingToLibrary ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => {
                setShowLibraryPrompt(false);
                setLibraryMessage("");
              }}
              style={{
                border: "1px solid var(--line)",
                background: "var(--card)",
                color: "var(--ink)",
                borderRadius: 6,
                padding: "8px 14px",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
          {libraryMessage && (
            <div style={{ fontSize: 12, marginTop: 8 }}>{libraryMessage}</div>
          )}
        </div>
      )}

      {showLoadPrompt && (
        <div className="card" style={{ padding: 12, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
            Pick a saved session to add to{" "}
            {activeWeek ? `Week ${activeWeek.week_number}` : "this week"},{" "}
            {DAYS.find((d) => d.value === activeDay)?.label}
          </div>
          {loadingLibrary && (
            <div className="muted" style={{ fontSize: 13 }}>Loading...</div>
          )}
          {!loadingLibrary && librarySessions && librarySessions.length === 0 && (
            <div className="muted" style={{ fontSize: 13 }}>
              You haven't saved any sessions to your Library yet.
            </div>
          )}
          {!loadingLibrary &&
            librarySessions &&
            librarySessions.map((ls) => (
              <div
                key={ls.id}
                onClick={() => loadSessionIntoDay(ls.id)}
                style={{
                  padding: "10px 4px",
                  borderBottom: "1px solid var(--line)",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                <span style={{ fontWeight: 600, color: "var(--moss-deep)" }}>{ls.name}</span>
                <span className="muted" style={{ marginLeft: 6 }}>
                  {ls.library_session_exercises?.[0]?.count || 0} exercises
                </span>
              </div>
            ))}
          <button
            onClick={() => {
              setShowLoadPrompt(false);
              setLoadMessage("");
            }}
            style={{
              marginTop: 10,
              border: "1px solid var(--line)",
              background: "var(--card)",
              color: "var(--ink)",
              borderRadius: 6,
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          {loadMessage && (
            <div style={{ fontSize: 12, marginTop: 8 }}>{loadMessage}</div>
          )}
        </div>
      )}

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
