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
    .select("full_name")
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
        <h1 style={{ fontSize: 22, marginTop: 8, marginBottom: 24 }}>
          {clientProfile?.full_name}&apos;s Workout Plan
        </h1>

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
