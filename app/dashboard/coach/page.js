import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/app/sign-out-button";
import ConfirmPackageButton from "./confirm-package-button";

function getAccessStatus(packageEndDate) {
  if (!packageEndDate) return "pending";
  const today = new Date().toISOString().split("T")[0];
  return packageEndDate >= today ? "active" : "expired";
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

  return (
    <div>
      <div className="top-bar">
        <span className="wordmark">TENSILE</span>
        <SignOutButton />
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 20px" }}>
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>Welcome, {profile?.full_name}</h1>
        <p className="muted" style={{ marginBottom: 24 }}>
          Coach dashboard
        </p>

        <div style={{ fontSize: 12, color: "var(--steel)", fontWeight: 600, marginBottom: 8 }}>
          YOUR CLIENTS
        </div>

        {links && links.length > 0 ? (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {links.map((l, i) => {
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
                      alignItems: "center",
                      gap: 12,
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
                  </div>

                  {l.profiles?.injuries && (
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 12,
                        color: "var(--amber)",
                        background: "#F3E9DC",
                        borderRadius: 6,
                        padding: "6px 10px",
                      }}
                    >
                      Injury note: {l.profiles.injuries}
                    </div>
                  )}

                  {pendingRequest && status !== "active" && (
                    <div
                      style={{
                        marginTop: 10,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ fontSize: 12, color: "var(--steel)" }}>
                        Requested: {pendingRequest.days_per_week} days/wk,{" "}
                        {pendingRequest.chat_frequency} chat — ${pendingRequest.price}
                      </div>
                      <ConfirmPackageButton
                        coachId={user.id}
                        clientId={l.client_id}
                        daysPerWeek={pendingRequest.days_per_week}
                        hasExistingPlan={hasExistingPlan}
                      />
                    </div>
                  )}

                  {status === "active" && (
                    <div style={{ marginTop: 10 }}>
                      <ConfirmPackageButton
                        coachId={user.id}
                        clientId={l.client_id}
                        daysPerWeek={pendingRequest?.days_per_week}
                        hasExistingPlan={true}
                      />
                    </div>
                  )}

                  <a
                    href={`/dashboard/coach/client/${l.client_id}`}
                    style={{
                      display: "inline-block",
                      marginTop: 10,
                      fontSize: 12,
                      fontWeight: 700,
                      color: "var(--moss-deep)",
                      textDecoration: "none",
                    }}
                  >
                    View workout plan →
                  </a>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">No clients have signed up yet.</div>
        )}
      </div>
    </div>
  );
}
