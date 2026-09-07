import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/app/sign-out-button";
import WorkoutEditor from "./workout-editor";

const BODY_PART_LABELS = {
  chest: "Chest", back: "Back (muscle)", shoulders: "Shoulders", biceps: "Biceps",
  triceps: "Triceps", forearms: "Forearms", lats: "Lats", traps: "Traps",
  quads: "Quads", hamstrings: "Hamstrings", glutes: "Glutes", calves: "Calves",
  core: "Core / abs", obliques: "Obliques", hip_flexors: "Hip flexors",
  adductors: "Adductors (inner thigh)", abductors: "Abductors (outer hip)",
  rotator_cuff: "Rotator cuff", neck: "Neck",
  upper_back_spine: "Upper back / spine (joint)", lower_back_spine: "Lower back / spine (joint)",
  shoulder_joint: "Shoulder joint", elbow: "Elbow", wrist: "Wrist",
  hip: "Hip", knee: "Knee", ankle: "Ankle", foot: "Foot",
  jaw_tmj: "Jaw / TMJ", ribs_sternum: "Ribs / sternum", collarbone: "Collarbone",
  hand_fingers: "Hand / fingers", toes: "Toes", achilles_tendon: "Achilles tendon",
  groin: "Groin", tailbone: "Tailbone", cardiovascular: "Heart / cardiovascular",
  respiratory: "Breathing / respiratory", pregnancy: "Pregnancy",
  general: "General illness / whole-body recovery",
  neurological_balance: "Neurological / balance issues", digestive: "Digestive / GI",
  diabetes_bloodsugar: "Diabetes / blood sugar",
};

const ACTION_LABELS = {
  global_rest: "Full rest — whole workout paused",
  local_rest: "Avoiding exercises for this area",
  local_modify: "Using modified/gentler exercises",
  no_restriction: "No restrictions",
};

export default async function ClientWorkoutPage({ params }) {
  const { clientId } = params;
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: coachProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (coachProfile?.role !== "coach") redirect("/dashboard/client");

  const { data: clientProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", clientId)
    .single();

  const { data: activeInjuries } = await supabase
    .from("client_injuries")
    .select("*")
    .eq("client_id", clientId)
    .eq("active", true);

  const { data: plan } = await supabase
    .from("workout_plan_exercises")
    .select("*")
    .eq("client_id", clientId)
    .eq("coach_id", user.id);

  const { data: allExercises } = await supabase
    .from("exercises")
    .select("*")
    .order("name", { ascending: true });

  return (
    <div>
      <div className="top-bar">
        <span className="wordmark">TENSILE</span>
        <SignOutButton />
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 20px" }}>
        <a href="/dashboard/coach" className="muted" style={{ textDecoration: "none" }}>
          ← Back to clients
        </a>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 8, marginBottom: 12 }}>
          <h1 style={{ fontSize: 22 }}>
            {clientProfile?.full_name}&apos;s Workout Plan
          </h1>
          <a
            href={`/dashboard/coach/client/${clientId}/report`}
            style={{ fontSize: 13, fontWeight: 700, color: "var(--moss-deep)", whiteSpace: "nowrap" }}
          >
            View weekly report →
          </a>
        </div>

        {(activeInjuries || []).map((inj) => (
          <div
            key={inj.id}
            style={{
              marginBottom: 12,
              fontSize: 13,
              color: "var(--amber)",
              background: "#F3E9DC",
              borderRadius: 8,
              padding: "10px 14px",
            }}
          >
            <div style={{ fontWeight: 700 }}>
              {BODY_PART_LABELS[inj.body_part] || inj.body_part} — {inj.injury_type}
            </div>
            <div>{ACTION_LABELS[inj.resolved_action] || inj.resolved_action}</div>
          </div>
        ))}

        <WorkoutEditor
          clientId={clientId}
          coachId={user.id}
          initialPlan={plan || []}
          allExercises={allExercises || []}
        />
      </div>
    </div>
  );
}
