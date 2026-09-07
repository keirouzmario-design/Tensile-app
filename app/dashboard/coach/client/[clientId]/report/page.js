import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const RECOMMENDATION_LABELS = {
  increase: "↑ Increasing weight",
  hold: "→ Holding steady",
  decrease: "↓ Decreasing weight (missed rep target)",
  flag_pain: "⚠ Pain or discomfort reported",
};

const RECOMMENDATION_COLORS = {
  increase: "var(--moss-deep)",
  hold: "var(--steel)",
  decrease: "var(--amber)",
  flag_pain: "var(--rust)",
};

const REASON_LABELS = {
  failure: "Reached failure",
  pain: "Pain or discomfort",
  form: "Form broke down",
  other: "Other",
};

function startOfWeek() {
  const now = new Date();
  const day = now.getDay();
  const start = new Date(now);
  start.setDate(now.getDate() - day);
  start.setHours(0, 0, 0, 0);
  return start;
}

export default async function WeeklyReportPage({ params }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: link } = await supabase
    .from("coach_client_links")
    .select("coach_id")
    .eq("client_id", params.clientId)
    .eq("coach_id", user.id)
    .maybeSingle();

  if (!link) redirect("/dashboard/coach");

  const { data: clientProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", params.clientId)
    .single();

  const weekStart = startOfWeek();
  const weekStartStr = weekStart.toISOString().split("T")[0];
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const weekEndStr = weekEnd.toISOString().split("T")[0];

  const { data: plan } = await supabase
    .from("workout_plan_exercises")
    .select("day_of_week")
    .eq("client_id", params.clientId);

  const planDays = [...new Set((plan || []).map((r) => r.day_of_week))].sort();

  const { data: logSets } = await supabase
    .from("workout_log_sets")
    .select("day_of_week, session_date")
    .eq("client_id", params.clientId)
    .gte("session_date", weekStartStr);

  const loggedDays = new Set((logSets || []).map((r) => r.day_of_week));

  const { data: adjustments } = await supabase
    .from("workout_adjustments")
    .select("*, exercises(name)")
    .eq("client_id", params.clientId)
    .gte("created_at", weekStart.toISOString())
    .order("created_at", { ascending: false });

  const seenExercise = new Set();
  const latestAdjustments = [];
  for (const adj of adjustments || []) {
    if (seenExercise.has(adj.exercise_id)) continue;
    seenExercise.add(adj.exercise_id);
    latestAdjustments.push(adj);
  }

  const flaggedItems = (adjustments || []).filter((a) => a.flagged);

  const { data: missedSets } = await supabase
    .from("workout_log_sets")
    .select("*, exercises(name)")
    .eq("client_id", params.clientId)
    .gte("session_date", weekStartStr)
    .not("shortfall_reason", "is", null);

  return (
    <div>
      <h2 style={{ fontSize: 18, marginBottom: 4 }}>
        Weekly Report — {clientProfile?.full_name}
      </h2>
      <p className="muted" style={{ marginBottom: 20 }}>
        {weekStartStr} to {weekEndStr}
      </p>

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>
          Sessions this week
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {planDays.map((d) => (
            <div
              key={d}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 700,
                background: loggedDays.has(d) ? "var(--moss-deep)" : "var(--card)",
                color: loggedDays.has(d) ? "var(--card)" : "var(--steel)",
                border: "1px solid var(--line)",
              }}
            >
              {DAYS[d]} {loggedDays.has(d) ? "✓" : ""}
            </div>
          ))}
        </div>
      </div>

      {flaggedItems.length > 0 && (
        <div className="card" style={{ padding: 16, marginBottom: 16, borderColor: "var(--rust)" }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: "var(--rust)" }}>
            Needs your attention
          </div>
          {flaggedItems.map((item, i) => (
            <div
              key={item.id}
              style={{
                paddingTop: i === 0 ? 0 : 10,
                marginTop: i === 0 ? 0 : 10,
                borderTop: i === 0 ? "none" : "1px solid var(--line)",
              }}
            >
              <div style={{ fontWeight: 600 }}>{item.exercises?.name}</div>
              <div style={{ fontSize: 13, color: RECOMMENDATION_COLORS[item.recommendation] }}>
                {RECOMMENDATION_LABELS[item.recommendation]}
              </div>
            </div>
          ))}
        </div>
      )}

      {missedSets && missedSets.length > 0 && (
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>
            Missed-minimum sets this week
          </div>
          {missedSets.map((s, i) => (
            <div
              key={s.id}
              style={{
                paddingTop: i === 0 ? 0 : 8,
                marginTop: i === 0 ? 0 : 8,
                borderTop: i === 0 ? "none" : "1px solid var(--line)",
                fontSize: 13,
              }}
            >
              <span style={{ fontWeight: 600 }}>{s.exercises?.name}</span> — set{" "}
              {s.set_number}: {s.reps_logged} reps ({REASON_LABELS[s.shortfall_reason] || s.shortfall_reason})
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ padding: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>
          Progression this week
        </div>
        {latestAdjustments.length === 0 && (
          <div className="muted" style={{ fontSize: 13 }}>
            No logged sessions yet this week.
          </div>
        )}
        {latestAdjustments.map((item, i) => (
          <div
            key={item.id}
            style={{
              paddingTop: i === 0 ? 0 : 8,
              marginTop: i === 0 ? 0 : 8,
              borderTop: i === 0 ? "none" : "1px solid var(--line)",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span style={{ fontSize: 13 }}>{item.exercises?.name}</span>
            <span
              style={{ fontSize: 13, fontWeight: 700, color: RECOMMENDATION_COLORS[item.recommendation] }}
            >
              {RECOMMENDATION_LABELS[item.recommendation]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
