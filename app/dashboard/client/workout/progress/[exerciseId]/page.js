import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function parseWeightValue(weightStr) {
  if (!weightStr) return null;
  const match = weightStr.trim().match(/^(\d+(\.\d+)?)\s*(.*)$/);
  if (!match) return null;
  return { value: parseFloat(match[1]), suffix: match[3] || "" };
}

function formatDateLabel(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function ExerciseProgressPage({ params }) {
  const { exerciseId } = params;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: exercise } = await supabase
    .from("exercises")
    .select("id, name")
    .eq("id", exerciseId)
    .single();

  if (!exercise) redirect("/dashboard/client/workout/progress");

  const { data: pr } = await supabase
    .from("personal_records")
    .select("*")
    .eq("client_id", user.id)
    .eq("exercise_id", exerciseId)
    .maybeSingle();

  const { data: logs } = await supabase
    .from("workout_log_sets")
    .select("session_date, set_number, reps_logged, weight_logged, effort, shortfall_reason")
    .eq("client_id", user.id)
    .eq("exercise_id", exerciseId)
    .order("session_date", { ascending: true });

  // Group logged sets by session_date
  const sessionsByDate = {};
  for (const log of logs || []) {
    if (!log.session_date) continue;
    if (!sessionsByDate[log.session_date]) sessionsByDate[log.session_date] = [];
    sessionsByDate[log.session_date].push(log);
  }

  const sessions = Object.entries(sessionsByDate)
    .map(([date, sets]) => {
      let topWeight = null;
      let totalVolume = 0;
      let suffix = "";
      for (const s of sets) {
        const parsed = parseWeightValue(s.weight_logged);
        if (parsed) {
          suffix = parsed.suffix;
          totalVolume += parsed.value * (s.reps_logged || 0);
          if (topWeight === null || parsed.value > topWeight) {
            topWeight = parsed.value;
          }
        }
      }
      return {
        date,
        sets: sets.sort((a, b) => a.set_number - b.set_number),
        topWeight,
        totalVolume: Math.round(totalVolume * 10) / 10,
        suffix,
      };
    })
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  // Build a simple SVG line chart of top weight per session over time
  const chartPoints = sessions.filter((s) => s.topWeight !== null);
  let chartSvg = null;
  if (chartPoints.length >= 2) {
    const width = 320;
    const height = 100;
    const padding = 10;
    const weights = chartPoints.map((s) => s.topWeight);
    const minW = Math.min(...weights);
    const maxW = Math.max(...weights);
    const range = maxW - minW || 1;

    const coords = chartPoints.map((s, i) => {
      const x =
        chartPoints.length === 1
          ? width / 2
          : padding + (i / (chartPoints.length - 1)) * (width - padding * 2);
      const y =
        height - padding - ((s.topWeight - minW) / range) * (height - padding * 2);
      return { x, y };
    });

    const pathD = coords
      .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
      .join(" ");

    chartSvg = (
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
        <path d={pathD} fill="none" stroke="var(--moss-deep)" strokeWidth="2" />
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r="3" fill="var(--moss-deep)" />
        ))}
      </svg>
    );
  }

  return (
    <div>
      <a
        href="/dashboard/client/workout/progress"
        className="muted"
        style={{ textDecoration: "none", fontSize: 13 }}
      >
        ← Back to progress
      </a>

      <h2 style={{ fontSize: 18, marginTop: 8, marginBottom: 4 }}>{exercise.name}</h2>

      {pr && (
        <p className="muted" style={{ marginBottom: 20 }}>
          Current PR: <strong style={{ color: "var(--moss-deep)" }}>{pr.weight_display}</strong>{" "}
          × {pr.reps} reps ({pr.session_date})
        </p>
      )}

      {sessions.length === 0 ? (
        <div className="empty-state">
          No logged sessions for this exercise yet.
        </div>
      ) : (
        <>
          {chartSvg && (
            <div className="card" style={{ padding: 16, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>
                Top weight over time
              </div>
              {chartSvg}
            </div>
          )}

          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>
              Session history
            </div>
            {sessions
              .slice()
              .reverse()
              .map((session, i) => (
                <div
                  key={session.date}
                  style={{
                    paddingTop: i === 0 ? 0 : 12,
                    marginTop: i === 0 ? 0 : 12,
                    borderTop: i === 0 ? "none" : "1px solid var(--line)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: 13 }}>
                      {formatDateLabel(session.date)}
                    </span>
                    {session.topWeight !== null && (
                      <span style={{ fontSize: 13, color: "var(--moss-deep)", fontWeight: 700 }}>
                        Top: {session.topWeight} {session.suffix}
                      </span>
                    )}
                  </div>
                  {session.sets.map((s) => (
                    <div
                      key={s.set_number}
                      className="muted"
                      style={{ fontSize: 12, marginBottom: 2 }}
                    >
                      Set {s.set_number}: {s.reps_logged} reps
                      {s.weight_logged ? ` @ ${s.weight_logged}` : ""}
                      {s.shortfall_reason ? ` — ${s.shortfall_reason}` : ""}
                    </div>
                  ))}
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
