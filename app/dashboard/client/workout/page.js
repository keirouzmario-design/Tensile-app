import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getAccessStatus(packageEndDate) {
  if (!packageEndDate) return "pending";
  const today = new Date().toISOString().split("T")[0];
  return packageEndDate >= today ? "active" : "expired";
}

// Maps each reportable body part to the exercise muscle groups it affects.
// Joints that bear weight while standing (ankle, knee, hip, foot, achilles)
// are broadened to include the major standing/leg muscles, since e.g. an
// ankle sprain rules out squats and lunges too, not just calf work.
const INJURY_MUSCLE_MAP = {
  chest: ["chest"],
  back: ["back"],
  shoulders: ["shoulders"],
  biceps: ["biceps"],
  triceps: ["triceps"],
  forearms: ["forearms"],
  lats: ["lats"],
  traps: ["traps"],
  quads: ["quads"],
  hamstrings: ["hamstrings"],
  glutes: ["glutes"],
  calves: ["calves"],
  core: ["core"],
  obliques: ["core"],
  hip_flexors: ["quads", "core"],
  adductors: ["quads", "glutes"],
  abductors: ["glutes"],
  rotator_cuff: ["shoulders"],
  neck: ["traps", "shoulders"],
  upper_back_spine: ["back", "lats", "traps"],
  lower_back_spine: ["back", "core"],
  shoulder_joint: ["shoulders", "chest", "back", "biceps", "triceps", "lats"],
  elbow: ["biceps", "triceps", "forearms"],
  wrist: ["forearms"],
  hip: ["glutes", "quads", "hamstrings", "core"],
  knee: ["quads", "hamstrings", "glutes", "calves"],
  ankle: ["calves", "quads", "hamstrings", "glutes", "core"],
  foot: ["calves", "quads", "hamstrings", "glutes", "core"],
  jaw_tmj: [],
  ribs_sternum: ["chest", "back", "core"],
  collarbone: ["shoulders", "chest", "back"],
  hand_fingers: ["forearms"],
  toes: ["calves"],
  achilles_tendon: ["calves", "quads", "hamstrings", "glutes"],
  groin: ["quads", "glutes", "hamstrings"],
  tailbone: ["core", "glutes"],
  cardiovascular: [],
  respiratory: [],
  pregnancy: [],
  general: [],
  neurological_balance: [],
  digestive: [],
  diabetes_bloodsugar: [],
};

const SAFER_EQUIPMENT = ["machine", "cable"];

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

  const restrictedMuscles = new Set();
  const modifyMuscles = new Set();
  for (const inj of activeInjuries) {
    const muscles = INJURY_MUSCLE_MAP[inj.body_part] || [];
    if (inj.resolved_action === "local_rest") {
      muscles.forEach((m) => restrictedMuscles.add(m));
    } else if (inj.resolved_action === "local_modify") {
      muscles.forEach((m) => modifyMuscles.add(m));
    }
  }

  let allExercises = [];
  if (modifyMuscles.size > 0) {
    const { data } = await supabase
      .from("exercises")
      .select("id, name, muscle_groups, equipment_type");
    allExercises = data || [];
  }

  function resolveDisplay(row) {
    const ex = row.exercises;
    const muscle = ex?.muscle_groups?.[0];

    if (restrictedMuscles.has(muscle)) {
      return { skipped: true };
    }

    if (modifyMuscles.has(muscle) && !SAFER_EQUIPMENT.includes(ex?.equipment_type)) {
      const alt = allExercises.find(
        (a) =>
          a.id !== ex.id &&
          a.muscle_groups?.[0] === muscle &&
          SAFER_EQUIPMENT.includes(a.equipment_type)
      );
      if (alt) return { exercise: alt, modified: true };
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
        return (
          <div key={idx} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--steel)", marginBottom: 6 }}>
              {label.toUpperCase()}
            </div>
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              {rows.map((r, i) => {
                const display = resolveDisplay(r);
                return (
                  <div
                    key={r.id}
                    style={{ padding: "12px 16px", borderTop: i === 0 ? "none" : "1px solid var(--line)" }}
                  >
                    {display.skipped ? (
                      <div>
                        <div style={{ fontWeight: 600, color: "var(--steel)" }}>
                          {r.exercises?.name}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--rust)", fontWeight: 700 }}>
                          Skipped — recovering from injury
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontWeight: 600 }}>{display.exercise?.name}</div>
                        <div className="muted">
                          {r.sets} sets × {r.reps_target} {r.weight ? `@ ${r.weight}` : ""}
                        </div>
                        {display.modified && (
                          <div style={{ fontSize: 12, color: "var(--amber)", fontWeight: 700, marginTop: 2 }}>
                            Modified for injury recovery
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
