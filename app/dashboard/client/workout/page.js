import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getAccessStatus(packageEndDate) {
  if (!packageEndDate) return "pending";
  const today = new Date().toISOString().split("T")[0];
  return packageEndDate >= today ? "active" : "expired";
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
    .select("*, exercises(name, muscle_groups, equipment_type)")
    .eq("client_id", user.id);

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
              {rows.map((r, i) => (
                <div
                  key={r.id}
                  style={{ padding: "12px 16px", borderTop: i === 0 ? "none" : "1px solid var(--line)" }}
                >
                  <div style={{ fontWeight: 600 }}>{r.exercises?.name}</div>
                  <div className="muted">
                    {r.sets} sets × {r.reps_target} {r.weight ? `@ ${r.weight}` : ""}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
