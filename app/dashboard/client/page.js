import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/app/sign-out-button";

function getAccessStatus(packageEndDate) {
  if (!packageEndDate) return "pending";
  const today = new Date().toISOString().split("T")[0];
  return packageEndDate >= today ? "active" : "expired";
}

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

  const { data: link } = await supabase
    .from("coach_client_links")
    .select("package_end_date, profiles:coach_id (full_name)")
    .eq("client_id", user.id)
    .maybeSingle();

  const status = getAccessStatus(link?.package_end_date);

  return (
    <div>
      <div className="top-bar">
        <span className="wordmark">TENSILE</span>
        <SignOutButton />
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 20px" }}>
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>Hi {profile?.full_name}</h1>
        <p className="muted" style={{ marginBottom: 24 }}>
          {link?.profiles?.full_name
            ? `Coached by ${link.profiles.full_name}`
            : "Client dashboard"}
        </p>

        {status === "active" && (
          <div className="empty-state">
            Your package is active until {link.package_end_date}. Meal and
            workout plans aren&apos;t built into the app yet — coming in the
            next build stage.
          </div>
        )}

        {status === "pending" && (
          <div className="empty-state">
            Your coach hasn&apos;t activated your package yet. Once payment
            is confirmed, your plans will appear here.
          </div>
        )}

        {status === "expired" && (
          <div className="empty-state">
            Your package expired on {link.package_end_date}. Contact your
            coach to renew.
          </div>
        )}
      </div>
    </div>
  );
}
