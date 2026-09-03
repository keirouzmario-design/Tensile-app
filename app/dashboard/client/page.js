import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/app/sign-out-button";

export default async function ClientDashboard() {
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

  if (profile?.role !== "client") redirect("/dashboard/coach");

  return (
    <div>
      <div className="top-bar">
        <span className="wordmark">TENSILE</span>
        <SignOutButton />
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 20px" }}>
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>Hi {profile?.full_name}</h1>
        <p className="muted" style={{ marginBottom: 24 }}>
          Client dashboard
        </p>

        <div className="empty-state">
          You&apos;re not linked to a coach yet, and plans haven&apos;t been built
          into the app yet either — both are coming in the next build stage.
        </div>
      </div>
    </div>
  );
}
