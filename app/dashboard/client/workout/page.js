import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getAccessStatus(packageEndDate) {
  if (!packageEndDate) return "pending";
  const today = new Date().toISOString().split("T")[0];
  return packageEndDate >= today ? "active" : "expired";
}

// CORE_MUSCLES: the muscle(s) literally located at/in each body part. These
// are the only muscles allowed to disqualify a replacement exercise.
const CORE_MUSCLES = {
  chest: ["chest"], back: ["back"], shoulders: ["shoulders"], biceps: ["biceps"],
  triceps: ["triceps"], forearms: ["forearms"], lats: ["lats"], traps: ["traps"],
  quads: ["quads"], hamstrings: ["hamstrings"], glutes: ["glutes"], calves: ["calves"],
  core: ["core"], obliques: ["core"], hip_flexors: ["quads"], adductors: ["quads"],
  abductors: ["glutes"], rotator_cuff: ["shoulders"], neck: ["traps", "shoulders"],
  upper_back_spine: ["back", "traps"], lower_back_spine: ["back", "core"],
  shoulder_joint: ["shoulders"], elbow: ["biceps", "triceps"], wrist: ["forearms"],
  hip: ["glutes"], knee: ["quads", "hamstrings"], ankle: ["calves"], foot: ["calves"],
  jaw_tmj: [], ribs_sternum: ["chest", "core"], collarbone: ["shoulders"],
  hand_fingers: ["forearms"], toes: ["calves"], achilles_tendon: ["calves"],
  groin: ["quads"], tailbone: ["core"], cardiovascular: [], respiratory: [],
  pregnancy: [], general: [], neurological_balance: [], digestive: [],
  diabetes_bloodsugar: [],
};

// TRIGGER_MUSCLES: broader set used only to DETECT which exercises are
// affected (includes muscles that get secondary stress, e.g. chest press
// loading the shoulder). Never used to disqualify a replacement.
const TRIGGER_MUSCLES = {
  chest: ["chest"], back: ["back"], shoulders: ["shoulders", "chest", "triceps"],
  biceps: ["biceps"], triceps: ["triceps"], forearms: ["forearms"], lats: ["lats"],
  traps: ["traps"], quads: ["quads"], hamstrings: ["hamstrings"], glutes: ["glutes"],
  calves: ["calves"], core: ["core"], obliques: ["core"], hip_flexors: ["quads", "core"],
  adductors: ["quads", "glutes"], abductors: ["glutes"],
  rotator_cuff: ["shoulders", "chest", "back", "triceps"], neck: ["traps", "shoulders"],
  upper_back_spine: ["back", "lats", "traps"], lower_back_spine: ["back", "core"],
  shoulder_joint: ["shoulders", "chest", "back", "biceps", "triceps", "lats"],
  elbow: ["biceps", "triceps", "forearms"], wrist: ["forearms"],
  hip: ["glutes", "quads", "hamstrings", "core"],
  knee: ["quads", "hamstrings", "glutes", "calves"],
  ankle: ["calves", "quads", "hamstrings", "glutes", "core"],
  foot: ["calves", "quads", "hamstrings", "glutes", "core"], jaw_tmj: [],
  ribs_sternum: ["chest", "back", "core"], collarbone: ["shoulders", "chest", "back"],
  hand_fingers: ["forearms"], toes: ["calves"],
  achilles_tendon: ["calves", "quads", "hamstrings", "glutes"],
  groin: ["quads", "glutes", "hamstrings"], tailbone: ["core", "glutes"],
  cardiovascular: [], respiratory: [], pregnancy: [], general: [],
  neurological_balance: [], digestive: [], diabetes_bloodsugar: [],
};

const SAFER_EQUIPMENT = ["machine", "cable"];

function muscleSet(ex) {
  return new Set(ex?.muscle_groups || []);
}

function overlapsAny(muscles, targetSet) {
  for (const m of muscles) {
    if (targetSet.has(m)) return true;
  }
  return false;
}

export default async function ClientWorkoutView() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: link } = await supabase
    .from("coach_client_links")
    .select("package_end_date")
    .eq("client_id", user.id)
    .maybeSingle();

  const status = getAccessStatus(link?.package_end_date);

  if (status !== "active") {
    return (
      <div className="empty-state">
        Your workout plan will appear here once your package is active.
      </div>
    );
  }

  const { data: plan } = await supabase
    .from("workout_plan_exercises")
    .select("*, exercises(id, name, muscle_groups, equipment_type)")
    .eq("client_id", user.id);

  const { data: injuries } = await supabase
    .from("client_injuries")
    .select("*")
    .eq("client_id", user.id)
    .eq("active", true);

  const activeInjuries = injuries || [];
  const hasGlobalRest = activeInjuries.some((i) => i.resolved_action === "global_rest");

  if (hasGlobalRest) {
    return (
      <div className="empty-state">
        Your workout is paused while you recover — an active injury or health
        note requires full rest. Once your coach or you mark it resolved,
        your plan will reappear here.
      </div>
    );
  }

  const hardRestrict = new Set();
  const modifyCore = new Set();
  const softFlag = new Set();

  for (const inj of activeInjuries) {
    const core = CORE_MUSCLES[inj.body_part] || [];
    const trigger = TRIGGER_MUSCLES[inj.body_part] || [];
    const secondary = trigger.filter((m) => !core.includes(m));

    if (inj.resolved_action === "local_rest") {
      core.forEach((m) => hardRestrict.add(m));
    } else if (inj.resolved_action === "local_modify") {
      core.forEach((m) => modifyCore.add(m));
    }
    secondary.forEach((m) => softFlag.add(m));
  }

  const needExerciseList = hardRestrict.size > 0 || modifyCore.size > 0 || softFlag.size > 0;
  let allExercises = [];
  if (needExerciseList) {
    const { data } = await supabase
      .from("exercises")
      .select("id, name, muscle_groups, equipment_type");
    allExercises = data || [];
  }

  function findSafeAlternate(primaryMuscle, excludeId, usedInDay, requireSaferEquipment) {
    return allExercises.find((a) => {
      if (a.id === excludeId) return false;
      if (usedInDay.has(a.id)) return false;
      if (a.muscle_groups?.[0] !== primaryMuscle) return false;
      if (requireSaferEquipment && !SAFER_EQUIPMENT.includes(a.equipment_type)) return false;
      return !overlapsAny(muscleSet(a), hardRestrict);
    });
  }

  function resolveDisplay(row, usedInDay) {
    const ex = row.exercises;
    const exMuscles = muscleSet(ex);
    const primaryMuscle = ex?.muscle_groups?.[0];

    if (overlapsAny(exMuscles, hardRestrict)) {
      const alt = findSafeAlternate(primaryMuscle, ex.id, usedInDay, false);
      if (alt) {
        usedInDay.add(alt.id);
        return { exercise: alt, swapped: true };
      }
      return { skipped: true, original: ex };
    }

    if (overlapsAny(exMuscles, modifyCore)) {
      if (!SAFER_EQUIPMENT.includes(ex?.equipment_type)) {
        const alt = findSafeAlternate(primaryMuscle, ex.id, usedInDay, true);
        if (alt) {
          usedInDay.add(alt.id);
          return { exercise: alt, modified: true };
        }
        return { exercise: ex, caution: true };
      }
      return { exercise: ex };
    }

    if (overlapsAny(exMuscles, softFlag)) {
      if (!SAFER_EQUIPMENT.includes(ex?.equipment_type)) {
        const alt = findSafeAlternate(primaryMuscle, ex.id, usedInDay, true);
        if (alt) {
          usedInDay.add(alt.id);
          return { exercise: alt, modified: true };
        }
        return { exercise: ex, caution: true };
      }
      return { exercise: ex };
    }

    return { exercise: ex };
  }

  return (
    <div>
      <h2 style={{ fontSize: 18, marginBottom: 12 }}>Your Workout Plan</h2>
      {DAYS.map((label, idx) => {
        const rows = (plan || [])
          .filter((r) => r.day_of_week === idx)
          .sort((a, b) => a.order_index - b.order_index);
        if (rows.length === 0) return null;
        const usedInDay = new Set();
        return (
          <div key={idx} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--steel)", marginBottom: 6 }}>
              {label.toUpperCase()}
            </div>
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              {rows.map((r, i) => {
                const display = resolveDisplay(r, usedInDay);
                return (
                  <div
                    key={r.id}
                    style={{ padding: "12px 16px", borderTop: i === 0 ? "none" : "1px solid var(--line)" }}
                  >
                    {display.skipped ? (
                      <div>
                        <div style={{ fontWeight: 600, color: "var(--steel)" }}>
                          {display.original?.name}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--rust)", fontWeight: 700 }}>
                          Skipped — no safe alternative available for your injury
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontWeight: 600 }}>{display.exercise?.name}</div>
                        <div className="muted">
                          {r.sets} sets × {r.reps_target} {r.weight ? `@ ${r.weight}` : ""}
                        </div>
                        {display.swapped && (
                          <div style={{ fontSize: 12, color: "var(--amber)", fontWeight: 700, marginTop: 2 }}>
                            Swapped — safer alternative for your injury
                          </div>
                        )}
                        {display.modified && (
                          <div style={{ fontSize: 12, color: "var(--amber)", fontWeight: 700, marginTop: 2 }}>
                            Modified for injury recovery
                          </div>
                        )}
                        {display.caution && (
                          <div style={{ fontSize: 12, color: "var(--rust)", fontWeight: 700, marginTop: 2 }}>
                            Use caution — no gentler alternative found
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
