import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/app/sign-out-button";
import ConfirmPackageButton from "./confirm-package-button";

function getAccessStatus(packageEndDate) {
  if (!packageEndDate) return "pending";
  const today = new Date().toISOString().split("T")[0];
  return packageEndDate >= today ? "active" : "expired";
}

function startOfWeek() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day; // shift back to Monday
  const start = new Date(now);
  start.setDate(now.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toDateStr(d) {
  return d.toISOString().split("T")[0];
}

export default async function CoachDashboard() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "coach") redirect("/dashboard/client");

  const { data: links } = await supabase
    .from("coach_client_links")
    .select("client_id, package_end_date, profiles:client_id (full_name, injuries)")
    .eq("coach_id", user.id);

  const { data: pendingRequests } = await supabase
    .from("package_requests")
    .select("*")
    .eq("coach_id", user.id)
    .eq("confirmed", false)
    .order("created_at", { ascending: false });

  const { data: planRows } = await supabase
    .from("workout_plan_exercises")
    .select("client_id")
    .eq("coach_id", user.id);

  const clientsWithPlans = new Set((planRows || []).map((r) => r.client_id));

  const weekStart = startOfWeek();
  const weekStartStr = toDateStr(weekStart);
  const weekEndStr = toDateStr(addDays(weekStart, 6));
  const todayStr = toDateStr(new Date());

  // Scheduled sessions this week (distinct dates per client)
  const { data: scheduledRows } = await supabase
    .from("workout_plan_exercises")
    .select("client_id, session_date")
    .eq("coach_id", user.id)
    .gte("session_date", weekStartStr)
    .lte("session_date", weekEndStr)
    .not("session_date", "is", null);

  const scheduledDatesByClient = {};
  for (const row of scheduledRows || []) {
    if (!scheduledDatesByClient[row.client_id]) scheduledDatesByClient[row.client_id] = new Set();
    scheduledDatesByClient[row.client_id].add(row.session_date);
  }

  // Logged sessions this week (distinct dates per client)
  const { data: loggedRows } = await supabase
    .from("workout_log_sets")
    .select("client_id, session_date")
    .eq("coach_id", user.id)
    .gte("session_date", weekStartStr)
    .lte("session_date", weekEndStr)
    .not("session_date", "is", null);

  const loggedDatesByClient = {};
  for (const row of loggedRows || []) {
    if (!loggedDatesByClient[row.client_id]) loggedDatesByClient[row.client_id] = new Set();
    loggedDatesByClient[row.client_id].add(row.session_date);
  }

  // Flagged items TODAY ONLY, per client — clears itself automatically each new day
  const { data: flaggedRows } = await supabase
    .from("workout_adjustments")
    .select("client_id")
    .eq("coach_id", user.id)
    .eq("flagged", true)
    .eq("session_date", todayStr);

  const flaggedCountByClient = {};
  for (const row of flaggedRows || []) {
    flaggedCountByClient[row.client_id] = (flaggedCountByClient[row.client_id] || 0) + 1;
  }

  const enrichedLinks = (links || []).map((l) => {
    const scheduled = scheduledDatesByClient[l.client_id]?.size || 0;
    const logged = loggedDatesByClient[l.client_id]?.size || 0;
    const flagged = flaggedCountByClient[l.client_id] || 0;
    return { ...l, scheduled, logged, flagged };
  });

  // Sort: flagged clients first, then lowest adherence, then alphabetical
  enrichedLinks.sort((a, b) => {
    if (a.flagged !== b.flagged) return b.flagged - a.flagged;
    const adherenceA = a.scheduled > 0 ? a.logged / a.scheduled : 1;
    const adherenceB = b.scheduled > 0 ? b.logged / b.scheduled : 1;
    if (adherenceA !== adherenceB) return adherenceA - adherenceB;
    return (a.profiles?.full_name || "").localeCompare(b.profiles?.full_name || "");
  });

  const totalFlagged = enrichedLinks.reduce((sum, l) => sum + l.flagged, 0);

  return (
    <div>
      <div className="top-bar">
        <span className="wordmark">TENSILE</span>
        <SignOutButton />
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 20px" }}>
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>Welcome, {profile?.full_name}</h1>
        <p className="muted" style={{ marginBottom: 4 }}>
          Coach dashboard
        </p>
        {totalFlagged > 0 && (
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--rust)", marginBottom: 20 }}>
            {totalFlagged} flagged item{totalFlagged !== 1 ? "s" : ""} from today need your attention
          </p>
        )}
        {totalFlagged === 0 && <div style={{ marginBottom: 20 }} />}

        <div style={{ fontSize: 12, color: "var(--steel)", fontWeight: 600, marginBottom: 8 }}>
          YOUR CLIENTS
        </div>

        {enrichedLinks.length > 0 ? (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {enrichedLinks.map((l, i) => {
              const status = getAccessStatus(l.package_end_date);
              const pendingRequest = (pendingRequests || []).find(
                (r) => r.client_id === l.client_id
              );
              const hasExistingPlan = clientsWithPlans.has(l.client_id);

              return (
                <div
                  key={l.client_id}
                  style={{
                    padding: "14px 20px",
                    borderTop: i === 0 ? "none" : "1px solid var(--line)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 10,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>{l.profiles?.full_name}</div>
                      <div
                        style={{
                          fontSize: 12,
                          marginTop: 2,
                          color:
                            status === "active"
                              ? "var(--moss)"
                              : status === "expired"
                              ? "var(--rust)"
                              : "var(--steel)",
                        }}
                      >
                        {status === "active" && `Active until ${l.package_end_date}`}
                        {status === "expired" && `Expired ${l.package_end_date}`}
                        {status === "pending" && "Pending — no package yet"}
                      </div>
                    </div>

                    {status === "active" && (
                      <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        {l.scheduled > 0 && (
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: "3px 8px",
                              borderRadius: 999,
                              background: l.logged >= l.scheduled ? "var(--moss-deep)" : "var(--card)",
