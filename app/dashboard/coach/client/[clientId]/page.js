import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/app/sign-out-button";
import WorkoutEditor from "./workout-editor";

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
    .select("full_name, injuries")
    .eq("id", clientId)
    .single();

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
        <h1 style={{ fontSize: 22, marginTop: 8, marginBottom: 12 }}>
          {clientProfile?.full_name}&apos;s Workout Plan
        </h1>

        {clientProfile?.injuries && (
          <div
            style={{
              marginBottom: 20,
              fontSize: 13,
              color: "var(--amber)",
              background: "#F3E9DC",
              borderRadius: 8,
              padding: "10px 14px",
            }}
          >
            Injury note: {clientProfile.injuries}
          </div>
        )}

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
