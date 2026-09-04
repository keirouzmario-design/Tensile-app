import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import StartPlanForm from "./start-plan-form";

function getAccessStatus(packageEndDate) {
  if (!packageEndDate) return "pending";
  const today = new Date().toISOString().split("T")[0];
  return packageEndDate >= today ? "active" : "expired";
}

export default async function PackagePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: link } = await supabase
    .from("coach_client_links")
    .select("coach_id, package_end_date")
    .eq("client_id", user.id)
    .maybeSingle();

  const status = getAccessStatus(link?.package_end_date);

  const { data: pendingRequest } = await supabase
    .from("package_requests")
    .select("*")
    .eq("client_id", user.id)
    .eq("confirmed", false)
    .order("created_at", { ascending: false })
    .maybeSingle();

  return (
    <div>
      <h2 style={{ fontSize: 18, marginBottom: 12 }}>Your Package</h2>

      {status === "active" && (
        <div className="empty-state">Active until {link.package_end_date}.</div>
      )}

      {status === "expired" && (
        <div className="empty-state" style={{ marginBottom: 16 }}>
          Your package expired on {link.package_end_date}. Choose a new
          package below to renew.
        </div>
      )}

      {status !== "active" &&
        (pendingRequest ? (
          <div className="empty-state">
            Request sent: {pendingRequest.days_per_week} days/week,{" "}
            {pendingRequest.chat_frequency} chat — ${pendingRequest.price}.
            Waiting for your coach to confirm payment.
          </div>
        ) : link?.coach_id ? (
          <StartPlanForm coachId={link.coach_id} clientId={user.id} />
        ) : (
          <div className="empty-state">You&apos;re not linked to a coach yet.</div>
        ))}
    </div>
  );
}
