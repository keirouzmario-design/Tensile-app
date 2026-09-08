import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LogForm from "./log-form";
import LogErrorBoundary from "./error-boundary";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getAccessStatus(packageEndDate) {
  if (!packageEndDate) return "pending";
  const today = new Date().toISOString().split("T")[0];
  return packageEndDate >= today ? "active" : "expired";
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

export default async function LogDayPage({ searchParams }) {
  const dayIndex = parseInt(searchParams?.day, 10);
  if (isNaN(dayIndex) || dayIndex < 0 || dayIndex > 6) {
    redirect("/dashboard/client/workout");
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: link } = await supabase
    .from("coach_client_links")
    .select("coach_id, package_end_date")
    .eq("client_id", user.id)
    .maybeSingle();

  const status = getAccessStatus(link?.package_end_date);
  if (status !== "active") {
    redirect("/dashboard/client/workout");
  }

  const { data: plan } = await supabase
    .from("workout_plan_exercises")
    .select("*, exercises(id, name, muscle_groups, equipment_type, joint_stress, video_url, instructions)")
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
        Logging is paused while you're on full rest for an active injury.
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
      .select("id, name, muscle_groups, equipment_type, joint_stress, video_url, instructions");
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
        return { exercise: alt };
      }
      return { skipped: true };
    }

    const needsModify =
      overlapsAny(exMuscles, modifyMuscles) || overlapsAny(exJoints, modifyJoints);

    if (needsModify && !SAFER_EQUIPMENT.includes(ex?.equipment_type)) {
      const alt = findSafeAlternate(primaryMuscle, ex.id, usedInDay, true);
      if (alt) {
        usedInDay.add(alt.id);
        return { exercise: alt };
      }
    }

    return { exercise: ex };
  }

  const usedThisWeek = new Set(
    (plan || []).map((r) => r.exercises?.id).filter(Boolean)
  );

  const dayRows = (plan || [])
    .filter((r) => r.day_of_week === dayIndex)
    .sort((a, b) => a.order_index - b.order_index);

  const resolvedRows = [];
  for (const row of dayRows) {
    const display = resolveDisplay(row, usedThisWeek);
    if (display.skipped) continue;
    resolvedRows.push({ row, exercise: display.exercise });
  }

  const exerciseIds = resolvedRows.map((r) => r.exercise.id);
  let lastSetDataByExercise = {};
  if (exerciseIds.length > 0) {
    const { data: recentLogs } = await supabase
      .from("workout_log_sets")
      .select("exercise_id, set_number, reps_logged, effort, shortfall_reason, session_date")
      .eq("client_id", user.id)
      .in("exercise_id", exerciseIds)
      .order("session_date", { ascending: false });

    const latestSessionDateByExercise = {};
    for (const log of recentLogs || []) {
      if (!(log.exercise_id in latestSessionDateByExercise)) {
        latestSessionDateByExercise[log.exercise_id] = log.session_date;
      }
    }
    for (const log of recentLogs || []) {
      if (log.session_date === latestSessionDateByExercise[log.exercise_id]) {
        if (!lastSetDataByExercise[log.exercise_id]) lastSetDataByExercise[log.exercise_id] = {};
        lastSetDataByExercise[log.exercise_id][log.set_number] = {
          reps: log.reps_logged,
          effort: log.effort,
          reason: log.shortfall_reason,
        };
      }
    }
  }

  const items = resolvedRows.map(({ row, exercise }) => ({
    rowId: row.id,
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    sets: row.sets,
    repsTarget: row.reps_target,
    weight: row.weight || "",
    equipmentType: exercise.equipment_type || "",
    videoUrl: exercise.video_url || "",
    instructions: exercise.instructions || "",
    lastSets: lastSetDataByExercise[exercise.id] || {},
  }));

  return (
    <div>
      <h2 style={{ fontSize: 18, marginBottom: 4 }}>Log {DAYS[dayIndex]}&apos;s Workout</h2>
      <p className="muted" style={{ marginBottom: 16 }}>
        Enter what you actually did for each set.
      </p>
      {items.length === 0 ? (
        <div className="empty-state">
          Nothing to log today — all exercises are skipped due to an active
          injury.
        </div>
      ) : (
        <LogErrorBoundary>
          <LogForm
            items={items}
            clientId={user.id}
            coachId={link.coach_id}
            dayOfWeek={dayIndex}
          />
        </LogErrorBoundary>
      )}
    </div>
  );
}
