import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function parseWeightValue(weightStr) {
  if (!weightStr) return null;
  const match = weightStr.trim().match(/^(\d+(\.\d+)?)\s*(.*)$/);
  if (!match) return null;
  return { value: parseFloat(match[1]), suffix: match[3] || "" };
}

function startOfWeek() {
  const now = new Date();
  const day = now.getDay();
  const start = new Date(now);
  start.setDate(now.getDate() - day);
  start.setHours(0, 0, 0, 0);
  return start;
}

export default async function ProgressPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: prs } = await supabase
    .from("personal_records")
    .select("*, exercises(name)")
    .eq("client_id", user.id)
    .order("weight_value", { ascending: false });

  const weekStart = startOfWeek();
  const weekStartStr = weekStart.toISOString().split("T")[0];

  const { data: logs } = await supabase
    .from("workout_log_sets")
    .select("exercise_id, weight_logged, reps_logged, exercises(name)")
    .eq("client_id", user.id)
    .gte("session_date", weekStartStr);

  const volumeByExercise = {};
  for (const log of logs || []) {
    const parsed = parseWeightValue(log.weight_logged);
    if (!parsed) continue;
    const vol = parsed.value * (log.reps_logged || 0);
    if (!volumeByExercise[log.exercise_id]) {
      volumeByExercise[log.exercise_id] = {
        name: log.exercises?.name,
        total: 0,
        suffix: parsed.suffix,
      };
    }
    volumeByExercise[log.exercise_id].total += vol;
  }
  const volumeList = Object.values(volumeByExercise).sort((a, b) => b.total - a.total);

  return (
    <div>
      <h2 style={{ fontSize: 18, marginBottom: 4 }}>Your Progress</h2>
      <p className="muted" style={{ marginBottom: 20 }}>
        Personal records and this week's training volume.
      </p>

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>
          Personal Records
        </div>
        {(!prs || prs.length === 0) && (
          <div className="muted" style={{ fontSize: 13 }}>
            No PRs yet — log a workout to start tracking.
          </div>
        )}
        {(prs || []).map((pr, i) => (
          <div
            key={pr.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingTop: i === 0 ? 0 : 8,
              marginTop: i === 0 ? 0 : 8,
              borderTop: i === 0 ? "none" : "1px solid var(--line)",
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{pr.exercises?.name}</div>
              <div className="muted" style={{ fontSize: 12 }}>
                {pr.reps} reps · {pr.session_date}
              </div>
            </div>
            <div style={{ fontWeight: 700, color: "var(--moss-deep)" }}>
              {pr.weight_display}
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>
          This Week's Volume
        </div>
        {volumeList.length === 0 && (
          <div className="muted" style={{ fontSize: 13 }}>
            No sets logged yet this week.
          </div>
        )}
        {volumeList.map((v, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: "space-between",
              paddingTop: i === 0 ? 0 : 8,
              marginTop: i === 0 ? 0 : 8,
              borderTop: i === 0 ? "none" : "1px solid var(--line)",
              fontSize: 13,
            }}
          >
            <span>{v.name}</span>
            <span style={{ fontWeight: 700 }}>
              {Math.round(v.total * 10) / 10} {v.suffix} total
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
