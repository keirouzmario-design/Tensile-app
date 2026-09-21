import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ExerciseItem from "./exercise-item";

function getAccessStatus(packageEndDate) {
  if (!packageEndDate) return "pending";
  const today = new Date().toISOString().split("T")[0];
  return packageEndDate >= today ? "active" : "expired";
}

function getWeekStart(dateStr) {
  const d = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day; // shift back to Monday
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return monday.toISOString().split("T")[0];
}

function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

function formatDayLabel(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  const weekday = d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
  const monthDay = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${weekday} · ${monthDay}`;
}

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

const BODY_PART_JOINT = {
  shoulders: "shoulder", shoulder_joint: "shoulder", rotator_cuff: "shoulder",
  collarbone: "shoulder", elbow: "elbow", wrist: "wrist", hand_fingers: "wrist",
  knee: "knee", hip: "hip", groin: "hip", adductors: "hip", abductors: "hip",
  hip_flexors: "hip", ankle: "ankle", foot: "ankle", achilles_tendon: "ankle",
  toes: "ankle", lower_back_spine: "lower_back", tailbone: "lower_back",
};

const SAFER_EQUIPMENT = ["machine", "cable"];

function muscleSet(ex) {
  return new Set(ex?.muscle_groups || []);
}

function jointSet(ex) {
  return new Set(ex?.joint_stress || []);
}

function overlapsAny(items, targetSet) {
  for (const m of items) {
    if (targetSet.has(m)) return true;
  }
  return false;
}

export default async function ClientWorkoutView({ searchParams }) {
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

  const weekStart = getWeekStart(searchParams?.week);
  const weekEnd = addDays(weekStart, 6);
  const prevWeek = addDays(weekStart, -7);
  const nextWeek = addDays(weekStart, 7);

  const { data: plan } = await supabase
    .from("workout_plan_exercises")
    .select("*, exercises(id, name, muscle_groups, equipment_type, joint_stress, gif_url, instructions, video_url)")
    .eq("client_id", user.id)
    .gte("session_date", weekStart)
    .lte("session_date", weekEnd)
    .order("session_date", { ascending: true });

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

  const hardRestrictMuscles = new Set();
  const hardRestrictJoints = new Set();
  const modifyMuscles = new Set();
  const modifyJoints = new Set();

  for (const inj of activeInjuries) {
    const muscles = CORE_MUSCLES[inj.body_part] || [];
    const joint = BODY_PART_JOINT[inj.body_part];

    if (inj.resolved_action === "local_rest") {
      muscles.forEach((m) => hardRestrictMuscles.add(m));
      if (joint) hardRestrictJoints.add(joint);
    } else if (inj.resolved_action === "local_modify") {
      muscles.forEach((m) => modifyMuscles.add(m));
      if (joint) modifyJoints.add(joint);
    }
  }

  const needExerciseList =
    hardRestrictMuscles.size > 0 ||
    hardRestrictJoints.size > 0 ||
    modifyMuscles.size > 0 ||
    modifyJoints.size > 0;

  let allExercises = [];
  if (needExerciseList) {
    const { data } = await supabase
      .from("exercises")
      .select("id, name, muscle_groups, equipment_type, joint_stress, gif_url, instructions, video_url")
      .order("id", { ascending: true });
    allExercises = data || [];
  }

  function isSafeFromHardRestrict(a) {
    return (
      !overlapsAny(muscleSet(a), hardRestrictMuscles) &&
      !overlapsAny(jointSet(a), hardRestrictJoints)
    );
  }

  function findSafeAlternate(primaryMuscle, excludeId, usedInDay, requireSaferEquipment) {
    return allExercises.find((a) => {
      if (a.id === excludeId) return false;
      if (usedInDay.has(a.id)) return false;
      if (a.muscle_groups?.[0] !== primaryMuscle) return false;
      if (requireSaferEquipment && !SAFER_EQUIPMENT.includes(a.equipment_type)) return false;
      return isSafeFromHardRestrict(a);
    });
  }

  function resolveDisplay(row, usedInDay) {
    const ex = row.exercises;
    const exMuscles = muscleSet(ex);
    const exJoints = jointSet(ex);
    const primaryMuscle = ex?.muscle_groups?.[0];

    const isHardRestricted =
      overlapsAny(exMuscles, hardRestrictMuscles) || overlapsAny(exJoints, hardRestrictJoints);

    if (isHardRestricted) {
      const alt = findSafeAlternate(primaryMuscle, ex.id, usedInDay, false);
      if (alt) {
        usedInDay.add(alt.id);
        return { exercise: alt, swapped: true };
      }
      return { skipped: true, original: ex };
    }

    const needsModify =
      overlapsAny(exMuscles, modifyMuscles) || overlapsAny(exJoints, modifyJoints);

    if (needsModify) {
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

  const usedThisWeek = new Set(
    (plan || []).map((r) => r.exercises?.id).filter(Boolean)
  );

  // Group rows by their actual session_date (not day_of_week)
  const byDate = {};
  for (const row of plan || []) {
    if (!row.session_date) continue;
    if (!byDate[row.session_date]) byDate[row.session_date] = [];
    byDate[row.session_date].push(row);
  }

  const datesInWeek = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <h2 style={{ fontSize: 18 }}>Your Workout Plan</h2>
        <a
          href="/dashboard/client/workout/progress"
          style={{ fontSize: 12, fontWeight: 700, color: "var(--moss-deep)" }}
        >
          View progress →
        </a>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <a
          href={`/dashboard/client/workout?week=${prevWeek}`}
          style={{ fontSize: 13, fontWeight: 700, color: "var(--moss-deep)" }}
        >
          ← Prev week
        </a>
        <div className="muted" style={{ fontSize: 13, fontWeight: 700 }}>
          {formatDayLabel(weekStart)} – {formatDayLabel(weekEnd)}
        </div>
        <a
          href={`/dashboard/client/workout?week=${nextWeek}`}
          style={{ fontSize: 13, fontWeight: 700, color: "var(--moss-deep)" }}
        >
          Next week →
        </a>
      </div>

      {datesInWeek.every((d) => !byDate[d]) && (
        <div className="empty-state">
          No workouts scheduled for this week.
        </div>
      )}

      {datesInWeek.map((dateStr) => {
        const rows = (byDate[dateStr] || []).slice().sort((a, b) => a.order_index - b.order_index);
        if (rows.length === 0) return null;
        return (
          <div key={dateStr} style={{ marginBottom: 16 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 6,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--steel)" }}>
                {formatDayLabel(dateStr)}
              </div>
              <a
                href={`/dashboard/client/workout/log?date=${dateStr}`}
                style={{ fontSize: 12, fontWeight: 700, color: "var(--moss-deep)" }}
              >
                Log this day →
              </a>
            </div>
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              {rows.map((r, i) => {
                const display = resolveDisplay(r, usedThisWeek);
                return (
                  <div
                    key={r.id}
                    style={{ padding: "12px 16px", borderTop: i === 0 ? "none" : "1px solid var(--line)" }}
                  >
                    {display.skipped ? (
                      <div>
                        <ExerciseItem
                          name={display.original?.name}
                          gifUrl={display.original?.gif_url}
                          instructions={display.original?.instructions}
                          videoUrl={display.original?.video_url}
                        />
                        <div style={{ fontSize: 12, color: "var(--rust)", fontWeight: 700 }}>
                          Skipped — no safe alternative available for your injury
                        </div>
                      </div>
                    ) : (
                      <div>
                        <ExerciseItem
                          name={display.exercise?.name}
                          gifUrl={display.exercise?.gif_url}
                          instructions={display.exercise?.instructions}
                          videoUrl={display.exercise?.video_url}
                        />
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
