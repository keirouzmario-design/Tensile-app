import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/app/sign-out-button";

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
    .select("client_id, profiles:client_id (full_name)")
    .eq("coach_id", user.id);

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
            {links.map((l, i) => (
              <div
                key={l.client_id}
                style={{
                  padding: "14px 20px",
                  borderTop: i === 0 ? "none" : "1px solid var(--line)",
                }}
              >
                {l.profiles?.full_name}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            You don&apos;t have any clients linked yet. Client invites and plan
            assignment are coming in the next build stage.
          </div>
        )}
      </div>
    </div>
  );
}
